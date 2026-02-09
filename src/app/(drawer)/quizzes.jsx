import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView
} from 'react-native';
// Clean up imports: only useTheme and createThemedStyles are needed from theme.js here
import { createThemedStyles, useTheme } from '../../theme/theme';
import SkeletonQuizItem from '../../components/SkeletonQuizItem';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUserQuizzes, deleteQuiz } from '../../services/quizService';
import { useNetwork } from '../../contexts/NetworkContext';
import NetworkStatusBar from '../../components/NetworkStatusBar';
import logger from '../../services/loggerService';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth

const PAGE_LIMIT = 10;

// Create themed styles using the utility function
const getStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.l,
    backgroundColor: theme.colors.background,
  },
  errorText: {
    fontSize: theme.typography.body.fontSize + 2,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.m,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.xl - 2,
    borderRadius: 8,
    marginTop: theme.spacing.xs,
  },
  retryButtonText: {
    color: theme.colors.primaryContent,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.l,
    marginTop: 50, // Keep existing margin
    backgroundColor: theme.colors.background,
  },
  emptyText: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.h3.fontWeight,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing.m,
  },
  emptySubtext: {
    fontSize: theme.typography.caption.fontSize + 2,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.l,
    lineHeight: 20,
  },
  upgradeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.l,
    marginHorizontal: theme.spacing.m,
  },
  upgradeTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.m,
    marginTop: theme.spacing.l,
  },
  upgradeText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  upgradeButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.m,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: theme.colors.primaryContent,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  generateButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.l,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateButtonText: {
    color: theme.colors.primaryContent,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    marginLeft: theme.spacing.xs,
  },
  generateExamButtonContainer: {
    padding: theme.spacing.m,
    alignItems: 'center',
    backgroundColor: theme.colors.background, // Match screen background
  },
  quizItem: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.m, // Consistent with profile card padding
    marginHorizontal: theme.spacing.m, // Consistent horizontal margin
    marginBottom: theme.spacing.m, // Consistent bottom margin for each item
    borderRadius: 10, // Consistent with profile card borderRadius (now matching home.jsx backup)
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quizInfo: {
    flex: 1,
    marginRight: theme.spacing.xs + 2,
  },
  quizTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  quizDetails: {
    fontSize: theme.typography.caption.fontSize + 1,
    color: theme.colors.subtext,
  },
  cachedBadge: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.subtext,
    fontWeight: '500',
  },
  quizActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.m,
    borderRadius: 6,
    marginLeft: theme.spacing.xs,
  },
  startButtonText: {
    color: theme.colors.primaryContent,
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    padding: theme.spacing.xs,
    borderRadius: 6,
  },
  listContent: {
    paddingTop: theme.spacing.medium, // Add top padding to the list container
    paddingBottom: theme.spacing.large, // Consistent bottom padding
    // No paddingHorizontal, as quizItem handles its own horizontal margins
  },
  emptyFlatList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoadingContainer: {
    paddingVertical: theme.spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoadingText: {
    marginTop: theme.spacing.xs,
    color: theme.colors.subtext,
    fontSize: theme.typography.caption.fontSize + 1,
  },
  loadMoreButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.l,
    borderRadius: 8,
    marginVertical: theme.spacing.s,
  },
  loadMoreButtonText: {
    color: theme.colors.primaryContent,
    fontWeight: '600',
    fontSize: theme.typography.caption.fontSize + 2,
  },
  endOfListText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.caption.fontSize + 1,
    fontStyle: 'italic',
  },
  offlineMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // Light blue with opacity
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.xs + 2,
  },
  offlineMessageText: {
    color: theme.colors.info, // Blue text
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.caption.fontSize + 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)', // Light red with opacity
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.xs + 2,
  },
  errorBannerText: {
    color: theme.colors.error,
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.caption.fontSize + 2,
  },
}));

const QuizzesScreen = () => {
  const theme = useTheme(); // Get the theme object from the context
  const styles = getStyles(); // getStyles is a hook that uses the theme internally
  
  const router = useRouter();
  const { session, profile, isAuthReady, handleSubscription, isSubscribing, subscriptionError: authSubscriptionError } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const { isConnected } = useNetwork();

  const handleGenerateNewExam = useCallback(() => {
    router.push('/home');
  }, [router]);

  // Fetch quizzes with pagination support

  const fetchQuizzes = useCallback(async (pageToFetch = 1, refreshing = false) => {
    if (!session) {
      logger.info('QuizzesScreen', 'No session, skipping quiz fetch');
      setQuizzes([]);
      setTotalQuizzes(0);
      setCurrentPage(1);
      setIsLoadingInitial(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
      setError(null);
      return;
    }

    logger.info('QuizzesScreen', `Fetching quizzes, page: ${pageToFetch}`, { refreshing, isOffline: !isConnected });
    
    try {
      // If refreshing or first page, set loading state
      if (refreshing) {
        setIsRefreshing(true);
      } else if (pageToFetch === 1) {
        setIsLoadingInitial(true);
      } else {
        setIsLoadingMore(true);
      }
      
      // Clear error state
      setError(null);
      
      // Call API
      const response = await getUserQuizzes(pageToFetch, PAGE_LIMIT);
      logger.debug('QuizzesScreen', 'Quizzes fetched successfully', { count: response.quizzes.length, total: response.total });
      
      // Update state based on page
      if (pageToFetch === 1) {
        // Replace all quizzes for page 1
        setQuizzes(response.quizzes);
      } else {
        // Append quizzes for subsequent pages, avoiding duplicates
        setQuizzes(prev => {
          // Get existing quiz IDs for deduplication
          const existingIds = new Set(prev.map(q => q.id));
          // Filter out any duplicates from the new quizzes
          const newQuizzes = response.quizzes.filter(quiz => !existingIds.has(quiz.id));
          
          // Log detailed information about the quizzes being appended
          logger.debug('QuizzesScreen', 'Appending quizzes', { 
            previousCount: prev.length, 
            newCount: newQuizzes.length,
            totalAfter: prev.length + newQuizzes.length,
            duplicatesFiltered: response.quizzes.length - newQuizzes.length,
            firstNewQuizId: newQuizzes.length > 0 ? newQuizzes[0].id : null,
            lastNewQuizId: newQuizzes.length > 0 ? newQuizzes[newQuizzes.length - 1].id : null
          });
          
          // If no new quizzes were found but we expect more, log a warning
          if (newQuizzes.length === 0 && prev.length < totalQuizzes) {
            logger.warn('QuizzesScreen', 'No new quizzes found despite expecting more', {
              currentCount: prev.length,
              totalExpected: totalQuizzes,
              page: pageToFetch
            });
          }
          
          return [...prev, ...newQuizzes];
        });
      }
      
      // Update metadata
      setTotalQuizzes(response.total);
      setCurrentPage(pageToFetch);
    } catch (err) {
      logger.error('QuizzesScreen', 'Error fetching quizzes', { error: err.message });
      setError('Failed to load quizzes. Please check your connection and try again.');
    } finally {
      // Reset loading states
      setIsLoadingInitial(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [session, isConnected]);

  // Initial fetch logic based on subscription status
  useEffect(() => {
    if (isAuthReady && profile) {
      if (profile.plan_status === 'active') {
        logger.info('QuizzesScreen:useEffect', 'Profile loaded and user is active. Fetching quizzes.');
        fetchQuizzes(1);
      } else {
        logger.info('QuizzesScreen:useEffect', 'Profile loaded but user is not subscribed. Showing upgrade prompt.');
        setIsLoadingInitial(false); // Stop loading, show upgrade prompt
        setQuizzes([]); // Clear any stale quiz data
        setTotalQuizzes(0);
      }
    } else if (isAuthReady && !session) {
      // Handle logged out state
      logger.info('QuizzesScreen:useEffect', 'Auth ready but no session. Clearing data.');
      setIsLoadingInitial(false);
      setQuizzes([]);
      setTotalQuizzes(0);
    }
  }, [isAuthReady, profile, session, fetchQuizzes]);

  const handleRefresh = () => {
    logger.debug('QuizzesScreen', 'Manual refresh triggered');
    fetchQuizzes(1, true);
  };

  const handleLoadMore = () => {
    // Only load more if we have more to load and we're not already loading
    if (quizzes.length < totalQuizzes && !isLoadingMore && !isRefreshing) {
      const nextPage = currentPage + 1;
      logger.info('QuizzesScreen', 'Loading more quizzes', { 
        currentPage, 
        nextPage, 
        quizzesLoaded: quizzes.length, 
        totalQuizzes,
        remainingToLoad: totalQuizzes - quizzes.length
      });
      // Force a small delay to prevent potential race conditions
      setTimeout(() => {
        fetchQuizzes(nextPage);
      }, 100);
      return true;
    } else {
      logger.debug('QuizzesScreen', 'Not loading more quizzes', { 
        quizzesLength: quizzes.length, 
        totalQuizzes, 
        isLoadingMore, 
        isRefreshing,
        shouldLoad: quizzes.length < totalQuizzes && !isLoadingMore && !isRefreshing
      });
      return false;
    }
  };

  const handleStartQuiz = (quiz) => {
    router.push(`/quiz/${quiz.id}`);
  };

  const performActualDelete = async (quizId, quizTitle) => {
    logger.info('QuizzesScreen', `Attempting to delete quiz: ${quizTitle} (ID: ${quizId})`);
    try {
      await deleteQuiz(quizId);
      logger.info('QuizzesScreen', `Quiz ${quizTitle} (ID: ${quizId}) deleted successfully from backend.`);
      
      setQuizzes(prevQuizzes => prevQuizzes.filter(q => q.id !== quizId));
      setTotalQuizzes(prevTotal => prevTotal - 1);
      
      Alert.alert(
        'Exam Deleted',
        `"${quizTitle || 'Untitled Exam'}" has been successfully deleted.`,
        [{ text: 'OK' }]
      );
      logger.debug('QuizzesScreen', 'Local state updated after quiz deletion.');
    } catch (err) {
      logger.error('QuizzesScreen', `Error deleting quiz ${quizTitle} (ID: ${quizId})`, { error: err.message });
      Alert.alert(
        'Error',
        `Failed to delete "${quizTitle || 'Untitled Exam'}". Please try again. Error: ${err.message}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleDeleteQuiz = (quizId, quizTitle) => {
    logger.debug('QuizzesScreen', `Delete action initiated for quiz: ${quizTitle} (ID: ${quizId})`);
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete the exam "${quizTitle || 'Untitled Exam'}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => logger.debug('QuizzesScreen', 'Quiz deletion cancelled.'),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => performActualDelete(quizId, quizTitle),
        },
      ],
      { cancelable: true }
    );
  };

  const renderQuizItem = ({ item }) => {
    const quizDate = new Date(item.created_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    const quizTime = new Date(item.created_at).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });

    return (
      <View style={styles.quizItem}>
        <View style={styles.quizInfo}>
          <Text style={styles.quizTitle} numberOfLines={2} ellipsizeMode="tail">
            {item.title || 'Untitled Exam'}
          </Text>
          <Text style={styles.quizDetails}>
            {item.question_count} Questions • {quizDate} at {quizTime}
          </Text>
          {item.is_cached && <Text style={styles.cachedBadge}>Cached</Text>}
        </View>
        <View style={styles.quizActions}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteQuiz(item.id, item.title)}
          >
            <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => handleStartQuiz(item)}
          >
            <Text style={styles.startButtonText}>Start</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.footerLoadingText}>Loading more exams...</Text>
        </View>
      );
    }
    
    if (quizzes.length > 0 && quizzes.length < totalQuizzes) {
      return (
        <View style={styles.footerLoadingContainer}>
          <Text style={styles.footerLoadingText}>
            Showing {quizzes.length} of {totalQuizzes} exams
          </Text>
          <TouchableOpacity 
            style={styles.loadMoreButton}
            onPress={() => {
              logger.debug('QuizzesScreen', 'Manual load more button pressed');
              handleLoadMore();
            }}
          >
            <Text style={styles.loadMoreButtonText}>Load More</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (quizzes.length > 0 && quizzes.length === totalQuizzes && !isLoadingMore) {
      return (
        <View style={styles.footerLoadingContainer}>
          <Text style={styles.endOfListText}>You've reached the end of your exam history.</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'My Exams' }} />
      <NetworkStatusBar />

      {/* Loading State */} 
      {(!isAuthReady || (session && !profile)) && (
        <View style={styles.emptyContainer}> 
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.emptySubtext, {marginTop: theme.spacing.m}]}>Loading your exam data...</Text>
        </View>
      )}

      {/* User is logged in, profile is loaded */} 
      {isAuthReady && profile && (
        <>
          {profile.plan_status === 'active' ? (
            // --- SUBSCRIBED USER VIEW ---
            <>
              {isLoadingInitial ? (
                <FlatList
                  data={Array.from({ length: 5 })}
                  renderItem={() => <SkeletonQuizItem />}
                  keyExtractor={(_, index) => index.toString()}
                  contentContainerStyle={styles.listContent}
                />
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={() => fetchQuizzes(1, true)}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={quizzes}
                  renderItem={renderQuizItem}
                  keyExtractor={(item) => item.id.toString()}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Ionicons name="document-text-outline" size={72} color={theme.colors.subtext} />
                      <Text style={styles.emptyText}>No Exams Yet</Text>
                      <Text style={styles.emptySubtext}>
                        Generate your first exam from the Home screen to see it here.
                      </Text>
                      <TouchableOpacity style={styles.generateButton} onPress={handleGenerateNewExam}>
                        <Ionicons name="add-circle-outline" size={20} color={theme.colors.primaryContent} />
                        <Text style={styles.generateButtonText}>Generate New Exam</Text>
                      </TouchableOpacity>
                    </View>
                  }
                  ListFooterComponent={renderFooter}
                  onEndReached={handleLoadMore}
                  onEndReachedThreshold={0.5}
                  refreshControl={
                    <RefreshControl
                      refreshing={isRefreshing}
                      onRefresh={handleRefresh}
                      colors={[theme.colors.primary]}
                      tintColor={theme.colors.primary}
                    />
                  }
                  contentContainerStyle={quizzes.length === 0 ? styles.emptyFlatList : styles.listContent}
                />
              )}
            </>
          ) : (
            // --- UPGRADE VIEW ---
            <View style={styles.upgradeContainer}>
              <Ionicons name="lock-closed-outline" size={72} color={theme.colors.primary} style={{ marginBottom: theme.spacing.m }}/>
              <Text style={styles.upgradeTitle}>Unlock Full Exam History</Text>
              <Text style={styles.upgradeText}>
                Upgrade to Captain's Club to access all your past exams, review your performance in detail, and track your learning journey.
              </Text>
              <TouchableOpacity 
                style={[styles.upgradeButton, isSubscribing && { backgroundColor: theme.colors.disabled }]} 
                onPress={handleSubscription}
                disabled={isSubscribing}
              >
                {isSubscribing ? (
                  <ActivityIndicator color={theme.colors.primaryContent} style={{marginRight: theme.spacing.s}}/>
                ) : (
                  <Ionicons name="star-outline" size={20} color={theme.colors.primaryContent} style={{ marginRight: theme.spacing.s }} />
                )}
                <Text style={styles.upgradeButtonText}>
                  {isSubscribing ? 'Processing...' : "Upgrade to Captain's Club"}
                </Text>
              </TouchableOpacity>
              {authSubscriptionError && (
                <Text style={[styles.errorText, { marginTop: theme.spacing.m, fontSize: theme.typography.caption.fontSize + 1 }]}>
                  Error: {typeof authSubscriptionError === 'string' ? authSubscriptionError : authSubscriptionError.message || 'An unknown subscription error occurred.'}
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
};
// ... rest of the code remains the same ...
export default QuizzesScreen;
