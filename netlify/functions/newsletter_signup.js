const { supabase } = require('./_lib/supabase');

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_REGEX.test(email);
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

exports.handler = async function handler(event) {
  try {
    // Only accept POST requests
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ 
          ok: false, 
          error: "Method not allowed" 
        })
      };
    }

    // Check if Supabase is configured
    if (!supabase) {
      console.error('Supabase not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          ok: false, 
          error: "Service not configured" 
        })
      };
    }

    // Parse request body
    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch (err) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          ok: false, 
          error: "Invalid JSON body" 
        })
      };
    }

    // Extract and normalize email
    const rawEmail = payload.email || "";
    const email = normalizeEmail(rawEmail);

    // Validate email
    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          ok: false, 
          error: "Email is required" 
        })
      };
    }

    if (!validateEmail(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          ok: false, 
          error: "invalid_email" 
        })
      };
    }

    // Extract UTM parameters and metadata
    const source = payload.source || 'popup';
    const page = payload.page || '';
    const utm = payload.utm || {};
    
    // Check if email already exists
    const { data: existingSubscriber, error: checkError } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, status')
      .eq('email', email)
      .maybeSingle();

    if (checkError) {
      console.error('Database check error:', checkError);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          ok: false, 
          error: "Database error" 
        })
      };
    }

    // If subscriber already exists
    if (existingSubscriber) {
      if (existingSubscriber.status === 'active') {
        return {
          statusCode: 409,
          body: JSON.stringify({ 
            ok: true, 
            status: 'exists',
            message: 'Email already subscribed' 
          })
        };
      }
      
      // Reactivate if previously unsubscribed
      if (existingSubscriber.status === 'unsubscribed') {
        const { error: updateError } = await supabase
          .from('newsletter_subscribers')
          .update({ 
            status: 'active',
            unsubscribed_at: null,
            created_at: new Date().toISOString()
          })
          .eq('id', existingSubscriber.id);

        if (updateError) {
          console.error('Database update error:', updateError);
          return {
            statusCode: 500,
            body: JSON.stringify({ 
              ok: false, 
              error: "Database error" 
            })
          };
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ 
            ok: true, 
            status: 'reactivated',
            message: 'Subscription reactivated' 
          })
        };
      }
    }

    // Insert new subscriber
    const subscriberData = {
      email,
      status: 'active',
      source,
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      utm_term: utm.utm_term || null,
      utm_content: utm.utm_content || null,
      meta: {
        page,
        user_agent: event.headers['user-agent'] || null,
        consent: payload.consent || false
      }
    };

    const { data: newSubscriber, error: insertError } = await supabase
      .from('newsletter_subscribers')
      .insert([subscriberData])
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return {
          statusCode: 409,
          body: JSON.stringify({ 
            ok: true, 
            status: 'exists',
            message: 'Email already subscribed' 
          })
        };
      }

      return {
        statusCode: 500,
        body: JSON.stringify({ 
          ok: false, 
          error: "Database error" 
        })
      };
    }

    // Success response
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        ok: true, 
        status: 'inserted',
        message: 'Successfully subscribed' 
      })
    };

  } catch (error) {
    console.error("newsletter_signup error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: "Internal Server Error",
        message: error.message
      })
    };
  }
};
