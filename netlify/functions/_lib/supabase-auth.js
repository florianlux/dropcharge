const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

function getAuthToken(headers) {
  const authHeader = headers?.authorization || headers?.Authorization;
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  
  return parts[1];
}

async function verifyAdminJWT(headers) {
  const token = getAuthToken(headers);
  
  if (!token) {
    return { ok: false, error: 'No authorization token provided' };
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return { ok: false, error: 'Supabase configuration missing' };
  }

  try {
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the JWT and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user || !user.email) {
      return { ok: false, error: 'Invalid or expired token' };
    }

    // Check if user is in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, email')
      .eq('email', user.email.toLowerCase())
      .single();

    if (adminError || !adminUser) {
      return { ok: false, error: 'User is not an admin' };
    }

    // Update last login time
    await supabase
      .from('admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', adminUser.id);

    return { ok: true, user: user, adminUser: adminUser };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = {
  verifyAdminJWT,
  getAuthToken
};
