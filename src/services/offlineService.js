/**
 * Offline Service
 * 
 * This service handles offline operation queuing and synchronization when connectivity is restored.
 * It provides mechanisms for:
 * 1. Detecting network connectivity changes
 * 2. Storing data locally when offline
 * 3. Syncing data with Supabase when connectivity is restored
 * 4. Managing cached files and database operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';
import logger from './loggerService';

// Constants for AsyncStorage keys
const OFFLINE_QUEUE_KEY = 'groundschool_offline_queue';
const OFFLINE_QUIZZES_KEY = 'groundschool_offline_quizzes';
const OFFLINE_QUESTIONS_KEY = 'groundschool_offline_questions';
const OFFLINE_DOCUMENTS_KEY = 'groundschool_offline_documents';
const OFFLINE_QUIZ_ATTEMPTS_KEY = 'groundschool_offline_quiz_attempts';
const OFFLINE_QUIZ_RESPONSES_KEY = 'groundschool_offline_quiz_responses';

// Temporary file directory for offline files
const OFFLINE_FILES_DIR = `${FileSystem.cacheDirectory}offline_files/`;

// Initialize offline directory
(async () => {
  if (Platform.OS !== 'web') {
    try {
      const dirInfo = await FileSystem.getInfoAsync(OFFLINE_FILES_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(OFFLINE_FILES_DIR, { intermediates: true });
        logger.info('offlineService', 'Created offline files directory');
      }
    } catch (error) {
      logger.error('offlineService', 'Failed to initialize offline files directory', error);
    }
  } else {
    logger.info('offlineService', 'Skipping offline files directory creation on web as FileSystem.cacheDirectory is null.');
  }
})();

/**
 * Network connectivity state and listeners
 */
let isConnected = true;
let networkListeners = [];

// Setup network state listener
NetInfo.addEventListener(eventState => {
  try {
    const wasConnected = isConnected;
    const currentEventIsConnected = eventState && typeof eventState.isConnected === 'boolean' ? eventState.isConnected : false;
    isConnected = currentEventIsConnected;
  
    // Log connectivity changes
    if (wasConnected !== isConnected) {
      logger.info('offlineService', `Network connectivity changed: ${isConnected ? 'ONLINE' : 'OFFLINE'}`);
    
      // Notify listeners of connectivity change
      networkListeners.forEach(listener => {
        try {
          listener(isConnected);
        } catch (error) {
          logger.error('offlineService', 'Error in network listener callback', error);
        }
      });
    
      // If connection was restored, try to sync offline data
      if (isConnected && !wasConnected) {
        syncOfflineData();
      }
    }
  } catch (error) {
    logger.error('offlineService', 'Error processing NetInfo event', error);
    isConnected = false; // Default to offline on error
  }
});

/**
 * Add a listener for network connectivity changes
 * @param {Function} listener - Callback function that receives isConnected boolean
 * @returns {Function} Function to remove the listener
 */
export const addNetworkListener = (listener) => {
  networkListeners.push(listener);
  return () => {
    networkListeners = networkListeners.filter(l => l !== listener);
  };
};

/**
 * Get current network connectivity status
 * @returns {Promise<boolean>} True if connected, false otherwise
 */
let initialWebCheckDone = false; // Flag to ensure override happens only once for web

export const getNetworkStatus = async () => {
  try {
    const state = await NetInfo.fetch();
    let currentFetchedIsConnected = state && typeof state.isConnected === 'boolean' ? state.isConnected : false;

    if (Platform.OS === 'web' && !initialWebCheckDone && !currentFetchedIsConnected) {
      logger.warn('offlineService:getNetworkStatus', 'Initial web NetInfo.fetch reported OFFLINE. Overriding to ONLINE for this first call to aid development boot. Subsequent calls/events will reflect actual status.');
      currentFetchedIsConnected = true; // Override for the very first call on web if offline
      initialWebCheckDone = true; // Ensure this override only happens once
    }

    isConnected = currentFetchedIsConnected; // Update the global isConnected state
    return isConnected;
  } catch (error) {
    logger.error('offlineService:getNetworkStatus', 'Error checking network status', error);
    isConnected = false; // Default to offline on error
    return false;
  }
};

/**
 * Queue an operation to be executed when online
 * @param {string} type - Type of operation (e.g., 'document_upload', 'quiz_attempt')
 * @param {Object} data - Data needed for the operation
 * @returns {Promise<string>} ID of the queued operation
 */
export const queueOperation = async (type, data) => {
  try {
    // Generate a unique ID for this operation
    const operationId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get current queue
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = queueJson ? JSON.parse(queueJson) : [];
    
    // Add new operation to queue
    const operation = {
      id: operationId,
      type,
      data,
      timestamp: Date.now(),
      attempts: 0
    };
    
    queue.push(operation);
    
    // Save updated queue
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    
    logger.info('offlineService:queueOperation', `Operation queued: ${type}`, { operationId });
    return operationId;
  } catch (error) {
    logger.error('offlineService:queueOperation', 'Error queuing operation', error);
    throw new Error(`Failed to queue offline operation: ${error.message}`);
  }
};

/**
 * Remove an operation from the queue
 * @param {string} operationId - ID of the operation to remove
 * @returns {Promise<void>}
 */
export const removeOperation = async (operationId) => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueJson) return;
    
    const queue = JSON.parse(queueJson);
    const updatedQueue = queue.filter(op => op.id !== operationId);
    
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
    logger.info('offlineService:removeOperation', `Operation removed from queue: ${operationId}`);
  } catch (error) {
    logger.error('offlineService:removeOperation', `Error removing operation ${operationId}`, error);
  }
};

/**
 * Sync all offline data with the server
 * @returns {Promise<Object>} Results of the sync operation
 */
export const syncOfflineData = async () => {
  // Assuming 'isConnected' is a module-level variable updated by NetInfo within this file's scope
  if (!isConnected) { 
    logger.info('offlineService:syncOfflineData', 'Cannot sync while offline (checked initial isConnected state).');
    return { success: false, reason: 'offline' };
  }

  let userDetails, authError;

  try {
    logger.info('offlineService:syncOfflineData', 'Attempting to get user for sync...');
    const { data, error } = await supabase.auth.getUser();
    
    userDetails = data?.user; // data itself can be null if error, or data.user can be null
    authError = error;

    if (authError) {
      const errorMessage = authError.message ? authError.message.toLowerCase() : '';
      if (errorMessage.includes('failed to fetch') || errorMessage.includes('err_internet_disconnected') || errorMessage.includes('network request failed')) {
        logger.warn('offlineService:syncOfflineData', 'Network error during user authentication. Sync postponed.', { error: authError });
        return { success: false, reason: 'auth_network_error', error: authError };
      }
      logger.error('offlineService:syncOfflineData', 'Authentication error (non-network related), cannot sync.', { error: authError });
      return { success: false, reason: 'auth_error', error: authError };
    }

    if (!userDetails) {
      logger.error('offlineService:syncOfflineData', 'No authenticated user found after auth attempt (user object is null). Cannot sync.');
      return { success: false, reason: 'no_user', error: new Error('User session not found or expired after auth attempt.') };
    }
    
    logger.info('offlineService:syncOfflineData', 'User authenticated, proceeding with sync for user:', userDetails.id);

    // Pass the authenticated user object to subsequent functions
    const results = await processOperationQueue(userDetails);
    await syncOfflineQuizzes(userDetails);
    await syncOfflineQuizAttempts(userDetails);
    
    logger.info('offlineService:syncOfflineData', 'Offline data synchronization completed successfully.', { results });
    return { success: true, results };

  } catch (error) { // Catches errors from processOperationQueue, syncOfflineQuizzes, etc., or unexpected errors
    logger.error('offlineService:syncOfflineData', 'Unhandled error during main offline data sync process.', { error });
    const errorMessage = error.message ? error.message.toLowerCase() : '';
    if (errorMessage.includes('failed to fetch') || errorMessage.includes('err_internet_disconnected') || errorMessage.includes('network request failed')) {
      logger.warn('offlineService:syncOfflineData', 'Sync failed due to a network error during data processing operations.', { error });
      return { success: false, reason: 'sync_network_error', error };
    }
    return { success: false, reason: 'general_sync_error', error };
  }
};

/**
 * Process the operation queue
 * @param {Object} user - The authenticated user
 * @returns {Promise<Object>} Results of processing the queue
 */
const processOperationQueue = async (user) => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueJson) return { processed: 0, success: 0, failed: 0 };
    
    const queue = JSON.parse(queueJson);
    if (queue.length === 0) return { processed: 0, success: 0, failed: 0 };
    
    logger.info('offlineService:processOperationQueue', `Processing ${queue.length} queued operations`);
    
    let processed = 0;
    let success = 0;
    let failed = 0;
    const remainingOperations = [];
    
    // Process each operation
    for (const operation of queue) {
      try {
        processed++;
        
        // Handle different operation types
        switch (operation.type) {
        case 'document_upload':
          await processDocumentUpload(operation, user);
          success++;
          break;
            
        case 'quiz_attempt_submit':
          await processQuizAttemptSubmit(operation, user);
          success++;
          break;
            
        default:
          logger.warn('offlineService:processOperationQueue', `Unknown operation type: ${operation.type}`);
          remainingOperations.push(operation);
          failed++;
        }
      } catch (error) {
        logger.error('offlineService:processOperationQueue', `Error processing operation ${operation.id}`, error);
        
        // Increment attempt count and keep in queue if under max attempts
        operation.attempts = (operation.attempts || 0) + 1;
        if (operation.attempts < 3) {
          remainingOperations.push(operation);
        }
        failed++;
      }
    }
    
    // Update the queue with remaining operations
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingOperations));
    
    return { processed, success, failed, remaining: remainingOperations.length };
  } catch (error) {
    logger.error('offlineService:processOperationQueue', 'Error processing operation queue', error);
    throw error;
  }
};

/**
 * Process a document upload operation
 * @param {Object} operation - The queued operation
 * @param {Object} user - The authenticated user
 * @returns {Promise<void>}
 */
const processDocumentUpload = async (operation, user) => {
  const { fileAsset, title, tempId } = operation.data;

  if (!fileAsset || !fileAsset.uri || !fileAsset.name || !title || !tempId) {
    logger.error('offlineService:processDocumentUpload', 'Invalid operation data for document upload.', { operationData: operation.data });
    // This operation is malformed and likely cannot be processed. Consider removing from queue or marking as failed permanently.
    throw new Error('Invalid operation data for document upload.'); 
  }

  logger.info('offlineService:processDocumentUpload', 'Attempting to process offline document upload.', { tempId, title, fileName: fileAsset.name });

  try {
    // Lazy import to avoid circular dependency
    const { performSyncedDocumentUpload, StorageLimitExceededError } = await import('./documentService');
    
    // Call the centralized upload function in documentService
    await performSyncedDocumentUpload(fileAsset, title, user);

    // If successful, delete the local cached file
    try {
      await FileSystem.deleteAsync(fileAsset.uri);
      logger.info('offlineService:processDocumentUpload', 'Local cached file deleted successfully after sync.', { localUri: fileAsset.uri });
    } catch (deleteError) {
      logger.error('offlineService:processDocumentUpload', 'Failed to delete local cached file after successful sync.', { localUri: fileAsset.uri, error: deleteError });
      // Continue, as the main operation was successful
    }

    logger.info('offlineService:processDocumentUpload', 'Successfully processed and synced offline document upload.', { tempId, title });
    // The calling function (processOperationQueue) will handle removing the operation from the queue on success (i.e., no error thrown here)
  } catch (error) {
    // Handle storage limit exceeded error specifically
    const { StorageLimitExceededError } = await import('./documentService');
    if (error instanceof StorageLimitExceededError) {
      logger.warn('offlineService:processDocumentUpload', 'Storage limit exceeded during sync of offline document.', { 
        tempId, 
        title, 
        currentUsage: error.currentUsage, 
        limit: error.limit,
        currentUsageMB: error.currentUsageInMB,
        limitMB: error.limitInMB
      });
      
      // Clean up the local cached file since we won't be retrying this operation
      try {
        await FileSystem.deleteAsync(fileAsset.uri);
        logger.info('offlineService:processDocumentUpload', 'Local cached file deleted after storage limit error.', { localUri: fileAsset.uri });
      } catch (deleteError) {
        logger.error('offlineService:processDocumentUpload', 'Failed to delete local cached file after storage limit error.', { localUri: fileAsset.uri, error: deleteError });
      }
      
      // Don't rethrow - we want to remove this operation from the queue without retrying
      return;
    }
    
    // For other errors, rethrow to allow retry logic in processOperationQueue to handle it
    logger.error('offlineService:processDocumentUpload', 'Error processing offline document upload during sync.', { tempId, title, error });
    throw error; // Rethrow other errors for retry mechanism or general failure handling
  }
};


/**
 * Process a quiz attempt submission
 * @param {Object} operation - The queued operation
 * @param {Object} user - The authenticated user
 * @returns {Promise<void>}
 */
const processQuizAttemptSubmit = async (operation, user) => {
  logger.info('offlineService:processQuizAttemptSubmit', 'Entering function. Operation object:', operation ? JSON.stringify(operation, null, 2) : 'Operation is null/undefined');
  if (operation && operation.data) {
    logger.info('offlineService:processQuizAttemptSubmit', 'Operation data:', JSON.stringify(operation.data, null, 2));
    if (operation.data.quizAttempt) {
      logger.info('offlineService:processQuizAttemptSubmit', 'Operation data.quizAttempt:', JSON.stringify(operation.data.quizAttempt, null, 2));
      logger.info('offlineService:processQuizAttemptSubmit', 'Operation data.quizAttempt.id (before check):', operation.data.quizAttempt.id);
    } else {
      logger.warn('offlineService:processQuizAttemptSubmit', 'Operation data.quizAttempt is undefined.');
    }
  } else {
    logger.warn('offlineService:processQuizAttemptSubmit', 'Operation or operation.data is undefined/null.');
  }

  const { quizAttempt, responses: questionResponsesFromOperation } = operation.data;

  // Defensive check for malformed quizAttempt from queue
  if (!quizAttempt || typeof quizAttempt.id === 'undefined') {
    logger.error('offlineService:processQuizAttemptSubmit', 'Malformed quizAttempt with undefined ID in operation data. Skipping.', { operationId: operation.id, quizAttempt });
    // Depending on desired behavior, you might throw an error to keep it in queue for x retries, or just return to effectively discard it.
    // For now, let's throw to allow retry mechanism in processOperationQueue to handle it.
    throw new Error('Malformed quizAttempt with undefined ID');
  }
  
  try {
    // Ensure user_id is present and valid
    if (!user || !user.id) {
      logger.error('offlineService:processQuizAttemptSubmit', 'User or user.id is undefined. Aborting submission.', { user });
      throw new Error('User or user.id is undefined during quiz attempt processing.');
    }

    const { id: quizAttemptId, original_attempted_at, saved_at, local_id_was_generated, ...restOfQuizAttempt } = quizAttempt; // Removed 'responses' from here as it's not a property of quizAttempt and was causing shadowing
    
    // Prepare the data for inserting the quiz attempt
    const attemptDataForInsert = {
      ...restOfQuizAttempt,
      user_id: user.id,
      attempted_at: new Date(original_attempted_at || saved_at || Date.now()).toISOString(), 
      synced_at: new Date().toISOString(), 
    };

    if (local_id_was_generated) {
      delete attemptDataForInsert.id;
      logger.info('offlineService:processQuizAttemptSubmit', 'Removed client-generated local_id before sending to Supabase.');
    }

    // Remove other client-side only flags before sending to Supabase
    delete attemptDataForInsert.is_offline;
    delete attemptDataForInsert.saved_at;
    // local_id_was_generated is already excluded due to earlier destructuring

    // Log the user object and the data payload before attempting the insert
    logger.info(
      'offlineService:processQuizAttemptSubmit',
      'User object for submission (offline queue):',
      user ? { id: user.id, email: user.email, created_at: user.created_at, app_metadata: user.app_metadata } : null
    );
    logger.info(
      'offlineService:processQuizAttemptSubmit',
      'Cleaned data to be inserted into quiz_attempts (offline queue):',
      JSON.stringify(attemptDataForInsert, null, 2) // Pretty print JSON
    );

    const { data: dbGeneratedAttempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert(attemptDataForInsert)
      .select()
      .single();
      
    if (attemptError) throw attemptError;
    
    // Create the responses records
    // Ensure questionResponsesFromOperation is an array before mapping; default to empty if not.
    const actualResponsesToProcess = Array.isArray(questionResponsesFromOperation) ? questionResponsesFromOperation : [];
    logger.info('offlineService:processQuizAttemptSubmit', 'Processing responses for attempt. Number of responses:', actualResponsesToProcess.length, { responses: actualResponsesToProcess });

    const responsesWithAttemptId = actualResponsesToProcess.map(r => {
      const payload = { ...r }; // Clone the original response object

      // If 'isCorrect' (camelCase) exists in the local data,
      // map it to 'is_correct' (snake_case) for Supabase.
      if (Object.hasOwn(payload, 'isCorrect')) {
        payload.is_correct = payload.isCorrect;
        delete payload.isCorrect; // Remove the original camelCase key
      }

      // Map 'questionId' (camelCase) to 'question_id' (snake_case)
      if (Object.hasOwn(payload, 'questionId')) {
        payload.question_id = payload.questionId;
        delete payload.questionId;
      }
      
      // Map 'selectedAnswer' (camelCase) to 'selected_answer' (snake_case)
      if (Object.hasOwn(payload, 'selectedAnswer')) {
        payload.selected_answer = payload.selectedAnswer;
        delete payload.selectedAnswer;
      }

      // Map 'selectedAnswerIndex' (camelCase) to 'selected_answer_index' (snake_case)
      if (Object.hasOwn(payload, 'selectedAnswerIndex')) {
        payload.selected_answer_index = payload.selectedAnswerIndex;
        delete payload.selectedAnswerIndex;
      }

      // Map 'responseTime' (camelCase) to 'response_time' (snake_case)
      if (Object.hasOwn(payload, 'responseTime')) {
        payload.response_time = payload.responseTime;
        delete payload.responseTime;
      }

      payload.attempt_id = dbGeneratedAttempt.id; // Add the attempt_id

      // Added a warning if 'is_correct' is not a boolean after mapping,
      // as the DB column is NOT NULL boolean.
      if (typeof payload.is_correct !== 'boolean') {
        logger.warn('offlineService:processQuizAttemptSubmit', 
          `Response object has non-boolean or missing is_correct value after mapping. Original 'isCorrect': ${r.isCorrect}, Mapped 'is_correct': ${payload.is_correct}. This might cause an error.`, 
          { originalResponse: r });
      }
      
      // Add a warning if question_id is missing after mapping, as it's NOT NULL
      if (!payload.question_id) {
        logger.warn('offlineService:processQuizAttemptSubmit',
          `Response object is missing question_id after mapping. Original 'questionId': ${r.questionId}. This will likely cause an error.`,
          { originalResponse: r });
      }

      // Add a warning if response_time is not a number or is missing after mapping
      if (typeof payload.response_time !== 'number') {
        logger.warn('offlineService:processQuizAttemptSubmit',
          `Response object has non-numeric or missing response_time after mapping. Original 'responseTime': ${r.responseTime}, Mapped 'response_time': ${payload.response_time}. This might cause an error if the column is numeric.`, 
          { originalResponse: r });
      }

      // Add a warning if selected_answer is missing after mapping
      if (typeof payload.selected_answer === 'undefined' || payload.selected_answer === null) {
        logger.warn('offlineService:processQuizAttemptSubmit',
          `Response object is missing selected_answer after mapping. Original 'selectedAnswer': ${r.selectedAnswer}. This will likely cause an error.`, 
          { originalResponse: r });
      }

      // Add a warning if selected_answer_index is not a number or is missing after mapping
      if (typeof payload.selected_answer_index !== 'number') {
        logger.warn('offlineService:processQuizAttemptSubmit',
          `Response object has non-numeric or missing selected_answer_index after mapping. Original 'selectedAnswerIndex': ${r.selectedAnswerIndex}, Mapped 'selected_answer_index': ${payload.selected_answer_index}. This will likely cause an error.`, 
          { originalResponse: r });
      }

      return payload;
    });
    
    const { error: responsesError } = await supabase
      .from('quiz_question_responses')
      .insert(responsesWithAttemptId);
      
    if (responsesError) throw responsesError;
    
    logger.info('offlineService:processQuizAttemptSubmit', 'Successfully processed offline quiz attempt');
  } catch (error) {
    logger.error('offlineService:processQuizAttemptSubmit', 'Error processing quiz attempt submission. Initial error object:', error);

    // Log known Supabase error properties if they exist
    if (error) {
      logger.error('offlineService:processQuizAttemptSubmit', 'Error Message:', error.message || 'N/A');
      logger.error('offlineService:processQuizAttemptSubmit', 'Error Details:', error.details || 'N/A');
      logger.error('offlineService:processQuizAttemptSubmit', 'Error Hint:', error.hint || 'N/A');
      logger.error('offlineService:processQuizAttemptSubmit', 'Error Code:', error.code || 'N/A');
    }

    // Attempt to stringify the error object for more comprehensive details
    try {
      logger.info('offlineService:processQuizAttemptSubmit', 'Attempting to stringify error object...');
      const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      logger.error('offlineService:processQuizAttemptSubmit', 'Full error details (stringified):', errorString);
    } catch (stringifyError) {
      logger.error('offlineService:processQuizAttemptSubmit', 'Failed to stringify the error object:', stringifyError);
      logger.error('offlineService:processQuizAttemptSubmit', 'Error object (could not stringify):', error); // Log the original error again if stringify fails
    }

    // Direct console.error for browser inspection
    console.error('[OFFLINE SERVICE RAW ERROR] processQuizAttemptSubmit (see structured logs above for details):', error);
    
    throw error; // Re-throw the error to be handled by the caller
  }
};

/**
 * Save a document for offline access
 * @param {Object} document - Document metadata
 * @param {Blob} fileBlob - The document file blob
 * @returns {Promise<Object>} The saved document with local file path
 */
export const saveDocumentOffline = async (document, fileBlob) => {
  try {
    // Create a local copy of the file
    const localFilePath = `${OFFLINE_FILES_DIR}${document.id}_${document.title.replace(/\s+/g, '_')}`;
    
    // Convert blob to base64
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(fileBlob);
    });
    
    // Write the file to local storage
    await FileSystem.writeAsStringAsync(localFilePath, base64, { encoding: FileSystem.EncodingType.Base64 });
    
    // Save document metadata
    const offlineDocument = {
      ...document,
      local_file_path: localFilePath,
      saved_at: Date.now()
    };
    
    // Get existing offline documents
    const documentsJson = await AsyncStorage.getItem(OFFLINE_DOCUMENTS_KEY);
    const documents = documentsJson ? JSON.parse(documentsJson) : [];
    
    // Add or update document
    const existingIndex = documents.findIndex(d => d.id === document.id);
    if (existingIndex >= 0) {
      documents[existingIndex] = offlineDocument;
    } else {
      documents.push(offlineDocument);
    }
    
    // Save updated documents list
    await AsyncStorage.setItem(OFFLINE_DOCUMENTS_KEY, JSON.stringify(documents));
    
    logger.info('offlineService:saveDocumentOffline', 'Document saved for offline access', { documentId: document.id });
    return offlineDocument;
  } catch (error) {
    logger.error('offlineService:saveDocumentOffline', 'Error saving document offline', error);
    throw new Error(`Failed to save document offline: ${error.message}`);
  }
};

/**
 * Get all documents available offline
 * @returns {Promise<Array>} Array of offline documents
 */
export const getOfflineDocuments = async () => {
  try {
    const documentsJson = await AsyncStorage.getItem(OFFLINE_DOCUMENTS_KEY);
    return documentsJson ? JSON.parse(documentsJson) : [];
  } catch (error) {
    logger.error('offlineService:getOfflineDocuments', 'Error getting offline documents', error);
    return [];
  }
};

/**
 * Save a quiz for offline access
 * @param {Object} quiz - Quiz data with questions
 * @returns {Promise<Object>} The saved quiz
 */
export const saveQuizOffline = async (quiz) => {
  try {
    // Separate quiz and questions
    const { questions, ...quizData } = quiz;
    
    // Save quiz
    const offlineQuiz = {
      ...quizData,
      saved_at: Date.now(),
      is_offline: true
    };
    
    // Get existing offline quizzes
    const quizzesJson = await AsyncStorage.getItem(OFFLINE_QUIZZES_KEY);
    const quizzes = quizzesJson ? JSON.parse(quizzesJson) : [];
    
    // Add or update quiz
    const existingIndex = quizzes.findIndex(q => q.id === quiz.id);
    if (existingIndex >= 0) {
      quizzes[existingIndex] = offlineQuiz;
    } else {
      quizzes.push(offlineQuiz);
    }
    
    // Save updated quizzes list
    await AsyncStorage.setItem(OFFLINE_QUIZZES_KEY, JSON.stringify(quizzes));
    
    // Save questions
    if (questions && questions.length > 0) {
      // Get existing offline questions
      const questionsJson = await AsyncStorage.getItem(OFFLINE_QUESTIONS_KEY);
      const allQuestions = questionsJson ? JSON.parse(questionsJson) : {};
      
      // Update questions for this quiz
      allQuestions[quiz.id] = questions.map(q => ({
        ...q,
        quiz_id: quiz.id,
        saved_at: Date.now()
      }));
      
      // Save updated questions
      await AsyncStorage.setItem(OFFLINE_QUESTIONS_KEY, JSON.stringify(allQuestions));
    }
    
    logger.info('offlineService:saveQuizOffline', 'Quiz saved for offline access', { quizId: quiz.id });
    return { ...offlineQuiz, questions };
  } catch (error) {
    logger.error('offlineService:saveQuizOffline', 'Error saving quiz offline', error);
    throw new Error(`Failed to save quiz offline: ${error.message}`);
  }
};

/**
 * Get all quizzes available offline
 * @returns {Promise<Array>} Array of offline quizzes
 */
export const getOfflineQuizzes = async () => {
  try {
    const quizzesJson = await AsyncStorage.getItem(OFFLINE_QUIZZES_KEY);
    return quizzesJson ? JSON.parse(quizzesJson) : [];
  } catch (error) {
    logger.error('offlineService:getOfflineQuizzes', 'Error getting offline quizzes', error);
    return [];
  }
};

/**
 * Get a specific quiz with its questions from offline storage
 * @param {string} quizId - ID of the quiz to retrieve
 * @returns {Promise<Object|null>} Quiz with questions or null if not found
 */
export const getOfflineQuizWithQuestions = async (quizId) => {
  try {
    // Get quizzes
    const quizzesJson = await AsyncStorage.getItem(OFFLINE_QUIZZES_KEY);
    const quizzes = quizzesJson ? JSON.parse(quizzesJson) : [];
    
    // Find the requested quiz
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return null;
    
    // Get questions for this quiz
    const questionsJson = await AsyncStorage.getItem(OFFLINE_QUESTIONS_KEY);
    const allQuestions = questionsJson ? JSON.parse(questionsJson) : {};
    const questions = allQuestions[quizId] || [];
    
    return { ...quiz, questions };
  } catch (error) {
    logger.error('offlineService:getOfflineQuizWithQuestions', `Error getting offline quiz ${quizId}`, error);
    return null;
  }
};

/**
 * Save a quiz attempt for offline sync
 * @param {Object} attempt - Quiz attempt data
 * @param {Array} responses - Array of question responses
 * @returns {Promise<Object>} The saved attempt
 */
export const saveQuizAttemptOffline = async (attempt, responses) => {
  logger.info('offlineService:saveQuizAttemptOffline', 'Received attempt:', JSON.stringify(attempt, null, 2));
  try {
    // Generate a local ID if the incoming attempt doesn't have one or is empty.
    // This 'id' will be used for local storage and queueing.
    const localGeneratedId = (!attempt.id || typeof attempt.id === 'undefined') ? `local_${Date.now()}_${Math.random().toString(36).substring(2, 15)}` : null;
    const currentAttemptId = attempt.id && typeof attempt.id !== 'undefined' ? attempt.id : localGeneratedId;

    const offlineAttempt = {
      ...attempt, // Spread original attempt data
      id: currentAttemptId, // Set id to be the existing one or the newly generated local one
      ...(localGeneratedId && { local_id_was_generated: true }), // Flag if we generated it
      is_offline: true,
      saved_at: new Date().toISOString(), // Use a consistent field for when it was saved for offline
      attempted_at: attempt.attempted_at || new Date().toISOString() // Ensure attempted_at is present
    };
    logger.info('offlineService:saveQuizAttemptOffline', 'ID generation details:', { localGeneratedId, currentAttemptId });
    logger.info('offlineService:saveQuizAttemptOffline', 'Constructed offlineAttempt:', JSON.stringify(offlineAttempt, null, 2));
    
    // Get existing offline attempts
    const attemptsJson = await AsyncStorage.getItem(OFFLINE_QUIZ_ATTEMPTS_KEY);
    const attempts = attemptsJson ? JSON.parse(attemptsJson) : [];
    
    // Add attempt
    attempts.push(offlineAttempt);
    
    // Save updated attempts list
    await AsyncStorage.setItem(OFFLINE_QUIZ_ATTEMPTS_KEY, JSON.stringify(attempts));
    
    // Save responses
    if (responses && responses.length > 0) {
      // Get existing offline responses
      const responsesJson = await AsyncStorage.getItem(OFFLINE_QUIZ_RESPONSES_KEY);
      const allResponses = responsesJson ? JSON.parse(responsesJson) : {};
      
      // Add responses for this attempt using the potentially new/local ID
      allResponses[offlineAttempt.id] = responses;
      
      // Save updated responses
      await AsyncStorage.setItem(OFFLINE_QUIZ_RESPONSES_KEY, JSON.stringify(allResponses));
    }
    
    // Queue for sync when online
    // Pass a copy of offlineAttempt to ensure no further mutations affect the queued object
    const dataForQueue = { quizAttempt: { ...offlineAttempt }, responses };
    logger.info('offlineService:saveQuizAttemptOffline', 'Data for queueOperation:', JSON.stringify(dataForQueue, null, 2));
    await queueOperation('quiz_attempt_submit', dataForQueue);
    
    logger.info('offlineService:saveQuizAttemptOffline', 'Quiz attempt saved offline', { attemptId: offlineAttempt.id, generated: !!localGeneratedId });
    return offlineAttempt;
  } catch (error) {
    logger.error('offlineService:saveQuizAttemptOffline', 'Error saving quiz attempt offline', error);
    throw new Error(`Failed to save quiz attempt offline: ${error.message}`);
  }
};

/**
 * Sync offline quizzes with the server
 * @param {Object} user - The authenticated user
 * @returns {Promise<Object>} Results of the sync operation
 */
const syncOfflineQuizzes = async (user) => {
  try {
    // Get offline quizzes
    const quizzesJson = await AsyncStorage.getItem(OFFLINE_QUIZZES_KEY);
    if (!quizzesJson) return { synced: 0 };
    
    const quizzes = JSON.parse(quizzesJson);
    if (quizzes.length === 0) return { synced: 0 };
    
    // Get offline questions
    const questionsJson = await AsyncStorage.getItem(OFFLINE_QUESTIONS_KEY);
    const allQuestions = questionsJson ? JSON.parse(questionsJson) : {};
    
    let synced = 0;
    const syncedQuizIds = [];
    
    // Process each quiz that doesn't have a real ID (created offline)
    for (const quiz of quizzes) {
      // Skip quizzes that are already synced (have a UUID)
      if (quiz.id && quiz.id.includes('-') && !quiz.id.startsWith('offline_')) continue;
      
      try {
        // Get questions for this quiz
        const questions = allQuestions[quiz.id] || [];
        
        // Create quiz in database
        const { data: newQuiz, error: quizError } = await supabase
          .from('quizzes')
          .insert({
            ...quiz,
            user_id: user.id,
            created_at: new Date(quiz.saved_at).toISOString(),
            is_offline: false
          })
          .select()
          .single();
          
        if (quizError) throw quizError;
        
        // Create questions
        if (questions.length > 0) {
          const questionsToInsert = questions.map(q => ({
            ...q,
            quiz_id: newQuiz.id
          }));
          
          const { error: questionsError } = await supabase
            .from('questions')
            .insert(questionsToInsert);
            
          if (questionsError) throw questionsError;
        }
        
        syncedQuizIds.push(quiz.id);
        synced++;
      } catch (error) {
        logger.error('offlineService:syncOfflineQuizzes', `Error syncing offline quiz ${quiz.id}`, error);
      }
    }
    
    // Remove synced quizzes from offline storage
    if (syncedQuizIds.length > 0) {
      const remainingQuizzes = quizzes.filter(q => !syncedQuizIds.includes(q.id));
      await AsyncStorage.setItem(OFFLINE_QUIZZES_KEY, JSON.stringify(remainingQuizzes));
      
      // Remove synced questions
      for (const quizId of syncedQuizIds) {
        delete allQuestions[quizId];
      }
      await AsyncStorage.setItem(OFFLINE_QUESTIONS_KEY, JSON.stringify(allQuestions));
    }
    
    logger.info('offlineService:syncOfflineQuizzes', `Synced ${synced} offline quizzes`);
    return { synced };
  } catch (error) {
    logger.error('offlineService:syncOfflineQuizzes', 'Error syncing offline quizzes', error);
    throw error;
  }
};

/**
 * Sync offline quiz attempts with the server
 * @param {Object} user - The authenticated user
 * @returns {Promise<Object>} Results of the sync operation
 */
const syncOfflineQuizAttempts = async (user) => {
  try {
    // Get offline attempts
    const attemptsJson = await AsyncStorage.getItem(OFFLINE_QUIZ_ATTEMPTS_KEY);
    if (!attemptsJson) return { synced: 0 };
    
    const attempts = JSON.parse(attemptsJson);
    if (attempts.length === 0) return { synced: 0 };
    
    // Get offline responses
    const responsesJson = await AsyncStorage.getItem(OFFLINE_QUIZ_RESPONSES_KEY);
    const allResponses = responsesJson ? JSON.parse(responsesJson) : {};
    
    let synced = 0;
    const syncedAttemptIds = [];
    
    // Process each attempt
    for (const attempt of attempts) {
      // Defensive check for malformed attempts from old storage
      if (!attempt || typeof attempt.id === 'undefined') {
        logger.warn('offlineService:syncOfflineQuizAttempts', 'Skipping malformed attempt with undefined ID from local storage.', attempt);
        continue; // Skip this iteration
      }
      try {
        // Get responses for this attempt
        const responses = allResponses[attempt.id] || [];

        // Construct the operation object for processQuizAttemptSubmit
        const operation = {
          id: attempt.id, // Using local attempt id for tracking/logging within processQuizAttemptSubmit if needed
          type: 'quiz_attempt_submit', // Consistent with processOperationQueue
          data: {
            quizAttempt: attempt, // The full attempt object as stored locally
            responses: responses    // The responses for this attempt
          }
        };

        // Call processQuizAttemptSubmit to handle the actual submission
        // This will use the centralized logic and detailed error logging
        await processQuizAttemptSubmit(operation, user);
        
        syncedAttemptIds.push(attempt.id); // Mark as synced if processQuizAttemptSubmit doesn't throw
        synced++;
      } catch (error) {
        // The error here will be whatever processQuizAttemptSubmit throws,
        // which already includes detailed logging.
        // We log an additional contextual message from syncOfflineQuizAttempts.
        logger.error('offlineService:syncOfflineQuizAttempts', `Error processing attempt ${attempt.id} via processQuizAttemptSubmit. See previous logs for details.`, error);
        // The error is re-thrown by processQuizAttemptSubmit, so it will be caught by the outer catch if not handled here.
        // For syncOfflineQuizAttempts, we want to continue trying other attempts, so we catch it here.
      }
    }
    
    // Remove synced attempts from offline storage
    if (syncedAttemptIds.length > 0) {
      const remainingAttempts = attempts.filter(a => !syncedAttemptIds.includes(a.id));
      await AsyncStorage.setItem(OFFLINE_QUIZ_ATTEMPTS_KEY, JSON.stringify(remainingAttempts));
      
      // Remove synced responses
      for (const attemptId of syncedAttemptIds) {
        delete allResponses[attemptId];
      }
      await AsyncStorage.setItem(OFFLINE_QUIZ_RESPONSES_KEY, JSON.stringify(allResponses));
    }
    
    logger.info('offlineService:syncOfflineQuizAttempts', `Synced ${synced} offline quiz attempts`);
    return { synced };
  } catch (error) {
    logger.error('offlineService:syncOfflineQuizAttempts', 'Error syncing offline quiz attempts', error);
    throw error;
  }
};

/**
 * Clear all offline data (for testing or logout)
 * @returns {Promise<void>}
 */
export const clearOfflineData = async () => {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    await AsyncStorage.removeItem(OFFLINE_QUIZZES_KEY);
    await AsyncStorage.removeItem(OFFLINE_QUESTIONS_KEY);
    await AsyncStorage.removeItem(OFFLINE_DOCUMENTS_KEY);
    await AsyncStorage.removeItem(OFFLINE_QUIZ_ATTEMPTS_KEY);
    await AsyncStorage.removeItem(OFFLINE_QUIZ_RESPONSES_KEY);
    
    // Clear offline files
    const dirInfo = await FileSystem.getInfoAsync(OFFLINE_FILES_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(OFFLINE_FILES_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(OFFLINE_FILES_DIR, { intermediates: true });
    }
    
    logger.info('offlineService:clearOfflineData', 'All offline data cleared');
  } catch (error) {
    logger.error('offlineService:clearOfflineData', 'Error clearing offline data', error);
    throw error;
  }
};

export default {
  addNetworkListener,
  getNetworkStatus,
  queueOperation,
  removeOperation,
  syncOfflineData,
  saveDocumentOffline,
  getOfflineDocuments,
  saveQuizOffline,
  getOfflineQuizzes,
  getOfflineQuizWithQuestions,
  saveQuizAttemptOffline,
  clearOfflineData
};
