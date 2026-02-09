// Jest setup file

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  default: {
    call: () => {},
  },
  useSharedValue: jest.fn(),
  useAnimatedStyle: jest.fn(),
  withTiming: jest.fn(),
  withSpring: jest.fn(),
  withSequence: jest.fn(),
  withDelay: jest.fn(),
  Easing: {},
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      GOOGLE_API_KEY: 'test-google-api-key',
    },
  },
}));

// Mock Supabase client
jest.mock('./src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
  isSupabaseReady: jest.fn(() => true),
  getSupabase: jest.fn(),
}));

// Mock logger to prevent console noise in tests
jest.mock('./src/services/loggerService', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  security: jest.fn(),
  performance: jest.fn(),
}));

// Global test timeout
jest.setTimeout(10000);
