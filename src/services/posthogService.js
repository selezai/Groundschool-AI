import PostHog from 'posthog-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import logger from './loggerService';

class PostHogService {
  constructor() {
    this.isInitialized = false;
    this.posthog = null;
  }

  async initialize() {
    try {
      const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
      const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

      if (!apiKey) {
        logger.warn('PostHog API key not found. Analytics will be disabled.');
        return;
      }

      this.posthog = new PostHog(apiKey, {
        host: host,
        // Enable autocapture for web
        autocapture: Platform.OS === 'web',
        // Capture pageviews automatically
        capture_pageview: Platform.OS === 'web',
        // Use AsyncStorage for persistence
        persistence: 'localStorage',
        // Enable session recording (optional)
        session_recording: {
          maskAllInputs: true,
          maskAllText: false,
        },
        // Privacy settings
        opt_out_capturing_by_default: false,
        respect_dnt: true,
        // Development settings
        debug: __DEV__,
        // Disable in development if needed
        disabled: false,
      });

      this.isInitialized = true;
      logger.info('PostHog initialized successfully');

      // Identify the platform
      this.posthog.capture('app_initialized', {
        platform: Platform.OS,
        app_version: '1.0.0',
        environment: __DEV__ ? 'development' : 'production',
      });

    } catch (error) {
      logger.error('Failed to initialize PostHog:', error);
    }
  }

  // User identification
  identify(userId, properties = {}) {
    if (!this.isInitialized || !this.posthog) return;

    try {
      this.posthog.identify(userId, {
        ...properties,
        platform: Platform.OS,
        app_version: '1.0.0',
      });
      logger.info('PostHog user identified:', userId);
    } catch (error) {
      logger.error('PostHog identify error:', error);
    }
  }

  // Event tracking
  capture(event, properties = {}) {
    if (!this.isInitialized || !this.posthog) return;

    try {
      this.posthog.capture(event, {
        ...properties,
        platform: Platform.OS,
        timestamp: new Date().toISOString(),
      });
      logger.info('PostHog event captured:', event);
    } catch (error) {
      logger.error('PostHog capture error:', error);
    }
  }

  // Screen/Page tracking
  screen(screenName, properties = {}) {
    if (!this.isInitialized || !this.posthog) return;

    try {
      this.posthog.screen(screenName, {
        ...properties,
        platform: Platform.OS,
      });
      logger.info('PostHog screen tracked:', screenName);
    } catch (error) {
      logger.error('PostHog screen error:', error);
    }
  }

  // User properties
  setPersonProperties(properties) {
    if (!this.isInitialized || !this.posthog) return;

    try {
      this.posthog.setPersonProperties(properties);
      logger.info('PostHog person properties set');
    } catch (error) {
      logger.error('PostHog setPersonProperties error:', error);
    }
  }

  // Reset user (on logout)
  reset() {
    if (!this.isInitialized || !this.posthog) return;

    try {
      this.posthog.reset();
      logger.info('PostHog user reset');
    } catch (error) {
      logger.error('PostHog reset error:', error);
    }
  }

  // Flush events (useful before app close)
  flush() {
    if (!this.isInitialized || !this.posthog) return;

    try {
      this.posthog.flush();
      logger.info('PostHog events flushed');
    } catch (error) {
      logger.error('PostHog flush error:', error);
    }
  }

  // Opt out/in
  optOut() {
    if (!this.isInitialized || !this.posthog) return;
    this.posthog.optOut();
    logger.info('PostHog opted out');
  }

  optIn() {
    if (!this.isInitialized || !this.posthog) return;
    this.posthog.optIn();
    logger.info('PostHog opted in');
  }

  // Feature flags
  isFeatureEnabled(flag, defaultValue = false) {
    if (!this.isInitialized || !this.posthog) return defaultValue;

    try {
      return this.posthog.isFeatureEnabled(flag) || defaultValue;
    } catch (error) {
      logger.error('PostHog feature flag error:', error);
      return defaultValue;
    }
  }

  // Get feature flag value
  getFeatureFlag(flag, defaultValue = null) {
    if (!this.isInitialized || !this.posthog) return defaultValue;

    try {
      return this.posthog.getFeatureFlag(flag) || defaultValue;
    } catch (error) {
      logger.error('PostHog get feature flag error:', error);
      return defaultValue;
    }
  }
}

// Create singleton instance
const posthogService = new PostHogService();

export default posthogService;
