/**
 * A simple, robust logger service that outputs plain text logs to the console.
 * This version avoids complex features to prevent issues in production builds.
 *
 * Usage:
 * import logger from './loggerService';
 *
 * logger.info('AuthService', 'User logged in', { userId: '123' });
 * logger.error('PaymentService', 'Payment failed', new Error('Timeout'));
 */

const log = (level, source, message, ...context) => {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase();

  const logMethod = console[level] || console.log;

  if (context && context.length > 0) {
    logMethod(`[${timestamp}] [${levelUpper}] [${source}] ${message}`, ...context);
  } else {
    logMethod(`[${timestamp}] [${levelUpper}] [${source}] ${message}`);
  }
};

const logger = {
  info: (source, message, ...context) => log('info', source, message, ...context),
  warn: (source, message, ...context) => log('warn', source, message, ...context),
  error: (source, message, ...context) => log('error', source, message, ...context),
  debug: (source, message, ...context) => log('debug', source, message, ...context),
};

export default logger;
