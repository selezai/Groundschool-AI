import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ScrollView,
  Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import logger from '../../services/loggerService';
import { supabase } from '../../services/supabaseClient';
import { getUserDocuments, uploadDocument, deleteDocument, getUserTotalStorageUsage, updateExistingDocumentSizes, getMaxStorageForPlan, StorageLimitExceededError } from '../../services/documentService';
import quizService from '../../services/quizService';
import { useNetwork } from '../../contexts/NetworkContext';
import NetworkStatusBar from '../../components/NetworkStatusBar';
import { useAuth } from '../../contexts/AuthContext';
import posthogService from '../../services/posthogService';
import cacheService, { CACHE_KEYS } from '../../services/cacheService';
// These imports are used by createThemedStyles internally
// eslint-disable-next-line no-unused-vars
import { darkColors, spacing, typography, createThemedStyles } from '../../theme/theme';

const HomeScreen = () => {
  // Initialize styles at the component level
  const styles = getStyles();

  const router = useRouter();
  const { session, profile } = useAuth();
  const { isConnected } = useNetwork();

  // Document states
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isRefreshingDocuments, setIsRefreshingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState(null);
  
  // Storage usage states
  const [storageUsage, setStorageUsage] = useState(0);
  const [maxStorage, setMaxStorage] = useState(getMaxStorageForPlan(null)); // Default to free plan limit
  const [storageUsagePercent, setStorageUsagePercent] = useState(0);
  const [isLoadingStorageUsage, setIsLoadingStorageUsage] = useState(false);
  
  // Cache for storage data
  const [storageCache, setStorageCache] = useState({
    data: null,
    isValid: false
  });

  // Upload states
  const [isUploading, setIsUploading] = useState(false);

  // Track if this is the initial load to prevent unnecessary refetches on window focus
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Cache invalidation utility for storage
  const invalidateStorageCache = useCallback((skipDocumentRefresh = false) => {
    logger.info('HomeScreen:invalidateStorageCache', 'Invalidating storage cache', { skipDocumentRefresh });
    setStorageCache(prev => ({
      ...prev,
      isValid: false
    }));
    // Also refresh documents when storage changes (upload/delete)
    // Skip document refresh if we've already optimistically updated the UI
    if (hasInitiallyLoaded && !skipDocumentRefresh) {
      fetchDocuments();
    }
  }, [hasInitiallyLoaded]);
  
  // Register with cache service for storage updates
  useEffect(() => {
    cacheService.registerInvalidationCallback(CACHE_KEYS.STORAGE_USAGE, invalidateStorageCache);
    
    return () => {
      cacheService.unregisterInvalidationCallback(CACHE_KEYS.STORAGE_USAGE, invalidateStorageCache);
    };
  }, [invalidateStorageCache]);

  // Initial load effect - runs once when component mounts and when session changes
  useEffect(() => {
    if (session?.user?.id && !hasInitiallyLoaded) {
      fetchDocuments();
      fetchStorageUsage();
      setHasInitiallyLoaded(true);
    } else if (!session?.user?.id) {
      // Reset the flag when user logs out so it loads fresh on next login
      setHasInitiallyLoaded(false);
    }
  }, [session?.user?.id, hasInitiallyLoaded]);

  // Fetch documents when the screen comes into focus (but only on native platforms)
  useFocusEffect(
    useCallback(() => {
      // Track screen view
      posthogService.screen('Home Screen', {
        user_plan: profile?.plan || 'basic',
        documents_count: documents.length,
        storage_used_mb: storageUsage,
        storage_used_percent: storageUsagePercent,
      });
      
      // Only fetch documents on native platforms where focus events are reliable
      if (Platform.OS !== 'web' && hasInitiallyLoaded) {
        fetchDocuments();
        fetchStorageUsage(); // Will use cache if valid
      }
    }, [profile?.plan, documents.length, storageUsage, storageUsagePercent, hasInitiallyLoaded])
  );

  // Reset loading states when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // This will run when the screen is focused
      setIsGeneratingQuiz(false);
      setQuizProgressMessage('');
      // Optionally, you could also reset examGenerationError if desired
      // setExamGenerationError(null);
      
      return () => {
        // Optional: Any cleanup if needed when the screen goes out of focus
        // For this case, cleanup is likely not necessary for these state resets.
      };
    }, []) // Empty dependency array means it relies on no props/state from parent scope for the callback itself
  );
  const [numberOfQuestions, setNumberOfQuestions] = useState(10); // State for number of questions
  const [selectedFile, setSelectedFile] = useState(null);
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  // Deletion states
  const [deletingId, setDeletingId] = useState(null);

  // Quiz generation states
  const [selectedDocumentIdsForQuiz, setSelectedDocumentIdsForQuiz] = useState([]); // Changed for multi-select
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [examGenerationError, setExamGenerationError] = useState(null);
  const [quizProgressMessage, setQuizProgressMessage] = useState(''); // For granular progress updates

  // Fetch storage usage information with caching
  const fetchStorageUsage = useCallback(async (forceRefresh = false) => {
    if (!session || !session.user) {
      setStorageUsage(0);
      setMaxStorage(getMaxStorageForPlan(null));
      setStorageUsagePercent(0);
      return;
    }

    // Check if we have valid cached data and don't need to force refresh
    if (!forceRefresh && storageCache.isValid && storageCache.data) {
      logger.info('HomeScreen:fetchStorageUsage', 'Using cached storage data');
      const cachedData = storageCache.data;
      setStorageUsage(cachedData.totalBytes);
      setMaxStorage(cachedData.maxStorage);
      setStorageUsagePercent(cachedData.percent);
      setIsLoadingStorageUsage(false);
      return;
    }

    setIsLoadingStorageUsage(true);
    try {
      // Fetch profile to determine plan and max storage
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', session.user.id)
        .single();

      const currentMaxStorage = getMaxStorageForPlan(profile?.plan);
      const totalBytes = await getUserTotalStorageUsage(session.user.id);
      
      const percent = currentMaxStorage > 0 
        ? Math.min(100, Math.round((totalBytes / currentMaxStorage) * 100)) 
        : 0;

      const newStorageData = {
        totalBytes,
        maxStorage: currentMaxStorage,
        percent
      };

      setStorageUsage(totalBytes);
      setMaxStorage(currentMaxStorage);
      setStorageUsagePercent(percent);
      
      // Update cache with fresh data
      setStorageCache({
        data: newStorageData,
        isValid: true
      });
      
      logger.info('HomeScreen', `Storage usage fetched and cached: ${totalBytes} bytes of ${currentMaxStorage} (${percent}%)`);
    } catch (err) {
      logger.error('HomeScreen', 'Error fetching storage usage', err);
      // Don't show an error to the user, just log it
    } finally {
      setIsLoadingStorageUsage(false);
    }
  }, [session, storageCache]);

  const fetchDocuments = useCallback(async (showRefreshing = false) => {
    if (!session) {
      logger.info('HomeScreen', 'No session, skipping document fetch');
      setDocuments([]);
      setIsLoadingDocuments(false);
      setIsRefreshingDocuments(false);
      setDocumentError(null);
      return;
    }

    if (showRefreshing) {
      setIsRefreshingDocuments(true);
    } else {
      setIsLoadingDocuments(true);
    }
    setDocumentError(null);

    try {
      logger.info('HomeScreen', 'Fetching documents', { isOffline: !isConnected });
      const fetchedDocs = await getUserDocuments();
      setDocuments(Array.isArray(fetchedDocs) ? fetchedDocs : []);
      logger.info('HomeScreen', 'Documents fetched successfully', {
        count: fetchedDocs?.length || 0,
        isOffline: !isConnected
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('HomeScreen', 'Error fetching documents', { error: errorMessage, isOffline: !isConnected });
      if (!isConnected) {
        setDocumentError('You are offline. Could not update document list.');
      } else {
        setDocumentError('Failed to load documents. Please try again.');
      }
      // More specific error handling can be added here based on documentService errors
    } finally {
      setIsLoadingDocuments(false);
      setIsRefreshingDocuments(false);
    }
  }, [session, isConnected]);

  useEffect(() => {
    if (session?.user?.id) {
      // When session is available, fetch user data.
      // updateExistingDocumentSizes can run in the background to ensure accuracy.
      updateExistingDocumentSizes(session.user.id).catch(err => {
        logger.error('HomeScreen', 'Background update of document sizes failed', err);
      });
      
      // Only fetch documents if we haven't loaded them yet or if the user ID actually changed
      if (!hasInitiallyLoaded) {
        fetchDocuments();
        fetchStorageUsage();
      }
    } else {
      // When there is no session (user is logged out), clear all user-specific data.
      logger.info('HomeScreen', 'No session, clearing user data.');
      setDocuments([]);
      setStorageUsage(0);
      setMaxStorage(getMaxStorageForPlan(null));
      setStorageUsagePercent(0);
      setIsLoadingDocuments(false);
      setDocumentError(null);
      setSelectedDocumentIdsForQuiz([]);
    }
  // This effect should re-run whenever the user ID or profile changes.
  // Adding profile ensures storage limits update when user upgrades to Captain's Club.
  // fetchDocuments and fetchStorageUsage are stable and have their own dependencies.
  }, [session?.user?.id, profile, hasInitiallyLoaded]);

  const handlePickDocument = async () => {
    if (isUploading) return;

    const processAsset = async (assetFromPicker) => {
      if (!assetFromPicker) return;

      logger.info('HomeScreen', 'Asset selected, preparing for upload', { 
        name: assetFromPicker.name, 
        size: assetFromPicker.size, 
        uri: assetFromPicker.uri,
        mimeType: assetFromPicker.mimeType
      });
      
      const fileName = assetFromPicker.name || '';
      const titleForDocument = fileName.lastIndexOf('.') > 0 ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
      const finalTitle = titleForDocument.trim() || 'Untitled Document';

      setSelectedFile(null);
      if (uploadError) setUploadError(null);

      await handleUploadDocument(assetFromPicker, finalTitle);
    };

    if (Platform.OS === 'web') {
      // Web-specific: Directly attempt to pick a document using DocumentPicker
      try {
        const docResult = await DocumentPicker.getDocumentAsync({
          type: [
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/msword', // .doc
            'image/jpeg',
            'image/png',
            'image/heic',
          ],
          copyToCacheDirectory: true,
          multiple: true, // Allow multiple file selection
        });

        logger.debug('HomeScreen', 'DocumentPicker result (web):', docResult);

        if (docResult.canceled) {
          logger.info('HomeScreen', 'Document picking cancelled by user (web).');
          return;
        }

        if (docResult.assets && docResult.assets.length > 0) {
          logger.info('HomeScreen', `Processing ${docResult.assets.length} assets from web DocumentPicker.`);
          for (const asset of docResult.assets) {
            try {
              // Reset title for each new document unless a global one is intended for all
              await processAsset(asset);
            } catch (loopError) {
              logger.error('HomeScreen', 'Error processing one of the selected assets (web)', { assetName: asset.name, error: loopError });
              Alert.alert('Upload Error', `Failed to process file: ${asset.name}. Others may have succeeded.`);
              // Optionally continue to next asset or break/return
            }
          }
        }
      } catch (err) {
        logger.error('HomeScreen', 'Error picking document from files (web)', err);
        Alert.alert('Error', 'Could not select document: ' + (err.message || 'Unknown error'));
        setUploadError('Could not select document from files.');
        if (isUploading) setIsUploading(false);
      }
    } else {
      // Native (iOS/Android): Use Alert.alert to offer choice
      Alert.alert(
        'Select File Source',
        'Choose where to select your file from:',
        [
          {
            text: 'Open Gallery',
            onPress: async () => {
              try {
                const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (permissionResult.granted === false) {
                  Alert.alert('Permission Denied', 'Permission to access photo library is required!');
                  return;
                }

                const pickerResult = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images, // Or .All if you want videos too
                  allowsEditing: false, // Usually false for multiple selection
                  quality: 1,
                  copyToCacheDirectory: true,
                  allowsMultipleSelection: true, // Enable multiple image selection
                });

                logger.debug('HomeScreen', 'ImagePicker result (native):', pickerResult);

                if (pickerResult.canceled) {
                  logger.info('HomeScreen', 'Image picking cancelled by user (native).');
                  return;
                }

                if (pickerResult.assets && pickerResult.assets.length > 0) {
                  logger.info('HomeScreen', `Processing ${pickerResult.assets.length} assets from native ImagePicker.`);
                  for (const asset of pickerResult.assets) {
                    try {
                      const extension = asset.uri.split('.').pop().toLowerCase();
                      let determinedMimeType = asset.mimeType; // Prioritize what ImagePicker gives

                      if (!determinedMimeType) {
                        switch (extension) {
                          case 'jpg':
                          case 'jpeg':
                            determinedMimeType = 'image/jpeg';
                            break;
                          case 'png':
                            determinedMimeType = 'image/png';
                            break;
                          case 'gif':
                            determinedMimeType = 'image/gif';
                            break;
                          case 'heic':
                            determinedMimeType = 'image/heic';
                            break;
                          default:
                            determinedMimeType = `image/${extension}`;
                            logger.warn('HomeScreen:ImagePicker', `Unknown image extension '${extension}', guessed mimeType: ${determinedMimeType}`);
                        }
                      } else {
                        if (determinedMimeType === 'image/jpg') {
                          determinedMimeType = 'image/jpeg';
                        }
                      }

                      const adaptedAsset = {
                        uri: asset.uri,
                        name: asset.fileName || `image_${Date.now()}_${asset.assetId || Math.random().toString(36).substring(7)}.${extension}`,
                        mimeType: determinedMimeType,
                        size: asset.fileSize,
                      };
                      await processAsset(adaptedAsset);
                    } catch (loopError) {
                      logger.error('HomeScreen', 'Error processing one of the selected images (native gallery)', { assetName: asset.fileName, error: loopError });
                      Alert.alert('Upload Error', `Failed to process image: ${asset.fileName || 'selected image'}. Others may have succeeded.`);
                    }
                  }
                }
              } catch (err) {
                logger.error('HomeScreen', 'Error picking image from gallery (native)', err);
                Alert.alert('Error', 'Could not select image: ' + (err.message || 'Unknown error'));
                setUploadError('Could not select image from gallery.');
                if (isUploading) setIsUploading(false);
              }
            },
          },
          {
            text: 'Open Files',
            onPress: async () => {
              try {
                const docResult = await DocumentPicker.getDocumentAsync({
                  type: [
                    'application/pdf',
                    'text/plain',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
                    'application/msword', // .doc
                    'image/jpeg',
                    'image/png',
                    'image/heic',
                  ],
                  copyToCacheDirectory: true,
                  multiple: true, // Allow multiple file selection
                });

                logger.debug('HomeScreen', 'DocumentPicker result (native):', docResult);

                if (docResult.canceled) {
                  logger.info('HomeScreen', 'Document picking cancelled by user (native).');
                  return;
                }

                if (docResult.assets && docResult.assets.length > 0) {
                  logger.info('HomeScreen', `Processing ${docResult.assets.length} assets from native DocumentPicker.`);
                  for (const asset of docResult.assets) {
                    try {
                      await processAsset(asset);
                    } catch (loopError) {
                      logger.error('HomeScreen', 'Error processing one of the selected files (native files)', { assetName: asset.name, error: loopError });
                      Alert.alert('Upload Error', `Failed to process file: ${asset.name}. Others may have succeeded.`);
                    }
                  }
                }
              } catch (err) {
                logger.error('HomeScreen', 'Error picking document from files (native)', err);
                Alert.alert('Error', 'Could not select document: ' + (err.message || 'Unknown error'));
                setUploadError('Could not select document from files.');
                if (isUploading) setIsUploading(false);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => logger.info('HomeScreen', 'File selection cancelled by user via dialog (native).'),
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleUploadDocument = async (fileToUpload, titleForDocument) => {
    if (!isConnected) {
      Alert.alert(
        'Offline Mode',
        'Document uploads require an internet connection. Please connect to the internet and try again.'
      );
      setUploadError('Upload failed: You are offline.');
      return;
    }

    if (!fileToUpload) {
      setUploadError('No file provided for upload.');
      Alert.alert('Error', 'No file was selected for upload.');
      return;
    }

    if (!titleForDocument || !titleForDocument.trim()) { 
      setUploadError('A title for the document is missing.');
      Alert.alert('Error', 'Document title is missing.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      logger.info('HomeScreen', 'Starting document upload', { title: titleForDocument.trim(), fileName: fileToUpload.name });
      
      // Track document upload start
      posthogService.capture('document_upload_started', {
        file_name: fileToUpload.name,
        file_size: fileToUpload.size,
        file_type: fileToUpload.mimeType || 'unknown',
        document_title: titleForDocument.trim(),
        user_plan: profile?.plan || 'basic',
        storage_used_mb: storageUsage,
        max_storage_mb: maxStorage,
      });
      
      const uploadedDoc = await uploadDocument(
        fileToUpload,
        titleForDocument.trim(),
        (progress) => {
          setUploadProgress(progress);
        }
      );

      logger.info('HomeScreen', 'Document uploaded successfully', { documentId: uploadedDoc?.id });
      
      // Track successful document upload
      posthogService.capture('document_uploaded', {
        document_id: uploadedDoc?.id,
        file_name: fileToUpload.name,
        file_size: fileToUpload.size,
        file_type: fileToUpload.mimeType || 'unknown',
        document_title: titleForDocument.trim(),
        user_plan: profile?.plan || 'basic',
        upload_duration: Date.now() - Date.now(), // Will be calculated properly in real implementation
      });
      
      setSelectedFile(null); 
      setNewDocumentTitle('');
      setUploadProgress(0);
      fetchDocuments(); // Refresh the document list
      fetchStorageUsage(true); // Force refresh storage usage after successful upload
      Alert.alert('Success', 'Document uploaded successfully!');
    } catch (err) {
      if (err instanceof StorageLimitExceededError) {
        // Handle storage limit exceeded error with more detailed information
        const errorMessage = `Storage limit of ${err.limitInMB}MB reached. Current usage: ${err.currentUsageInMB}MB. Please delete some documents to free up space.`;
        logger.error('HomeScreen', 'Storage limit exceeded during upload', { 
          error: errorMessage, 
          currentUsage: err.currentUsage, 
          limit: err.limit 
        });
        
        // Track storage limit exceeded
        posthogService.capture('document_upload_failed', {
          error_type: 'storage_limit_exceeded',
          error_message: errorMessage,
          file_name: fileToUpload.name,
          file_size: fileToUpload.size,
          current_usage_mb: err.currentUsageInMB,
          limit_mb: err.limitInMB,
          user_plan: profile?.plan || 'basic',
        });
        
        setUploadError(errorMessage);
      } else {
        // Handle other errors
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('HomeScreen', 'Error uploading document', { 
          error: errorMessage, 
          errorStack: err instanceof Error ? err.stack : undefined,
          errorName: err instanceof Error ? err.name : undefined,
          title: titleForDocument 
        }); 
        
        // Track general upload failure
        posthogService.capture('document_upload_failed', {
          error_type: 'upload_error',
          error_message: errorMessage,
          file_name: fileToUpload.name,
          file_size: fileToUpload.size,
          document_title: titleForDocument.trim(),
          user_plan: profile?.plan || 'basic',
        });
        
        setUploadError(`Upload failed: ${errorMessage}`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId, documentName) => {
    logger.debug('home:handleDeleteDocument', 'Delete document requested:', { documentId, documentName });
    if (!isConnected) {
      Alert.alert('Offline Mode', 'Deleting documents requires an internet connection.');
      return;
    }

    const actualDeletionLogic = async () => {
      setDeletingId(documentId);
      try {
        if (!session || !session.user || !session.user.id) {
          logger.error('HomeScreen:handleDeleteDocument', 'User session or ID not found for deletion.');
          Alert.alert('Error', 'Could not delete document: User information is missing.');
          return; // Return early if user info is missing
        }
        logger.info('HomeScreen:handleDeleteDocument', 'Attempting to delete document.', { documentId, userId: session.user.id });
        
        // Find document details for tracking
        const documentToDelete = documents.find(doc => doc.id === documentId);
        
        await deleteDocument(documentId, session.user.id, true); // Skip cache invalidation
        logger.info('HomeScreen:handleDeleteDocument', 'Successfully deleted from backend. Updating UI.', { documentId });
        
        // Track successful document deletion
        posthogService.capture('document_deleted', {
          document_id: documentId,
          document_name: documentName,
          document_title: documentToDelete?.title || 'unknown',
          file_size: documentToDelete?.file_size || 0,
          user_plan: profile?.plan || 'basic',
          storage_freed_mb: documentToDelete?.file_size ? (documentToDelete.file_size / (1024 * 1024)).toFixed(2) : 0,
        });
        
        // Optimistically update the UI by removing the document from the list
        setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== documentId));
        
        // Correctly update the multi-select quiz document IDs
        setSelectedDocumentIdsForQuiz(prevSelectedIds => 
          prevSelectedIds.filter(id => id !== documentId)
        );

        // Manually invalidate caches without triggering callbacks
        cacheService.invalidateCaches([CACHE_KEYS.PROFILE_STATS, CACHE_KEYS.STORAGE_USAGE]);
        
        // Refresh storage usage to update the UI
        fetchStorageUsage(true);
        Alert.alert('Success', `"${documentName}" has been deleted.`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : 'No stack available';
        logger.error('HomeScreen:handleDeleteDocument', 'Error during document deletion', { documentId, error: errorMessage, stack: errorStack });
        Alert.alert('Error Deleting Document', `Could not delete "${documentName}": ${errorMessage}`);
      } finally {
        setDeletingId(null); // Ensure deletingId is cleared after the attempt
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete "${documentName || 'this document'}"? This action cannot be undone.`)) {
        await actualDeletionLogic();
      }
    } else {
      Alert.alert(
        'Confirm Delete',
        `Are you sure you want to delete "${documentName || 'this document'}"? This action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: actualDeletionLogic,
          },
        ],
      );
    }
  };

  const handleGenerateQuiz = async () => {
    if (!isConnected) {
      Alert.alert(
        'Offline Mode',
        'Exam generation requires an internet connection. Please connect to the internet and try again.'
      );
      setExamGenerationError('Exam generation failed: You are offline.');
      setQuizProgressMessage(''); // Clear progress
      return;
    }

    if (selectedDocumentIdsForQuiz.length === 0) {
      Alert.alert('Select Document(s)', 'Please select one or more documents from your list to generate an exam.');
      setExamGenerationError('Please select at least one document.');
      setQuizProgressMessage(''); // Clear progress
      return;
    }

    setIsGeneratingQuiz(true);
    setExamGenerationError(null);
    setQuizProgressMessage('Initiating exam generation...'); // Initial progress message

    try {
      logger.info('HomeScreen', 'Generating quiz for documents', { documentIds: selectedDocumentIdsForQuiz });
      const numQuestions = parseInt(String(numberOfQuestions), 10);
      if (isNaN(numQuestions) || numQuestions <= 0) {
        Alert.alert('Invalid Input', 'Please enter a valid number of questions.');
        setQuizProgressMessage('Invalid number of questions entered.');
        // setIsGeneratingExam(false); // Keep true to show error and retry options
        setExamGenerationError('Invalid number of questions. Please enter a positive number.');
        setIsGeneratingQuiz(false); // Allow retry
        return;
      }

      // Pass setQuizProgressMessage to the service
      const generatedQuiz = await quizService.generateQuizFromDocuments(
        selectedDocumentIdsForQuiz, 
        'medium', 
        numQuestions,
        setQuizProgressMessage // Pass the callback
      ); 
      
      setQuizProgressMessage('Exam generated successfully! Navigating...');
      logger.info('HomeScreen', 'Quiz generated successfully', { quizId: generatedQuiz.id, sourceDocumentIds: selectedDocumentIdsForQuiz });
      router.push(`/quiz/${generatedQuiz.id}`);
      setSelectedDocumentIdsForQuiz([]); // Clear selection
      setQuizProgressMessage(''); // Clear progress after navigation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('HomeScreen', 'Error generating quiz', { 
        errorMessage,
        documentIds: selectedDocumentIdsForQuiz
      });
      setExamGenerationError(`Failed to generate exam: ${errorMessage}`);
      setQuizProgressMessage(''); // Clear progress on error
      setIsGeneratingQuiz(false); // Ensure loading state is reset on error
      // Alert.alert('Error Generating Exam', `Could not generate exam: ${errorMessage}`); // Error is shown in UI now
    } finally {
      // setIsGeneratingExam(false); // Moved to be conditional based on error or success
      // If an error occurred that doesn't set isGeneratingExam to false (like validation), ensure it's false here.
      // However, if we want to show retry/dismiss, isGeneratingExam should be false.
      // The logic above now sets isGeneratingExam = false in the error case for validation, and it's set to false after try/catch completes. 
    }
  };

  const renderDocumentItem = ({ item }) => {
    const isSelected = selectedDocumentIdsForQuiz.includes(item.id);

    const handleSelectDocument = () => {
      setSelectedDocumentIdsForQuiz(prevSelectedIds => {
        if (prevSelectedIds.includes(item.id)) {
          return prevSelectedIds.filter(id => id !== item.id); // Deselect
        } else {
          return [...prevSelectedIds, item.id]; // Select
        }
      });
    };

    return (
      <TouchableOpacity 
        style={[
          styles.documentItem,
          isSelected && styles.selectedDocumentItem // Apply selected style
        ]}
        onPress={handleSelectDocument}
      >
        <Ionicons 
          name={isSelected ? "checkbox-outline" : "square-outline"} 
          size={24} 
          color={isSelected ? "#4A90E2" : "#A0AEC0"} 
          style={styles.checkboxIcon} 
        />
        <View style={styles.documentInfoContainer}>
          <Ionicons name="document-text-outline" size={24} color="#A0AEC0" style={styles.documentIcon} />
          <Text style={styles.documentName} numberOfLines={1} ellipsizeMode="tail">{item.title || item.name || 'Untitled Document'}</Text>
        </View>
        {deletingId === item.id ? (
          <ActivityIndicator size="small" color="#A0AEC0" style={styles.deleteButton} />
        ) : (
          <TouchableOpacity 
            onPress={(e) => { 
              e.stopPropagation(); // Prevent triggering select on delete
              logger.debug('home:deleteButton', 'Delete button clicked for item:', { id: item.id, title: item.title || item.name }); 
              handleDeleteDocument(item.id, item.name || item.title); 
            }}
            style={styles.deleteButton}
            disabled={deletingId !== null} // Disable other delete buttons while one is processing
          >
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // Main render
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Home' }} />
      <NetworkStatusBar />

      <ScrollView 
        contentContainerStyle={styles.scrollContentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingDocuments}
            onRefresh={() => fetchDocuments(true)}
            tintColor="#FFFFFF"
            titleColor="#A0AEC0"
            colors={['#8dffd6']} // Restored prop
            progressBackgroundColor="#191E38" // Restored prop
          />
        }
      >
        {/* Exam Generation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generate Exam</Text>
          {selectedDocumentIdsForQuiz.length > 0 ? (
            <Text style={styles.sectionInfoText}>
              Selected: {selectedDocumentIdsForQuiz.length} document{selectedDocumentIdsForQuiz.length > 1 ? 's' : ''}
            </Text>
          ) : (
            <Text style={styles.sectionInfoText}>Select one or more documents below to generate an exam.</Text>
          )}
          
          {/* Number of Questions Input - Moved up for better flow before button */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Questions:</Text>
            <TextInput
              style={styles.numericInput}
              keyboardType="numeric"
              value={String(numberOfQuestions)}
              onChangeText={(text) => {
                const num = parseInt(text, 10);
                if (text === '' || (isNaN(num) && text !== '')) {
                  setNumberOfQuestions(''); 
                } else if (num <= 0 && text !== '') {
                  setNumberOfQuestions(1); 
                } else if (num > 50) { 
                  setNumberOfQuestions(50);
                } else {
                  setNumberOfQuestions(isNaN(num) ? '' : num);
                }
              }}
              placeholder="e.g., 10"
              placeholderTextColor="#718096"
              editable={!isGeneratingQuiz} // Disable while generating
            />
          </View>
          <Text style={styles.guidanceText}>
            • More questions = longer generation time{"\n"}
            • Final count may vary based on document content
          </Text>

          <TouchableOpacity 
            style={[styles.button, styles.generateButton, (selectedDocumentIdsForQuiz.length === 0 || isGeneratingQuiz) && styles.buttonDisabled]}
            disabled={selectedDocumentIdsForQuiz.length === 0 || isGeneratingQuiz}
            onPress={handleGenerateQuiz}
          >
            {isGeneratingQuiz && !quizProgressMessage ? ( // Show spinner in button only if no detailed progress message yet
              <ActivityIndicator color="#0a0e23" />
            ) : (
              <Text style={styles.buttonText}>Generate Exam</Text>
            )}
          </TouchableOpacity>

          {/* Progress Indicator and Message */}
          {isGeneratingQuiz && typeof quizProgressMessage === 'string' && quizProgressMessage.trim() !== '' && (
            <View style={styles.quizProgressContainer}>
              <ActivityIndicator size="small" color="#8dffd6" style={{marginRight: 8}} />
              <Text style={styles.quizProgressText}>{quizProgressMessage}</Text>
            </View>
          )}

          {/* Error Display and Actions */}
          {examGenerationError && !isGeneratingQuiz && (
            <View style={styles.quizErrorContainer}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                <Ionicons name="alert-circle-outline" size={20} color={styles.errorText?.color || "#EF4444"} style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>{examGenerationError}</Text>
              </View>
              <View style={styles.errorActionsContainer}>
                <TouchableOpacity 
                  onPress={handleGenerateQuiz} 
                  style={[styles.buttonSmall, styles.retryButton]}
                >
                  <Ionicons name="refresh-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.buttonSmallText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => { setExamGenerationError(null); setQuizProgressMessage(''); }} 
                  style={[styles.buttonSmall, styles.dismissButton]}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.buttonSmallText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Upload Document Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload New Document</Text>
          
          {/* Storage Usage Indicator */}
          <View style={styles.storageInfoContainer}>
            <Text style={styles.storageInfoText}>
              Storage: {(storageUsage / (1024 * 1024)).toFixed(1)}MB / {(maxStorage / (1024 * 1024)).toFixed(0)}MB
            </Text>
            <View style={styles.storageBarContainer}>
              <View 
                style={[styles.storageBarFill, { width: `${storageUsagePercent}%` }, 
                  storageUsagePercent > 90 ? styles.storageBarCritical : 
                  storageUsagePercent > 70 ? styles.storageBarWarning : null]}
              />
            </View>
            {isLoadingStorageUsage && (
              <ActivityIndicator size="small" color="#8dffd6" style={{ marginLeft: 8 }} />
            )}
          </View>
          <TouchableOpacity
            style={[styles.button, styles.uploadActionButton, isUploading && styles.buttonDisabled]}
            onPress={handlePickDocument}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#0a0e23" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#0a0e23" style={{ marginRight: 8 }}/>
                <Text style={styles.buttonText}>Upload Document</Text>
              </>
            )}
          </TouchableOpacity>

          {isUploading && uploadProgress > 0 && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
              <Text style={styles.progressText}>{`${Math.round(uploadProgress)}%`}</Text>
            </View>
          )}

          {uploadError && <Text style={styles.errorText}>{uploadError}</Text>}
        </View>

        {/* Documents List Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Documents</Text>
          {isLoadingDocuments && !isRefreshingDocuments ? (
            <ActivityIndicator size="large" color="#8dffd6" style={{ marginTop: 20 }} />
          ) : documentError ? (
            <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={30} color="#EF4444" />
                <Text style={styles.errorText}>{documentError}</Text>
                <TouchableOpacity onPress={() => fetchDocuments()} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
          ) : documents.length === 0 ? (
            <Text style={styles.emptyMessage}>No documents found. Upload one to get started!</Text>
          ) : (
            <FlatList
              data={documents}
              renderItem={renderDocumentItem}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={<Text style={styles.emptyMessage}>No documents found.</Text>}
              // Removed nested ScrollView behavior by making FlatList non-scrollable if inside ScrollView
              // Or, ensure ScrollView is the primary scroller and FlatList content fits or is also non-scrollable.
              // For now, let's assume the list might grow, so it's better to have FlatList scroll itself if needed,
              // or manage layout carefully. For simplicity, we'll keep it basic.
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Create themed styles using the utility function
const getStyles = createThemedStyles((theme) => ({
  // Styles for Quiz Generation Progress and Error
  quizProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.s,
    padding: theme.spacing.xs + 2,
    backgroundColor: theme.colors.base300, // Darker blue-gray
    borderRadius: 6,
  },
  quizProgressText: {
    fontSize: theme.typography.caption.fontSize + 2,
    color: theme.colors.text, // Light gray for progress text
    marginLeft: theme.spacing.xs,
    flexShrink: 1, // Allow text to wrap
  },
  quizErrorContainer: {
    marginTop: theme.spacing.s,
    padding: theme.spacing.s,
    backgroundColor: 'rgba(239, 68, 68, 0.15)', // Semi-transparent error background
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)', // Semi-transparent error border
  },
  errorActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // Align buttons to the right
    marginTop: theme.spacing.xs + 2,
  },
  buttonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.s,
    borderRadius: 6,
    marginLeft: theme.spacing.xs + 2,
  },
  buttonSmallText: {
    color: theme.colors.text,
    fontSize: theme.typography.caption.fontSize + 2,
    fontWeight: '500',
  },
  retryButtonBlue: {
    backgroundColor: theme.colors.info, // Blue
  },
  dismissButton: {
    backgroundColor: theme.colors.neutral, // Gray
  },
  inputGroup: {
    marginBottom: theme.spacing.s,
  },
  inputLabel: {
    fontSize: theme.typography.caption.fontSize + 2,
    color: theme.colors.subtext,
    marginBottom: theme.spacing.xs - 2,
  },
  numericInput: {
    backgroundColor: theme.colors.base300,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.s,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: theme.typography.body.fontSize,
  },
  guidanceText: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.subtext,
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.s,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContentContainer: {
    padding: theme.spacing.m,
  },
  section: {
    marginBottom: theme.spacing.l,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: theme.spacing.m,
  },
  sectionTitle: {
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
    color: theme.colors.text,
    marginBottom: theme.spacing.s,
  },
  sectionInfoText: {
    fontSize: theme.typography.caption.fontSize + 2,
    color: theme.colors.subtext, 
    marginBottom: theme.spacing.s,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.m - 1,
    paddingHorizontal: theme.spacing.m - 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: theme.spacing.xs + 2,
  },
  selectedDocumentItem: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  documentInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentIcon: {
    marginRight: theme.spacing.s,
  },
  documentName: {
    fontSize: 15,
    color: theme.colors.text,
    flexShrink: 1, 
  },
  checkboxIcon: {
    marginRight: theme.spacing.xs + 2, // Space between checkbox and document icon/name
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.s + 2,
    paddingHorizontal: theme.spacing.m + 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  generateButton: {
    // Specific styles if any, otherwise uses 'button'
  },
  buttonText: {
    color: theme.colors.primaryContent,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: theme.colors.neutral,
  },
  errorContainer: {
    alignItems: 'center',
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface, // Card background for consistency
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.error, // Error border
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    marginTop: theme.spacing.xs + 2,
    fontSize: theme.typography.caption.fontSize + 2,
  },
  storageInfoContainer: {
    marginBottom: theme.spacing.m - 1,
    alignItems: 'center',
  },
  storageInfoText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.caption.fontSize + 2,
    marginBottom: theme.spacing.xs - 3,
  },
  storageBarContainer: {
    height: 8,
    width: '100%',
    backgroundColor: theme.colors.neutral,
    borderRadius: 4,
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  storageBarWarning: {
    backgroundColor: theme.colors.warning,
  },
  storageBarCritical: {
    backgroundColor: theme.colors.error,
  },
  retryButton: {
    marginTop: theme.spacing.xs + 2,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.m + 4,
    borderRadius: 6,
  },
  retryButtonText: {
    color: theme.colors.primaryContent,
    fontWeight: '500',
  },
  emptyMessage: {
    textAlign: 'center',
    color: theme.colors.subtext,
    marginTop: theme.spacing.m + 4,
    fontSize: theme.typography.body.fontSize - 1,
  },
  uploadActionButton: {
    // Inherits from 'button' now
  },
  progressBarContainer: {
    height: 20,
    backgroundColor: theme.colors.neutral,
    borderRadius: 10,
    marginTop: theme.spacing.xs + 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  progressText: {
    position: 'absolute',
    alignSelf: 'center',
    color: theme.colors.primaryContent, // Ensure visibility against progress bar color
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: theme.spacing.xs, // Make it easier to tap
    marginLeft: theme.spacing.xs,
  },
}));

export default HomeScreen;
