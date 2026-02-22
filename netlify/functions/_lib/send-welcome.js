/**
 * Shared helper – sends a welcome email via Resend and logs the result.
 * Used by newsletter_signup and spin-enter endpoints.
 */
const { welcomeEmail } = require('./email-templates');
const { supabase, hasSupabase } = require('./supabase');

const EMAIL_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.RESEND_FROM;
const EMAIL_FALLBACK_FROM = process.env.RESEND_FALLBACK_FROM || undefined;
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

async function logEmailSend({ email, template, subject, status, error: errMsg, messageId }) {
  if (!hasSupabase || !supabase) return;
  try {
    await supabase.from('email_logs').insert({
      recipient: email,
      template,
      subject,
      status,
      message_id: messageId || null,
      error: errMsg || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null
    });
  } catch (err) {
    console.error('email_log insert error:', err.message);
  }
}

/**
 * Send a welcome email and log the result.
 * @param {{ email: string, unsubscribeUrl: string }} opts
 * @returns {Promise<{ sent: boolean, messageId?: string, error?: string }>}
 */
async function sendWelcomeEmail({ email, unsubscribeUrl }) {
  const senderFrom = EMAIL_FROM || EMAIL_FALLBACK_FROM;
  if (!EMAIL_API_KEY || !senderFrom) {
    return { sent: false, error: 'email_not_configured' };
  }

  const welcomeSubject = welcomeEmail({ email, unsubscribeUrl: '#' }).subject;

  try {
    const tpl = welcomeEmail({ email, unsubscribeUrl });
    if (!tpl.subject || !tpl.html) {
      throw new Error('invalid_template_payload: welcome template produced empty subject or html');
    }

    const body = {
      from: senderFrom,
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {})
    };

    console.log('EMAIL PAYLOAD:', {
      from: senderFrom,
      to: email.replace(/^[^@]+/, '***'),
      subjectLength: tpl.subject.length,
      htmlLength: tpl.html.length
    });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EMAIL_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    let resBody;
    try { resBody = await res.json(); } catch { resBody = await res.text().catch(() => ''); }

    if (!res.ok) {
      console.error('RESEND ERROR FULL:', { status: res.status, response: resBody });
      const detail = typeof resBody === 'object' ? JSON.stringify(resBody) : String(resBody);
      throw new Error(`resend_error:${res.status}:${detail}`);
    }

    console.log('RESEND SUCCESS:', resBody);
    const resendId = resBody?.id ?? null;
    await logEmailSend({ email, template: 'welcome', subject: tpl.subject, status: 'sent', messageId: resendId });
    return { sent: true, messageId: resendId };
  } catch (err) {
    console.error('Welcome email failed (non-fatal):', err.message);
    await logEmailSend({ email, template: 'welcome', subject: welcomeSubject, status: 'failed', error: err.message });
    return { sent: false, error: err.message };
  }
}

module.exports = { sendWelcomeEmail, logEmailSend };
