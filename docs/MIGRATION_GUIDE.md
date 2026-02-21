# Migration Guide: Admin Token → Supabase Auth

## Overview
This guide helps you migrate from the legacy admin token authentication to the new Supabase Auth system with magic link email authentication.

## Pre-Migration Checklist

- [ ] Backup your current Supabase database
- [ ] Note your current `ADMIN_TOKEN` (you can keep it temporarily for fallback)
- [ ] Have access to your Supabase dashboard
- [ ] Have access to your Netlify environment variables

## Step 1: Update Database Schema

1. Go to your Supabase SQL Editor
2. Run the updated `supabase-schema.sql` file
3. Verify the tables were created:
   ```sql
   SELECT * FROM admin_users;
   ```

## Step 2: Configure Supabase Email Auth

1. In Supabase Dashboard, go to **Authentication → Providers**
2. Enable the **Email** provider
3. Under **Email Templates**, review and customize if needed
4. Set **Redirect URLs**:
   - Add: `https://yourdomain.com/admin.html`
   - Add: `http://localhost:8888/admin.html` (for development)

## Step 3: Add Admin Users

Run this SQL in Supabase to add your admin email(s):

```sql
INSERT INTO public.admin_users (email)
VALUES 
  ('your-email@example.com'),
  ('another-admin@example.com')
ON CONFLICT (email) DO NOTHING;
```

Or use the helper script:
```bash
./scripts/add-admin.sh your-email@example.com
```

## Step 4: Update Netlify Environment Variables

Add these new environment variables in Netlify:

1. **SUPABASE_ANON_KEY**
   - Find in: Supabase → Settings → API → Project API keys → `anon` `public`
   - This is safe to expose publicly

Keep these existing variables:
- **SUPABASE_URL** (already set)
- **SUPABASE_SERVICE_KEY** (already set)
- **ADMIN_TOKEN** (optional - keep for backward compatibility during migration)

## Step 5: Deploy the Changes

1. Push the updated code to your repository
2. Netlify will automatically deploy
3. Wait for deployment to complete

## Step 6: Test the New Auth System

### Test Login Flow:
1. Visit `https://yourdomain.com/admin-login.html`
2. Enter your admin email
3. Click "Magischen Link senden"
4. Check your email for the magic link
5. Click the link
6. You should be redirected to `/admin.html` and authenticated

### Test Admin Operations:
1. Try creating/editing a deal
2. Try viewing analytics
3. Try sending a test campaign
4. Verify all operations work correctly

### Test Logout:
1. Click the "Logout" button in the admin sidebar
2. Verify you're redirected to login
3. Verify you can't access `/admin.html` without logging in

## Step 7: Verify RLS Policies

Test that unauthorized writes are blocked:

1. Open browser console on `/admin.html`
2. Sign out
3. Try to insert data directly via Supabase client:
   ```javascript
   // This should fail
   await supabase.from('spotlights').insert({ title: 'Test' })
   ```
4. Verify you get an RLS policy violation error

## Step 8: Remove Legacy Token (Optional)

Once you've confirmed everything works:

1. Remove `ADMIN_TOKEN` from Netlify environment variables
2. The system will now only accept JWT authentication
3. Update any CI/CD scripts that used the old token

## Troubleshooting

### "Supabase is not configured" Error
- Check that SUPABASE_URL and SUPABASE_ANON_KEY are set in Netlify
- Verify the environment variables are deployed (check deployment logs)
- Try clearing browser cache

### Magic Link Not Arriving
- Check spam folder
- Verify email provider is configured in Supabase
- Check Supabase logs in Dashboard → Authentication → Logs

### "User is not an admin" Error
- Verify your email is in the `admin_users` table
- Check the email matches exactly (case-insensitive)
- Run: `SELECT * FROM admin_users WHERE email ILIKE 'your@email.com'`

### 401 Unauthorized on API Calls
- Check that JWT is being sent in Authorization header
- Verify JWT hasn't expired (tokens last 1 hour by default)
- Try logging out and back in to get a fresh token

### RLS Policy Errors
- Verify the `is_admin()` function exists
- Check that RLS policies were created correctly
- Ensure your user is authenticated (not anonymous)

## Rollback Plan

If you need to rollback to the old system:

1. Revert the code changes:
   ```bash
   git revert <commit-hash>
   ```
2. Keep the `ADMIN_TOKEN` environment variable
3. The old token-based auth will still work

## Additional Resources

- [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md) - Detailed setup guide
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check Netlify function logs
3. Check Supabase logs in the dashboard
4. Review the troubleshooting section above
