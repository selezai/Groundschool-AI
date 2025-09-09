/**
 * Cache Service for managing application-wide cache invalidation
 * Provides utilities for invalidating cached data when relevant changes occur
 */

import logger from './loggerService';

class CacheService {
  constructor() {
    this.invalidationCallbacks = new Map();
  }

  /**
   * Register a cache invalidation callback
   * @param {string} cacheKey - Unique identifier for the cache
   * @param {Function} callback - Function to call when cache should be invalidated
   */
  registerInvalidationCallback(cacheKey, callback) {
    if (!this.invalidationCallbacks.has(cacheKey)) {
      this.invalidationCallbacks.set(cacheKey, new Set());
    }
    this.invalidationCallbacks.get(cacheKey).add(callback);
    logger.debug('CacheService:registerInvalidationCallback', `Registered callback for ${cacheKey}`);
  }

  /**
   * Unregister a cache invalidation callback
   * @param {string} cacheKey - Unique identifier for the cache
   * @param {Function} callback - Function to remove
   */
  unregisterInvalidationCallback(cacheKey, callback) {
    if (this.invalidationCallbacks.has(cacheKey)) {
      this.invalidationCallbacks.get(cacheKey).delete(callback);
      if (this.invalidationCallbacks.get(cacheKey).size === 0) {
        this.invalidationCallbacks.delete(cacheKey);
      }
      logger.debug('CacheService:unregisterInvalidationCallback', `Unregistered callback for ${cacheKey}`);
    }
  }

  /**
   * Invalidate specific cache
   * @param {string} cacheKey - Unique identifier for the cache to invalidate
   */
  invalidateCache(cacheKey) {
    if (this.invalidationCallbacks.has(cacheKey)) {
      const callbacks = this.invalidationCallbacks.get(cacheKey);
      logger.info('CacheService:invalidateCache', `Invalidating cache: ${cacheKey}`, { callbackCount: callbacks.size });
      
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          logger.error('CacheService:invalidateCache', `Error calling invalidation callback for ${cacheKey}`, { error });
        }
      });
    }
  }

  /**
   * Invalidate multiple caches
   * @param {string[]} cacheKeys - Array of cache keys to invalidate
   */
  invalidateCaches(cacheKeys) {
    cacheKeys.forEach(key => this.invalidateCache(key));
  }

  /**
   * Invalidate all registered caches
   */
  invalidateAllCaches() {
    logger.info('CacheService:invalidateAllCaches', 'Invalidating all caches');
    this.invalidationCallbacks.forEach((callbacks, cacheKey) => {
      this.invalidateCache(cacheKey);
    });
  }
}

// Create singleton instance
const cacheService = new CacheService();

// Cache keys constants
export const CACHE_KEYS = {
  PROFILE_STATS: 'profile_stats',
  USER_QUIZZES: 'user_quizzes',
  USER_DOCUMENTS: 'user_documents',
  QUIZ_ATTEMPTS: 'quiz_attempts',
  STORAGE_USAGE: 'storage_usage'
};

export default cacheService;
