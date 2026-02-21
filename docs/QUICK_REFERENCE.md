# Quick Reference: Supabase Auth Implementation

## Environment Variables Required

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...  # Public key
SUPABASE_SERVICE_KEY=eyJhbGci...  # Secret key
ADMIN_TOKEN=optional-legacy-token  # Optional for backward compatibility
```

## SQL Commands

### Add Admin User
```sql
INSERT INTO public.admin_users (email)
VALUES ('admin@example.com')
ON CONFLICT (email) DO NOTHING;
```

### List Admin Users
```sql
SELECT id, email, created_at, last_login_at 
FROM public.admin_users 
ORDER BY created_at DESC;
```

### Remove Admin User
```sql
DELETE FROM public.admin_users 
WHERE email = 'old-admin@example.com';
```

### Check RLS Policies
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## API Endpoints

### Config Endpoint
- **URL**: `/.netlify/functions/supabase-config`
- **Method**: GET
- **Returns**: JavaScript that sets `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY`

### Admin Endpoints (All require JWT)
All admin endpoints now accept JWT in the Authorization header:
```bash
Authorization: Bearer <jwt-token>
```

Or legacy token (during migration):
```bash
x-admin-token: <legacy-token>
```

## File Structure

```
/admin-login.html         # New magic link login page
/admin.html              # Admin dashboard (requires auth)
/assets/
  admin.js               # Updated with Supabase client
/netlify/functions/
  _lib/
    supabase-auth.js     # JWT verification logic
    admin-token.js       # Updated auth middleware
  supabase-config.js     # Config injection endpoint
  [14 admin functions]   # Updated to use async auth
/supabase-schema.sql     # Updated schema with admin_users and RLS
/scripts/
  add-admin.sh          # Helper script
/docs/
  SUPABASE_AUTH_SETUP.md  # Detailed setup guide
  MIGRATION_GUIDE.md      # Step-by-step migration
```

## Authentication Flow

1. **Login**: User visits `/admin-login.html`
2. **Request Magic Link**: Enters email → Supabase sends magic link
3. **Authenticate**: Clicks link → Supabase creates session
4. **Redirect**: Redirected to `/admin.html` with JWT
5. **API Calls**: All requests include `Authorization: Bearer <jwt>`
6. **Backend Verify**: Functions verify JWT and check admin_users table
7. **Logout**: User clicks logout → Session cleared → Redirected to login

## Security Model

### Frontend
- ✅ Session stored in browser (httpOnly cookies via Supabase)
- ✅ JWT automatically refreshed by Supabase client
- ✅ Route guard redirects to login if no session
- ✅ Logout clears session and tokens

### Backend
- ✅ JWT verification on every admin endpoint
- ✅ Email checked against admin_users table
- ✅ Backward compatible with legacy token
- ✅ 401 response if unauthorized

### Database
- ✅ RLS enabled on all tables
- ✅ Public can read (needed for service role)
- ✅ Only admins can write (checked via is_admin() function)
- ✅ Admin check queries admin_users table

## Testing Checklist

- [ ] Magic link arrives in email
- [ ] Link redirects to admin dashboard
- [ ] Dashboard loads without errors
- [ ] Can view analytics data
- [ ] Can create/edit deals
- [ ] Can send test emails
- [ ] Logout works correctly
- [ ] Cannot access admin without login
- [ ] RLS prevents unauthorized writes
- [ ] JWT expires and refreshes correctly

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Config not loaded | Check SUPABASE_URL and SUPABASE_ANON_KEY in Netlify |
| Magic link not arriving | Check Supabase email settings and spam folder |
| 401 on API calls | Verify JWT is valid and user is in admin_users |
| RLS policy error | Check is_admin() function exists and policies are created |
| Cannot insert data | Verify you're authenticated (not anonymous) |

## Useful Supabase Dashboard Links

- **Auth Logs**: Authentication → Logs
- **API Keys**: Settings → API
- **Email Templates**: Authentication → Email Templates  
- **RLS Policies**: Database → Tables → [table] → Policies
- **SQL Editor**: SQL Editor

## Support Commands

### Check if admin_users table exists
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'admin_users'
);
```

### Check if is_admin() function exists
```sql
SELECT EXISTS (
  SELECT FROM pg_proc 
  WHERE proname = 'is_admin'
);
```

### Test is_admin() function manually
```sql
-- This should return true if you're an admin
SELECT is_admin();
```

### View current session (from frontend console)
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log(session);
```

### Manually verify JWT
```javascript
// In browser console after login
console.log(currentAccessToken);
// Copy token and decode at jwt.io to inspect claims
```

## Quick Deploy

```bash
# 1. Update database
psql -h db.xxx.supabase.co -U postgres -f supabase-schema.sql

# 2. Add admin user
./scripts/add-admin.sh your@email.com

# 3. Deploy to Netlify
git push origin main

# 4. Test
open https://yourdomain.com/admin-login.html
```
