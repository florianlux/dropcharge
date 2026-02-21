import crypto from 'crypto';

/**
 * Generates a unique request ID for tracking
 * @returns {string} A short unique request identifier
 */
export function generateRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Formats error object with full stack trace
 * @param {Error} error - The error object
 * @returns {Object} Formatted error details
 */
export function formatError(error) {
  if (!error) return null;
  
  return {
    message: error.message || 'Unknown error',
    name: error.name || 'Error',
    stack: error.stack || '',
    code: error.code || null,
  };
}

/**
 * Creates a structured logger for a Netlify function
 * @param {string} functionName - Name of the function
 * @param {Object} event - Netlify event object
 * @returns {Object} Logger instance with log methods
 */
export function createLogger(functionName, event = {}) {
  const requestId = generateRequestId();
  const method = event.httpMethod || 'UNKNOWN';
  const path = event.path || 'UNKNOWN';
  const timestamp = new Date().toISOString();
  
  const baseContext = {
    requestId,
    function: functionName,
    method,
    path,
    timestamp,
  };

  /**
   * Log helper that outputs structured JSON
   */
  function log(level, message, extra = {}) {
    const logEntry = {
      ...baseContext,
      level,
      message,
      ...extra,
    };
    
    const output = JSON.stringify(logEntry);
    
    if (level === 'error') {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  return {
    requestId,
    
    info: (message, extra = {}) => log('info', message, extra),
    
    warn: (message, extra = {}) => log('warn', message, extra),
    
    error: (message, error = null, extra = {}) => {
      const errorDetails = error ? formatError(error) : null;
      log('error', message, { error: errorDetails, ...extra });
    },
    
    success: (statusCode, message = 'Request successful', extra = {}) => {
      log('info', message, { statusCode, status: 'success', ...extra });
    },
    
    requestStart: () => {
      log('info', 'Request started', {
        userAgent: event.headers?.['user-agent'] || null,
        clientIp: event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null,
      });
    },
    
    requestEnd: (statusCode, duration = null) => {
      log('info', 'Request completed', {
        statusCode,
        durationMs: duration,
        status: statusCode >= 200 && statusCode < 300 ? 'success' : 'error',
      });
    },
  };
}

/**
 * Wraps a Netlify function handler with logging
 * @param {string} functionName - Name of the function
 * @param {Function} handler - The function handler
 * @returns {Function} Wrapped handler with logging
 */
export function withLogging(functionName, handler) {
  return async function loggedHandler(event, context) {
    const logger = createLogger(functionName, event);
    const startTime = Date.now();
    
    logger.requestStart();
    
    try {
      const response = await handler(event, context, logger);
      const duration = Date.now() - startTime;
      logger.requestEnd(response.statusCode, duration);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Unhandled error in function', error, { durationMs: duration });
      logger.requestEnd(500, duration);
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Internal server error',
          requestId: logger.requestId,
        }),
      };
    }
  };
}
