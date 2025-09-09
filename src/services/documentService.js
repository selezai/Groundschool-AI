import { supabase } from './supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import logger from './loggerService';
import { validateFile } from '../utils/fileValidation.js';
import cacheService, { CACHE_KEYS } from './cacheService';

// Request deduplication for getUserDocuments
let activeDocumentFetchPromise = null;

// --- Dynamic Storage Limits ---
export const PLAN_PRO = 'captains_club';
export const STORAGE_LIMIT_FREE_BYTES = 25 * 1024 * 1024; // 25MB
export const STORAGE_LIMIT_PRO_BYTES = 500 * 1024 * 1024; // 500MB

/**
 * Gets the maximum storage limit in bytes for a given user plan.
 * @param {string} [plan] - The user's plan (e.g., 'Commercial Pilot').
 * @returns {number} The storage limit in bytes.
 */
export const getMaxStorageForPlan = (plan) => {
  if (plan === PLAN_PRO) {
    return STORAGE_LIMIT_PRO_BYTES;
  }
  return STORAGE_LIMIT_FREE_BYTES;
};

// Helper function to update user's storage usage by a delta.
// This calls a Supabase RPC function to ensure atomic updates.
const updateUserStorageUsage = async (userId, sizeDeltaBytes) => {
  if (!userId || typeof sizeDeltaBytes !== 'number' || sizeDeltaBytes === 0) {
    logger.warn('documentService:updateUserStorageUsage', 'Invalid parameters, skipping storage update.', { userId, sizeDeltaBytes });
    return;
  }

  const sizeDeltaMB = sizeDeltaBytes / (1024 * 1024);
  logger.info('documentService:updateUserStorageUsage', 'Attempting to update user storage usage', { userId, changeInMB: sizeDeltaMB });

  try {
    const supabaseClient = supabase; // Use the existing client
    const { error } = await supabaseClient.rpc('increment_storage_used', {
      user_id_input: userId,
      size_delta_mb: sizeDeltaMB
    });

    if (error) {
      logger.error('documentService:updateUserStorageUsage', 'Error updating user storage usage via RPC', { userId, sizeDeltaMB, error });
    } else {
      logger.info('documentService:updateUserStorageUsage', 'Successfully updated user storage usage.', { userId, changeInMB: sizeDeltaMB });
    }
  } catch (e) {
    logger.error('documentService:updateUserStorageUsage', 'Exception while updating user storage usage.', { userId, sizeDeltaMB, error: e });
  }
};

/**
 * Gets the current count of documents for a user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<number>} The number of documents the user has.
 */
export const getDocumentCount = async (userId) => {
  if (!userId) {
    logger.error('documentService:getDocumentCount', 'User ID is required.');
    throw new Error('User ID is required to get document count.');
  }
  try {
    const { count, error } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      logger.error('documentService:getDocumentCount', 'Error fetching document count.', { userId, error });
      throw error;
    }
    return count || 0;
  } catch (error) {
    logger.error('documentService:getDocumentCount', 'Exception fetching document count.', { userId, error });
    throw error;
  }
};

/**
 * Gets the total storage usage in bytes for a user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<number>} The total storage usage in bytes.
 */
export const getUserTotalStorageUsage = async (userId) => {
  if (!userId) {
    logger.error('documentService:getUserTotalStorageUsage', 'User ID is required.');
    throw new Error('User ID is required to get storage usage.');
  }
  try {
    // Use a simpler query approach that just selects the file_size column
    const { data, error } = await supabase
      .from('documents')
      .select('file_size')
      .filter('user_id', 'eq', userId);

    if (error) {
      logger.error('documentService:getUserTotalStorageUsage', 'Error fetching storage usage.', { userId, error });
      return 0; // Return 0 if there's an error to avoid breaking the UI
    }
    
    // Sum up all file sizes with better error handling
    const totalBytes = Array.isArray(data) 
      ? data.reduce((sum, doc) => {
          const fileSize = doc.file_size || 0;
          return sum + (typeof fileSize === 'number' ? fileSize : 0);
        }, 0)
      : 0;
      
    logger.info('documentService:getUserTotalStorageUsage', `Total storage usage for user ${userId}: ${totalBytes} bytes`);
    return totalBytes;
  } catch (error) {
    logger.error('documentService:getUserTotalStorageUsage', 'Exception fetching storage usage.', { userId, error });
    return 0; // Return 0 if there's an exception to avoid breaking the UI
  }
};

const DOCUMENTS_BUCKET = 'documents'; // Updated to match new bucket name

// Custom error for storage limit exceeded
export class StorageLimitExceededError extends Error {
  constructor(message = 'Storage limit exceeded', currentUsage = 0, limit = STORAGE_LIMIT_FREE_BYTES) {
    super(message);
    this.name = 'StorageLimitExceededError';
    this.currentUsage = currentUsage;
    this.limit = limit;
    this.limitInMB = Math.round(limit / (1024 * 1024));
    this.currentUsageInMB = Math.round(currentUsage / (1024 * 1024) * 10) / 10; // One decimal place
  }
}

const OFFLINE_DOCUMENTS_KEY = 'offline_documents';
const DOCUMENTS_CACHE_DIR = FileSystem.documentDirectory + 'cached_documents/';

/**
 * Ensures the cache directory for documents exists
 * @returns {Promise<void>}
 */
const ensureCacheDirectoryExists = async () => {
  if (Platform.OS === 'web') {
    logger.info('documentService', 'Skipping cache directory creation on web platform.');
    return; // On web, don't attempt to create file system directories
  }
  try {
    const dirInfo = await FileSystem.getInfoAsync(DOCUMENTS_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(DOCUMENTS_CACHE_DIR, { intermediates: true });
      logger.info('documentService', 'Created cache directory for documents');
    }
  } catch (error) {
    logger.error('documentService', 'Failed to create cache directory', error);
    throw error;
  }
};

/**
 * Caches a document file locally for offline access
 * @param {string} documentId - The ID of the document
 * @param {string} fileUri - The URI of the file to cache
 * @param {string} fileName - The name of the file
 * @returns {Promise<string>} The local URI of the cached file
 */
const cacheDocumentFile = async (documentId, fileUri, fileName) => {
  if (Platform.OS === 'web') {
    logger.warn('documentService', 'File system caching is not supported on the web platform. Returning original URI.');
    // For web, we might not be able to "cache" in the same way.
    // Depending on requirements, could use IndexedDB or just skip.
    // For now, just return the original URI to prevent errors.
    return fileUri;
  }
  try {
    await ensureCacheDirectoryExists();
    
    // Create a safe filename
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localUri = `${DOCUMENTS_CACHE_DIR}${documentId}_${safeFileName}`;
    
    // Copy the file to the cache directory
    await FileSystem.copyAsync({
      from: fileUri,
      to: localUri
    });
    
    logger.info('documentService', 'Document cached successfully', { documentId, localUri });
    return localUri;
  } catch (error) {
    logger.error('documentService', 'Failed to cache document', { documentId, error });
    throw error;
  }
};

/**
 * Uploads a document file to Supabase Storage and records its metadata.
 * If offline, queues the upload for later.
 * @param {object} fileAsset - The file asset object from expo-document-picker (uri, name, mimeType, size).
 * @param {string} title - The user-defined title for the document.
 * @param {function} [onProgress] - Optional callback for upload progress (percentage).
 * @returns {Promise<object>} The newly created document metadata record from the database.
 */
/**
 * Uploads a document that was queued while offline.
 * Performs storage limit checks before uploading.
 * @param {object} fileAsset - The file asset object from expo-document-picker or local cache.
 * @param {string} title - The user-defined title for the document.
 * @param {object} user - The authenticated user object.
 * @returns {Promise<object>} The newly created document metadata record from the database.
 */
export const performSyncedDocumentUpload = async (fileAsset, title, user) => {
  if (!fileAsset || !fileAsset.uri || !fileAsset.name) {
    logger.error('documentService:performSyncedDocumentUpload', 'Invalid file asset provided.');
    throw new Error('Invalid file asset. URI and name are required.');
  }
  if (!title || title.trim() === '') {
    logger.error('documentService:performSyncedDocumentUpload', 'Invalid title provided.');
    throw new Error('A document title is required.');
  }
  if (!user || !user.id) {
    logger.error('documentService:performSyncedDocumentUpload', 'User object or ID is missing.');
    throw new Error('User must be authenticated to upload documents.');
  }

  // Step 1: Fetch user profile to determine storage limit
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profileError) {
    logger.error('documentService:performSyncedDocumentUpload', 'Failed to fetch user profile to determine storage limit.', { userId: user.id, error: profileError });
    // Fallback to default limit if profile fetch fails
  }

  const maxStorage = getMaxStorageForPlan(profile?.plan);

  // Step 2: Verify storage usage
  let currentStorageUsage;
  try {
    currentStorageUsage = await getUserTotalStorageUsage(user.id);
  } catch (storageVerificationError) {
    logger.error('documentService:performSyncedDocumentUpload', 'Failed to verify storage usage.', { userId: user.id, originalError: storageVerificationError });
    throw new Error('Could not verify document storage usage. Please try again.');
  }

  // Step 3: Check if storage limit would be exceeded by this upload
  const newFileSize = fileAsset.size || 0;
  if (currentStorageUsage + newFileSize > maxStorage) {
    const currentUsageMB = (currentStorageUsage / (1024 * 1024)).toFixed(1);
    const limitMB = (maxStorage / (1024 * 1024)).toFixed(0);
    const newFileSizeMB = (newFileSize / (1024 * 1024)).toFixed(1);

    logger.warn('documentService:performSyncedDocumentUpload', 'Storage limit would be exceeded.', { 
      userId: user.id, 
      currentUsage: currentStorageUsage, 
      newFileSize, 
      limit: maxStorage 
    });
    
    throw new StorageLimitExceededError(
      `Storage limit of ${limitMB}MB would be exceeded. Current usage: ${currentUsageMB}MB, new file: ${newFileSizeMB}MB. Please delete existing documents to free up space.`,
      currentStorageUsage,
      maxStorage
    );
  }

  const filePathInBucket = `${user.id}/${Date.now()}_${fileAsset.name.replace(/\s+/g, '_')}`;

  try {
    // Fetch the file content from the URI and convert to Blob
    const response = await fetch(fileAsset.uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    const fileBlob = await response.blob();

    // Upload file to Supabase Storage
    logger.info('documentService:performSyncedDocumentUpload', `Uploading file to: ${DOCUMENTS_BUCKET}/${filePathInBucket}`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePathInBucket, fileBlob, {
        contentType: fileAsset.mimeType || fileBlob.type || 'application/octet-stream',
        upsert: false, // Do not overwrite if file with same path exists (should be unique due to timestamp)
      });

    if (uploadError) {
      logger.error('documentService:performSyncedDocumentUpload', 'Error uploading file to storage.', uploadError);
      throw uploadError;
    }

    if (!uploadData) {
      logger.error('documentService:performSyncedDocumentUpload', 'Upload to storage completed but no data returned.');
      throw new Error('File upload to storage failed to return data.');
    }

    logger.info('documentService:performSyncedDocumentUpload', 'File uploaded successfully. Path:', uploadData.path);

    // Record document metadata in the database
    const documentMetadata = {
      user_id: user.id,
      title: title.trim(), // User-defined title
      file_path: uploadData.path, // Path in Supabase storage (mapped to file_path)
      document_type: fileAsset.mimeType || fileBlob.type || 'application/octet-stream', // Mapped to document_type
      file_size: fileAsset.size || fileBlob.size || 0, // Add file size in bytes
    };

    logger.info('documentService:performSyncedDocumentUpload', 'Inserting document metadata:', documentMetadata);
    const { data: dbData, error: dbError } = await supabase
      .from('documents')
      .insert(documentMetadata)
      .select()
      .single();

    if (dbError) {
      logger.error('documentService:performSyncedDocumentUpload', 'Error inserting document metadata.', dbError);
      // Attempt to delete the orphaned file from storage if DB insert fails
      try {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([uploadData.path]);
        logger.warn('documentService:performSyncedDocumentUpload', 'Orphaned file deleted from storage after DB error:', uploadData.path);
      } catch (cleanupError) {
        logger.error('documentService:performSyncedDocumentUpload', 'Failed to cleanup orphaned file from storage:', cleanupError);
      }
      throw dbError;
    }

    logger.info('documentService:performSyncedDocumentUpload', 'Document metadata inserted successfully:', dbData);

    // --- NEW: Update storage usage ---
    if (dbData && dbData.file_size > 0) {
      await updateUserStorageUsage(user.id, dbData.file_size);
    }
    // --- END NEW ---

    return dbData;

  } catch (error) {
    logger.error('documentService:performSyncedDocumentUpload', 'An error occurred during document upload process.', error);
    throw error; // Re-throw the error to be caught by the calling function
  }
};

/**
 * Uploads a document file to Supabase Storage and records its metadata.
 * If offline, queues the upload for later.
 * @param {object} fileAsset - The file asset object from expo-document-picker (uri, name, mimeType, size).
 * @param {string} title - The user-defined title for the document.
 * @param {function} [onProgress] - Optional callback for upload progress (percentage).
 * @returns {Promise<object>} The newly created document metadata record from the database.
 */
export const uploadDocument = async (fileAsset, title, onProgress) => {
  // Enhanced security validation
  const validationResult = await validateFile(fileAsset);
  if (!validationResult.isValid) {
    logger.error('documentService:uploadDocument', 'File validation failed', {
      error: validationResult.error,
      details: validationResult.details,
      filename: fileAsset.name
    });
    throw new Error(`File validation failed: ${validationResult.error}`);
  }
  
  // Use sanitized filename
  const sanitizedFileAsset = {
    ...fileAsset,
    name: validationResult.sanitizedFilename
  };
  
  if (!title || title.trim() === '') {
    logger.error('documentService:uploadDocument', 'Invalid title provided.');
    throw new Error('A document title is required.');
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    logger.error('documentService:uploadDocument', 'Error fetching user or no authenticated user found.', userError);
    throw new Error('User must be authenticated to upload documents.');
  }

  // Step 1: Fetch user profile to determine storage limit
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profileError) {
    logger.error('documentService:uploadDocument', 'Failed to fetch user profile to determine storage limit.', { userId: user.id, error: profileError });
    // Fallback to default limit if profile fetch fails
  }

  const maxStorage = getMaxStorageForPlan(profile?.plan);

  // Step 2: Verify storage usage
  let currentStorageUsage;
  try {
    currentStorageUsage = await getUserTotalStorageUsage(user.id);
  } catch (storageVerificationError) {
    // This catch is ONLY for failures within getUserTotalStorageUsage itself
    logger.error('documentService:uploadDocument', 'Failed to verify storage usage.', { userId: user.id, originalError: storageVerificationError });
    throw new Error('Could not verify document storage usage. Please try again.');
  }

  // Step 3: Check if storage limit would be exceeded by this upload
  const newFileSize = fileAsset.size || 0;
  if (currentStorageUsage + newFileSize > maxStorage) {
    const currentUsageMB = (currentStorageUsage / (1024 * 1024)).toFixed(1);
    const limitMB = (maxStorage / (1024 * 1024)).toFixed(0);
    const newFileSizeMB = (newFileSize / (1024 * 1024)).toFixed(1);
    
    logger.warn('documentService:uploadDocument', 'Storage limit would be exceeded.', { 
      userId: user.id, 
      currentUsage: currentStorageUsage, 
      newFileSize, 
      limit: maxStorage 
    });
    
    throw new StorageLimitExceededError(
      `Storage limit of ${limitMB}MB would be exceeded. Current usage: ${currentUsageMB}MB, new file: ${newFileSizeMB}MB. Please delete existing documents to free up space.`,
      currentStorageUsage,
      maxStorage
    );
  }
  
  // Step 3: Check if we're offline (this comes after successful storage verification and limit check)
  const offlineService = await import('./offlineService');
  const isConnected = await offlineService.getNetworkStatus();
  if (!isConnected) {
    logger.info('documentService:uploadDocument', 'Device is offline, queuing document upload');
    return await queueDocumentUpload(fileAsset, title); // Return here if offline
  }

  const filePathInBucket = `${user.id}/${Date.now()}_${fileAsset.name.replace(/\s+/g, '_')}`;

  try {
    // Upload directly to the bucket without checking if it exists first
    // This is more efficient and works even when the user doesn't have permission to list buckets
    
    // Fetch the file content from the URI and convert to Blob
    const response = await fetch(fileAsset.uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    const fileBlob = await response.blob();

    // Upload file to Supabase Storage
    logger.info('documentService:uploadDocument', `Uploading file to: ${DOCUMENTS_BUCKET}/${filePathInBucket}`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePathInBucket, fileBlob, {
        contentType: fileAsset.mimeType,
        upsert: false, // Do not overwrite if file with same path exists (should be unique due to timestamp)
      });

    if (uploadError) {
      logger.error('documentService:uploadDocument', 'Error uploading file to storage.', uploadError);
      throw uploadError;
    }

    if (!uploadData) {
      logger.error('documentService:uploadDocument', 'Upload to storage completed but no data returned.');
      throw new Error('File upload to storage failed to return data.');
    }

    logger.info('documentService:uploadDocument', 'File uploaded successfully. Path:', uploadData.path);

    // Record document metadata in the database
    const documentMetadata = {
      user_id: user.id,
      title: title.trim(), // User-defined title
      file_path: uploadData.path, // Path in Supabase storage (mapped to file_path)
      document_type: fileAsset.mimeType || fileBlob.type || 'application/octet-stream', // Mapped to document_type
      file_size: fileAsset.size || fileBlob.size || 0, // Add file size in bytes
      // uploaded_at is set by default in DB
      // ai_processed_at can be updated later
      // content_url and status are not set here, assuming DB handles them (nullable/default)
    };

    logger.info('documentService:uploadDocument', 'Inserting document metadata:', documentMetadata);
    const { data: dbData, error: dbError } = await supabase
      .from('documents')
      .insert(documentMetadata)
      .select()
      .single();

    if (dbError) {
      logger.error('documentService:uploadDocument', 'Error inserting document metadata.', dbError);
      // Attempt to delete the orphaned file from storage if DB insert fails
      try {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([uploadData.path]);
        logger.warn('documentService:uploadDocument', 'Orphaned file deleted from storage after DB error:', uploadData.path);
      } catch (cleanupError) {
        logger.error('documentService:uploadDocument', 'Failed to cleanup orphaned file from storage:', cleanupError);
      }
      throw dbError;
    }

    logger.info('documentService:uploadDocument', 'Document metadata inserted successfully:', dbData);

    // --- NEW: Update storage usage ---
    if (dbData && dbData.file_size > 0) {
        await updateUserStorageUsage(user.id, dbData.file_size);
    }
    // Invalidate caches since document count and storage usage have changed
    cacheService.invalidateCaches([CACHE_KEYS.PROFILE_STATS, CACHE_KEYS.STORAGE_USAGE]);

    return dbData;

  } catch (error) {
    logger.error('documentService:uploadDocument', 'An error occurred during document upload process.', error);
    // More specific error handling or re-throwing might be needed depending on frontend requirements
    throw error; // Re-throw the error to be caught by the calling function
  }
};

// --- Document Retrieval & Deletion Stubs ---

/**
 * Retrieves all documents for the current user.
 * If offline, returns cached documents.
 * @returns {Promise<Array<object>>} A list of document metadata objects.
 */
/**
 * Updates existing documents with default file sizes if they don't have a size set
 * @param {string} userId - The ID of the user
 * @returns {Promise<void>}
 */
export const updateExistingDocumentSizes = async (userId) => {
  if (!userId) {
    logger.error('documentService:updateExistingDocumentSizes', 'User ID is required.');
    return;
  }

  try {
    // Fetch all documents for this user
    const { data: documents, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId);
    
    if (fetchError) {
      logger.error('documentService:updateExistingDocumentSizes', 'Error fetching documents:', { userId, error: fetchError });
      return;
    }
    
    if (!documents || documents.length === 0) {
      logger.info('documentService:updateExistingDocumentSizes', 'No documents to update for user.', { userId });
      return;
    }
    
    // Filter documents that need size updates (null, 0, or undefined file_size)
    const documentsNeedingUpdate = documents.filter(doc => {
      return doc.file_size === null || doc.file_size === 0 || typeof doc.file_size === 'undefined';
    });
    
    if (documentsNeedingUpdate.length === 0) {
      logger.info('documentService:updateExistingDocumentSizes', 'All documents already have file sizes.', { userId });
      return;
    }
    
    logger.info('documentService:updateExistingDocumentSizes', `Found ${documentsNeedingUpdate.length} documents that need size updates.`, { userId });
    
    // Process each document with default sizes based on type
    for (const doc of documentsNeedingUpdate) {
      try {
        // Determine a reasonable default size based on document type
        let defaultSize = 2 * 1024 * 1024; // Default: 2MB
        
        if (doc.document_type) {
          const type = doc.document_type.toLowerCase();
          
          if (type.includes('pdf')) {
            defaultSize = 3 * 1024 * 1024; // PDFs: 3MB
          } else if (type.includes('image') || type.includes('jpg') || type.includes('jpeg') || type.includes('png')) {
            defaultSize = 1.5 * 1024 * 1024; // Images: 1.5MB
          } else if (type.includes('doc') || type.includes('word')) {
            defaultSize = 2.5 * 1024 * 1024; // Word docs: 2.5MB
          } else if (type.includes('text') || type.includes('txt')) {
            defaultSize = 0.5 * 1024 * 1024; // Text files: 0.5MB
          }
        }
        
        // Update the document with the default file size
        // Use a simpler update approach with a single filter
        const { error: updateError } = await supabase
          .from('documents')
          .update({ file_size: defaultSize })
          .filter('id', 'eq', doc.id);
          
        if (updateError) {
          // Log the full error object for more details
          logger.error(
            'documentService:updateExistingDocumentSizes',
            `Error updating file size for document ${doc.id}. Supabase error: ${JSON.stringify(updateError, null, 2)}`,
            { error: updateError } // Keep original error object for structured logging if available
          );
        } else {
          logger.info('documentService:updateExistingDocumentSizes', `Updated document ${doc.id} with default file size: ${defaultSize} bytes (${(defaultSize / (1024 * 1024)).toFixed(2)} MB)`);
        }
      } catch (docError) {
        logger.error('documentService:updateExistingDocumentSizes', `Error processing document ${doc.id}:`, { error: docError });
      }
    }
    
    logger.info('documentService:updateExistingDocumentSizes', 'Document size update completed.', { userId });
  } catch (error) {
    logger.error('documentService:updateExistingDocumentSizes', 'Error updating document sizes:', { userId, error });
  }
};

export const getUserDocuments = async (forceRefresh = false) => {
  // Request deduplication - if there's already an active request and we're not forcing refresh, return it
  if (!forceRefresh && activeDocumentFetchPromise) {
    logger.info('documentService:getUserDocuments', 'Returning existing active request to prevent duplicate fetching');
    return activeDocumentFetchPromise;
  }

  // Create the actual fetch promise
  const fetchPromise = async () => {
    try {
      // Lazy import to avoid circular dependency
      const offlineService = await import('./offlineService');
      
      // Check if we're offline
      const isConnected = await offlineService.getNetworkStatus();
      
      // If offline, return cached documents
      if (!isConnected) {
        logger.info('documentService:getUserDocuments', 'Device is offline, returning cached documents');
        const offlineDocuments = await getOfflineDocuments();
        return offlineDocuments;
      }
  
      // If online, proceed with normal fetch
      let userDetails, authErrorDetails;
      try {
        const { data, error } = await supabase.auth.getUser();
        userDetails = data?.user;
        authErrorDetails = error;
      } catch (e) { // Catch if supabase.auth.getUser() itself throws an unexpected error
        logger.error('documentService:getUserDocuments', 'Unexpected error during supabase.auth.getUser() call.', { error: e });
        const criticalAuthError = new Error('Critical error during user authentication.');
        criticalAuthError.isCriticalAuthError = true;
        throw criticalAuthError;
      }

      if (authErrorDetails) {
        const errorMessage = authErrorDetails.message ? authErrorDetails.message.toLowerCase() : '';
        if (errorMessage.includes('failed to fetch') || errorMessage.includes('err_internet_disconnected') || errorMessage.includes('network request failed')) {
          logger.warn('documentService:getUserDocuments', 'Network error during user authentication. Documents cannot be fetched.', { error: authErrorDetails });
          const networkAuthError = new Error('Network error during user authentication. Please check your connection and try again.');
          networkAuthError.isNetworkError = true;
          networkAuthError.isAuthFailure = true;
          throw networkAuthError;
        }
        logger.error('documentService:getUserDocuments', 'Authentication error (non-network). Documents cannot be fetched.', { error: authErrorDetails });
        const authError = new Error('User authentication failed. Documents cannot be fetched.');
        authError.isAuthFailure = true;
        throw authError;
      }

      if (!userDetails) {
        logger.error('documentService:getUserDocuments', 'No authenticated user found after auth attempt (user object is null). Documents cannot be fetched.');
        const noUserError = new Error('No active user session. Please log in to view documents.');
        noUserError.isAuthFailure = true; // Treat as an auth failure for UI purposes
        throw noUserError;
      }
      const user = userDetails; // Assign to user to maintain consistency with the rest of the function

      try {
        logger.info('documentService:getUserDocuments', 'Fetching documents for user:', user.id);
        
        // First check if the documents table exists
        const { error: tableCheckError } = await supabase
          .from('documents')
          .select('count')
          .limit(1);
        
        if (tableCheckError && tableCheckError.code === '42P01') { // PostgreSQL code for undefined_table
          logger.error('documentService:getUserDocuments', 'Documents table does not exist.', tableCheckError);
          throw new Error('The documents table does not exist in the database. Please set up the database schema.');
        }
        
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id) // RLS also enforces this, but explicit check is good practice
          .order('created_at', { ascending: false });

        if (error) {
          logger.error('documentService:getUserDocuments', 'Error fetching documents from DB.', error);
          throw new Error(`Database error: ${error.message || 'Unknown database error'}`);
        }
        
        // Get offline documents to merge with online documents
        const offlineDocuments = await getOfflineDocuments();
        
        // Filter out offline documents that have been uploaded (by tempId)
        const pendingOfflineDocuments = offlineDocuments.filter(doc => 
          doc.status === 'pending_upload' && !data.some(onlineDoc => onlineDoc.id === doc.id.replace('temp_', ''))
        );
        
        // Cache online documents for offline access
        await cacheOnlineDocuments(data);
        
        // Combine online and offline documents
        const allDocuments = [...data, ...pendingOfflineDocuments];
        
        logger.info('documentService:getUserDocuments', `Found ${allDocuments.length} documents (${data.length} online, ${pendingOfflineDocuments.length} offline).`);
        return allDocuments;
      } catch (error) {
        logger.error('documentService:getUserDocuments', 'An error occurred during document retrieval.', error);
        
        // If we encounter an error fetching online, try to return offline documents
        try {
          const offlineDocuments = await getOfflineDocuments();
          logger.info('documentService:getUserDocuments', `Returning ${offlineDocuments.length} cached documents after online fetch error.`);
          return offlineDocuments;
        } catch (offlineError) {
          logger.error('documentService:getUserDocuments', 'Failed to get offline documents after online error', offlineError);
          throw error; // Throw the original error
        }
      }
    } catch (error) {
      logger.error('documentService:getUserDocuments', 'Critical error in getUserDocuments', error);
      throw error;
    }
  };

  // Set the active promise and execute it
  activeDocumentFetchPromise = fetchPromise();
  
  try {
    const result = await activeDocumentFetchPromise;
    return result;
  } finally {
    // Clear the active promise when done
    activeDocumentFetchPromise = null;
  }
};



/**
 * Deletes a document (metadata and file from storage).
 * @param {string} documentId - The ID of the document to delete.
 * @param {string} userId - The ID of the user (for verification).
 * @returns {Promise<void>}
 */
export const deleteDocument = async (documentId, userId, skipCacheInvalidation = false) => {
  logger.debug('documentService:deleteDocument', 'Delete document requested:', { documentId, userId });
  if (!documentId || !userId) {
    logger.error('documentService:deleteDocument', 'Document ID and User ID are required.');
    throw new Error('Document ID and User ID are required.');
  }
  logger.info('documentService:deleteDocument', `Initiating deletion for documentId: ${documentId}, userId: ${userId}`);

  try {
    // 1. Get document record to find storage_path, file_size and verify ownership
    logger.debug('documentService:deleteDocument', `Step 1: Fetching document metadata for id: ${documentId}`);
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('file_path, user_id, file_size') // Added file_size
      .eq('id', documentId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // PostgREST error for ' dokładnie jeden wiersz' (exactly one row) not found
        logger.warn('documentService:deleteDocument', 'Document not found or user does not have access.', { documentId, userId });
        throw new Error('Document not found or access denied.'); 
      }
      logger.error('documentService:deleteDocument', `Error fetching document metadata for id: ${documentId}. Error:`, fetchError);
      throw fetchError;
    }

    if (!document) {
        logger.warn('documentService:deleteDocument', `Document metadata not found for id: ${documentId} after fetch (PGRST116 should have caught this).`);
        throw new Error('Document not found.');
    }
    logger.debug('documentService:deleteDocument', `Document metadata fetched:`, document);

    // This check is technically redundant if RLS is perfectly set up for select, but good for service-level assurance.
    if (document.user_id !== userId) {
        logger.error('documentService:deleteDocument', `Ownership verification failed. Doc owner: ${document.user_id}, Requester: ${userId}. Denying deletion for documentId: ${documentId}`);
        throw new Error('Access denied: You do not own this document.');
    }
    logger.debug('documentService:deleteDocument', `Ownership verified for documentId: ${documentId}. Owner: ${document.user_id}`);

    const { file_path: filePathInStorage } = document; // Renamed for clarity, actual column is file_path

    // 2. Delete file from Supabase Storage
    logger.debug('documentService:deleteDocument', `Step 2: Attempting to delete file from storage. Path: ${filePathInStorage}`);
    if (filePathInStorage) {
      const { error: storageError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([filePathInStorage]);

      if (storageError) {
        // If file not found in storage, it might be an orphaned record or already deleted.
        // We can choose to log and continue to delete the DB record, or throw.
        // For now, let's log a warning and proceed to delete the DB record to clean up.
        if (storageError.message && (storageError.message.includes('Not found') || storageError.message.includes('No objects found'))) {
          logger.warn('documentService:deleteDocument', `File not found in storage (path: ${filePathInStorage}), possibly already deleted or orphaned. Proceeding to DB record deletion.`, { error: storageError.message });
        } else {
          // Log the error but continue with DB deletion to ensure cleanup
          logger.warn('documentService:deleteDocument', `Non-critical error deleting file from storage (path: ${filePathInStorage}). Will still attempt DB record deletion.`, { error: storageError.message });
          // We don't throw here anymore to allow the deletion process to continue
        }
      } else {
        logger.debug('documentService:deleteDocument', `File successfully deleted from storage (path: ${filePathInStorage}) or no error reported.`);
      }
    } else {
      logger.warn('documentService:deleteDocument', `Document record (id: ${documentId}) had no file_path. Skipping storage deletion.`);
    }

    // 3. Delete record from 'documents' table
    logger.debug('documentService:deleteDocument', `Step 3: Attempting to delete document record from database for id: ${documentId}`);
    const { error: dbDeleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (dbDeleteError) {
      // Check if it's a permission error or a record not found error
      if (dbDeleteError.code === 'PGRST204' || (dbDeleteError.message && dbDeleteError.message.includes('not found'))) {
        // Record might have already been deleted
        logger.warn('documentService:deleteDocument', `Document record not found in database for id: ${documentId} during deletion. It may have already been deleted.`, { error: dbDeleteError.message });
        // Don't throw - return success since the document is gone anyway
        return { success: true, message: 'Document no longer exists in the database.' };
      } else {
        logger.error('documentService:deleteDocument', `Error deleting document record from database for id: ${documentId}.`, { error: dbDeleteError.message, code: dbDeleteError.code });
        // At this point, the file might be deleted from storage but the DB record remains.
        // This is an orphaned record scenario. Manual cleanup or a batch job might be needed for such cases if they occur frequently.
        throw dbDeleteError;
      }
    } else {
      logger.debug('documentService:deleteDocument', `Document record successfully deleted from database for id: ${documentId}`);
    }

    logger.info('documentService:deleteDocument', `Successfully completed deletion process for documentId: ${documentId}`);

    // --- NEW: Update storage usage ---
    if (document && document.file_size > 0) {
        await updateUserStorageUsage(userId, -document.file_size); // Negative to reduce usage
    }
    
    // Invalidate caches since document count and storage usage have changed
    if (!skipCacheInvalidation) {
      cacheService.invalidateCaches([CACHE_KEYS.PROFILE_STATS, CACHE_KEYS.STORAGE_USAGE]);
    }

    return { success: true, message: 'Document deleted successfully.' };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack available';
    logger.error('documentService:deleteDocument', `Exception during document deletion process for documentId: ${documentId}, userId: ${userId}. Error: ${errorMessage}, Stack: ${errorStack}. Full error object:`, error);
    // Re-throw the original error or a new generic one
    // It's often better to throw specific error types or objects with more context if the frontend needs to react differently.
    throw error; 
  }
};

// --- Document Retrieval ---

/**
 * Queues a document upload for when the device is back online
 * @param {object} fileAsset - The file asset to upload
 * @param {string} title - The title of the document
 * @returns {Promise<object>} The temporary document object
 */
const queueDocumentUpload = async (fileAsset, title) => {
  try {
    // Generate a temporary ID for the document
    const tempId = 'temp_' + Date.now().toString();
    
    // Cache the file locally
    const localUri = await cacheDocumentFile(tempId, fileAsset.uri, fileAsset.name);
    
    // Create a temporary document object
    const tempDocument = {
      id: tempId,
      title: title.trim(),
      title: title.trim(),
      file_name: fileAsset.name,
      storage_path: localUri, // Temporarily, this will be the local URI until uploaded
      content_type: fileAsset.mimeType || 'application/octet-stream',
      file_size: fileAsset.size || 0,
      status: 'pending_upload', // Custom status for offline items
      is_cached: true,
      cached_uri: localUri,
      uploaded_at: new Date().toISOString(), // Or keep as created_at if preferred for temp items
      user_id: 'offline_user', // Placeholder; real user_id needed upon sync
      name: fileAsset.name,
      original_uri: fileAsset.uri
    };
    
    // Queue the upload operation
    const offlineService = await import('./offlineService');
    await offlineService.queueOperation('document_upload', {
      tempId,
      fileAsset: {
        uri: localUri,
        name: fileAsset.name,
        mimeType: fileAsset.mimeType,
        size: fileAsset.size
      },
      title
    });
    
    // Save the temporary document to local storage
    const offlineDocuments = await getOfflineDocuments();
    offlineDocuments.push(tempDocument);
    await AsyncStorage.setItem(OFFLINE_DOCUMENTS_KEY, JSON.stringify(offlineDocuments));
    
    logger.info('documentService:queueDocumentUpload', 'Document queued for upload', { tempId, title });
    return tempDocument;
  } catch (error) {
    logger.error('documentService:queueDocumentUpload', 'Failed to queue document upload', error);
    throw error;
  }
};

/**
 * Gets documents stored offline
 * @returns {Promise<Array<object>>} List of offline documents
 */
const getOfflineDocuments = async () => {
  try {
    const offlineDocumentsJson = await AsyncStorage.getItem(OFFLINE_DOCUMENTS_KEY);
    return offlineDocumentsJson ? JSON.parse(offlineDocumentsJson) : [];
  } catch (error) {
    logger.error('documentService:getOfflineDocuments', 'Failed to get offline documents', error);
    return [];
  }
};


/**
 * Cache online documents for offline access
 * @param {Array<object>} documents - The documents to cache
 * @returns {Promise<void>}
 */
const cacheOnlineDocuments = async (documents) => {
  try {
    // Ensure the cache directory exists
    await ensureCacheDirectoryExists();
    
    // Get existing offline documents
    const offlineDocuments = await getOfflineDocuments();
    const existingIds = new Set(offlineDocuments.map(doc => doc.id));
    
    // Add the is_cached flag to online documents
    const updatedDocuments = documents.map(doc => ({
      ...doc,
      is_cached: existingIds.has(doc.id)
    }));
    
    // Update the offline documents store
    await AsyncStorage.setItem(OFFLINE_DOCUMENTS_KEY, JSON.stringify(updatedDocuments));
    
    logger.info('documentService:cacheOnlineDocuments', `Cached ${updatedDocuments.length} documents for offline access`);
  } catch (error) {
    logger.error('documentService:cacheOnlineDocuments', 'Failed to cache online documents', error);
    // Don't throw - this is a background operation that shouldn't break the main flow
  }
};

/**
 * Fetches a single document by its ID for the authenticated user.
 * If offline, tries to retrieve from cache.
 * @param {string} documentId - The UUID of the document.
 * @returns {Promise<object|null>} The document metadata object or null if not found/accessible.
 */
export const getDocumentById = async (documentId) => {
  if (!documentId) {
    logger.warn('documentService:getDocumentById', 'No document ID provided.');
    return null;
  }
  
  // Check if we're offline
  const offlineService = await import('./offlineService');
  const isConnected = await offlineService.getNetworkStatus();
  
  // If offline, try to get from cache
  if (!isConnected) {
    logger.info('documentService:getDocumentById', 'Device is offline, checking cache for document', { documentId });
    try {
      const offlineDocuments = await getOfflineDocuments();
      const cachedDocument = offlineDocuments.find(doc => doc.id === documentId || doc.id === `temp_${documentId}`);
      
      if (cachedDocument) {
        logger.info('documentService:getDocumentById', 'Found document in cache', { documentId });
        return cachedDocument;
      }
      
      logger.warn('documentService:getDocumentById', 'Document not found in cache', { documentId });
      return null;
    } catch (error) {
      logger.error('documentService:getDocumentById', 'Error retrieving document from cache', { documentId, error });
      return null;
    }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    logger.error('documentService:getDocumentById', 'Error fetching user or no authenticated user.', userError);
    throw new Error('User must be authenticated to view a document.');
  }

  try {
    logger.info('documentService:getDocumentById', 'Fetching document by ID:', documentId);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id) // RLS enforces this, added for clarity
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Code for 'Not Found'
        logger.warn('documentService:getDocumentById', 'Document not found or access denied:', documentId);
        return null;
      }
      logger.error('documentService:getDocumentById', 'Error fetching document from DB.', error);
      throw error;
    }

    logger.info('documentService:getDocumentById', 'Document found:', data);
    return data;
  } catch (error) {
    logger.error('documentService:getDocumentById', 'An error occurred fetching document by ID.', error);
    throw error;
  }
};

// --- Document Modification ---

/**
 * Updates metadata for a specific document.
 * If offline, queues the update for later.
 * @param {string} documentId - The UUID of the document to update.
 * @param {object} updates - An object containing fields to update (e.g., { title: 'New Title' }).
 * @returns {Promise<object>} The updated document metadata object.
 */
export const updateDocument = async (documentId, updates) => {
  if (!documentId || !updates || Object.keys(updates).length === 0) {
    logger.warn('documentService:updateDocument', 'Invalid parameters for document update.');
    throw new Error('Document ID and updates are required.');
  }
  
  // Check if we're offline
  const offlineService = await import('./offlineService');
  const isConnected = await offlineService.getNetworkStatus();
  
  // If offline, queue the update
  if (!isConnected) {
    logger.info('documentService:updateDocument', 'Device is offline, queuing document update', { documentId });
    return await queueDocumentUpdate(documentId, updates);
  }

  // Ensure user_id is not accidentally updated
  const { user_id, file_path, ...safeUpdates } = updates;
  if (Object.keys(safeUpdates).length === 0) {
    logger.warn('documentService:updateDocument', 'No valid fields to update provided.');
    return getDocumentById(documentId); // Return current data if no valid updates
  }

  safeUpdates.updated_at = new Date(); // Always update the timestamp

  try {
    logger.info('documentService:updateDocument', `Updating document ${documentId} with:`, safeUpdates);
    const { data, error } = await supabase
      .from('documents')
      .update(safeUpdates)
      .eq('id', documentId)
      // RLS handles user check
      .select()
      .single();

    if (error) {
      logger.error('documentService:updateDocument', 'Error updating document metadata.', error);
      throw error;
    }

    logger.info('documentService:updateDocument', 'Document updated successfully:', data);
    return data;
  } catch (error) {
    logger.error('documentService:updateDocument', 'An error occurred during document update.', error);
    throw error;
  }
};

/**
 * Queues a document update for when the device is back online
 * @param {string} documentId - The ID of the document to update
 * @param {object} updates - The updates to apply
 * @returns {Promise<object>} The updated document object (from cache)
 */
const queueDocumentUpdate = async (documentId, updates) => {
  try {
    // Get offline documents
    const offlineDocuments = await getOfflineDocuments();
    
    // Find the document to update
    const documentIndex = offlineDocuments.findIndex(doc => 
      doc.id === documentId || doc.id === `temp_${documentId}`
    );
    
    if (documentIndex === -1) {
      logger.error('documentService:queueDocumentUpdate', 'Document not found in cache', { documentId });
      throw new Error('Document not found in offline cache');
    }
    
    // Update the document
    const updatedDocument = {
      ...offlineDocuments[documentIndex],
      ...updates,
      updated_at: new Date().toISOString(),
      status: offlineDocuments[documentIndex].status === 'pending_upload' 
        ? 'pending_upload' 
        : 'pending_update'
    };
    
    offlineDocuments[documentIndex] = updatedDocument;
    
    // Save updated documents to cache
    await AsyncStorage.setItem(OFFLINE_DOCUMENTS_KEY, JSON.stringify(offlineDocuments));
    
    // Queue the update operation
    const offlineService = await import('./offlineService');
    await offlineService.queueOperation('document_update', {
      documentId: documentId.startsWith('temp_') ? documentId.replace('temp_', '') : documentId,
      updates
    });
    
    logger.info('documentService:queueDocumentUpdate', 'Document update queued', { documentId });
    return updatedDocument;
  } catch (error) {
    logger.error('documentService:queueDocumentUpdate', 'Failed to queue document update', { documentId, error });
    throw error;
  }
};


/**
 * Creates a temporary signed URL to access a private file in storage.
 * If the file is cached locally, returns the local URI instead.
 * @param {string} filePath - The path to the file within the bucket (e.g., 'user_id/file_name.pdf').
 * @param {number} [expiresInSeconds=3600] - The duration the URL should be valid for (default: 1 hour).
 * @returns {Promise<string|null>} The signed URL or local URI, or null if an error occurs.
 */
export const createSignedUrl = async (filePath, expiresInSeconds = 3600) => {
  if (!filePath) {
    logger.warn('documentService:createSignedUrl', 'No file path provided.');
    return null;
  }
  
  // If the file path is already a local URI (cached file), return it directly
  if (filePath.startsWith(FileSystem.documentDirectory)) {
    logger.info('documentService:createSignedUrl', 'Using cached local file', { filePath });
    return filePath;
  }
  
  // Check if we're offline
  const offlineService = await import('./offlineService');
  const isConnected = await offlineService.getNetworkStatus();
  if (!isConnected) {
    logger.info('documentService:createSignedUrl', 'Device is offline, checking for cached version', { filePath });
    
    // Try to find a cached version of this file
    try {
      const offlineDocuments = await getOfflineDocuments();
      const cachedDoc = offlineDocuments.find(doc => doc.file_path === filePath && doc.cached_uri);
      
      if (cachedDoc && cachedDoc.cached_uri) {
        logger.info('documentService:createSignedUrl', 'Found cached version of file', { filePath, cachedUri: cachedDoc.cached_uri });
        return cachedDoc.cached_uri;
      }
      
      logger.warn('documentService:createSignedUrl', 'No cached version found for offline file', { filePath });
      return null;
    } catch (error) {
      logger.error('documentService:createSignedUrl', 'Error checking for cached file', { filePath, error });
      return null;
    }
  }

  try {
    logger.info('documentService:createSignedUrl', `Generating signed URL for: ${filePath}`);
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error) {
      logger.error('documentService:createSignedUrl', 'Error creating signed URL.', error);
      throw error;
    }

    if (!data?.signedUrl) {
        logger.error('documentService:createSignedUrl', 'Signed URL creation returned no URL.', data);
        throw new Error('Failed to generate signed URL.');
    }

    logger.info('documentService:createSignedUrl', 'Signed URL generated successfully.');
    return data.signedUrl;
  } catch (error) {
    logger.error('documentService:createSignedUrl', 'An error occurred generating signed URL.', error);
    throw error; // Re-throw to be handled by caller
  }
};
