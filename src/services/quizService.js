/**
 * Quiz Service
 * 
 * This service handles quiz generation, storage, and retrieval.
 * It integrates with the Gemini service for AI-powered question generation
 * and manages quiz data in the Supabase database.
 * It also supports offline functionality through integration with offlineService.
 */

import { supabase, getSupabase, isSupabaseReady } from './supabaseClient';
import logger from './loggerService';
import geminiService from './geminiService';
import offlineService from './offlineService';
import NetworkService from './networkService';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const MAX_QUIZZES_PER_USER = 20;


// Helper function to enforce quiz limit for a user
const enforceQuizLimit = async (userId, supabaseClient, userProfile) => {
  if (userProfile && userProfile.plan === 'captains_club') {
    logger.info('quizService:enforceQuizLimit', 'Captain\'s Club user, skipping quiz storage limit.', { userId });
    return;
  }
  logger.info('quizService:enforceQuizLimit', 'Basic user or plan not determined, applying standard quiz storage limit.', { userId, plan: userProfile?.plan });

  logger.info('quizService:enforceQuizLimit', 'Checking quiz limit for user', { userId });
  try {
    const { data: userQuizzes, error: fetchError } = await supabaseClient
      .from('quizzes')
      .select('id, created_at') // Only select necessary fields
      .eq('user_id', userId)
      .order('created_at', { ascending: true }); // Oldest first

    if (fetchError) {
      logger.error('quizService:enforceQuizLimit', 'Error fetching user quizzes to enforce limit', { userId, error: fetchError.message });
      // Do not throw here, allow quiz creation to proceed but log the failure to prune
      return;
    }

    if (userQuizzes && userQuizzes.length >= MAX_QUIZZES_PER_USER) {
      const numToDelete = userQuizzes.length - MAX_QUIZZES_PER_USER + 1;
      logger.info('quizService:enforceQuizLimit', `User has ${userQuizzes.length} quizzes (max ${MAX_QUIZZES_PER_USER}). Need to delete ${numToDelete} oldest quizzes.`, { userId });

      const quizzesToDelete = userQuizzes.slice(0, numToDelete);
      for (const quiz of quizzesToDelete) {
        try {
          logger.info('quizService:enforceQuizLimit', `Deleting old quiz ID: ${quiz.id} for user ${userId} to enforce limit.`);
          await deleteQuiz(quiz.id); // deleteQuiz is an existing exported function from this service
        } catch (deleteSingleQuizError) {
          logger.error('quizService:enforceQuizLimit', `Failed to delete old quiz ID: ${quiz.id} during limit enforcement.`, { userId, error: deleteSingleQuizError.message });
          // Continue trying to delete other old quizzes
        }
      }
      logger.info('quizService:enforceQuizLimit', `Attempted deletion of ${numToDelete} oldest quizzes for user ${userId}.`);
    } else {
      logger.info('quizService:enforceQuizLimit', `User has ${userQuizzes ? userQuizzes.length : 0} quizzes. No deletion needed to enforce limit.`, { userId });
    }
  } catch (error) {
    logger.error('quizService:enforceQuizLimit', 'General error enforcing quiz limit', { userId, error: error.message, stack: error.stack });
    // Do not throw here to prevent blocking quiz creation due to pruning failure. Logged aggressively.
  }
};

/**
 * Creates a new quiz from a document
 * @param {string} title - The title of the quiz
 * @param {Object} document - The document object from which to generate questions
 * @param {number} questionCount - Number of questions to generate (default: 5)
 * @param {string} difficulty - Desired difficulty level (easy, medium, hard)
 * @returns {Promise<Object>} - The created quiz object
 */
// Title and questionCount will now be determined by the AI via geminiService
export const createQuizFromDocument = async (document, difficulty = 'medium') => {
  try {
    if (!document) {
      logger.error('quizService:createQuizFromDocument', 'Missing document parameter', { 
        hasDocument: !!document,
        documentType: document ? typeof document : 'undefined',
        documentId: document?.id || 'undefined'
      });
      throw new Error('Document is required to generate a quiz');
    }

    logger.info('quizService:createQuizFromDocument', 'Document details', {
      id: document.id,
      title: document.title,
      file_path: document.file_path,
      document_type: document.document_type,
      status: document.status
    });

    const supabaseClient = getSupabase(); // Ensure this is the main Supabase client for the function scope
    
    logger.info('quizService:createQuizFromDocument', 'Fetching current user');
    const { data: authData, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError) {
      logger.error('quizService:createQuizFromDocument', 'Error fetching user', userError);
      throw new Error(`Authentication error: ${userError.message}`);
    }
    
    if (!authData || !authData.user) {
      logger.error('quizService:createQuizFromDocument', 'No authenticated user found');
      throw new Error('User must be authenticated to create quizzes');
    }
    
    const user = authData.user;
    
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !sessionData.session) {
      logger.error('quizService:createQuizFromDocument', 'Invalid or expired session', sessionError);
      throw new Error('Your session has expired. Please sign in again.');
    }
    
    logger.info('quizService:createQuizFromDocument', 'User authenticated', { userId: user.id });

    // Initialize userProfile with safe defaults
    let userProfile = { plan: 'basic', monthly_quizzes_remaining: 0 };
    
    try {
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('plan, monthly_quizzes_remaining, last_quota_reset_date') // last_quota_reset_date for future use
        .eq('id', user.id)
        .single();

      if (profileError) {
        logger.error('quizService:createQuizFromDocument', 'Error fetching user profile', { userId: user.id, error: profileError });
        throw new Error(`Failed to fetch user profile: ${profileError.message}`);
      }
      if (!profileData) {
        logger.warn('quizService:createQuizFromDocument', 'No profile found for user, defaulting to basic plan limits', { userId: user.id });
        userProfile = { plan: 'basic', monthly_quizzes_remaining: 0 }; // Default to basic, no quizzes remaining
      } else {
        userProfile = profileData;
      }
      logger.info('quizService:createQuizFromDocument', 'User profile fetched', { userId: user.id, plan: userProfile.plan, remaining: userProfile.monthly_quizzes_remaining });
    } catch (e) {
      logger.error('quizService:createQuizFromDocument', 'Exception fetching user profile', { userId: user.id, error: e });
      // Don't throw here - use the default profile instead
      logger.warn('quizService:createQuizFromDocument', 'Using default basic profile due to fetch error', { userId: user.id });
      userProfile = { plan: 'basic', monthly_quizzes_remaining: 0 };
    }

    // Monthly Quota Check for Basic Users
    if (userProfile.plan === 'basic' || !userProfile.plan) { // Treat null/undefined plan as basic
      // TODO: Implement logic for last_quota_reset_date to see if quota should be reset.
      // This typically happens via a cron job or on login, not during quiz creation itself.
      if (userProfile.monthly_quizzes_remaining <= 0) {
        logger.warn('quizService:createQuizFromDocument', 'Basic user has no monthly exams remaining', { userId: user.id, remaining: userProfile.monthly_quizzes_remaining });
        throw new Error("You have reached your monthly limit for exam generation. Upgrade to Captain\'s Club for unlimited exams.");
      }
      logger.info('quizService:createQuizFromDocument', 'Basic user has monthly exams remaining', { userId: user.id, remaining: userProfile.monthly_quizzes_remaining });
    }


    logger.info('quizService:createQuizFromDocument', 'Generating quiz content, title, and determining question count via AI', { documentId: document.id, difficulty });
    let aiQuizData;
    try {
      // IMPORTANT: Assuming geminiService.generateQuestionsFromDocument is updated to:
      // 1. No longer require questionCount as a strict input if AI is to determine it.
      // 2. Return an object like { title: "AI Generated Title", questions: [...] }
      aiQuizData = await geminiService.generateQuestionsFromDocument(document, difficulty); 
      
      if (!aiQuizData || !aiQuizData.questions || aiQuizData.questions.length === 0 || !aiQuizData.title) {
        logger.error('quizService:createQuizFromDocument', 'Invalid or incomplete data from geminiService', {responseData: aiQuizData});
        throw new Error('Failed to generate complete quiz data (title and questions) from the document');
      }
      logger.info('quizService:createQuizFromDocument', 'AI generated title and questions successfully', { title: aiQuizData.title, count: aiQuizData.questions.length });
    } catch (geminiError) {
      logger.error('quizService:createQuizFromDocument', 'Error in geminiService.generateQuestionsFromDocument', geminiError);
      throw new Error(`Failed to generate quiz content via AI: ${geminiError.message}`);
    }

    // Enforce quiz limit before inserting the new quiz
    logger.info('quizService:createQuizFromDocument', 'PRE-CALL to enforceQuizLimit for user', { userId: user.id });
    await enforceQuizLimit(user.id, supabaseClient, userProfile);

    let quiz = null;
    try {
      const quizData = {
        user_id: user.id,
        title: aiQuizData.title.trim(), // Use AI generated title
        document_ids: [document.id],
        question_count: aiQuizData.questions.length, // Use count from AI generated questions
        created_at: new Date().toISOString(),
        status: 'active'
      };
      
      logger.info('quizService:createQuizFromDocument', 'Inserting quiz record', quizData);
      // Retry logic for quiz insertion
      let newQuizData, quizInsertError;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          logger.info('quizService:createQuizFromDocument', `Retrying quiz insertion (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
        const { data, error } = await supabaseClient
          .from('quizzes')
          .insert(quizData)
          .select()
          .single();
        newQuizData = data;
        quizInsertError = error;
        if (!quizInsertError) break;
      }

      if (quizInsertError) {
        logger.error('quizService:createQuizFromDocument', 'Error creating quiz record after retries', quizInsertError);
        throw new Error(`Failed to create quiz: ${quizInsertError.message}`);
      }
      if (!newQuizData) {
        logger.error('quizService:createQuizFromDocument', 'Quiz creation returned no data after retries but also no error');
        throw new Error('Quiz creation failed: No quiz data returned');
      }
      quiz = newQuizData;
      logger.info('quizService:createQuizFromDocument', 'Quiz record created successfully', { quizId: quiz.id });
    } catch (dbError) {
      logger.error('quizService:createQuizFromDocument', 'Exception during quiz creation database operation', dbError);
      throw new Error(`Database error creating quiz: ${dbError.message}`);
    }

    // Store the questions in the database
    let savedQuestions = [];
    try {
      logger.info('quizService:createQuizFromDocument', 'Preparing to insert questions', { count: aiQuizData.questions.length });
      const questionsToInsert = aiQuizData.questions.map((q, index) => {
        if (!q.question_text || typeof q.question_text !== 'string' || q.question_text.trim() === '' || 
          !q.options || !Array.isArray(q.options) || q.options.length < 2 || 
          !q.correct_answer_id || typeof q.correct_answer_id !== 'string' || q.correct_answer_id.trim() === '') {
          logger.error('quizService:createQuizFromDocument', 'Invalid basic question structure or missing fields', { questionIndex: index, questionData: q });
          throw new Error(`Invalid basic question structure (text, options, or answer ID) at index ${index}`);
        }

        // Validate each option within the options array
        for (let i = 0; i < q.options.length; i++) {
          const opt = q.options[i];
          if (!opt || typeof opt !== 'object' || 
              !opt.text || typeof opt.text !== 'string' || opt.text.trim() === '' || 
              !opt.id || (typeof opt.id !== 'string' && typeof opt.id !== 'number') || String(opt.id).trim() === '') {
            logger.error('quizService:createQuizFromDocument', 'Invalid option structure within question', { questionIndex: index, optionIndex: i, optionData: opt });
            throw new Error(`Invalid option structure at question index ${index}, option index ${i}`);
          }
        }

        const correctIndex = q.options.findIndex(opt => opt.id === q.correct_answer_id);
        // Previous validation ensures correct_answer_id is in options, so findIndex should not return -1.
        // However, an explicit check could be added for extreme defensiveness if desired.
        if (correctIndex === -1) {
            // This should ideally not be reached due to prior validation of correct_answer_id against option IDs.
            logger.error('quizService:createQuizFromDocument', 'Consistency error: correct_answer_id valid but not found in options for indexing.', { questionIndex: index, questionData: q });
            throw new Error(`Consistency error processing correct answer for question index ${index}. correct_answer_id '${q.correct_answer_id}' not found in options.`);
        }

        return {
          quiz_id: quiz.id,
          text: q.question_text, 
          options: q.options,
          correct_answer: q.correct_answer_id, // Maps to Supabase 'correct_answer' (text) column
          correct_answer_index: correctIndex, // Added for Supabase 'correct_answer_index' (int4) column
          explanation: q.explanation || '',
          order_index: index, // Use order_index to match schema
        };
      });

      // Stringify to ensure complex object is logged reliably
      logger.debug('quizService:createQuizFromDocument', 'Questions payload to be inserted:', { data: JSON.stringify(questionsToInsert, null, 2) });

      // Retry logic for question insertion
      let insertedQuestionsData, questionsInsertError;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          logger.info('quizService:createQuizFromDocument', `Retrying questions insertion (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
        const { data, error } = await supabaseClient
          .from('questions')
          .insert(questionsToInsert)
          .select();
        insertedQuestionsData = data;
        questionsInsertError = error;
        if (!questionsInsertError) break;
      }

      if (questionsInsertError) {
        logger.error('quizService:createQuizFromDocument', 'Error inserting questions into DB after retries', questionsInsertError);
        throw questionsInsertError; // Propagate to catch block below for cleanup
      }
      if (!insertedQuestionsData || insertedQuestionsData.length === 0) {
        logger.error('quizService:createQuizFromDocument', 'No questions were inserted into DB after retries');
        throw new Error('Failed to save questions to the database.');
      }
      savedQuestions = insertedQuestionsData;
      logger.info('quizService:createQuizFromDocument', 'All questions saved successfully', { quizId: quiz.id, count: savedQuestions.length });

      quiz.questions = savedQuestions;

      // Decrement monthly quota for basic users if applicable
      if (userProfile.plan === 'basic' || !userProfile.plan) {
        try {
          const newRemaining = Math.max(0, userProfile.monthly_quizzes_remaining - 1);
          const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ monthly_quizzes_remaining: newRemaining })
            .eq('id', user.id);
          if (updateError) {
            logger.error('quizService:createQuizFromDocument', 'Failed to decrement monthly_quizzes_remaining', { userId: user.id, error: updateError });
            // Non-fatal, log and continue. The quiz is already created.
          } else {
            logger.info('quizService:createQuizFromDocument', 'Successfully decremented monthly_quizzes_remaining for basic user', { userId: user.id, newRemaining });
          }
        } catch (e) {
          logger.error('quizService:createQuizFromDocument', 'Exception decrementing monthly_quizzes_remaining', { userId: user.id, error: e });
        }
      }

      logger.info('quizService:createQuizFromDocument', 'Quiz created successfully, limit enforced (if applicable), and quota updated (if applicable)', { quizId: quiz.id, title: quiz.title });
      return quiz;

    } catch (questionsDbErrorOuter) {
      logger.error('quizService:createQuizFromDocument', 'Exception storing quiz questions or enforcing limit', questionsDbErrorOuter);
      if (quiz && quiz.id) {
        try {
          logger.warn('quizService:createQuizFromDocument', `Attempting to cleanup quiz ${quiz.id} due to question processing failure`);
          await deleteQuiz(quiz.id);
          logger.info('quizService:createQuizFromDocument', `Successfully cleaned up quiz ${quiz.id}`);
        } catch (cleanupError) {
          logger.error('quizService:createQuizFromDocument', `Failed to cleanup quiz ${quiz.id} after question processing error`, cleanupError);
        }
      }
      throw new Error(`Exception storing quiz questions: ${questionsDbErrorOuter.message}`);
    }
  } catch (error) { // Main catch for createQuizFromDocument
    logger.error('quizService:createQuizFromDocument', 'Error in quiz creation process', {
      errorMessage: error.message,
      errorName: error.name,
    });
    throw new Error(`Quiz generation failed: ${error.message}`);
  }
};
/**
 * Gets quizzes for the current user with pagination support
 * @param {number} page - The page number to fetch (1-based)
 * @param {number} limit - Number of items per page
 * @returns {Promise<{quizzes: Array, total: number}>} - Paginated quizzes and total count
 */
export const getUserQuizzes = async (page = 1, limit = 10) => {
  logger.info('quizService:getUserQuizzes', 'Attempting to retrieve quizzes', { page, limit });
  try {
    const isConnected = await NetworkService.isNetworkAvailable();
    
    if (!isConnected) {
      logger.info('quizService:getUserQuizzes', 'Device is offline, fetching from local storage');
      const offlineQuizzes = await offlineService.getOfflineQuizzes();
      return { quizzes: offlineQuizzes, total: offlineQuizzes.length };
    }

    const supabaseClient = getSupabase();
    const { data: authData, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !authData || !authData.user) {
      logger.error('quizService:getUserQuizzes', 'Error fetching user or no authenticated user found', userError);
      throw new Error('User must be authenticated to view quizzes');
    }
    const user = authData.user;
    logger.info('quizService:getUserQuizzes', 'User authenticated, fetching quizzes', { userId: user.id, page, limit });

    // Calculate offset for pagination (0-based for Supabase range)
    const offset = (page - 1) * limit;
    
    logger.debug('quizService:getUserQuizzes', 'Pagination details', { 
      page, 
      limit, 
      offset, 
      rangeStart: offset, 
      rangeEnd: offset + limit - 1 
    });

    // First get the total count of quizzes for this user
    const { count, error: countError } = await supabaseClient
      .from('quizzes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
      
    if (countError) {
      logger.error('quizService:getUserQuizzes', 'Error getting total quiz count', countError);
    }
    
    // Now fetch the actual page of quizzes
    const { data: quizzesData, error: quizzesError } = await supabaseClient
      .from('quizzes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (quizzesError) {
      logger.error('quizService:getUserQuizzes', 'Error fetching quizzes from Supabase', quizzesError);
      const offlineQuizzes = await offlineService.getOfflineQuizzes();
      if (offlineQuizzes.length > 0) {
        logger.info('quizService:getUserQuizzes', 'Returning offline quizzes due to Supabase fetch error');
        return { quizzes: offlineQuizzes, total: offlineQuizzes.length };
      }
      throw new Error(`Failed to fetch quizzes: ${quizzesError.message}`);
    }

    const onlineQuizzes = quizzesData || [];
    const totalCount = count || onlineQuizzes.length;
    
    logger.info('quizService:getUserQuizzes', 'Successfully fetched quizzes from Supabase', { 
      count: onlineQuizzes.length, 
      totalCount, 
      page, 
      offset,
      hasMore: totalCount > (offset + onlineQuizzes.length)
    });

    // Add detailed debugging info for each quiz to help track pagination issues
    if (onlineQuizzes.length > 0) {
      // Log the first and last quiz details
      logger.debug('quizService:getUserQuizzes', 'Quiz details for debugging', {
        firstQuizId: onlineQuizzes[0]?.id,
        lastQuizId: onlineQuizzes[onlineQuizzes.length - 1]?.id,
        firstQuizDate: onlineQuizzes[0]?.created_at,
        lastQuizDate: onlineQuizzes[onlineQuizzes.length - 1]?.created_at
      });
      
      // Log all quiz IDs for detailed debugging
      logger.debug('quizService:getUserQuizzes', 'All quiz IDs in this page', {
        quizIds: onlineQuizzes.map(q => q.id),
        page,
        offset
      });
    } else if (totalCount > 0) {
      // If we expect quizzes but got none, log a warning
      logger.warn('quizService:getUserQuizzes', 'No quizzes returned despite non-zero total count', {
        page,
        offset,
        totalCount
      });
    }

    // Trigger background caching instead of doing it synchronously
    // This allows the UI to render the quiz list immediately
    setTimeout(() => {
      cacheQuizzesInBackground(onlineQuizzes);
    }, 0);
    
    return { quizzes: onlineQuizzes, total: totalCount };

  } catch (error) {
    logger.error('quizService:getUserQuizzes', 'General error in getUserQuizzes', error);
    try {
      const offlineQuizzes = await offlineService.getOfflineQuizzes();
      if (offlineQuizzes.length > 0) {
        logger.info('quizService:getUserQuizzes', 'Returning offline quizzes due to general error');
        return { quizzes: offlineQuizzes, total: offlineQuizzes.length };
      }
    } catch (offlineError) {
      logger.error('quizService:getUserQuizzes', 'Failed to fetch offline quizzes after general error', offlineError);
    }
    throw error;
  }
};

/**
 * Retrieves a specific quiz with its questions
 * @param {string} quizId - The ID of the quiz to retrieve
 * @returns {Promise<Object>} - Quiz object with questions
 */
export const getQuizWithQuestions = async (quizId) => {
  try {
    if (!quizId) {
      throw new Error('Quiz ID is required');
    }

    // Check network status
    const isConnected = await offlineService.getNetworkStatus();
    
    if (!isConnected) {
      logger.info('quizService:getQuizWithQuestions', 'Device is offline, fetching from local storage', { quizId });
      const offlineQuiz = await offlineService.getOfflineQuizWithQuestions(quizId);
      if (offlineQuiz) {
        return offlineQuiz;
      }
      throw new Error('Quiz not available offline. Please connect to the internet and try again.');
    }

    // Get a validated Supabase client
    const supabaseClient = getSupabase();

    // Get the current user
    const { data, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !data || !data.user) {
      logger.error('quizService:getQuizWithQuestions', 'Error fetching user or no authenticated user found', userError);
      throw new Error('User must be authenticated to retrieve quiz details');
    }
    
    const user = data.user;

    logger.info('quizService:getQuizWithQuestions', 'Fetching quiz with questions', { quizId });

    // Fetch the quiz
    const { data: quiz, error: quizError } = await supabaseClient
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .eq('user_id', user.id) // Ensure the user can only access their own quizzes
      .single();

    if (quizError) {
      logger.error('quizService:getQuizWithQuestions', 'Error fetching quiz', quizError);
      
      // Try to get from offline storage if online fetch fails
      const offlineQuiz = await offlineService.getOfflineQuizWithQuestions(quizId);
      if (offlineQuiz) {
        logger.info('quizService:getQuizWithQuestions', 'Retrieved quiz from offline storage after online error');
        return offlineQuiz;
      }
      
      throw new Error(`Failed to fetch quiz: ${quizError.message}`);
    }

    // Fetch the questions for this quiz
    const { data: questions, error: questionsError } = await supabaseClient
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true });

    if (questionsError) {
      logger.error('quizService:getQuizWithQuestions', 'Error fetching quiz questions', questionsError);
      
      // Try to get from offline storage if online fetch fails
      const offlineQuiz = await offlineService.getOfflineQuizWithQuestions(quizId);
      if (offlineQuiz) {
        logger.info('quizService:getQuizWithQuestions', 'Retrieved quiz from offline storage after questions fetch error');
        return offlineQuiz;
      }
      
      throw new Error(`Failed to fetch quiz questions: ${questionsError.message}`);
    }

    // Prepare the full quiz with questions
    const fullQuiz = {
      ...quiz,
      questions: questions || []
    };

    // Save the quiz for offline use
    try {
      await offlineService.saveQuizOffline(fullQuiz);
      logger.info('quizService:getQuizWithQuestions', 'Saved quiz for offline use', { quizId });
    } catch (offlineError) {
      logger.warn('quizService:getQuizWithQuestions', 'Failed to save quiz for offline use', offlineError);
    }

    logger.info(
      'quizService:getQuizWithQuestions',
      { 
        details: 'Successfully fetched quiz with questions',
        quizId: quizId,
        questionCount: questions?.length || 0
      }
    );

    logger.debug('quizService:getQuizWithQuestions - DIAGNOSTIC - Pre-Loop Check', {
      quizId: fullQuiz.id,
      questionsPresent: !!(fullQuiz && fullQuiz.questions),
      questionsIsArray: Array.isArray(fullQuiz.questions),
      numberOfQuestions: (fullQuiz && fullQuiz.questions) ? fullQuiz.questions.length : 'N/A'
    });

    // Diagnostic logging for question.text structure
    if (fullQuiz && fullQuiz.questions && Array.isArray(fullQuiz.questions)) {
      fullQuiz.questions.forEach((q, index) => {
        logger.debug('quizService:getQuizWithQuestions - DIAGNOSTIC', {
          quizId: fullQuiz.id,
          questionIndex: index,
          questionId: q.id,
          typeOfQuestionText: typeof q.text,
          questionTextValue: (typeof q.text === 'object') ? JSON.stringify(q.text) : q.text,
          allQuestionKeys: Object.keys(q),
          questionOptionsData: JSON.stringify(q.options) // Log the options structure
        });
      });
    }

    return fullQuiz;
  } catch (error) {
    logger.error('quizService:getQuizWithQuestions', 'Error retrieving quiz with questions', error);
    
    // Last resort: try to get from offline storage
    try {
      const offlineQuiz = await offlineService.getOfflineQuizWithQuestions(quizId);
      if (offlineQuiz) {
        logger.info('quizService:getQuizWithQuestions', 'Retrieved quiz from offline storage as last resort');
        return offlineQuiz;
      }
    } catch (offlineError) {
      logger.error('quizService:getQuizWithQuestions', 'Failed to get offline quiz after all other attempts', offlineError);
    }
    
    throw error;
  }
};

/**
 * Deletes a quiz and its questions
 * @param {string} quizId - The ID of the quiz to delete
 * @returns {Promise<void>}
 */
export const deleteQuiz = async (quizId) => {
  try {
    if (!quizId) {
      throw new Error('Quiz ID is required');
    }

    // Get a validated Supabase client
    const supabaseClient = getSupabase();

    // Get the current user
    const { data, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !data || !data.user) {
      logger.error('quizService:deleteQuiz', 'Error fetching user or no authenticated user found', userError);
      throw new Error('User must be authenticated to delete quizzes');
    }
    
    const user = data.user;

    logger.info('quizService:deleteQuiz', 'Deleting quiz', { quizId });

    // Verify the quiz belongs to the user
    const { data: quiz, error: quizError } = await supabaseClient
      .from('quizzes')
      .select('id')
      .eq('id', quizId)
      .eq('user_id', user.id)
      .single();

    if (quizError || !quiz) {
      logger.error('quizService:deleteQuiz', 'Error verifying quiz ownership or quiz not found', quizError);
      throw new Error('Quiz not found or you do not have permission to delete it');
    }

    // --- Start: Delete related data for the quiz ---

    // 1. Delete all questions for the quiz
    logger.info('quizService:deleteQuiz', `Deleting questions for quiz ${quizId}`);
    const { error: questionsDeleteError } = await supabaseClient
      .from('questions')
      .delete()
      .eq('quiz_id', quizId);

    if (questionsDeleteError) {
      logger.error('quizService:deleteQuiz', 'Error deleting quiz questions', questionsDeleteError);
      throw new Error(`Failed to delete quiz questions: ${questionsDeleteError.message}`);
    }

    // 2. Get all attempt IDs for the quiz
    const { data: attempts, error: attemptsFetchError } = await supabaseClient
      .from('quiz_attempts')
      .select('id')
      .eq('quiz_id', quizId);

    if (attemptsFetchError) {
      logger.error('quizService:deleteQuiz', 'Error fetching quiz attempts for deletion', attemptsFetchError);
      throw new Error(`Failed to fetch quiz attempts: ${attemptsFetchError.message}`);
    }

    if (attempts && attempts.length > 0) {
      const attemptIds = attempts.map(a => a.id);

      // 2. Delete all quiz_question_responses for those attempts
      logger.info('quizService:deleteQuiz', `Deleting ${attemptIds.length} sets of question responses for quiz ${quizId}`);
      const { error: responsesDeleteError } = await supabaseClient
        .from('quiz_question_responses')
        .delete()
        .in('attempt_id', attemptIds);

      if (responsesDeleteError) {
        logger.error('quizService:deleteQuiz', 'Error deleting quiz question responses', responsesDeleteError);
        throw new Error(`Failed to delete quiz question responses: ${responsesDeleteError.message}`);
      }

      // 3. Delete all quiz_attempts for the quiz
      logger.info('quizService:deleteQuiz', `Deleting ${attempts.length} attempts for quiz ${quizId}`);
      const { error: attemptsDeleteError } = await supabaseClient
        .from('quiz_attempts')
        .delete()
        .eq('quiz_id', quizId); // or .in('id', attemptIds)

      if (attemptsDeleteError) {
        logger.error('quizService:deleteQuiz', 'Error deleting quiz attempts', attemptsDeleteError);
        throw new Error(`Failed to delete quiz attempts: ${attemptsDeleteError.message}`);
      }
    } else {
      logger.info('quizService:deleteQuiz', `No attempts found for quiz ${quizId}, skipping deletion of attempts and responses.`);
    }
    // --- End: Delete related data for the quiz ---

    // Then delete the quiz
    const { error: quizDeleteError } = await supabaseClient
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    if (quizDeleteError) {
      logger.error('quizService:deleteQuiz', 'Error deleting quiz', quizDeleteError);
      throw new Error(`Failed to delete quiz: ${quizDeleteError.message}`);
    }

    logger.info('quizService:deleteQuiz', 'Successfully deleted quiz and its related data (attempts, responses)', { quizId });
  } catch (error) {
    logger.error('quizService:deleteQuiz', 'Error in quiz deletion process', error);
    throw error;
  }
};

/**
 * Submit a quiz attempt, works both online and offline
 * @param {string} quizId - The ID of the quiz
 * @param {Array} answers - Array of user answers with question IDs
 * @param {number} score - The score achieved (0-100)
 * @param {number} completionTime - Time taken to complete in seconds
 * @returns {Promise<Object>} - The created attempt
 */
export const submitQuizAttempt = async (quizId, answers, score, completionTime) => {
  logger.info('quizService:submitQuizAttempt', 'Attempting to submit quiz', { quizId, score, answersCount: answers.length });

  try {
    const supabaseClient = getSupabase();
    const isConnected = await offlineService.getNetworkStatus();

    // Get the current user. This is needed for user_id in online submissions 
    // and potentially for metadata.
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    // Critical: If no user for an online submission, we cannot satisfy NOT NULL for user_id
    if (!user && isConnected) { 
        logger.error('quizService:submitQuizAttempt', 'User not authenticated for online submission. Quiz attempt cannot be saved.', userError);
        throw new Error('User not authenticated. Cannot submit quiz online.');
    }
    // If offline, or if user is null but we are offline, offlineService will handle user_id later
    // If online and user is null, the above throw would have triggered.
    // If user is present (and online), it will be used.

    // Create the base attempt object (without id, as it's auto-generated by Supabase)
    const attemptData = {
      quiz_id: quizId,
      score,
      completion_time: completionTime,
      attempted_at: new Date().toISOString(),
      metadata: {
        appVersion: Constants.expoConfig.version,
        platform: Platform.OS,
        ...(user && { userIdForMetadata: user.id }), 
      },
    };

    if (!isConnected) {
      logger.info('quizService:submitQuizAttempt', 'Device is offline, saving attempt locally');
      const offlineAttempt = await offlineService.saveQuizAttemptOffline(attemptData, answers);
      return offlineAttempt;
    }

    // If online, proceed with direct submission
    logger.info('quizService:submitQuizAttempt', 'Device is online, submitting attempt directly', { quizId, score });

    const insertData = {
      ...attemptData,
      user_id: user.id, // CRITICAL: Add user_id for online inserts
    };

    logger.debug('quizService:submitQuizAttempt', 'Raw insert data:', insertData);
    logger.debug('quizService:submitQuizAttempt', 'Submitting to quiz_attempts with data:', insertData);

    const { data: dbAttempt, error: attemptError } = await supabaseClient
      .from('quiz_attempts')
      .insert(insertData)
      .select()
      .single();

    if (attemptError) {
      logger.error('quizService:submitQuizAttempt', 'Database error inserting quiz attempt:', attemptError);
      // The previous console.log(attemptError) might not have been fully captured or stringified well by all log viewers.
      logger.error('quizService:submitQuizAttempt', 'Error inserting quiz attempt, attempting offline save. Full error object:', attemptError); 
      logger.error('quizService:submitQuizAttempt', 'Error details for quiz_attempts insert:', { 
        errorMessage: attemptError.message,
        errorCode: attemptError.code,
        errorDetails: attemptError.details,
        errorHint: attemptError.hint || 'No hint provided'
      });
      const fallbackAttemptAfterError = await offlineService.saveQuizAttemptOffline(attemptData, answers);
      return fallbackAttemptAfterError;
    }

    logger.info('quizService:submitQuizAttempt', 'Quiz attempt submitted successfully online', { attemptId: dbAttempt.id });

    if (dbAttempt && dbAttempt.id) {
      const responsesData = answers.map(answer => ({
        attempt_id: dbAttempt.id,
        question_id: answer.questionId, 
        selected_answer: answer.selectedAnswer,
        selected_answer_index: answer.selectedAnswerIndex,
        is_correct: answer.isCorrect,
        response_time: answer.responseTime || 0,
      }));

      const { error: responsesError } = await supabaseClient
        .from('quiz_question_responses')
        .insert(responsesData);

      if (responsesError) {
        logger.error('quizService:submitQuizAttempt', 'Error inserting quiz question responses online', {
          errorMessage: responsesError.message,
          errorCode: responsesError.code,
          errorDetails: responsesError.details
        });
      } else {
        logger.info('quizService:submitQuizAttempt', 'Quiz question responses submitted successfully online');
      }
    } else {
        logger.error('quizService:submitQuizAttempt', 'No attempt ID returned after insert, cannot save responses online.');
    }
    
    return dbAttempt;

  } catch (error) {
    logger.error('quizService:submitQuizAttempt', 'Failed to submit quiz attempt', { 
        errorMessage: error.message,
        errorStack: error.stack,
        quizId, 
        score 
    });
    // Fallback: Try to save offline if any unhandled error occurs during online submission processing.
    // Construct attemptData for offline saving. User may or may not be available here.
    const fallbackAttemptData = {
        quiz_id: quizId,
        score,
        completion_time: completionTime,
        attempted_at: new Date().toISOString(),
        metadata: {
            appVersion: Constants.expoConfig.version,
            platform: Platform.OS,
            // If user was fetched earlier and is in scope, could add userIdForMetadata
        }
    };
    try {
        logger.info('quizService:submitQuizAttempt', 'Attempting to save offline due to unhandled error during submission process.');
        const finalFallbackAttempt = await offlineService.saveQuizAttemptOffline(fallbackAttemptData, answers);
        return finalFallbackAttempt;
    } catch (offlineError) {
      logger.error('quizService:submitQuizAttempt', 'Failed to save attempt offline after all other attempts', offlineError);
      throw error;
    }
  }
};

/**
 * Sync offline data with the server
 * @returns {Promise<Object>} Results of the sync operation
 */
export const syncOfflineData = async () => {
  try {
    logger.info('quizService:syncOfflineData', 'Starting offline data synchronization');
    const result = await offlineService.syncOfflineData();
    logger.info('quizService:syncOfflineData', 'Offline data synchronization completed', result);
    return result;
  } catch (error) {
    logger.error('quizService:syncOfflineData', 'Error syncing offline data', error);
    throw error;
  }
};

/**
 * Helper function to cache quizzes in the background
 * This is called after the main quiz list is returned to the UI
 * @param {Array} quizzes - Array of quiz objects to cache
 */
const cacheQuizzesInBackground = async (quizzes) => {
  logger.info('quizService:cacheQuizzesInBackground', `Starting background caching for ${quizzes.length} quizzes`);
  
  for (const quiz of quizzes) {
    try {
      const fullQuiz = await getQuizWithQuestions(quiz.id);
      if (fullQuiz) {
        await offlineService.saveQuizOffline(fullQuiz);
        logger.debug('quizService:cacheQuizzesInBackground', `Successfully cached quiz ${quiz.id} offline.`);
      } else {
        logger.warn('quizService:cacheQuizzesInBackground', `Could not retrieve full details for quiz ${quiz.id} (getQuizWithQuestions returned no data but no error).`);
      }
    } catch (error) {
      logger.error(
        'quizService:cacheQuizzesInBackground',
        `Error caching quiz ${quiz.id}`, 
        { quizId: quiz.id, errorMessage: error.message, errorStack: error.stack }
      );
      // Continue to the next quiz in the loop
    }
  }
  
  logger.info('quizService:cacheQuizzesInBackground', `Completed background caching attempt for ${quizzes.length} quizzes`);
};

export const generateQuizFromDocuments = async (documentIds, difficulty = 'medium', questionCount = 5, onProgressUpdate = () => {}) => {
  var quizTitle = '';
  try {
    onProgressUpdate('Validating inputs and user session...');
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      logger.error('quizService:generateQuizFromDocuments', 'Missing or invalid documentIds parameter');
      throw new Error('Document IDs are required to generate a quiz');
    }

    const supabaseClient = getSupabase();
    logger.info('quizService:generateQuizFromDocuments', 'Fetching current user');
    const { data: authData, error: userError } = await supabaseClient.auth.getUser();

    if (userError) {
      logger.error('quizService:generateQuizFromDocuments', 'Error fetching user', userError);
      throw new Error(`Authentication error: ${userError.message}`);
    }
    if (!authData || !authData.user) {
      logger.error('quizService:generateQuizFromDocuments', 'No authenticated user found');
      throw new Error('User must be authenticated to create quizzes');
    }
    const user = authData.user;

    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !sessionData.session) {
      logger.error('quizService:generateQuizFromDocuments', 'Invalid or expired session', sessionError);
      throw new Error('Your session has expired. Please sign in again.');
    }
    logger.info('quizService:generateQuizFromDocuments', 'User authenticated', { userId: user.id });
    
    // Initialize userProfile with safe defaults
    let userProfile = { plan: 'basic', monthly_quizzes_remaining: 0 };
    
    try {
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('plan, monthly_quizzes_remaining, last_quota_reset_date')
        .eq('id', user.id)
        .single();

      if (profileError) {
        logger.error('quizService:generateQuizFromDocuments', 'Error fetching user profile', { userId: user.id, error: profileError });
        logger.warn('quizService:generateQuizFromDocuments', 'Using default basic profile due to fetch error', { userId: user.id });
      } else if (!profileData) {
        logger.warn('quizService:generateQuizFromDocuments', 'No profile found for user, using default basic plan limits', { userId: user.id });
      } else {
        userProfile = profileData;
      }
      logger.info('quizService:generateQuizFromDocuments', 'User profile fetched', { userId: user.id, plan: userProfile.plan, remaining: userProfile.monthly_quizzes_remaining });
    } catch (e) {
      logger.error('quizService:generateQuizFromDocuments', 'Exception fetching user profile', { userId: user.id, error: e });
      logger.warn('quizService:generateQuizFromDocuments', 'Using default basic profile due to exception', { userId: user.id });
      userProfile = { plan: 'basic', monthly_quizzes_remaining: 0 };
    }
    
    onProgressUpdate('User authenticated. Fetching selected documents...');

    logger.info('quizService:generateQuizFromDocuments', 'Fetching document details for IDs:', { documentIds });
    const { data: documents, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .in('id', documentIds);

    if (docError) {
      logger.error('quizService:generateQuizFromDocuments', 'Error fetching documents by IDs', docError);
      throw new Error(`Failed to fetch document details: ${docError.message}`);
    }
    if (!documents || documents.length !== documentIds.length) {
      logger.error('quizService:generateQuizFromDocuments', 'Could not find all documents for the given IDs', { requested: documentIds.length, found: documents ? documents.length : 0 });
      throw new Error('One or more specified documents could not be found. Please check your selection.');
    }
    logger.info('quizService:generateQuizFromDocuments', 'Successfully fetched all document objects', { count: documents.length });
    onProgressUpdate(`Found ${documents.length} document(s). Preparing content for AI...`);

    logger.info('quizService:generateQuizFromDocuments', 'Generating quiz content via AI for multiple documents', { difficulty });
    onProgressUpdate('Requesting exam content from AI...');
    let aiQuizData;
    try {
      aiQuizData = await geminiService.generateQuestionsFromMultipleDocuments(documents, questionCount, difficulty);
      logger.info('Received aiQuizData from geminiService', { data: JSON.stringify(aiQuizData), message: 'quizService:generateQuizFromDocuments' });
      if (!aiQuizData || !aiQuizData.questions || aiQuizData.questions.length === 0) {
        logger.error('quizService:generateQuizFromDocuments', 'Invalid or incomplete questions data from geminiService (multiple docs)', { responseData: aiQuizData });
        throw new Error('Failed to generate complete quiz questions from the documents');
      }

      // Validate each question in the AI response
      for (let i = 0; i < aiQuizData.questions.length; i++) {
        const q = aiQuizData.questions[i];
        const questionText = q.text || q.question_text;
        
        if (!questionText) {
          logger.error('quizService:generateQuizFromDocuments', `AI response validation failed: Question ${i} missing text`, { questionData: q });
          throw new Error(`AI generated invalid question data: Question ${i} is missing question text`);
        }
        
        if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
          logger.error('quizService:generateQuizFromDocuments', `AI response validation failed: Question ${i} has invalid options`, { questionData: q });
          throw new Error(`AI generated invalid question data: Question ${i} has no valid options`);
        }
        
        if (!q.correct_answer_id) {
          logger.error('quizService:generateQuizFromDocuments', `AI response validation failed: Question ${i} missing correct_answer_id`, { questionData: q });
          throw new Error(`AI generated invalid question data: Question ${i} is missing correct answer ID`);
        }
        
        // Validate that correct_answer_id exists in options
        const hasCorrectOption = q.options.some(opt => opt && opt.id === q.correct_answer_id);
        if (!hasCorrectOption) {
          logger.error('quizService:generateQuizFromDocuments', `AI response validation failed: Question ${i} correct_answer_id not found in options`, { questionData: q });
          throw new Error(`AI generated invalid question data: Question ${i} correct answer '${q.correct_answer_id}' not found in options`);
        }
      }
      
      logger.info('quizService:generateQuizFromDocuments', `AI response validation passed: ${aiQuizData.questions.length} questions validated successfully`);
      
      const titles = documents.map(doc => doc.title);
      if (aiQuizData && typeof aiQuizData.title === 'string' && aiQuizData.title.trim() !== '') {
        quizTitle = aiQuizData.title;
        logger.info('Using title from AI.', { quizTitleValue: quizTitle, message: 'quizService:generateQuizFromDocuments' });
      } else {
        logger.info('No valid title from AI or aiQuizData.title is missing/empty.', { providedTitle: aiQuizData ? aiQuizData.title : 'aiQuizData missing', message: 'quizService:generateQuizFromDocuments' });
        const firstDocTitle = titles.length > 0 ? titles[0] : 'Untitled Document';
        quizTitle = titles.length > 1 ? `Quiz from ${firstDocTitle} and ${titles.length - 1} other(s)` : `Quiz from ${firstDocTitle}`;
        logger.info('Generated default title.', { quizTitleValue: quizTitle, message: 'quizService:generateQuizFromDocuments' });
      }
      logger.info('Final quizTitle before DB insert:', { quizTitleValue: quizTitle, type: typeof quizTitle, message: 'quizService:generateQuizFromDocuments' });
      onProgressUpdate('AI processing complete. Structuring quiz data...');
    } catch (geminiError) {
      logger.error('quizService:generateQuizFromDocuments', 'Error in geminiService.generateQuestionsFromMultipleDocuments or subsequent quizTitle processing', geminiError);
      if (typeof quizTitle === 'undefined' || quizTitle === null || quizTitle.toString().trim() === '') {
          const titles = documents.map(doc => doc.title); 
          const firstDocTitle = titles.length > 0 ? titles[0] : 'Untitled Document';
          quizTitle = titles.length > 1 ? `Quiz from ${firstDocTitle} and ${titles.length - 1} other(s)` : `Quiz from ${firstDocTitle}`;
          logger.warn('quizService:generateQuizFromDocuments', 'quizTitle was undefined/empty after geminiError, set to default.', { quizTitleValue: quizTitle });
      }
      throw new Error(`Failed to generate quiz content via AI: ${geminiError.message}`);
    }
      
    let quiz = null;
    try {
      logger.info('quizService:generateQuizFromDocuments', 'PRE-CALL to enforceQuizLimit for user', { userId: user.id });
      await enforceQuizLimit(user.id, supabaseClient, userProfile);

      const quizData = {
        user_id: user.id,
        title: quizTitle.trim(),
        document_ids: documentIds,
        question_count: aiQuizData.questions.length,
        created_at: new Date().toISOString(),
        status: 'active'
      };
      
      logger.info('quizService:generateQuizFromDocuments', 'Inserting quiz record for multiple documents', quizData);
      onProgressUpdate('Saving quiz structure to database...');
      let newQuizData, quizInsertError;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          logger.info('quizService:generateQuizFromDocuments', `Retrying quiz insertion (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
        const { data, error } = await supabaseClient
          .from('quizzes')
          .insert(quizData)
          .select()
          .single();
        newQuizData = data;
        quizInsertError = error;
        if (!quizInsertError) break; 
      }

      if (quizInsertError) {
        logger.error('Database error creating quiz. Full error object:', { errorObject: JSON.stringify(quizInsertError, Object.getOwnPropertyNames(quizInsertError)), quizTitleAtError: quizTitle, message: 'quizService:generateQuizFromDocuments' });
        throw new Error(`Database error: ${quizInsertError.message}`);
      }
      if (!newQuizData) {
        logger.error('quizService:generateQuizFromDocuments', 'Quiz creation (multiple docs) returned no data but also no error');
        throw new Error('Quiz creation failed: No quiz data returned');
      }
      quiz = newQuizData;
      logger.info('quizService:generateQuizFromDocuments', 'Quiz record for multiple documents created successfully', { quizId: quiz.id });
      onProgressUpdate('Quiz structure saved. Preparing to save questions...');

      const questionsToInsert = aiQuizData.questions.map((q, index) => {
        // Handle both 'text' and 'question_text' properties from AI response
        const questionText = q.text || q.question_text;
        if (!questionText) {
            logger.error('quizService:generateQuizFromDocuments', `Question at index ${index} missing both 'text' and 'question_text' properties.`, { questionData: q });
            throw new Error(`Data integrity issue: Question at index ${index} is missing question text.`);
        }

        // Validate options array
        if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
            logger.error('quizService:generateQuizFromDocuments', `Question at index ${index} missing or invalid options array.`, { questionData: q });
            throw new Error(`Data integrity issue: Question at index ${index} has invalid options.`);
        }

        const correctOption = q.options.find(opt => opt.id === q.correct_answer_id);
        if (!correctOption) {
            logger.error('quizService:generateQuizFromDocuments', `Correct answer ID '${q.correct_answer_id}' not found in options for question (index ${index}).`, { questionData: q });
            throw new Error(`Data integrity issue: Correct answer ID '${q.correct_answer_id}' not found for question: "${questionText.substring(0, 50)}..."`);
        }
        const correctOptionIndex = q.options.indexOf(correctOption);

        return {
            quiz_id: quiz.id,
            text: questionText, // Use the resolved question text
            options: q.options,
            correct_answer: q.correct_answer_id,
            correct_answer_index: correctOptionIndex,
            explanation: q.explanation || null,
            order_index: index
        };
      });

      logger.info('quizService:generateQuizFromDocuments', 'Preparing to insert questions for multi-doc quiz', { count: questionsToInsert.length });
      onProgressUpdate(`Saving ${questionsToInsert.length} question(s)...`);
      logger.debug('quizService:generateQuizFromDocuments', 'Attempting to insert questions:', JSON.stringify(questionsToInsert, null, 2)); // DEBUG LOG ADDED
      const { data: insertedQuestions, error: questionsInsertError } = await supabaseClient
        .from('questions')
        .insert(questionsToInsert)
        .select();

      if (questionsInsertError) {
        logger.error('quizService:generateQuizFromDocuments', 'Error inserting questions for multi-doc quiz, attempting rollback', { error: questionsInsertError, quizId: quiz.id });
        await supabaseClient.from('quizzes').delete().eq('id', quiz.id);
        logger.warn('quizService:generateQuizFromDocuments', 'Orphaned quiz record deleted due to question insertion failure', { quizId: quiz.id });
        throw new Error(`Failed to save questions: ${questionsInsertError.message}. Quiz creation rolled back.`);
      }
      
      logger.info('quizService:generateQuizFromDocuments', 'Questions for multi-doc quiz inserted successfully', { count: insertedQuestions ? insertedQuestions.length : 0 });
      onProgressUpdate('All questions saved. Quiz generation complete!');
      return { ...quiz, questions: insertedQuestions || [] };

    } catch (dbError) {
      logger.error('quizService:generateQuizFromDocuments', 'Exception during multi-doc quiz creation database operation', { 
        fullError: JSON.stringify(dbError, Object.getOwnPropertyNames(dbError)), 
        errorMessage: dbError.message 
      });
      const finalQuizTitle = (typeof quizTitle === 'string' && quizTitle.trim() !== '') ? quizTitle.trim() : 'Unknown Title';
      onProgressUpdate('Error during database operations. Please try again.');
      throw new Error(`Database error creating quiz "${finalQuizTitle}": ${dbError.message}`);
    }
  } catch (error) {
    onProgressUpdate('An unexpected error occurred during quiz generation.'); // Generic message for top-level catch
    logger.error('quizService:generateQuizFromDocuments', 'Top-level error in generateQuizFromDocuments', error);
    throw error; // Re-throw the original error after updating progress
  }
};

export default {
  createQuizFromDocument,
  generateQuizFromDocuments,
  getUserQuizzes,
  getQuizWithQuestions,
  deleteQuiz,
  submitQuizAttempt,
  syncOfflineData
};
