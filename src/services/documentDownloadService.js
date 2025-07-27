import * as FileSystem from 'expo-file-system';
import { supabase } from './supabaseClient';
import logger from './loggerService';

/**
 * Downloads a document from Supabase Storage to a temporary local location.
 * @param {string} documentId - The ID of the document (for logging or unique naming).
 * @param {string} filePath - The path to the file in Supabase Storage.
 * @param {string} fileName - The name of the file.
 * @param {Function} [progressCallback] - Optional callback for download progress.
 * @returns {Promise<string>} The local URI of the downloaded file.
 */
export const downloadDocument = async (documentId, filePath, fileName, progressCallback) => {
  try {
    // Get a signed URL for the file
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (signedUrlError || !signedUrlData?.signedUrl) {
      logger.error('documentDownloadService', 'Failed to create signed URL', { documentId, filePath, error: signedUrlError });
      throw new Error('Failed to create download URL for document');
    }
    
    // Create a safe filename and a temporary local URI
    const safeFileName = (fileName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempDir = FileSystem.cacheDirectory + 'temp_document_downloads/';
    
    // Ensure temporary directory exists
    const dirInfo = await FileSystem.getInfoAsync(tempDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
      logger.info('documentDownloadService', 'Created temporary document download directory', { tempDir });
    }
    const localUri = `${tempDir}${documentId}_${safeFileName}`;
    
    // Download the file
    logger.info('documentDownloadService', 'Starting document download', { documentId, filePath, localUri });
    const downloadResumable = FileSystem.createDownloadResumable(
      signedUrlData.signedUrl,
      localUri,
      {}, // options
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        if (progressCallback) {
          progressCallback(progress);
        }
      }
    );
    
    const { uri } = await downloadResumable.downloadAsync();
    
    logger.info('documentDownloadService', 'Document downloaded successfully to temporary location', { documentId, localUri: uri });
    return uri; // This is the URI to the temporarily downloaded file
  } catch (error) {
    logger.error('documentDownloadService', 'Failed to download document', { documentId, filePath, error });
    throw error;
  }
};
