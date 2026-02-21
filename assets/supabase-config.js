// Supabase configuration loader
// This script loads Supabase credentials from the backend

(async function() {
  try {
    // Try to load from Netlify function
    const response = await fetch('/.netlify/functions/supabase-config');
    if (response.ok) {
      const script = await response.text();
      eval(script);
    }
  } catch (err) {
    console.warn('Failed to load Supabase config:', err);
  }
  
  // Fallback values if not set
  window.SUPABASE_URL = window.SUPABASE_URL || '';
  window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
})();

