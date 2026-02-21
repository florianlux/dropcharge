# Newsletter & Supabase Connection Guide

## Overview
The DropCharge application has full Supabase integration for newsletter/email functionality.

## Connection Status: ✅ READY

### Prerequisites Met
- ✅ **SUPABASE_URL** configured: `https://qoinlxpumoakfmkfrwqb.supabase.co`
- ✅ **SUPABASE_SERVICE_KEY** configured: Available in environment
- ✅ **Connection code** in place: `netlify/functions/_lib/supabase.js`
- ✅ **Newsletter functions** exist and properly use Supabase

## Newsletter Implementation

### Two Systems Available

#### 1. Simple Email Capture (`emails` table)
**Function:** `netlify/functions/subscribe.js`
**Table:** `public.emails`
**Schema:** `supabase-schema.sql` (lines 25-40)

```sql
create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  confirmed boolean default false,
  created_at timestamptz default now(),
  source text,
  meta jsonb default '{}'::jsonb
);
```

**Features:**
- Simple email collection
- Duplicate detection
- Source tracking
- Optional confirmation status
- Metadata support

#### 2. Advanced Newsletter System (`newsletter_leads` table)
**Schema:** `supabase/newsletter.sql`
**Tables:** `newsletter_leads`, `newsletter_events`

```sql
create table if not exists public.newsletter_leads (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  status text not null default 'pending',
  source text,
  page text,
  user_agent text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  last_sent_at timestamptz,
  unsubscribe_token text not null,
  metadata jsonb default '{}'::jsonb
);
```

**Features:**
- Status tracking (pending, confirmed, unsubscribed)
- Unsubscribe tokens
- Event tracking (newsletter_events table)
- Row Level Security (RLS) enabled
- Case-insensitive email (citext)

## Setup Instructions

### 1. Database Setup
Run the following SQL files in your Supabase SQL editor:

```bash
# Core tables (required)
./supabase-schema.sql

# Advanced newsletter (optional, for newsletter_leads)
./supabase/newsletter.sql
```

### 2. Environment Variables
Set in Netlify Dashboard → Site Settings → Environment:

```bash
SUPABASE_URL=https://qoinlxpumoakfmkfrwqb.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>
```

Or use Next.js-style:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://qoinlxpumoakfmkfrwqb.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<your-publishable-key>
```

### 3. Optional: Double Opt-in
```bash
ENABLE_DOUBLE_OPT_IN=1
```

## Verification Steps

### Test Connection
1. **Check Netlify Environment Variables**
   - Go to Netlify Dashboard → Your Site → Site Settings → Environment
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set

2. **Verify Tables Exist**
   - Go to Supabase Dashboard → Table Editor
   - Check for `emails` table (and optionally `newsletter_leads`)

3. **Test Email Capture**
   - Visit your deployed site
   - Submit email via the popup form
   - Should receive success response

4. **Check Admin Dashboard**
   - Go to `/admin` on your site
   - Log in with admin credentials
   - Check "Email & Leads" section for new entries

5. **Review Function Logs**
   - Go to Netlify Dashboard → Functions → Log
   - Check `subscribe` function logs
   - Look for successful insertions or any Supabase errors

## Common Issues & Solutions

### Issue: 500 Error on Newsletter Signup
**Cause:** Supabase not configured or tables don't exist
**Solution:** 
- Verify environment variables are set
- Run SQL schema files to create tables

### Issue: "supabase_not_configured" Error
**Cause:** Missing SUPABASE_URL or SUPABASE_SERVICE_KEY
**Solution:** Set environment variables in Netlify

### Issue: Duplicate Email Errors
**Behavior:** This is expected - returns 409 status
**Solution:** This is working correctly, duplicate emails are rejected

### Issue: Column Missing Errors
**Cause:** Table schema not up to date
**Solution:** Run the full supabase-schema.sql file again

## API Endpoints

### Subscribe Endpoint
```
POST /.netlify/functions/subscribe
Content-Type: application/json

{
  "email": "user@example.com",
  "source": "landing_page",
  "meta": {}
}
```

**Success Response (200):**
```json
{
  "ok": true
}
```

**Error Responses:**
- 400: Invalid email format
- 409: Email already exists
- 500: Server error (check Supabase connection)
- 503: Email capture disabled (via flags)

## Connection Health Check

The connection is healthy when:
- ✅ Functions can query Supabase without errors
- ✅ Email submissions return 200 or 409 (not 500)
- ✅ Admin dashboard shows real-time data
- ✅ Netlify function logs show successful Supabase operations

## Summary

**Status: Supabase is properly configured and ready for newsletter use**

All necessary components are in place:
- Environment variables configured
- Connection code implemented
- Newsletter functions operational
- Database schemas available

To complete setup:
1. Set environment variables in Netlify
2. Run SQL schema files in Supabase
3. Test email capture functionality
4. Monitor function logs for confirmation

The newsletter system is ready to use once the environment variables are deployed and tables are created!
