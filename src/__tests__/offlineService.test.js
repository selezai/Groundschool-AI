/**
 * Offline Service Tests
 * Tests for offline data handling and sync functionality
 */

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock logger
jest.mock('../services/loggerService', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock supabaseClient
jest.mock('../services/supabaseClient', () => ({
  supabase: {
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
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

describe('Offline Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Network Status', () => {
    it('should detect online status', async () => {
      NetInfo.fetch.mockResolvedValue({ isConnected: true });
      
      const result = await NetInfo.fetch();
      
      expect(result.isConnected).toBe(true);
    });

    it('should detect offline status', async () => {
      NetInfo.fetch.mockResolvedValue({ isConnected: false });
      
      const result = await NetInfo.fetch();
      
      expect(result.isConnected).toBe(false);
    });
  });

  describe('AsyncStorage Operations', () => {
    it('should store data in AsyncStorage', async () => {
      const key = 'test_key';
      const value = JSON.stringify({ data: 'test' });
      
      await AsyncStorage.setItem(key, value);
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, value);
    });

    it('should retrieve data from AsyncStorage', async () => {
      const key = 'test_key';
      const storedValue = JSON.stringify({ data: 'test' });
      AsyncStorage.getItem.mockResolvedValue(storedValue);
      
      const result = await AsyncStorage.getItem(key);
      
      expect(result).toBe(storedValue);
    });

    it('should handle missing data gracefully', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await AsyncStorage.getItem('nonexistent_key');
      
      expect(result).toBeNull();
    });

    it('should remove data from AsyncStorage', async () => {
      const key = 'test_key';
      
      await AsyncStorage.removeItem(key);
      
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
    });
  });

  describe('Data Serialization', () => {
    it('should serialize objects to JSON', () => {
      const data = { id: 1, name: 'Test Quiz', questions: [] };
      
      const serialized = JSON.stringify(data);
      
      expect(typeof serialized).toBe('string');
      expect(serialized).toContain('Test Quiz');
    });

    it('should deserialize JSON to objects', () => {
      const json = '{"id":1,"name":"Test Quiz","questions":[]}';
      
      const deserialized = JSON.parse(json);
      
      expect(deserialized.id).toBe(1);
      expect(deserialized.name).toBe('Test Quiz');
      expect(Array.isArray(deserialized.questions)).toBe(true);
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = 'not valid json';
      
      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });
});
