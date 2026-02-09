/**
 * Gemini AI Service
 * 
 * This service provides an interface to the Google Gemini API for generating
 * quiz questions directly from document files.
 */

import Constants from 'expo-constants';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase, getSupabase, isSupabaseReady } from './supabaseClient.js';
import logger from './loggerService.js';
import { ProductionQuizGenerator } from '../utils/quizParserUtils.js';
import { ScalableQuizGenerator } from '../utils/scalableQuizUtils.js';

// Helper function to get a validated Supabase client
const getValidatedSupabase = () => {
  if (typeof window === 'undefined') {
    logger.warn('geminiService', 'Attempted to access Supabase during SSR');
    throw new Error('Database access is not available during server-side rendering');
  }
  
  if (!isSupabaseReady()) {
    logger.error('geminiService', 'Supabase client is not ready');
    throw new Error('Database services are not initialized yet');
  }
  
  return getSupabase();
};

// Get API key from environment variables
const GOOGLE_API_KEY = Constants.expoConfig?.extra?.GOOGLE_API_KEY;

// Initialize the Google Generative AI client
let genAI = null;
try {
  if (!GOOGLE_API_KEY) {
    logger.error('geminiService', 'Google API key is not configured');
  } else {
    genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    logger.info('geminiService', 'Google Generative AI client initialized');
  }
} catch (error) {
  logger.error('geminiService', 'Failed to initialize Google Generative AI client', error);
}

/**
 * Converts a file to a GoogleGenerativeAI.Part object
 * @param {Blob} fileBlob - The file blob
 * @param {string} mimeType - The MIME type of the file
 * @returns {Promise<Object>} - A Part object for the Gemini API
 */
// Document size limits for AI processing (to prevent token limit issues)
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit for AI processing
const MAX_DOCUMENT_SIZE_MB = MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);

const fileToGenerativePart = async (fileBlob, mimeType) => {
  logger.info('geminiService:fileToGenerativePart', 'Starting file to generative part conversion.', {
    inputType: typeof fileBlob,
    inputIsBlobInstance: fileBlob instanceof Blob,
    inputSize: fileBlob?.size,
    providedMimeType: mimeType
  });
  try {
    if (!fileBlob) {
      throw new Error('No file blob provided');
    }

    // Check document size before processing
    const fileSizeBytes = fileBlob.size || 0;
    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    
    if (fileSizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      const errorMessage = `Document too large for AI processing: ${fileSizeMB.toFixed(1)}MB exceeds ${MAX_DOCUMENT_SIZE_MB}MB limit. Large documents (like 274-page PDFs) cause AI response truncation and parsing failures.`;
      logger.error('geminiService:fileToGenerativePart', errorMessage, {
        fileSizeBytes,
        fileSizeMB: fileSizeMB.toFixed(1),
        maxSizeMB: MAX_DOCUMENT_SIZE_MB,
        mimeType
      });
      throw new Error(errorMessage);
    }
    
    if (fileSizeMB > 5) {
      logger.warn('geminiService:fileToGenerativePart', `Processing large document: ${fileSizeMB.toFixed(1)}MB. This may cause longer processing times or AI response issues.`, {
        fileSizeBytes,
        fileSizeMB: fileSizeMB.toFixed(1),
        mimeType
      });
    }

    logger.info('geminiService:fileToGenerativePart', 'Processing file for Gemini API', { 
      blobType: typeof fileBlob, 
      isBlob: fileBlob instanceof Blob,
      size: fileBlob.size || 'unknown',
      mimeType: mimeType || 'unknown'
    });

    let processedBlob = fileBlob;
    if (!(fileBlob instanceof Blob) && fileBlob.arrayBuffer) {
      logger.info('geminiService:fileToGenerativePart', 'Converting response to blob');
      processedBlob = await fileBlob.blob();
    }

    const base64Data = await blobToBase64(processedBlob);
    if (!base64Data) {
      logger.error('geminiService:fileToGenerativePart', 'Failed to convert file to base64. blobToBase64 returned null or empty.', { blobSize: processedBlob?.size });
      throw new Error('Failed to convert file to base64: No data returned.');
    }

    const effectiveMimeType = mimeType || 'application/pdf';
    logger.info('geminiService:fileToGenerativePart', 'Successfully converted file to base64 for Gemini API.', {
      base64Length: base64Data.length,
      base64Snippet: base64Data.substring(0, 100) + (base64Data.length > 100 ? '...' : ''),
      effectiveMimeType
    });
    
    return {
      inlineData: {
        data: base64Data,
        mimeType: effectiveMimeType
      }
    };
  } catch (error) {
    logger.error('geminiService:fileToGenerativePart', 'Error converting file to generative part.', {
      errorMessage: error.message,
      errorStack: error.stack,
      inputMimeType: mimeType,
      inputBlobSize: fileBlob?.size
    });
    // Re-throw the original error or a new one with more context if needed
    throw new Error(`Failed during fileToGenerativePart: ${error.message}`);
  }
};

/**
 * Converts a blob to a base64 string
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} - The base64 string
 */
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    try {
      if (!blob) {
        reject(new Error('Invalid blob: blob is null or undefined'));
        return;
      }
      
      if (!(blob instanceof Blob)) {
        logger.warn('geminiService:blobToBase64', 'Input is not a Blob instance, attempting to convert', { 
          type: typeof blob, 
          constructor: blob?.constructor?.name 
        });
        if (typeof blob === 'string') {
          blob = new Blob([blob], { type: 'text/plain' });
        } else if (blob instanceof ArrayBuffer) {
          blob = new Blob([blob]);
        }
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          if (!reader.result) {
            reject(new Error('FileReader result is null or undefined'));
            return;
          }
          
          const parts = reader.result.split(',');
          if (parts.length < 2) {
            reject(new Error('FileReader result does not contain expected format'));
            return;
          }
          
          const base64String = parts[1];
          resolve(base64String);
        } catch (parseError) {
          logger.error('geminiService:blobToBase64', 'Error processing FileReader result', parseError);
          reject(parseError);
        }
      };
      reader.onerror = (error) => {
        logger.error('geminiService:blobToBase64', 'FileReader error', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      logger.error('geminiService:blobToBase64', 'Error in blobToBase64', error);
      reject(error);
    }
  });
};

/**
 * Generates quiz questions from a single document using Google Gemini API.
 * Note: Title generation has been removed to simplify integration with ProductionQuizGenerator.
 * @param {Object} document - The document metadata from Supabase
 * @param {number} questionCount - Number of questions to generate (default: 10)
 * @param {string} difficulty - Desired difficulty level (currently not used by ProductionQuizGenerator directly but can be passed in options if needed)
 * @returns {Promise<Array>} - Array of generated questions
 */
export const generateQuestionsFromDocument = async (document, questionCount = 10, difficulty = 'medium') => {
  try {
    if (!genAI) {
      throw new Error('Google Generative AI client is not initialized. Check your API key configuration.');
    }
    if (!GOOGLE_API_KEY) {
      throw new Error('Google API key is not available for ProductionQuizGenerator.');
    }

    if (!document || !document.file_path) {
      throw new Error('Invalid document or missing file path');
    }

    logger.info('geminiService:generateQuestionsFromDocument', 'Generating quiz questions for single document', { 
      documentId: document.id, 
      questionCount,
      difficulty 
    });

    const supabaseClient = getValidatedSupabase();
    
    let fileData = null;
    let fileError = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries && !fileData) {
      if (retryCount > 0) {
        logger.info('geminiService:generateQuestionsFromDocument', `Retrying file download (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
      }
      
      const result = await supabaseClient.storage
        .from('documents')
        .download(document.file_path);
        
      fileData = result.data;
      fileError = result.error;
      
      if (fileError) {
        logger.warn('geminiService:generateQuestionsFromDocument', `File download attempt ${retryCount + 1} failed`, fileError);
      }
      retryCount++;
    }

    if (fileError || !fileData) {
      logger.error('geminiService:generateQuestionsFromDocument', 'Failed to download document from storage after multiple retries', fileError);
      throw new Error(`Failed to download document: ${fileError?.message || 'Unknown error'}`);
    }

    const fileSizeMB = (fileData.size || 0) / (1024 * 1024);
    logger.info('geminiService:generateQuestionsFromDocument', 'Document downloaded successfully', { 
      size: fileData.size,
      sizeMB: fileSizeMB.toFixed(1)
    });
    
    const mimeType = document.document_type || 'application/pdf'; // Fallback to PDF if type is unknown
    
    let filePart;
    try {
      filePart = await fileToGenerativePart(fileData, mimeType);
    } catch (sizeError) {
      if (sizeError.message && sizeError.message.includes('Document too large for AI processing')) {
        logger.error('geminiService:generateQuestionsFromDocument', 'Document is too large for AI processing', {
          documentId: document.id,
          title: document.title,
          sizeMB: fileSizeMB.toFixed(1),
          error: sizeError.message
        });
        throw new Error(`Document "${document.title || 'Untitled'}" is too large for AI processing (${fileSizeMB.toFixed(1)}MB). Please use a smaller document or split large documents into smaller sections.`);
      }
      throw sizeError; // Re-throw other errors
    }

    const generator = new ProductionQuizGenerator(GOOGLE_API_KEY, genAI, {
      enableLogging: true, // Or false, depending on your preference
      model: 'gemini-1.5-flash-latest' // Or your preferred model
    });

    const documentParts = [filePart]; // ProductionQuizGenerator expects an array of parts

    logger.info('geminiService:generateQuestionsFromDocument', 'Calling ProductionQuizGenerator for single document', { questionCount });
    const generationResult = await generator.generateQuiz(documentParts, questionCount);

    if (generationResult.success && generationResult.quiz && Array.isArray(generationResult.quiz.questions)) {
      logger.info('geminiService:generateQuestionsFromDocument', 'Successfully generated questions from single document', {
        questionsGenerated: generationResult.quiz.questions.length,
        metadata: generationResult.metadata
      });
      return generationResult.quiz.questions;
    } else {
      logger.error('geminiService:generateQuestionsFromDocument', 'Failed to generate questions using ProductionQuizGenerator', {
        error: generationResult.error,
        metadata: generationResult.metadata
      });
      throw new Error(`Failed to generate quiz: ${generationResult.error || 'Unknown generator error'}`);
    }

  } catch (error) {
    logger.error('geminiService:generateQuestionsFromDocument', 'Error generating questions from document', error);
    throw error;
  }
};

/**
 * Generates quiz questions from multiple documents using Google Gemini API
 * @param {Array<Object>} documents - Array of document metadata from Supabase
 * @param {number} questionCount - Total number of questions to generate (default: 10)
 * @param {string} difficulty - Desired difficulty level (currently not used by ProductionQuizGenerator directly)
 * @returns {Promise<Array>} - Array of generated questions
 */
export const generateQuestionsFromMultipleDocuments = async (documents, questionCount = 10, difficulty = 'medium', onProgressUpdate = () => {}) => {
  logger.info('geminiService:generateQuestionsFromMultipleDocuments', 'Starting generation for multiple documents', { numDocs: documents?.length, questionCount, difficulty });
  onProgressUpdate('Initializing quiz generation from multiple documents...');
  try {
    if (!genAI) {
      logger.error('geminiService:generateQuestionsFromMultipleDocuments', 'Google Generative AI client is not initialized.');
      throw new Error('Google Generative AI client is not initialized. Check your API key configuration.');
    }
    if (!GOOGLE_API_KEY) {
      logger.error('geminiService:generateQuestionsFromMultipleDocuments', 'Google API key is not available.');
      throw new Error('Google API key is not available for quiz generation.');
    }
    if (!documents || documents.length === 0) {
      logger.warn('geminiService:generateQuestionsFromMultipleDocuments', 'No documents provided.');
      return { title: 'No Documents Provided', questions: [] };
    }

    const supabaseClient = getValidatedSupabase();
    const documentInfos = [];

    for (const [index, doc] of documents.entries()) {
      if (!doc || !doc.file_path) {
        logger.warn('geminiService:generateQuestionsFromMultipleDocuments', 'Skipping invalid document or document with missing file path', { documentId: doc?.id });
        continue;
      }

      logger.info('geminiService:generateQuestionsFromMultipleDocuments', 'Processing document for quiz generation', { documentId: doc.id, filePath: doc.file_path });
      onProgressUpdate(`Downloading document ${index + 1} of ${documents.length}: ${doc.title || 'Untitled'}...`);

      let fileData = null;
      let fileError = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries && !fileData) {
        if (retryCount > 0) {
          logger.info('geminiService:generateQuestionsFromMultipleDocuments', `Retrying file download (attempt ${retryCount + 1}/${maxRetries}) for doc ID ${doc.id}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
        try {
          const result = await supabaseClient.storage
            .from('documents')
            .download(doc.file_path);
          
          fileData = result.data;
          fileError = result.error;

          if (fileError) {
            logger.warn('geminiService:generateQuestionsFromMultipleDocuments', `File download attempt ${retryCount + 1} failed for doc ID ${doc.id}`, fileError);
          } else if (!fileData) {
            logger.warn('geminiService:generateQuestionsFromMultipleDocuments', `File download attempt ${retryCount + 1} for doc ID ${doc.id} returned no data.`);
          }
        } catch (e) {
          logger.warn('geminiService:generateQuestionsFromMultipleDocuments', `Exception during file download attempt ${retryCount + 1} for doc ID ${doc.id}`, e);
          fileError = e; // Store the exception as an error
        }
        retryCount++;
      }

      if (fileError || !fileData) {
        logger.error('geminiService:generateQuestionsFromMultipleDocuments', `Failed to download document ${doc.file_path} (ID: ${doc.id}) after ${maxRetries} retries. Skipping.`, fileError);
        continue; // Skip this document
      }

      onProgressUpdate(`Processing document ${index + 1} of ${documents.length}: ${doc.title || 'Untitled'}...`);
      try {
        const mimeType = doc.document_type || 'application/pdf'; // Default to PDF if not specified
        const fileSizeMB = (fileData.size || 0) / (1024 * 1024);
        
        logger.info('geminiService:generateQuestionsFromMultipleDocuments', 'Converting file to generative part', { 
          documentId: doc.id, 
          mimeType, 
          fileSizeMB: fileSizeMB.toFixed(1) 
        });
        
        const generativePart = await fileToGenerativePart(fileData, doc.document_type);
        documentInfos.push({
          id: doc.id,
          title: doc.title,
          content: generativePart, // This is the GoogleGenerativeAI.Part object
          mimeType: mimeType
        });
        logger.info('geminiService:generateQuestionsFromMultipleDocuments', 'Successfully prepared generative part for document', { documentId: doc.id });
      } catch (partError) {
        // Check if this is a document size error
        if (partError.message && partError.message.includes('Document too large for AI processing')) {
          logger.error('geminiService:generateQuestionsFromMultipleDocuments', `Document ${doc.title || doc.id} is too large for AI processing and will be skipped.`, {
            documentId: doc.id,
            title: doc.title,
            error: partError.message
          });
          onProgressUpdate(`⚠️ Skipping oversized document: ${doc.title || 'Untitled'} - Too large for AI processing`);
        } else {
          logger.error('geminiService:generateQuestionsFromMultipleDocuments', `Error creating generative part for document ${doc.id}. Skipping.`, partError);
          onProgressUpdate(`⚠️ Error processing document: ${doc.title || 'Untitled'} - ${partError.message}`);
        }
        continue; // Skip this document if part creation fails
      }
    }

    if (documentInfos.length === 0) {
      logger.warn('geminiService:generateQuestionsFromMultipleDocuments', 'No documents could be processed successfully.');
      return { title: 'Quiz Generation Failed', questions: [] };
    }

    logger.info('geminiService:generateQuestionsFromMultipleDocuments', `Successfully prepared ${documentInfos.length} documents for ScalableQuizGenerator.`);
    onProgressUpdate(`All ${documentInfos.length} documents prepared. Handing off to AI for quiz generation...`);

    const scaler = new ScalableQuizGenerator(genAI, {
      apiKey: GOOGLE_API_KEY,
      enableLogging: true,
      // model: 'gemini-1.5-pro-latest', // Or let ScalableQuizGenerator use its default/passed one
      parserOptions: { 
        // Add any specific parser options if needed, e.g., custom validation
        // modelName: 'gemini-1.5-pro-latest' // Ensure parser also knows the model if it affects parsing
      }
    });

    logger.info('geminiService:generateQuestionsFromMultipleDocuments', 'Invoking ScalableQuizGenerator.generateScaledQuiz');
    const result = await scaler.generateScaledQuiz(documentInfos, questionCount, onProgressUpdate); // Pass callback
    // Expected result: { questions: Array, metadata: Object }

    let generatedTitle = `Quiz from ${documentInfos.length} document(s)`;
    if (documentInfos.length === 1 && documentInfos[0].title) {
      generatedTitle = documentInfos[0].title;
    }
    // Consider a more sophisticated title if multiple documents, e.g., from metadata
    if (result.metadata && result.metadata.suggestedTitle) {
      generatedTitle = result.metadata.suggestedTitle;
    }

    logger.info('geminiService:generateQuestionsFromMultipleDocuments', 'Successfully generated quiz using ScalableQuizGenerator', { numQuestions: result.questions?.length, title: generatedTitle });
    onProgressUpdate('AI processing complete. Finalizing quiz data...');

    return { title: generatedTitle, questions: result.questions || [] };

  } catch (error) {
    logger.error('geminiService:generateQuestionsFromMultipleDocuments', 'Error generating quiz from multiple documents', error);
    onProgressUpdate(`Error during AI quiz generation: ${error.message}`);
    // Consider re-throwing or returning a specific error structure
    return { title: 'Error Generating Quiz', questions: [], error: error.message };
  }
};


export default {
  generateQuestionsFromDocument,
  generateQuestionsFromMultipleDocuments
};