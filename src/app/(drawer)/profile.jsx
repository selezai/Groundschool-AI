import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Modal,
  Platform,
  // StyleSheet // No longer needed directly if createThemedStyles handles all
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import logger from '../../services/loggerService';
import posthogService from '../../services/posthogService';
import { useTheme, createThemedStyles } from '../../theme/theme';
import { WebView } from 'react-native-webview';
import CustomWebAlert from '../../components/CustomWebAlert';
import cacheService, { CACHE_KEYS } from '../../services/cacheService';

const PAYFAST_RETURN_URL_IDENTIFIER = '/payment-success.html';
const PAYFAST_CANCEL_URL_IDENTIFIER = '/payment-cancel.html';

const ProfileScreen = () => {
  const [storageUsage, setStorageUsage] = useState(0);
  const [examsCount, setExamsCount] = useState(0);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [usageError, setUsageError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  // Cache for activity stats
  const [statsCache, setStatsCache] = useState({
    data: null,
    timestamp: null,
    isValid: false
  });
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  // Cache invalidation utility
  const invalidateStatsCache = useCallback(() => {
    logger.info('ProfileScreen:invalidateStatsCache', 'Invalidating stats cache');
    setStatsCache(prev => ({
      ...prev,
      isValid: false
    }));
  }, []);
  
  // Register with cache service
  useEffect(() => {
    cacheService.registerInvalidationCallback(CACHE_KEYS.PROFILE_STATS, invalidateStatsCache);
    
    return () => {
      cacheService.unregisterInvalidationCallback(CACHE_KEYS.PROFILE_STATS, invalidateStatsCache);
    };
  }, [invalidateStatsCache]);
  
  // Testing phase flag - set to true to hide billing elements
  // When user says "activate cc", change this to false to restore normal functionality
  const isTestingPhase = true;
  const theme = useTheme(); // Define theme using the hook
  const styles = getStyles();
  const router = useRouter();
  const { 
    user,
    profile, 
    signOut,
    session,
    handleSubscription,
    isSubscribing,
    subscriptionError,
    resetSubscriptionState,
    cancelSubscription,
    isCancelling,
    showPayfastWebView,
    payfastPaymentData,
    fetchUserProfile,
  } = useAuth();

  // isLoadingInitial: true if profile is not yet loaded from AuthContext (and user exists)
  const [isLoadingInitial, setIsLoadingInitial] = useState(!!user && !profile);
  // isFetchingStats: true when stats are actively being fetched
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  const [error, setError] = useState(null); // For stats fetching errors primarily
  const [stats, setStats] = useState({
    quizCount: 0,
    documentCount: 0,
    averageScore: 0,
  });

  const fetchUserStats = useCallback(async (forceRefresh = false) => {
    if (!user?.id) {
      logger.warn('ProfileScreen:fetchUserStats', 'No user ID, cannot fetch stats.');
      setStats({ quizCount: 0, documentCount: 0, averageScore: 0 });
      setIsFetchingStats(false); // Not fetching if no user
      return;
    }

    // Check if we have valid cached data and don't need to force refresh
    const now = Date.now();
    if (!forceRefresh && statsCache.isValid && statsCache.data && statsCache.timestamp) {
      const cacheAge = now - statsCache.timestamp;
      if (cacheAge < CACHE_DURATION) {
        logger.info('ProfileScreen:fetchUserStats', 'Using cached stats data', { cacheAge: Math.round(cacheAge / 1000) + 's' });
        setStats(statsCache.data);
        setIsFetchingStats(false);
        setError(null);
        return;
      }
    }

    logger.info('ProfileScreen:fetchUserStats', 'Fetching fresh stats for user:', { userId: user.id, forceRefresh });
    setIsFetchingStats(true);
    setError(null); // Clear previous errors
    try {
      const [quizData, docData, attemptsData] = await Promise.all([
        supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('quiz_attempts').select('score').eq('user_id', user.id),
      ]);

      const quizCount = quizData.error ? 0 : quizData.count;
      if (quizData.error) logger.error('ProfileScreen:fetchUserStats', 'Error fetching quiz count', { error: quizData.error });

      const documentCount = docData.error ? 0 : docData.count;
      if (docData.error) logger.error('ProfileScreen:fetchUserStats', 'Error fetching document count', { error: docData.error });

      let averageScore = 0;
      if (!attemptsData.error && attemptsData.data && attemptsData.data.length > 0) {
        const totalScore = attemptsData.data.reduce((sum, attempt) => sum + attempt.score, 0);
        averageScore = Math.round(totalScore / attemptsData.data.length);
      } else if (attemptsData.error) {
        logger.error('ProfileScreen:fetchUserStats', 'Error fetching quiz attempts', { error: attemptsData.error });
      }

      const newStats = {
        quizCount: quizCount || 0,
        documentCount: documentCount || 0,
        averageScore: averageScore || 0,
      };

      setStats(newStats);
      
      // Update cache with fresh data
      setStatsCache({
        data: newStats,
        timestamp: now,
        isValid: true
      });
      
      logger.info('ProfileScreen:fetchUserStats', 'Stats fetched and cached successfully');
    } catch (e) {
      logger.error('ProfileScreen:fetchUserStats', 'Exception fetching user stats', { error: e });
      setError('Failed to load your activity statistics. Please try again.');
    } finally {
      setIsFetchingStats(false); // Done fetching stats (or failed)
    }
  }, [user?.id, statsCache, CACHE_DURATION]);

  // Track if usage data has been initially loaded to prevent unnecessary refetches on window focus
  const [hasInitiallyLoadedUsage, setHasInitiallyLoadedUsage] = useState(false);

  useEffect(() => {
    const fetchUsageData = async () => {
      if (!session?.user?.id) {
        // Reset the flag when user logs out so it loads fresh on next login
        setHasInitiallyLoadedUsage(false);
        return;
      }

      // Only fetch if we haven't loaded yet for this user session
      if (hasInitiallyLoadedUsage) return;

      setIsLoadingUsage(true);
      setUsageError(null);

      try {
        // Fetch storage usage
        const { data: documents, error: documentsError } = await supabase
          .from('documents')
          .select('file_size')
          .eq('user_id', session.user.id);

        if (documentsError) throw documentsError;

        const totalSize = documents.reduce((acc, doc) => acc + (doc.file_size || 0), 0);
        setStorageUsage(totalSize / (1024 * 1024)); // Convert bytes to MB

        // Fetch monthly exams count
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const { count, error: examsError } = await supabase
          .from('quizzes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .gte('created_at', firstDayOfMonth.toISOString());

        if (examsError) throw examsError;

        setExamsCount(count || 0);
        setHasInitiallyLoadedUsage(true);

      } catch (error) {
        console.error('Error fetching usage data:', error.message);
        setUsageError('Failed to load usage data. Please try again.');
      } finally {
        setIsLoadingUsage(false);
      }
    };

    fetchUsageData();
  }, [session?.user?.id, hasInitiallyLoadedUsage]);

  // Effect for initial profile loading state and triggering stats fetch
  useEffect(() => {
    if (user && !profile) {
      // User exists, but profile hasn't loaded yet from AuthContext. Show initial loading.
      setIsLoadingInitial(true);
      setError(null);
    } else if (user && profile) {
      // User and profile are available. Stop initial loading and fetch stats.
      setIsLoadingInitial(false);
      fetchUserStats();
    } else if (!user) {
      // No user, clear everything and stop all loading.
      setIsLoadingInitial(false);
      setIsFetchingStats(false);
      setError(null);
      setStats({ quizCount: 0, documentCount: 0, averageScore: 0 });
    }
  }, [user, profile, fetchUserStats]);

  // useFocusEffect to refetch stats when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Track screen view
      posthogService.screen('Profile Screen', {
        user_plan: profile?.plan || 'basic',
        plan_status: profile?.plan_status || 'unknown',
        storage_used_mb: storageUsage,
        exams_count: examsCount,
        monthly_quizzes_remaining: profile?.monthly_quizzes_remaining || 0,
      });
      
      logger.info('ProfileScreen:useFocusEffect', 'Screen focused.');
      if (user?.id && profile) {
        // User and profile are available, fetch stats (will use cache if valid).
        fetchUserStats();
      } else if (!user?.id) {
        // No user, ensure all loading is false and stats are cleared.
        logger.info('ProfileScreen:useFocusEffect', 'No user session on focus.');
        setIsLoadingInitial(false);
        setIsFetchingStats(false);
        setStats({ quizCount: 0, documentCount: 0, averageScore: 0 });
        setError(null);
      } else if (user?.id && !profile) {
        // User exists but profile not yet loaded (e.g., came to screen before AuthContext finished)
        logger.info('ProfileScreen:useFocusEffect', 'User session active, but profile not yet available. AuthContext should load it.');
        setIsLoadingInitial(true);
      }
      return () => {
        // Optional: Cleanup if needed when screen loses focus
        // logger.debug('ProfileScreen:useFocusEffect', 'Screen unfocused.');
      };
    }, [user?.id, profile, fetchUserStats])
  );

  useEffect(() => {
    if (subscriptionError) {
      Alert.alert('Subscription Error', subscriptionError.message || 'An unexpected error occurred during the subscription process.');
      resetSubscriptionState(); // Clear the error and WebView state
    }
  }, [subscriptionError, resetSubscriptionState]);

  const handleWebViewNavigationStateChange = async (navState) => {
    const { url } = navState;
    if (!url) return;

    // Check for success URL
    if (url.includes(PAYFAST_RETURN_URL_IDENTIFIER)) {
      logger.info('ProfileScreen:WebViewNav', 'Payment success detected', { url });
      resetSubscriptionState();
      
      // Refresh profile to get new plan status
      try {
        await fetchUserProfile(user.id);
        logger.info('ProfileScreen:WebViewNav', 'Profile refreshed after payment success');
      } catch (error) {
        logger.error('ProfileScreen:WebViewNav', 'Failed to refresh profile after payment', error);
      }
      
      Alert.alert('Success!', 'Your subscription to Captain\'s Club is now active.');
      // Optionally navigate to a success screen or refresh data
    }

    // Check for cancel URL
    if (url.includes(PAYFAST_CANCEL_URL_IDENTIFIER)) {
      logger.info('ProfileScreen:WebViewNav', 'Payment cancellation detected', { url });
      resetSubscriptionState();
      Alert.alert('Payment Cancelled', 'Your subscription process was cancelled.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      logger.info('ProfileScreen:handleSignOut', 'Sign out successful.');
      // AuthContext's onAuthStateChange listener should handle navigation
    } catch (err) {
      logger.error('ProfileScreen:handleSignOut', 'Error during sign out', { error: err });
      Alert.alert('Error Signing Out', err.message || 'An unexpected error occurred.');
    }
  };

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      setShowDeleteConfirm(true);
    } else {
      Alert.alert(
        'Delete Account',
        'Are you sure you want to permanently delete your account? This action cannot be undone and will delete all your data, documents, and exam history.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete Account',
            style: 'destructive',
            onPress: () => performAccountDeletion(),
          },
        ]
      );
    }
  };

  const performAccountDeletion = async () => {
    if (isDeletingAccount) return;
    
    setIsDeletingAccount(true);
    
    try {
      logger.info('Starting account deletion process', { userId: user.id });
      
      // Call the Edge Function to delete the account
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        throw new Error('No active session found');
      }
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-user-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete account');
      }
      
      logger.info('Account deleted successfully', { userId: user.id });
      
      // Show success message
      if (Platform.OS === 'web') {
        alert('Account deleted successfully. You will now be signed out.');
      } else {
        Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
      }
      
      // Sign out the user
      await signOut();
      
    } catch (error) {
      logger.error('Exception during account deletion', { error });
      
      const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
      
      if (Platform.OS === 'web') {
        alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUpgradePress = () => {
    logger.info('ProfileScreen:handleUpgradePress', "Upgrade to Captain's Club pressed.");
    if (isSubscribing) return; // Prevent multiple presses
    handleSubscription(); // This now comes from AuthContext
  };

  const handleCancelPress = () => {
    const performCancellation = async () => {
      logger.info('ProfileScreen:handleCancelPress', 'User confirmed cancellation. Calling cancelSubscription...');
      try {
        await cancelSubscription();
        // Use Alert for success message as it's less critical if it doesn't show on web
        Alert.alert('Success', 'Your subscription has been successfully cancelled.');
      } catch (error) {
        logger.error('ProfileScreen:handleCancelPress', 'Error during cancellation.', { error });
        Alert.alert('Error', error.message || 'Failed to cancel subscription. Please try again.');
      }
    };

    logger.info('ProfileScreen:handleCancelPress', 'Cancel button pressed. Checking platform for confirmation.');

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to cancel? You will lose access to Captain\'s Club features at the end of your current billing period.')) {
        performCancellation();
      } else {
        logger.info('ProfileScreen:handleCancelPress', 'User chose "Nevermind" in browser confirm dialog.');
      }
    } else {
      Alert.alert(
        'Cancel Subscription',
        'Are you sure you want to cancel? You will lose access to Captain\'s Club features at the end of your current billing period.',
        [
          {
            text: 'Nevermind',
            style: 'cancel',
            onPress: () => logger.info('ProfileScreen:handleCancelPress', 'User chose "Nevermind".'),
          },
          {
            text: 'Yes, Cancel',
            onPress: performCancellation,
            style: 'destructive',
          },
        ]
      );
    }
  };

  const getPlanDisplayName = (planKey) => {
    if (!planKey) return 'N/A';
    switch (planKey.toLowerCase()) {
      case 'basic': return 'Basic Plan';
      case 'captains_club': return "Captain's Club";
      default: return planKey.charAt(0).toUpperCase() + planKey.slice(1);
    }
  };

  const getStorageDisplay = () => {
    if (!profile) return 'N/A';
    const used = profile.storage_used_mb || 0;
    const limit = profile.plan === 'captains_club' ? 500 : 25;
    return `${used}MB / ${limit}MB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) {
      logger.warn('ProfileScreen:formatDate', 'Could not format date', { dateString, error: e });
      return 'Invalid Date';
    }
  };

  // Initial loading state (waiting for profile from AuthContext)
  if (isLoadingInitial) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Profile', headerTintColor: theme.colors.text }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading Your Profile...</Text>
        </View>
      </View>
    );
  }

  // If not signed in (user and session are null)
  if (!user && !session) {
     return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Profile', headerTintColor: theme.colors.text }} />
        <View style={styles.centeredMessageContainer}>
          <Ionicons name="log-in-outline" size={48} color={theme.colors.text} />
          <Text style={styles.messageText}>Please sign in to view your profile.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/sign-in')}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const captainFeatures = [
    "Unlimited Exams",
    "500MB Secure Storage",
    "Full Access to 'My Exams'",
    "Priority Support"
  ];

  // If signed in, but profile is still null after initial loading period (should be rare if trigger works)
  if (user && !profile) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Profile', headerTintColor: darkColors.text }} />
        <View style={styles.centeredMessageContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={darkColors.warning} />
          <Text style={styles.messageText}>Could not load your profile data. Please try refreshing the app or contact support if the issue persists.</Text>
        </View>
      </View>
    );
  }

  // Main content once profile is available
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
      <Stack.Screen options={{ title: 'Profile', headerTintColor: theme.colors.text }} />

      {/* User Info Card */}
      <View style={styles.card}>
        <View style={styles.userInfoHeader}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <Ionicons name="person-circle-outline" size={styles.avatar.width} color={theme.colors.textMuted} style={styles.avatarIcon} />
          )}
          <View style={styles.userInfoTextContainer}>
            <Text style={styles.userIdentifier}>{profile.username || user?.email || 'User'}</Text>
            {profile.username && user?.email && (
              <Text style={styles.userEmail}>{user.email}</Text>
            )}
          </View>
        </View>
      </View>

      {/* New Subscription Card Structure */}
      <View style={styles.card}>
        {/* Basic Plan Box */}
        <View style={[styles.planBox, profile.plan === 'basic' && styles.planBoxHighlighted]}>
          <View style={styles.planHeader}>
            <Text style={styles.planNameText}>Basic Plan{profile.plan === 'basic' ? ' (Current)' : ''}</Text>
            <Text style={styles.planPriceText}>Free</Text>
          </View>
          {/* No description for Basic Plan as per request */}
        </View>

        {/* Captain's Club Box */}
        <View style={[styles.planBox, { marginTop: theme.spacing.m }, profile.plan === 'captains_club' && styles.planBoxHighlighted]}>
          <View style={styles.planHeader}>
            <Text style={styles.planNameText}>Captain's Club{profile.plan === 'captains_club' ? ' (Current)' : ''}</Text>
            {/* Hide price during testing phase */}
            {!isTestingPhase && <Text style={styles.planPriceText}>R99/month</Text>}
          </View>
          <Text style={styles.planDescriptionText}>
            {captainFeatures.join(', ')}
          </Text>
          {profile.plan === 'captains_club' && (
            <>
              <View style={[styles.infoRow, { marginTop: theme.spacing.s }]}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={[styles.infoValue, { color: profile.plan_status === 'active' ? theme.colors.success : theme.colors.error }]}>
                  {profile.plan_status ? profile.plan_status.charAt(0).toUpperCase() + profile.plan_status.slice(1) : 'N/A'}
                </Text>
              </View>
              {/* Hide next billing date during testing phase */}
              {!isTestingPhase && profile.plan_period_end && (
                <View style={styles.infoRowBorderless}>
                  <Text style={styles.infoLabel}>Next Billing Date</Text>
                  <Text style={styles.infoValue}>{formatDate(profile.plan_period_end)}</Text>
                </View>
              )}
              {/* Disable cancel button during testing phase */}
              <TouchableOpacity 
                style={[styles.cancelButton, isTestingPhase && styles.disabledButton]} 
                onPress={isTestingPhase ? null : handleCancelPress}
                disabled={isTestingPhase}
              >
                <Text style={[styles.cancelButtonText, isTestingPhase && { opacity: 0.5 }]}>Cancel Subscription</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Upgrade Button - shown only if user is on basic plan */}
        {profile.plan === 'basic' && (
          <TouchableOpacity 
            style={[styles.upgradeCtaButton, { marginTop: theme.spacing.l }, isSubscribing && styles.disabledButton]} 
            onPress={handleUpgradePress}
            disabled={isSubscribing}
          >
            {isSubscribing ? (
              <ActivityIndicator size="small" color={theme.colors.buttonText} />
            ) : (
              <Text style={styles.upgradeCtaButtonText}>Upgrade to Captain's Club (R99/Month)</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Usage & Quotas Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Usage & Quotas</Text>
        <View style={styles.usageQuotaItem}>
          <Text style={styles.usageQuotaLabel}>Monthly Exams</Text>
          <Text style={styles.usageQuotaValue}>
            {isLoadingUsage ? '...' : `${examsCount} / ${profile?.plan === 'basic' ? 10 : 'Unlimited'}`}
          </Text>
        </View>
        <View style={styles.usageQuotaItem}>
          <Text style={styles.usageQuotaLabel}>Cloud Storage</Text>
          <Text style={styles.usageQuotaValue}>
            {isLoadingUsage ? '...' : `${storageUsage.toFixed(1)} MB / ${profile?.plan === 'basic' ? '25 MB' : '500 MB'}`}
          </Text>
        </View>
        {profile.last_quota_reset_date && profile.plan === 'basic' && (
           <View style={[styles.quotaResetTextContainer, {borderTopWidth: 0, marginTop: theme.spacing.xs, paddingTop: theme.spacing.xs}]}>
             <Text style={[styles.quotaResetText, {textAlign: 'left', marginTop: theme.spacing.s}]}>Quotas next reset on: {formatDate(new Date(new Date(profile.last_quota_reset_date).setMonth(new Date(profile.last_quota_reset_date).getMonth() + 1)))}</Text>
           </View>
        )}
      </View>

      {/* My Activity Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Activity</Text>
        {isFetchingStats ? (
          <View style={styles.loadingOrErrorContainer}>
            <ActivityIndicator size="small" color={theme.colors.textMuted} />
            <Text style={styles.loadingOrErrorText}>Loading stats...</Text>
          </View>
        ) : error ? (
           <View style={styles.loadingOrErrorContainer}>
             <Ionicons name="warning-outline" size={24} color={theme.colors.error} />
             <Text style={[styles.loadingOrErrorText, {color: theme.colors.error}]}>{error}</Text>
             <TouchableOpacity style={[styles.secondaryButton, {marginTop: theme.spacing.small}]} onPress={() => fetchUserStats(true)}>
                <Text style={styles.secondaryButtonText}>Try Again</Text>
            </TouchableOpacity>
           </View>
        ) : (
          <View style={styles.statsRowContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.quizCount}</Text>
              <Text style={styles.statLabel}>Exams</Text>
            </View>
            <View style={styles.statItemSeparator} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.documentCount}</Text>
              <Text style={styles.statLabel}>Documents</Text>
            </View>
            <View style={styles.statItemSeparator} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.averageScore}%</Text>
              <Text style={styles.statLabel}>Avg. Score</Text>
            </View>
          </View>
        )}
      </View>

      {/* Navigation Card */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.navigationItem} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={22} style={styles.navigationItemIcon} color={theme.colors.primary} />
          <Text style={styles.navigationItemText}>App Settings</Text>
          <Ionicons name="chevron-forward" size={20} style={styles.navigationChevron} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.navigationItemSeparator} />
        <TouchableOpacity style={styles.navigationItem} onPress={() => router.push('/help')}>
          <Ionicons name="help-circle-outline" size={22} color={theme.colors.primary} style={styles.navigationItemIcon} />
          <Text style={styles.navigationItemText}>Help & Support</Text>
          <Ionicons name="chevron-forward-outline" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.navigationItemSeparator} />
        <TouchableOpacity style={styles.navigationItem} onPress={() => router.push('/about')}>
          <Ionicons name="information-circle-outline" size={22} color={theme.colors.primary} style={styles.navigationItemIcon} />
          <Text style={styles.navigationItemText}>About</Text>
          <Ionicons name="chevron-forward-outline" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#0a0e23" style={styles.signOutButtonIcon} />
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Delete Account Button */}
      <TouchableOpacity 
        style={[styles.deleteAccountButton, isDeletingAccount && styles.buttonDisabled]} 
        onPress={handleDeleteAccount}
        disabled={isDeletingAccount}
      >
        {isDeletingAccount ? (
          <ActivityIndicator size="small" color={theme.colors.white} style={styles.deleteAccountButtonIcon} />
        ) : (
          <Ionicons name="trash-outline" size={20} color={theme.colors.white} style={styles.deleteAccountButtonIcon} />
        )}
        <Text style={styles.deleteAccountButtonText}>
          {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
        </Text>
      </TouchableOpacity>

      {/* Custom Web Alert for Delete Confirmation */}
      <CustomWebAlert
        visible={showDeleteConfirm}
        title="Delete Account"
        message="Are you sure you want to permanently delete your account? This action cannot be undone and will delete all your data, documents, and exam history."
        buttons={[
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setShowDeleteConfirm(false),
          },
          {
            text: 'Delete Account',
            style: 'destructive',
            onPress: () => {
              setShowDeleteConfirm(false);
              performAccountDeletion();
            },
          },
        ]}
        onClose={() => setShowDeleteConfirm(false)}
      />

    
      {/* Payfast WebView Modal */}
      {showPayfastWebView && payfastPaymentData && (
        <Modal
          visible={showPayfastWebView}
          onRequestClose={() => resetSubscriptionState()} // Android back button
          animationType="slide"
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <View style={{ padding: theme.spacing.s, flexDirection: 'row', justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <TouchableOpacity onPress={() => resetSubscriptionState()} style={{ padding: theme.spacing.s }}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <WebView
              source={{ html: payfastPaymentData.htmlForm }}
              originWhitelist={['*']} // Consider tightening this to Payfast domains
              onNavigationStateChange={handleWebViewNavigationStateChange}
              style={{ flex: 1 }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={{color: theme.colors.text, marginTop: theme.spacing.m}}>Connecting to Payfast...</Text>
                </View>
              )}
            />
          </SafeAreaView>
        </Modal>
      )}
    </ScrollView>
  );
};

// Create themed styles using the utility function
const getStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContentContainer: {
    paddingVertical: theme.spacing.medium, // Add some padding at the top too
    paddingBottom: theme.spacing.extraLarge, // Ensure ample space for last elements
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginTop: theme.spacing.medium,
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.l,
    backgroundColor: theme.colors.background,
  },
  messageText: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing.m,
    marginBottom: theme.spacing.l,
  },
  // New Card Styles
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 10, // Softer, larger radius (now matching home.jsx backup)
    marginHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
    padding: theme.spacing.m,
    // Add subtle shadow if desired and defined in theme, e.g., ...theme.shadows.small
  },
  cardTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontWeight: 'bold',
    marginBottom: theme.spacing.m,
  },
  // User Info Card Styles
  userInfoHeader: {
    alignItems: 'center',
    paddingVertical: theme.spacing.s, // Reduced padding as card has its own
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: theme.spacing.medium,
    backgroundColor: theme.colors.border, // Placeholder bg for avatar if needed
  },
  avatarIcon: { // For the Ionicons placeholder
    width: 80, // Match image avatar size
    height: 80,
    textAlign: 'center', // Center icon within its bounds
    lineHeight: 80, // Vertically center icon
    borderRadius: 40,
    marginBottom: theme.spacing.medium,
    backgroundColor: theme.colors.surface, // Slightly different bg for icon
  },
  userInfoTextContainer: {
    alignItems: 'center',
  },
  userIdentifier: {
    ...theme.typography.h2,
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  userEmail: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xsmall,
  },
  // Info Row (for key-value pairs)
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoRowBorderless: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.smedium,
  },
  infoLabel: {
    ...theme.typography.body,
    color: theme.colors.text, // Changed to primary text color (white in dark theme)
  },
  infoValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '500',
    textAlign: 'right', // Ensure values align right if they wrap
    flexShrink: 1, // Allow value text to shrink if label is long
  },
  // Upgrade Section Styles
  upgradeContainer: {
    marginTop: theme.spacing.medium,
    paddingTop: theme.spacing.medium,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: 'center', // Center the content of upgrade section
  },
  upgradeIcon: {
    marginBottom: theme.spacing.small,
  },
  upgradeTitle: {
    ...theme.typography.h3,
    color: theme.colors.primary, // Use primary color for emphasis
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: theme.spacing.xsmall,
  },
  upgradeText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.smedium,
  },
  benefitList: {
    alignSelf: 'stretch', // Allow list to take width
    marginVertical: theme.spacing.smedium,
    paddingHorizontal: theme.spacing.medium, // Indent benefits slightly
  },
  benefitItem: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.xsmall,
    lineHeight: theme.typography.body.fontSize * 1.4,
  },
  quotaResetTextContainer: {
    marginTop: theme.spacing.smedium,
    paddingTop: theme.spacing.smedium,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  quotaResetText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Activity Stats Card Styles
  statsRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: theme.spacing.small,
  },
  statItem: {
    alignItems: 'center',
    flex: 1, // Distribute space equally
  },
  statValue: {
    ...theme.typography.h2, // Make stats prominent
    color: theme.colors.text,
    fontWeight: '600',
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.text,
    marginTop: theme.spacing.xsmall,
  },
  statItemSeparator: {
    width: 1,
    height: '60%', // Adjust height as needed
    backgroundColor: theme.colors.border,
  },
  loadingOrErrorContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.medium,
  },
  loadingOrErrorText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.small,
    textAlign: 'center',
  },
  // Styles for Subscription Card
  subscriptionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  planTagContainer: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.s,
    paddingVertical: theme.spacing.xs + 2, // Adjusted for better pill shape
    borderRadius: 12, // Pill shape
  },
  planTagText: {
    ...theme.typography.caption,
    fontSize: 10, // Smaller font for tag
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  featureList: {
    marginBottom: theme.spacing.m,
  },
  featureListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.s - 2, // Tighter spacing for feature list
  },
  featureListIcon: {
    marginRight: theme.spacing.s,
    // color will be set dynamically based on plan
  },
  featureListText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontSize: 15, // Slightly smaller feature text
  },

  // Styles for Upgrade CTA Box
  upgradeCtaBox: {
    backgroundColor: '#252A40', // Darker background for CTA box
    padding: theme.spacing.m,
    borderRadius: 8,
    marginTop: theme.spacing.m,
    alignItems: 'center',
  },
  upgradeCtaTitle: {
    ...theme.typography.h3,
    color: '#4FD1C5', // Teal/Cyan color
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
    fontSize: 18, // Prominent CTA title
  },
  upgradeCtaSubtitle: {
    ...theme.typography.body,
    color: theme.colors.text, // Changed to white
    textAlign: 'center',
    marginBottom: theme.spacing.m,
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.7,
  },
  upgradeCtaButton: {
    backgroundColor: '#4FD1C5', // Teal/Cyan color
    paddingVertical: theme.spacing.s + 2,
    paddingHorizontal: theme.spacing.l,
    borderRadius: 20, // Pill-shaped button
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  upgradeCtaButtonText: {
    ...theme.typography.button,
    color: '#191E38', // Dark text on light teal button
    fontWeight: 'bold',
    fontSize: 15,
  },

  // Styles for Usage & Quotas Card
  usageQuotaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.s - 2, // Tighter spacing
  },
  usageQuotaLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontSize: 15,
  },
  usageQuotaValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 15,
  },

  // Navigation Item Styles
  navigationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.m, // Generous touch target
  },
  navigationItemIcon: {
    marginRight: theme.spacing.m,
  },
  navigationItemText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1, // Allow text to take available space
    fontWeight: '500',
  },
  navigationItemSeparator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: -theme.spacing.m, // Extend to card edges if card has padding
  },
  // Button Styles
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.m, // Was smedium
    paddingHorizontal: theme.spacing.l,
    borderRadius: 8, // Was theme.borderRadius.medium
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch', // Make button full width of its container
    marginTop: theme.spacing.m,
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white, // Assuming primary button text is white
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface, // Or theme.colors.primaryMuted
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.m,
    borderRadius: 8, // Was theme.borderRadius.medium
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  signOutButton: {
    backgroundColor: theme.colors.primary, // Match upload button style
    paddingVertical: theme.spacing.s + 2,
    paddingHorizontal: theme.spacing.m + 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
    marginHorizontal: theme.spacing.m, // Align with card margins
    marginTop: theme.spacing.l, // Space above sign out
    marginBottom: theme.spacing.s, // Reduced space below sign out
  },
  signOutButtonIcon: {
    marginRight: theme.spacing.s,
  },
  signOutButtonText: {
    color: theme.colors.primaryContent, // Match upload button text color
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  deleteAccountButton: {
    backgroundColor: theme.colors.error, // Prominent error color for delete account
    paddingVertical: theme.spacing.m,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: theme.spacing.m, // Align with card margins
    marginTop: theme.spacing.s, // Small space above delete account
    marginBottom: theme.spacing.m, // Space below delete account
  },
  deleteAccountButtonIcon: {
    marginRight: theme.spacing.s,
  },
  deleteAccountButtonText: {
    ...theme.typography.button,
    color: theme.colors.white, // Error button text is white
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Styles for New Subscription Boxes (June 2025 Redesign)
  planBox: {
    backgroundColor: theme.colors.surface, 
    padding: theme.spacing.m,
    borderRadius: 8, 
    borderWidth: 1,
    borderColor: theme.colors.border, 
  },
  planBoxHighlighted: {
    borderColor: '#4FD1C5', // Teal/Cyan highlight for active plan
    borderWidth: 1.5, 
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.s, 
  },
  planNameText: {
    ...theme.typography.h3, 
    color: theme.colors.text,
    fontSize: 17, 
  },
  planPriceText: {
    ...theme.typography.h3, 
    color: '#4FD1C5', 
    fontSize: 17, 
    fontWeight: '600',
  },
  planDescriptionText: {
    ...theme.typography.body,
    color: theme.colors.text, // Changed from textMuted to text (white)
    fontSize: 14,
    lineHeight: 20, 
    marginTop: theme.spacing.xs, // Add a small space above description
  },
  cancelButton: {
    marginTop: theme.spacing.l,
    borderColor: theme.colors.error,
    borderWidth: 1,
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.m,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.error,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
}));

export default ProfileScreen;