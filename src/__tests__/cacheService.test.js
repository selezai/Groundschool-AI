/**
 * Cache Service Tests
 * Tests for cache invalidation functionality
 */

// Mock logger
jest.mock('../services/loggerService', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

import cacheService, { CACHE_KEYS } from '../services/cacheService';

describe('Cache Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CACHE_KEYS', () => {
    it('should have defined cache keys', () => {
      expect(CACHE_KEYS).toBeDefined();
      expect(typeof CACHE_KEYS).toBe('object');
    });

    it('should have PROFILE_STATS key', () => {
      expect(CACHE_KEYS.PROFILE_STATS).toBe('profile_stats');
    });

    it('should have USER_QUIZZES key', () => {
      expect(CACHE_KEYS.USER_QUIZZES).toBe('user_quizzes');
    });

    it('should have USER_DOCUMENTS key', () => {
      expect(CACHE_KEYS.USER_DOCUMENTS).toBe('user_documents');
    });
  });

  describe('Cache Invalidation', () => {
    it('should register invalidation callback', () => {
      const callback = jest.fn();
      const key = 'test_key';
      
      cacheService.registerInvalidationCallback(key, callback);
      
      // Callback should be registered (no error thrown)
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call registered callback on invalidation', () => {
      const callback = jest.fn();
      const key = 'test_invalidate_key';
      
      cacheService.registerInvalidationCallback(key, callback);
      cacheService.invalidateCache(key);
      
      expect(callback).toHaveBeenCalled();
    });

    it('should unregister callback', () => {
      const callback = jest.fn();
      const key = 'test_unregister_key';
      
      cacheService.registerInvalidationCallback(key, callback);
      cacheService.unregisterInvalidationCallback(key, callback);
      cacheService.invalidateCache(key);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should invalidate multiple caches', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      cacheService.registerInvalidationCallback('key1', callback1);
      cacheService.registerInvalidationCallback('key2', callback2);
      
      cacheService.invalidateCaches(['key1', 'key2']);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
});
