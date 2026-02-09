/**
 * Feature Flags Configuration
 * 
 * This file contains feature flags that can be easily toggled to enable/disable
 * specific functionality during testing or rollout phases.
 */

import logger from '../services/loggerService';

/**
 * Get feature flag value with environment variable override support
 * @param {string} envVarName - Environment variable name
 * @param {*} defaultValue - Default value if env var not set
 * @returns {*} The feature flag value
 */
const getEnvFlag = (envVarName, defaultValue) => {
  const envValue = process.env[envVarName];
  
  if (envValue === undefined || envValue === null) {
    return defaultValue;
  }
  
  // Handle boolean strings
  if (envValue === 'true') return true;
  if (envValue === 'false') return false;
  
  // Handle null string
  if (envValue === 'null') return null;
  
  // Handle numbers
  const numValue = Number(envValue);
  if (!isNaN(numValue)) return numValue;
  
  // Return as string
  return envValue;
};

const featureFlags = {
  /**
   * AUTO_UPGRADE_NEW_USERS_TO_CAPTAINS_CLUB
   * 
   * When enabled (true): All new user registrations will automatically be assigned
   * the "captains_club" plan instead of the default "basic" plan.
   * 
   * When disabled (false): New users get the standard "basic" plan.
   * 
   * Environment Variable: EXPO_PUBLIC_AUTO_UPGRADE_NEW_USERS
   * 
   * Use case: Testing phase where you want all new users to have full functionality
   * to evaluate the complete app experience.
   * 
   * To enable: Set environment variable to 'true' or change default below
   * To disable: Set environment variable to 'false' or change default below
   */
  AUTO_UPGRADE_NEW_USERS_TO_CAPTAINS_CLUB: getEnvFlag('EXPO_PUBLIC_AUTO_UPGRADE_NEW_USERS', true),

  /**
   * CAPTAINS_CLUB_TRIAL_DURATION_DAYS
   * 
   * When AUTO_UPGRADE_NEW_USERS_TO_CAPTAINS_CLUB is enabled, this determines
   * how long the automatic Captain's Club access lasts.
   * 
   * Environment Variable: EXPO_PUBLIC_CAPTAINS_CLUB_TRIAL_DAYS
   * 
   * Set to null for permanent access (no expiration)
   * Set to a number for trial period in days (e.g., 30 for 30-day trial)
   */
  CAPTAINS_CLUB_TRIAL_DURATION_DAYS: getEnvFlag('EXPO_PUBLIC_CAPTAINS_CLUB_TRIAL_DAYS', null),

  /**
   * LOG_FEATURE_FLAG_USAGE
   * 
   * When enabled, logs when feature flags are used for debugging and monitoring.
   */
  LOG_FEATURE_FLAG_USAGE: true,
};

/**
 * Get the value of a feature flag
 * @param {string} flagName - The name of the feature flag
 * @param {*} defaultValue - Default value if flag doesn't exist
 * @returns {*} The feature flag value
 */
export const getFeatureFlag = (flagName, defaultValue = false) => {
  const value = featureFlags[flagName];
  
  if (featureFlags.LOG_FEATURE_FLAG_USAGE) {
    logger.debug('FeatureFlags', `${flagName}: ${value}`);
  }
  
  return value !== undefined ? value : defaultValue;
};

/**
 * Check if auto-upgrade to Captain's Club is enabled for new users
 * @returns {boolean} True if new users should get Captain's Club automatically
 */
export const shouldAutoUpgradeNewUsers = () => {
  return getFeatureFlag('AUTO_UPGRADE_NEW_USERS_TO_CAPTAINS_CLUB', false);
};

/**
 * Get the trial duration for auto-upgraded Captain's Club users
 * @returns {number|null} Trial duration in days, or null for permanent access
 */
export const getCaptainsClubTrialDuration = () => {
  return getFeatureFlag('CAPTAINS_CLUB_TRIAL_DURATION_DAYS', null);
};

/**
 * Calculate the trial end date for a Captain's Club trial
 * @param {Date} startDate - The start date of the trial
 * @returns {Date|null} The trial end date, or null if permanent access
 */
export const calculateTrialEndDate = (startDate = new Date()) => {
  const trialDays = getCaptainsClubTrialDuration();
  
  if (trialDays === null) {
    return null; // Permanent access
  }
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + trialDays);
  return endDate;
};

/**
 * Get the default plan for new users based on feature flags
 * @returns {string} The plan name ('basic' or 'captains_club')
 */
export const getDefaultPlanForNewUsers = () => {
  if (shouldAutoUpgradeNewUsers()) {
    if (featureFlags.LOG_FEATURE_FLAG_USAGE) {
      logger.debug('FeatureFlags', 'New user will get Captain\'s Club plan');
    }
    return 'captains_club';
  }
  
  if (featureFlags.LOG_FEATURE_FLAG_USAGE) {
    logger.debug('FeatureFlags', 'New user will get basic plan');
  }
  return 'basic';
};

export default featureFlags;
