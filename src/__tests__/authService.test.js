/**
 * Authentication Service Tests
 * Tests for sign in, sign up, and sign out functionality
 */

// Mock the supabase client before importing authService
jest.mock('../services/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
  isSupabaseReady: jest.fn(() => true),
}));

// Mock logger
jest.mock('../services/loggerService', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock posthog
jest.mock('../services/posthogService', () => ({
  capture: jest.fn(),
  identify: jest.fn(),
}));

// Mock feature flags
jest.mock('../config/featureFlags', () => ({
  getDefaultPlanForNewUsers: jest.fn(() => 'basic'),
  calculateTrialEndDate: jest.fn(() => null),
  shouldAutoUpgradeNewUsers: jest.fn(() => false),
}));

import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signIn', () => {
    it('should successfully sign in with valid credentials', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token-123', user: mockUser };

      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.signIn('test@example.com', 'password123');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result).toEqual({ user: mockUser, session: mockSession });
    });

    it('should throw error for invalid credentials', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(authService.signIn('test@example.com', 'wrongpassword'))
        .rejects.toThrow();
    });

    it('should throw error for empty email', async () => {
      await expect(authService.signIn('', 'password123'))
        .rejects.toThrow();
    });
  });

  describe('signUp', () => {
    it('should successfully sign up a new user', async () => {
      const mockUser = { id: 'new-user-123', email: 'newuser@example.com' };
      const mockSession = { access_token: 'token-456', user: mockUser };

      supabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const mockFrom = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: mockUser.id }, error: null }),
          }),
        }),
      });
      supabase.from = mockFrom;

      const result = await authService.signUp(
        'newuser@example.com',
        'password123',
        { full_name: 'Test User' }
      );

      expect(supabase.auth.signUp).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
    });

    it('should throw error for weak password', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Password should be at least 6 characters' },
      });

      await expect(authService.signUp('test@example.com', '123'))
        .rejects.toThrow();
    });
  });

  describe('signOut', () => {
    it('should successfully sign out', async () => {
      supabase.auth.signOut.mockResolvedValue({ error: null });

      await expect(authService.signOut()).resolves.not.toThrow();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors gracefully', async () => {
      supabase.auth.signOut.mockResolvedValue({
        error: { message: 'Network error' },
      });

      await expect(authService.signOut()).rejects.toThrow();
    });
  });
});
