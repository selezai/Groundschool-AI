import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { supabase, isSupabaseReady, refreshSession, getSupabase } from '../services/supabaseClient';
import { authService } from '../services/authService';
import logger from '../services/loggerService';
import posthogService from '../services/posthogService';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const [error, setError] = useState(null);
  const [isSupabaseInitialized, setIsSupabaseInitialized] = useState(isSupabaseReady());

  // State for Payfast subscription flow
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [payfastPaymentData, setPayfastPaymentData] = useState(null);
  const [showPayfastWebView, setShowPayfastWebView] = useState(false);

  const fetchUserProfile = useCallback(async (userId) => {
    if (!userId) {
      logger.warn('AuthContext', 'fetchUserProfile called without userId');
      setProfile(null);
      return null;
    }
    if (!isSupabaseReady()) {
      logger.error('AuthContext', 'fetchUserProfile: Supabase client not initialized');
      setProfile(null);
      return null;
    }
    logger.info('AuthContext', 'Fetching user profile for', { userId });

    const profileQuery = `
      plan,
      plan_status,
      plan_period_end,
      storage_used_mb,
      can_access_past_exams,
      monthly_quizzes_remaining,
      last_quota_reset_date,
      full_name,
      avatar_url,
      m_payment_id_last_attempt,
      pf_payment_id
    `;

    try {
      const { data, error: profileError } = await getSupabase()
        .from('profiles')
        .select(profileQuery)
        .eq('id', userId)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          logger.warn('AuthContext', 'No profile found for user. Creating a new one.', { userId });
          if (!user) {
            logger.error('AuthContext', 'Cannot create profile as user object is not available.');
            setProfile(null);
            return null;
          }
          const { data: newProfile, error: createError } = await getSupabase()
            .from('profiles')
            .insert({
              id: user.id,
              full_name: user.user_metadata?.full_name || 'New User',
              avatar_url: user.user_metadata?.avatar_url,
              email: user.email,
            })
            .select(profileQuery)
            .single();

          if (createError) {
            logger.error('AuthContext', 'Error creating new profile for user', { userId, error: createError });
            setProfile(null);
            return null;
          }

          logger.info('AuthContext', 'Successfully created and fetched new profile', { userId, profileData: newProfile });
          setProfile(newProfile);
          return newProfile;
        } else {
          const supabaseErrorMessage = profileError?.message || 'Unknown Supabase error';
          const supabaseErrorDetails = profileError?.details || 'No details';
          const supabaseErrorHint = profileError?.hint || 'No hint';
          logger.error(
            'AuthContext', 
            `Error fetching profile. Supabase: ${supabaseErrorMessage}. Details: ${supabaseErrorDetails}. Hint: ${supabaseErrorHint}. Raw: ${JSON.stringify(profileError)}`,
            { userId } 
          );
          setProfile(null);
          return;
        }
      }

      if (data) {
        logger.info('AuthContext', 'User profile fetched successfully', { userId, profileData: data });
        setProfile(data);
        return data;
      } else {
        logger.warn('AuthContext', 'No profile data found for user', { userId });
        setProfile(null);
        return null;
      }
    } catch (e) {
      logger.error('AuthContext', 'Exception during fetchUserProfile', { userId, error: e });
      setProfile(null);
      return null;
    }
  }, [user]);

  const validateAuth = useCallback(() => {
    if (typeof window === 'undefined') {
      logger.warn('AuthContext', 'validateAuth called during SSR');
      return false;
    }
    if (!isSupabaseReady()) {
      logger.error('AuthContext', 'validateAuth: Supabase client not initialized');
      return false;
    }
    if (!session || !user) {
      logger.warn('AuthContext', 'validateAuth: No active session or user');
      return false;
    }
    return true;
  }, [session, user]);

  const ensureValidSession = useCallback(async (force = false) => {
    if (!isSupabaseReady()) {
      logger.error('AuthContext', 'Cannot ensure valid session: Supabase client not initialized');
      return false;
    }
    try {
      if (session && !force) {
        return true;
      }
      logger.info('AuthContext', 'Refreshing session');
      const { data, error: refreshError } = await refreshSession();
      if (refreshError) {
        logger.error('AuthContext', 'Failed to refresh session', { error: refreshError });
        return false;
      }
      if (data && data.session) {
        setSession(data.session);
        setUser(data.session.user);
        logger.info('AuthContext', 'Session refreshed successfully');
        return true;
      } else {
        logger.warn('AuthContext', 'No session after refresh');
        return false;
      }
    } catch (e) {
      logger.error('AuthContext', 'Exception during session refresh', { error: e });
      return false;
    }
  }, [session]);

  useEffect(() => {
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) {
      logger.warn('AuthContext', 'Running in SSR environment, skipping auth initialization');
      setIsAuthReady(true);
      return;
    }

    logger.info('AuthContext', 'Starting auth initialization', { platform: Platform.OS });

    // onAuthStateChange fires immediately with the current session or null.
    // It also handles session recovery from the URL hash after a redirect.
    // This is the single source of truth for the auth state.
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_event, session) => {
      logger.info('AuthContext', 'Auth state change event received', { event: _event, hasSession: !!session });
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // The first time this listener runs, the auth state is determined.
      // We can now mark the auth process as "ready".
      setIsAuthReady(true);
    });

    // The cleanup function will run when the component unmounts.
    return () => {
      if (subscription) {
        subscription.unsubscribe();
        logger.info('AuthContext', 'Unsubscribed from auth state changes.');
      }
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      logger.info('AuthContext', 'User ID detected, fetching profile.', { userId: user.id });
      fetchUserProfile(user.id);
    } else {
      logger.info('AuthContext', 'No user ID, clearing profile.');
      setProfile(null);
    }
  }, [user?.id, fetchUserProfile]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isPolling || !user?.id) {
      return;
    }

    let pollingInterval;
    let timeoutId;

    const stopPolling = (reason) => {
      logger.info('AuthContext', `Stopping subscription polling. Reason: ${reason}`);
      clearInterval(pollingInterval);
      clearTimeout(timeoutId);
      setIsPolling(false);
    };

    const checkStatus = async () => {
      logger.info('AuthContext', 'Polling: checking for subscription update...');
      await fetchUserProfile(user.id);
      // Note: We will implement Captain's Club specific checks here in the future
    };

    const handleFocus = () => {
      logger.info('AuthContext', 'App gained focus, re-checking subscription status.');
      checkStatus();
    };

    window.addEventListener('focus', handleFocus);
    logger.info('AuthContext', 'Attached window focus listener for polling.');

    logger.info('AuthContext', 'Starting subscription status polling.');
    checkStatus();
    pollingInterval = setInterval(checkStatus, 3000);

    timeoutId = setTimeout(() => {
      stopPolling('Timeout reached');
    }, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      logger.info('AuthContext', 'Cleaning up polling effect and focus listener.');
      clearInterval(pollingInterval);
      clearTimeout(timeoutId);
    };
  }, [isPolling, user?.id, fetchUserProfile]);

  const handleSubscription = useCallback(async () => {
    logger.debug('AuthContext', 'handleSubscription: Initial profile state:', { profile });
    let currentProfile = profile;
    if (!user?.id || !user?.email) {
      logger.error('AuthContext', 'handleSubscription: User ID or email not available.');
      setSubscriptionError(new Error('User details not available. Please sign in again.'));
      return;
    }

    if (!currentProfile?.full_name) {
      logger.warn('AuthContext', 'handleSubscription: Profile or full_name not available, attempting to fetch.', { userId: user.id });
      setIsSubscribing(true);
      try {
        const fetchedProfile = await fetchUserProfile(user.id);
        if (fetchedProfile?.full_name) {
          logger.info('AuthContext', 'handleSubscription: Profile (with full_name) fetched successfully on-demand.');
          currentProfile = fetchedProfile;
        } else {
          logger.error('AuthContext', 'handleSubscription: Failed to fetch profile or full_name still missing after attempt.');
          setSubscriptionError(new Error('User profile details could not be loaded. Please try again.'));
          setIsSubscribing(false);
          return;
        }
      } catch (fetchError) {
        logger.error('AuthContext', 'handleSubscription: Exception during on-demand profile fetch.', { error: fetchError });
        setSubscriptionError(new Error('Error loading user profile. Please try again.'));
        setIsSubscribing(false);
        return;
      }
    }

    logger.info('AuthContext', 'Attempting to initiate Captain\'s Club subscription for user:', { userId: user.id });
    setIsSubscribing(true);
    setSubscriptionError(null);
    setPayfastPaymentData(null);
    setShowPayfastWebView(false);

    try {
      const supabaseClient = getSupabase();
      if (!supabaseClient) {
        throw new Error('Supabase client not available.');
      }

      const payload = {
        userId: user.id,
        email: user.email,
        fullName: currentProfile.full_name,
        itemName: "Captain's Club",
        amount: '99.00',
        itemDescription: "Monthly subscription to Captain's Club",
        isInitialSetup: false,
      };
      logger.info('AuthContext', 'Payload to be sent to Edge Function:', { payload });

      const { data: functionResponseData, error: functionError } = await supabaseClient.functions.invoke(
        'generate-payfast-payment-data',
        { body: JSON.stringify(payload) }
      );

      logger.debug('AuthContext', 'handleSubscription: Raw response from Edge Function:', { functionResponseData, functionError });

      if (functionError) {
        const errorResponse = functionError.context;
        const detailedMessage = errorResponse?.error || functionError.message;
        logger.error(
          'AuthContext',
          'Error invoking generate-payfast-payment-data function.',
          { errorMessage: detailedMessage, functionResponse: errorResponse, originalError: functionError }
        );
        setSubscriptionError(new Error(String(detailedMessage || 'An unknown payment system error occurred.')));
      } else if (functionResponseData && functionResponseData.error) {
        logger.error('AuthContext', 'Error returned by generate-payfast-payment-data function:', { errorDetail: functionResponseData.error });
        setSubscriptionError(new Error(String(functionResponseData.error)));
      } else if (functionResponseData && functionResponseData.paymentUrl && functionResponseData.formData) {
        logger.info('AuthContext', 'Received Payfast payment data successfully');

        if (Platform.OS === 'web') {
          logger.info('AuthContext', 'Web platform detected, redirecting to Payfast via POST.');
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = functionResponseData.paymentUrl;
          Object.keys(functionResponseData.formData).forEach(key => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = functionResponseData.formData[key];
            form.appendChild(input);
          });
          document.body.appendChild(form);
          form.submit();
          setIsPolling(true);
        } else {
          logger.info('AuthContext', 'Native platform detected, using WebView.');
          setPayfastPaymentData({
            paymentUrl: functionResponseData.paymentUrl,
            formData: functionResponseData.formData,
          });
          setShowPayfastWebView(true);
          // Note: We will implement polling for native platforms when implementing Captain's Club benefits
        }
      } else {
        logger.error('AuthContext', 'Unexpected response structure from generate-payfast-payment-data', { responseData: functionResponseData });
        setSubscriptionError(new Error('Failed to get payment details due to an unexpected response. Please try again.'));
      }
    } catch (e) {
      logger.error('AuthContext', 'Exception during handleSubscription', { error: e });
      setSubscriptionError(e);
      setShowPayfastWebView(false);
    } finally {
      setIsSubscribing(false);
    }
  }, [user, profile, fetchUserProfile]);

  const resetSubscriptionState = useCallback(() => {
    logger.info('AuthContext', 'Resetting subscription state.');
    setIsSubscribing(false);
    setSubscriptionError(null);
    setPayfastPaymentData(null);
    setShowPayfastWebView(false);
  }, []);

  const cancelSubscription = useCallback(async () => {
    logger.info('AuthContext', 'Attempting to cancel subscription for user:', { userId: user?.id });
    setIsCancelling(true);
    setSubscriptionError(null);

    try {
      const supabaseClient = getSupabase();
      if (!supabaseClient) {
        throw new Error('Supabase client not available.');
      }

      const { data, error: functionError } = await supabaseClient.functions.invoke(
        'handle-subscription-cancellation'
      );

      if (functionError) {
        const errorResponse = functionError.context;
        const detailedMessage = errorResponse?.error || functionError.message;
        logger.error(
          'AuthContext',
          'Error invoking handle-subscription-cancellation function.',
          { errorMessage: detailedMessage, functionResponse: errorResponse, originalError: functionError }
        );
        throw new Error(String(detailedMessage || 'An unknown error occurred during cancellation.'));
      }

      if (data && data.error) {
        logger.error('AuthContext', 'Error returned by handle-subscription-cancellation function:', { errorDetail: data.error });
        throw new Error(String(data.error));
      }

      logger.info('AuthContext', 'Subscription cancellation function invoked successfully.', { responseData: data });
      
      await fetchUserProfile(user.id);

    } catch (e) {
      logger.error('AuthContext', 'Exception during cancelSubscription', { error: e });
      setSubscriptionError(e);
      throw e;
    } finally {
      setIsCancelling(false);
    }
  }, [user, fetchUserProfile]);

  const signIn = async ({ email, password }) => {
    setIsProcessingAuth(true);
    logger.info('AuthContext', 'Attempting sign in', { email });
    try {
      if (!isSupabaseReady()) {
        logger.error('AuthContext', 'Supabase client not initialized during sign in');
        throw new Error('Authentication services are not initialized yet');
      }
      setError(null);
      const result = await authService.signIn(email, password);
      if (result && result.session && result.user) {
        setSession(result.session);
        setUser(result.user);
        logger.info('AuthContext', 'Sign in successful, session active', { userId: result.user.id });
        
        // Track sign in event
        posthogService.identify(result.user.id, {
          email: result.user.email,
          email_verified: result.user.email_confirmed_at ? true : false,
          sign_in_method: 'email',
        });
        posthogService.capture('user_signed_in', {
          method: 'email',
          user_id: result.user.id,
        });
        
        return { success: true, data: result };
      } else {
        logger.error('AuthContext', 'Unexpected success structure from authService.signIn', { result });
        const unexpectedError = new Error('Unexpected error during sign in process (invalid success structure).');
        setError(unexpectedError);
        return { success: false, error: unexpectedError };
      }
    } catch (e) {
      logger.error('AuthContext', 'Sign in failed or exception occurred in signIn', { errorMessage: e.message, errorName: e.name, errorDetails: e });
      setError(e);
      return { success: false, error: e };
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const signUp = async ({ email, password, metadata = {}, profileData = {} }) => {
    setIsProcessingAuth(true);
    logger.info('AuthContext', 'Attempting sign up', { email });
    try {
      if (!isSupabaseReady()) {
        logger.error('AuthContext', 'Supabase client not initialized during sign up');
        throw new Error('Authentication services are not initialized yet');
      }
      setError(null);
      const serviceResult = await authService.signUp(email, password, metadata, profileData);
      if (serviceResult.user && serviceResult.session) {
        setSession(serviceResult.session);
        setUser(serviceResult.user);
        logger.info('AuthContext', 'Sign up successful, session active', { userId: serviceResult.user.id });
        
        // Track sign up event
        posthogService.identify(serviceResult.user.id, {
          email: serviceResult.user.email,
          email_verified: serviceResult.user.email_confirmed_at ? true : false,
          sign_up_method: 'email',
        });
        posthogService.capture('user_signed_up', {
          method: 'email',
          user_id: serviceResult.user.id,
        });
        
        return { success: true, data: serviceResult };
      } else if (serviceResult.message) {
        logger.info('AuthContext', 'Sign up initiated', { message: serviceResult.message });
        return { success: true, data: serviceResult };
      } else {
        logger.error('AuthContext', 'Unexpected result from authService.signUp', { serviceResult });
        throw new Error('Unexpected error during sign up process.');
      }
    } catch (e) {
      logger.error('AuthContext', 'Exception during sign up', { errorMessage: e.message, errorName: e.name });
      setError(e);
      return { success: false, error: e };
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const signOut = async () => {
    setIsProcessingAuth(true);
    logger.info('AuthContext', 'Attempting sign out');
    try {
      setError(null);
      if (!isSupabaseReady()) {
        logger.error('AuthContext', 'Supabase client not initialized during sign out');
        throw new Error('Authentication services are not initialized yet');
      }
      // Track sign out event before clearing user data
      if (user) {
        posthogService.capture('user_signed_out', {
          user_id: user.id,
        });
        posthogService.reset(); // Clear PostHog user data
      }
      
      await authService.signOut();
      setSession(null);
      setUser(null);
      logger.info('AuthContext', 'Sign out successful');
      return { success: true };
    } catch (e) {
      logger.error('AuthContext', 'Exception during sign out', { errorMessage: e.message, errorName: e.name, stack: e.stack });
      setError(e);
      setSession(null);
      setUser(null);
      return { success: false, error: e };
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const contextValue = {
    // Core Auth State
    session,
    user,
    profile,
    isAuthReady,
    isProcessingAuth,
    error,
    isSupabaseInitialized,

    // Core Auth Functions
    signIn,
    signUp,
    signOut,
    validateAuth,
    ensureValidSession,
    fetchUserProfile,

    // Subscription State & Functions
    isSubscribing,
    isCancelling,
    subscriptionError,
    payfastPaymentData,
    showPayfastWebView,
    setShowPayfastWebView,
    handleSubscription,
    resetSubscriptionState,
    cancelSubscription,
    isPolling,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;