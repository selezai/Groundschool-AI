import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import logger from './loggerService.js';

// Track client initialization state
let clientInitialized = false;
let initializationError = null;

// Define platform-specific storage adapters
const AsyncStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

// Check if localStorage is available (for SSR compatibility)
const isLocalStorageAvailable = () => {
  try {
    if (typeof window === 'undefined') return false;
    if (typeof localStorage === 'undefined') return false;
    
    // Test if we can actually use localStorage
    const testKey = '__supabase_storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

// Web-specific storage adapter using localStorage with SSR safety
const WebStorageAdapter = {
  getItem: (key) => {
    if (!isLocalStorageAvailable()) {
      logger.warn('supabaseClient', 'localStorage not available, returning null for key', { key });
      return Promise.resolve(null);
    }
    
    try {
      const value = localStorage.getItem(key);
      return Promise.resolve(value);
    } catch (error) {
      logger.error('supabaseClient', 'Error getting item from localStorage', { key, error: error.message });
      return Promise.resolve(null); // Resolve with null instead of rejecting to prevent crashes
    }
  },
  setItem: (key, value) => {
    if (!isLocalStorageAvailable()) {
      logger.warn('supabaseClient', 'localStorage not available, skipping setItem', { key });
      return Promise.resolve();
    }
    
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (error) {
      logger.error('supabaseClient', 'Error setting item in localStorage', { key, error: error.message });
      return Promise.resolve(); // Resolve instead of rejecting to prevent crashes
    }
  },
  removeItem: (key) => {
    if (!isLocalStorageAvailable()) {
      logger.warn('supabaseClient', 'localStorage not available, skipping removeItem', { key });
      return Promise.resolve();
    }
    
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (error) {
      logger.error('supabaseClient', 'Error removing item from localStorage', { key, error: error.message });
      return Promise.resolve(); // Resolve instead of rejecting to prevent crashes
    }
  },
};

// Choose the appropriate storage adapter based on platform
const storageAdapter = Platform.OS === 'web' ? WebStorageAdapter : AsyncStorageAdapter;

// Retrieve Supabase URL and Anon Key from environment variables
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

// Check if we're in a browser environment for SSR safety
const isBrowser = typeof window !== 'undefined';

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  const error = new Error('Supabase configuration is missing. Check environment variables and app.config.js setup.');
  logger.error('supabaseClient', 'Configuration error', {
    supabaseUrlExists: !!supabaseUrl,
    supabaseKeyExists: !!supabaseAnonKey,
    expoConfigExists: !!Constants.expoConfig,
    extraExists: !!(Constants.expoConfig && Constants.expoConfig.extra)
  });
  initializationError = error;
}

// Log initialization attempt
logger.info('supabaseClient', 'Initializing Supabase client', { 
  supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NOT SET', 
  supabaseAnonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 8)}...` : 'NOT SET',
  platform: Platform.OS,
  storageType: Platform.OS === 'web' ? 'WebStorage' : 'AsyncStorage'
});

// Create the Supabase client
let supabase;

// Custom no-op lock function for platforms that don't support navigator.locks (iOS Safari)
// navigator.locks API is not fully supported on iOS Safari and causes the app to crash
const noOpLock = async (name, acquireTimeout, fn) => {
  return await fn();
};

// Only initialize the client if we're in a browser environment or on a mobile device
// This prevents SSR issues with localStorage and session handling
if (Platform.OS !== 'web' || isBrowser) {
  try {
    // Check if navigator.locks is supported (not available on iOS Safari)
    const supportsNavigatorLocks = typeof globalThis !== 'undefined' && 
      globalThis.navigator && 
      typeof globalThis.navigator.locks !== 'undefined' &&
      typeof globalThis.navigator.locks.request === 'function';
    
    supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
      auth: {
        storage: storageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        debug: __DEV__,
        // Use no-op lock on web if navigator.locks is not supported (iOS Safari)
        // This prevents crashes on platforms that don't support the Web Locks API
        lock: Platform.OS === 'web' && !supportsNavigatorLocks ? noOpLock : undefined,
      },
    });
  
    clientInitialized = true;
    logger.info('supabaseClient', 'Supabase client initialized successfully');
  } catch (error) {
    logger.error('supabaseClient', 'Failed to initialize Supabase client', {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack
    });
    initializationError = error;
  }
}

// Helper function to check if client is ready
export const isSupabaseReady = () => {
  return clientInitialized && !initializationError;
};

// Function to get client with validation
export const getSupabase = () => {
  if (initializationError) {
    throw initializationError;
  }
  
  if (!clientInitialized) {
    throw new Error('Supabase client is not initialized yet');
  }
  
  return supabase;
};

// Export the client directly for backward compatibility
export { supabase };

// Add session refresh mechanism
export const refreshSession = async () => {
  try {
    if (!isSupabaseReady()) {
      throw new Error('Cannot refresh session: Supabase client is not ready');
    }
    
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    
    logger.info('supabaseClient', 'Session refreshed successfully');
    return data;
  } catch (error) {
    logger.error('supabaseClient', 'Failed to refresh session', {
      errorMessage: error.message,
      errorName: error.name
    });
    throw error;
  }
};

// Function to initialize Supabase listeners and check session
export const initializeSupabase = async () => {
  logger.info('Initializing Supabase client...');
  // Check for existing session on app start
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      logger.error('Error getting Supabase session on init:', error);
    } else if (session) {
      logger.info('Existing Supabase session found on init.');
    } else {
      logger.info('No active Supabase session found on init.');
    }
  } catch (e) {
    logger.error('Exception during initial Supabase session check:', e);
  }

  // Optional: Re-fetch session when app comes to foreground (useful for session refresh)
  AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          logger.info('Supabase session refreshed on app resume.');
        }
      }).catch(error => {
        logger.error('Error refreshing Supabase session on app resume:', error);
      });
    }
  });

  logger.info('Supabase client initialized.');
};

// Helper function to get the current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      logger.error('Error getting current Supabase user:', error);
      return null;
    }
    return user;
  } catch (e) {
    logger.error('Exception getting current Supabase user:', e);
    return null;
  }
};
