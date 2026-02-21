# Supabase Auth Setup Instructions

This project now uses Supabase Auth with magic link email authentication for admin access.

## Required Environment Variables

Add these environment variables to your Netlify site settings:

1. **SUPABASE_URL** - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
2. **SUPABASE_ANON_KEY** - Your Supabase anonymous/public key
3. **SUPABASE_SERVICE_KEY** - Your Supabase service role key (keep this secret!)

## Database Setup

1. Run the updated `supabase-schema.sql` in your Supabase SQL Editor
2. Add admin users to the `admin_users` table:

```sql
INSERT INTO public.admin_users (email)
VALUES 
  ('admin@example.com'),
  ('another-admin@example.com');
```

3. Enable Email Auth in Supabase:
   - Go to Authentication → Providers in your Supabase dashboard
   - Enable "Email" provider
   - Configure email templates if desired
   - Set the redirect URL to your site: `https://yourdomain.com/admin.html`

## Row Level Security (RLS)

The schema now includes RLS policies that:
- Allow public read access to all tables (needed for service role operations)
- Allow write access only to authenticated admin users (via JWT)
- Check the `admin_users` table to verify admin status

**Security Note**: Public read access is enabled to allow the application to function with the service role key. If you need to restrict read access (e.g., prevent anonymous users from accessing analytics data), you can modify the RLS policies to require authentication:

```sql
-- Example: Restrict reads to authenticated users only
drop policy "Allow public read on clicks" on public.clicks;
create policy "Allow authenticated read on clicks" on public.clicks 
  for select using (auth.uid() is not null);
```

However, this may require changes to how the application authenticates for read operations.

## Authentication Flow

1. User visits `/admin-login.html`
2. Enters their email address
3. Receives a magic link via email
4. Clicks the link to authenticate
5. Gets redirected to `/admin.html` with a valid JWT session
6. All API calls include the JWT in the Authorization header
7. Backend verifies JWT and checks admin status before allowing operations

## Backward Compatibility

The system supports both:
- **New JWT Auth**: Using Supabase magic link + JWT tokens
- **Legacy Token Auth**: Using the old `ADMIN_TOKEN` environment variable

This allows for gradual migration. Once all admins are set up with Supabase Auth, you can remove the `ADMIN_TOKEN` environment variable.

## Testing

1. Deploy the updated code to Netlify
2. Set the required environment variables
3. Run the database migrations
4. Add your email to `admin_users` table
5. Visit `/admin-login.html` and request a magic link
6. Check your email and click the link
7. Verify you can access the admin dashboard

## Security Notes

- The `SUPABASE_ANON_KEY` is safe to expose publicly
- The `SUPABASE_SERVICE_KEY` must remain secret
- JWTs are automatically verified by the backend
- Admin status is checked on every protected endpoint
- Sessions expire after 1 hour (configurable in Supabase)
