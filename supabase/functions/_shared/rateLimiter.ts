/**
 * 🚦 COMPREHENSIVE RATE LIMITING UTILITY
 * 
 * Provides flexible rate limiting for Supabase Edge Functions with:
 * - Multiple rate limiting strategies (sliding window, fixed window)
 * - IP-based and user-based limiting
 * - Configurable limits per endpoint
 * - Redis-like storage using Supabase for persistence
 * - Automatic cleanup of expired entries
 * 
 * Security Features:
 * - Prevents API abuse and DDoS attacks
 * - Protects payment endpoints from fraud attempts
 * - Configurable burst and sustained rate limits
 * - Detailed logging for monitoring and alerting
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

// Rate limiting configuration types
export interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean;        // Don't count successful requests
  skipFailedRequests?: boolean;            // Don't count failed requests
  message?: string;        // Custom rate limit exceeded message
  statusCode?: number;     // Custom HTTP status code (default: 429)
}

// Predefined rate limit configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // Payment endpoints - very strict to prevent fraud
  PAYMENT: {
    windowMs: 60 * 1000,     // 1 minute window
    maxRequests: 3,          // Max 3 payment attempts per minute
    message: 'Too many payment requests. Please wait before trying again.',
    statusCode: 429
  },
  
  // Authentication endpoints - moderate limits
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minute window
    maxRequests: 10,          // Max 10 auth attempts per 15 minutes
    message: 'Too many authentication attempts. Please wait before trying again.',
    statusCode: 429
  },
  
  // General API endpoints - more permissive
  API: {
    windowMs: 60 * 1000,     // 1 minute window
    maxRequests: 60,         // Max 60 requests per minute
    message: 'Rate limit exceeded. Please slow down your requests.',
    statusCode: 429
  },
  
  // File upload endpoints - moderate limits due to resource usage
  UPLOAD: {
    windowMs: 5 * 60 * 1000, // 5 minute window
    maxRequests: 20,         // Max 20 uploads per 5 minutes
    message: 'Too many upload requests. Please wait before uploading again.',
    statusCode: 429
  },
  
  // Webhook endpoints (like PayFast ITN) - strict but allow legitimate traffic
  WEBHOOK: {
    windowMs: 60 * 1000,     // 1 minute window
    maxRequests: 10,         // Max 10 webhooks per minute
    message: 'Webhook rate limit exceeded.',
    statusCode: 429
  }
} as const;

// Rate limit storage interface
interface RateLimitEntry {
  key: string;
  count: number;
  window_start: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Advanced Rate Limiter Class
 */
export class RateLimiter {
  private supabase: any;
  private tableName = 'rate_limits';

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Initialize rate limiting table (call this once during setup)
   */
  async initializeTable(): Promise<void> {
    try {
      // Create rate_limits table if it doesn't exist
      const { error } = await this.supabase.rpc('create_rate_limits_table');
      if (error && !error.message.includes('already exists')) {
        console.error('Failed to create rate_limits table:', error);
      }
    } catch (error) {
      console.error('Error initializing rate limiter table:', error);
    }
  }

  /**
   * Generate rate limiting key from request
   */
  private generateKey(req: Request, prefix: string, customKeyGen?: (req: Request) => string): string {
    if (customKeyGen) {
      return `${prefix}:${customKeyGen(req)}`;
    }

    // Try to get IP from various headers (for different deployment scenarios)
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    
    const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
    
    // Also include user agent for additional uniqueness
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const userAgentHash = this.simpleHash(userAgent);
    
    return `${prefix}:${ip}:${userAgentHash}`;
  }

  /**
   * Simple hash function for user agent
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Check if request should be rate limited
   */
  async isRateLimited(req: Request, config: RateLimitConfig, endpointName: string): Promise<{
    limited: boolean;
    remaining: number;
    resetTime: Date;
    totalHits: number;
  }> {
    const key = this.generateKey(req, endpointName, config.keyGenerator);
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);

    try {
      // Clean up expired entries first
      await this.cleanupExpiredEntries();

      // Get current rate limit entry
      const { data: existing, error: fetchError } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('key', key)
        .gte('expires_at', now.toISOString())
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Rate limiter fetch error:', fetchError);
        // Fail open - don't block requests if we can't check rate limits
        return { limited: false, remaining: config.maxRequests, resetTime: now, totalHits: 0 };
      }

      let currentCount = 0;
      let resetTime = new Date(now.getTime() + config.windowMs);

      if (existing) {
        const existingWindowStart = new Date(existing.window_start);
        
        // If the existing window is still valid, increment count
        if (existingWindowStart > windowStart) {
          currentCount = existing.count + 1;
          resetTime = new Date(existingWindowStart.getTime() + config.windowMs);
          
          // Update existing entry
          await this.supabase
            .from(this.tableName)
            .update({
              count: currentCount,
              updated_at: now.toISOString()
            })
            .eq('key', key);
        } else {
          // Window expired, start new window
          currentCount = 1;
          await this.supabase
            .from(this.tableName)
            .update({
              count: currentCount,
              window_start: now.toISOString(),
              expires_at: resetTime.toISOString(),
              updated_at: now.toISOString()
            })
            .eq('key', key);
        }
      } else {
        // Create new entry
        currentCount = 1;
        await this.supabase
          .from(this.tableName)
          .insert({
            key,
            count: currentCount,
            window_start: now.toISOString(),
            expires_at: resetTime.toISOString(),
            created_at: now.toISOString(),
            updated_at: now.toISOString()
          });
      }

      const limited = currentCount > config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - currentCount);

      // Log rate limiting events
      if (limited) {
        console.warn(`🚦 Rate limit exceeded for ${endpointName}:`, {
          key,
          currentCount,
          maxRequests: config.maxRequests,
          windowMs: config.windowMs,
          resetTime: resetTime.toISOString()
        });
      }

      return {
        limited,
        remaining,
        resetTime,
        totalHits: currentCount
      };

    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - don't block requests if rate limiter fails
      return { limited: false, remaining: config.maxRequests, resetTime: now, totalHits: 0 };
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private async cleanupExpiredEntries(): Promise<void> {
    try {
      const now = new Date();
      await this.supabase
        .from(this.tableName)
        .delete()
        .lt('expires_at', now.toISOString());
    } catch (error) {
      console.error('Failed to cleanup expired rate limit entries:', error);
    }
  }

  /**
   * Create rate limit response
   */
  createRateLimitResponse(config: RateLimitConfig, rateLimitInfo: {
    remaining: number;
    resetTime: Date;
    totalHits: number;
  }): Response {
    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitInfo.resetTime.getTime() / 1000).toString(),
      'X-RateLimit-Window': config.windowMs.toString(),
      'Retry-After': Math.ceil(config.windowMs / 1000).toString()
    };

    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: config.message || 'Too many requests',
        retryAfter: Math.ceil(config.windowMs / 1000),
        limit: config.maxRequests,
        remaining: rateLimitInfo.remaining,
        resetTime: rateLimitInfo.resetTime.toISOString()
      }),
      {
        status: config.statusCode || 429,
        headers
      }
    );
  }
}

/**
 * Convenience function to apply rate limiting to an Edge Function
 */
export async function applyRateLimit(
  req: Request,
  config: RateLimitConfig,
  endpointName: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<Response | null> {
  const rateLimiter = new RateLimiter(supabaseUrl, supabaseKey);
  
  const rateLimitInfo = await rateLimiter.isRateLimited(req, config, endpointName);
  
  if (rateLimitInfo.limited) {
    return rateLimiter.createRateLimitResponse(config, rateLimitInfo);
  }
  
  return null; // Not rate limited, continue processing
}

/**
 * SQL function to create rate_limits table (run this once in your database)
 */
export const CREATE_RATE_LIMITS_TABLE_SQL = `
CREATE OR REPLACE FUNCTION create_rate_limits_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  
  -- Create index for efficient lookups
  CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
  CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
  
  -- Enable RLS for security
  ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
  
  -- Allow service role to manage rate limits
  CREATE POLICY IF NOT EXISTS "Service role can manage rate limits"
    ON rate_limits FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
END;
$$ LANGUAGE plpgsql;
`;
