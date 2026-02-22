exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      env: {
        resend: !!process.env.RESEND_API_KEY,
        from: !!process.env.RESEND_FROM,
        supabase: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    })
  };
};
