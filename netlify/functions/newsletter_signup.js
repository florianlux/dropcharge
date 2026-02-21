import { createLogger } from './_lib/logger.mjs';

export async function handler(event, context) {
  const logger = createLogger('newsletter_signup', event);
  const startTime = Date.now();
  logger.requestStart();
  
  try {
    if (event.httpMethod !== "POST") {
      logger.warn('Method not allowed', { method: event.httpMethod });
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    if (!process.env.RESEND_API_KEY) {
      logger.error('RESEND_API_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing RESEND_API_KEY" })
      };
    }

    let payload = {};

    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch (err) {
      logger.error('Invalid JSON body', err);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON body" })
      };
    }

    const email = (payload.email || "").trim().toLowerCase();

    if (!email) {
      logger.warn('Email missing from request');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email is required" })
      };
    }

    logger.info('Sending welcome email', { email });

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const response = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Welcome to DropCharge 🚀",
      html: "<p>Thanks for subscribing!</p>"
    });

    const duration = Date.now() - startTime;
    logger.success(200, 'Welcome email sent', { email, resendId: response.id, durationMs: duration });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        id: response.id,
        requestId: logger.requestId
      })
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Newsletter signup failed', error, { durationMs: duration });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal Server Error",
        message: error.message,
        requestId: logger.requestId
      })
    };
  }
}
