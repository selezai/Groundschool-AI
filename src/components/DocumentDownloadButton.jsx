import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { downloadDocument } from '../services/documentDownloadService'; // Only downloadDocument is needed
import { useNetwork } from '../contexts/NetworkContext';
import logger from '../services/loggerService';

/**
 * Button component for downloading documents.
 * 
 * @param {Object} props
 * @param {Object} props.document - The document object (must have id, file_path, name)
 * @param {Function} [props.onActionComplete] - Optional callback when an action (e.g. download, share) is complete or fails.
 *                                            Signature: (success: boolean, status: string, data?: any) => void
 */
const DocumentDownloadButton = ({ document, onActionComplete }) => {
  const [status, setStatus] = useState('idle'); // idle, downloading, success, error
  const [downloadProgress, setDownloadProgress] = useState(0);
  const { isConnected } = useNetwork();

  const handlePress = async () => {
    if (!isConnected) {
      logger.warn('DocumentDownloadButton', 'Download attempt while offline prevented.', { documentId: document.id });
      if (onActionComplete) onActionComplete(false, 'offline');
      return;
    }

    if (status === 'downloading') return; // Prevent multiple clicks if already downloading

    setStatus('downloading');
    setDownloadProgress(0);

    try {
      const localUri = await downloadDocument(
        document.id,
        document.file_path,
        document.name || 'document', // Ensure name is provided
        (progress) => {
          setDownloadProgress(progress);
        }
      );

      logger.info('DocumentDownloadButton', 'Document downloaded to temporary location', { documentId: document.id, localUri });
      setStatus('success');

      // Attempt to share the downloaded file
      try {
        // On iOS, title is not used with url. On Android, title is used.
        const shareOptions = {
            title: document.name || 'Document',
            url: localUri, // For iOS, this is enough. For Android, might need file:// prefix or specific content type handling.
        };
        if (Platform.OS === 'android') {
            // Android sharing can be tricky with file URIs. Ensure it's accessible.
            // Using just `url` often works for many apps.
        }
        await Share.share(shareOptions);
        logger.info('DocumentDownloadButton', 'Share intent initiated', { documentId: document.id, localUri });
        if (onActionComplete) onActionComplete(true, 'shared', localUri);
      } catch (shareError) {
        logger.error('DocumentDownloadButton', 'Error sharing document', { documentId: document.id, shareError });
        // If sharing fails, still report download success
        if (onActionComplete) onActionComplete(true, 'download_success_share_failed', localUri);
        // Potentially alert user that sharing failed but download was okay
      }

      // Optional: Reset status after a delay, or keep as 'success' for user feedback
      // setTimeout(() => setStatus('idle'), 3000); 

    } catch (error) {
      logger.error('DocumentDownloadButton', 'Error downloading document', { documentId: document.id, error });
      setStatus('error');
      if (onActionComplete) onActionComplete(false, 'error_downloading', error.message);
      
      // Reset to idle after a delay so user can retry
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
  };

  // Render different button states
  const renderButtonContent = () => {
    switch (status) {
      case 'downloading':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />
            <Text style={styles.buttonText}>{Math.round(downloadProgress * 100)}%</Text>
          </View>
        );
      case 'success': // Indicates download successful, share attempted
        return (
          <>
            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" style={styles.icon} />
            <Text style={styles.buttonText}>Downloaded</Text>
          </>
        );
      case 'error':
        return (
          <>
            <Ionicons name="alert-circle-outline" size={16} color="#FFFFFF" style={styles.icon} />
            <Text style={styles.buttonText}>Error</Text>
          </>
        );
      default: // idle
        return (
          <>
            <Ionicons 
              name="download-outline" 
              size={16} 
              color={isConnected ? "#FFFFFF" : "#A1A1AA"} 
              style={styles.icon} 
            />
            <Text style={[styles.buttonText, !isConnected && styles.disabledText]}>
              Download
            </Text>
          </>
        );
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        status === 'success' && styles.successButton,
        status === 'error' && styles.errorButton,
        (!isConnected && status === 'idle') && styles.disabledButton,
        status === 'downloading' && styles.downloadingButton,
      ]}
      onPress={handlePress}
      disabled={(!isConnected && status === 'idle') || status === 'downloading'}
    >
      {renderButtonContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5', // Indigo-600
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginVertical: 4,
    minWidth: 120, // Give button some minimum width
    height: 38, // Consistent height
  },
  successButton: {
    backgroundColor: '#059669', // Green-600
  },
  errorButton: {
    backgroundColor: '#DC2626', // Red-600 (was EF4444 - Red-500)
  },
  disabledButton: {
    backgroundColor: '#D1D5DB', // Cool Gray-300
  },
  downloadingButton: {
    backgroundColor: '#6366F1', // Indigo-500 (lighter indigo for downloading state)
  },
  icon: {
    marginRight: 8, // Increased spacing
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600', // Slightly bolder
  },
  disabledText: {
    color: '#6B7280', // Cool Gray-500 for text on disabled button
  },
  statusContainer: { // For downloading state
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default DocumentDownloadButton;
