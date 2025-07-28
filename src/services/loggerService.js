/**
 * Production-Safe Logger Service
 * 
 * Features:
 * - Environment-based log level control
 * - Sensitive data sanitization
 * - Production-safe error logging
 * - Configurable via environment variables
 *
 * Usage:
 * import logger from './loggerService';
 *
 * logger.info('AuthService', 'User operation completed');
 * logger.error('PaymentService', 'Operation failed', sanitizedError);
 */

// Environment-based configuration
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.EXPO_PUBLIC_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production' || process.env.EXPO_PUBLIC_ENV === 'production';
const shouldSanitizeLogs = process.env.EXPO_PUBLIC_SANITIZE_LOGS === 'true' || isProduction;
const securityLoggingEnabled = process.env.EXPO_PUBLIC_SECURITY_LOGGING !== 'false';

// Log levels (higher number = more verbose)
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Current log level based on environment variable or fallback
const envLogLevel = process.env.EXPO_PUBLIC_LOG_LEVEL || (isDevelopment ? 'debug' : 'error');
const currentLogLevel = LOG_LEVELS[envLogLevel] !== undefined ? LOG_LEVELS[envLogLevel] : LOG_LEVELS.error;

// Sensitive data patterns to sanitize
const SENSITIVE_PATTERNS = [
  // User IDs (UUIDs)
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // API keys and tokens
  /(?:api[_-]?key|token|secret|password)["']?\s*[:=]\s*["']?([^\s"',}]+)/gi,
  // Supabase project IDs
  /[a-z]{20,}\.supabase\.co/g,
  // Database connection strings
  /postgresql:\/\/[^\s]+/g,
];

// Sensitive keys to redact from objects
const SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'key', 'authorization', 'auth',
  'user_id', 'userId', 'id', 'email', 'phone', 'ssn', 'credit_card',
  'api_key', 'apiKey', 'access_token', 'refresh_token', 'session_id'
];

/**
 * Sanitize sensitive data from strings
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  let sanitized = str;
  
  // Replace sensitive patterns
  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized;
};

/**
 * Sanitize sensitive data from objects
 */
const sanitizeObject = (obj, maxDepth = 3, currentDepth = 0) => {
  if (currentDepth >= maxDepth) return '[MAX_DEPTH_REACHED]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return sanitizeString(String(obj));
  
  if (Array.isArray(obj)) {
    return obj.slice(0, 5).map(item => sanitizeObject(item, maxDepth, currentDepth + 1));
  }
  
  const sanitized = {};
  const keys = Object.keys(obj).slice(0, 10); // Limit object size
  
  keys.forEach(key => {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(sensitiveKey => 
      lowerKey.includes(sensitiveKey.toLowerCase())
    );
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeObject(obj[key], maxDepth, currentDepth + 1);
    }
  });
  
  return sanitized;
};

/**
 * Sanitize log context for production safety
 */
const sanitizeContext = (context) => {
  if (!context || context.length === 0) return [];
  
  return context.map(item => {
    if (typeof item === 'string') {
      return sanitizeString(item);
    } else if (typeof item === 'object') {
      return sanitizeObject(item);
    }
    return item;
  });
};

/**
 * Core logging function with security controls
 */
const log = (level, source, message, ...context) => {
  // Check if this log level should be output
  if (LOG_LEVELS[level] > currentLogLevel) {
    return; // Skip logging in production
  }
  
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase();
  const logMethod = console[level] || console.log;
  
  // Sanitize message
  const sanitizedMessage = sanitizeString(message);
  
  // Sanitize context based on configuration
  const sanitizedContext = shouldSanitizeLogs ? sanitizeContext(context) : context;
  
  // Log with appropriate level of detail
  if (sanitizedContext && sanitizedContext.length > 0) {
    if (isProduction) {
      // Production: minimal context
      logMethod(`[${timestamp}] [${levelUpper}] [${source}] ${sanitizedMessage}`);
    } else {
      // Development: full context
      logMethod(`[${timestamp}] [${levelUpper}] [${source}] ${sanitizedMessage}`, ...sanitizedContext);
    }
  } else {
    logMethod(`[${timestamp}] [${levelUpper}] [${source}] ${sanitizedMessage}`);
  }
};

/**
 * Production-safe logger interface
 */
const logger = {
  /**
   * Error logging - always enabled
   */
  error: (source, message, ...context) => {
    log('error', source, message, ...context);
  },
  
  /**
   * Warning logging - enabled in development and staging
   */
  warn: (source, message, ...context) => {
    log('warn', source, message, ...context);
  },
  
  /**
   * Info logging - development only
   */
  info: (source, message, ...context) => {
    if (isDevelopment) {
      log('info', source, message, ...context);
    }
  },
  
  /**
   * Debug logging - development only
   */
  debug: (source, message, ...context) => {
    if (isDevelopment) {
      log('debug', source, message, ...context);
    }
  },
  
  /**
   * Security-focused logging for audit trails
   */
  security: (source, message, ...context) => {
    if (securityLoggingEnabled) {
      // Security logs are always heavily sanitized
      const sanitizedContext = sanitizeContext(context);
      log('warn', `SECURITY:${source}`, message, ...sanitizedContext);
    }
  },
  
  /**
   * Performance logging - development only
   */
  performance: (source, message, ...context) => {
    if (isDevelopment) {
      log('info', `PERF:${source}`, message, ...context);
    }
  }
};

export default logger;
