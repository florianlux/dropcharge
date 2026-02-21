const { supabase, hasSupabase, supabaseUrlPresent, supabaseServiceKeyPresent, verifyConnection } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');
const { withLogging } = require('./_lib/logger');

/**
 * Health check endpoint
 * Returns system status and connectivity information
 */
async function handler(event, context, logger) {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    supabase: {
      configured: hasSupabase,
      urlPresent: supabaseUrlPresent,
      serviceKeyPresent: supabaseServiceKeyPresent,
      connected: false,
      error: null,
    },
    netlify: {
      functionName: context.functionName || 'health',
      region: process.env.AWS_REGION || 'unknown',
    },
  };

  // Check Supabase connectivity
  if (hasSupabase) {
    logger.info('Checking Supabase connection');
    const connectionResult = await verifyConnection();
    checks.supabase.connected = connectionResult.ok;
    if (!connectionResult.ok) {
      checks.supabase.error = connectionResult.error;
      logger.warn('Supabase connection check failed', { error: connectionResult.error });
    } else {
      logger.info('Supabase connection check passed');
    }
  } else {
    logger.warn('Supabase not configured');
  }

  // Determine overall health status
  const isHealthy = checks.supabase.configured ? checks.supabase.connected : true;
  const statusCode = isHealthy ? 200 : 503;
  
  logger.success(statusCode, isHealthy ? 'Health check passed' : 'Health check failed', {
    healthy: isHealthy,
    supabaseConnected: checks.supabase.connected,
  });

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
    body: JSON.stringify({
      status: isHealthy ? 'healthy' : 'unhealthy',
      checks,
    }, null, 2),
  };
}

exports.handler = withCors(withLogging('health', handler));
