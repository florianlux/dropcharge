# Newsletter Signup Deployment Guide

## Overview
This guide covers deployment steps and requirements for the newsletter signup functionality.

## Prerequisites

### Required Environment Variables
Ensure the following environment variables are set in Netlify:

1. **SUPABASE_URL**
   - Your Supabase project URL
   - Example: `https://xxxxxxxxxxxxx.supabase.co`
   - Location: Supabase Dashboard → Settings → API

2. **SUPABASE_SERVICE_KEY**
   - Supabase service role key (not anon key!)
   - Example: `eyJhbGci...`
   - Location: Supabase Dashboard → Settings → API
   - ⚠️ Keep this secret! Service role bypasses Row Level Security

### Database Requirements
The `newsletter_subscribers` table must exist with the following schema:

```sql
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text default 'active',
  created_at timestamptz default now(),
  unsubscribed_at timestamptz,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  last_sent_at timestamptz,
  meta jsonb default '{}'::jsonb
);

create unique index if not exists newsletter_subscribers_email_unique 
  on public.newsletter_subscribers ((lower(email)));

create index if not exists newsletter_subscribers_status_idx 
  on public.newsletter_subscribers (status);

create index if not exists newsletter_subscribers_created_idx 
  on public.newsletter_subscribers (created_at desc);
```

This schema already exists in `supabase-schema.sql` and should be applied to your Supabase database.

## Deployment Steps

### 1. Verify Database Schema
```bash
# Connect to your Supabase database and verify the table exists
psql $DATABASE_URL -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'newsletter_subscribers';
"
```

### 2. Set Environment Variables in Netlify

#### Via Netlify UI:
1. Go to Netlify Dashboard
2. Select your site (dropcharge)
3. Go to Site settings → Environment variables
4. Add/verify:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`

#### Via Netlify CLI:
```bash
netlify env:set SUPABASE_URL "https://xxxxxxxxxxxxx.supabase.co"
netlify env:set SUPABASE_SERVICE_KEY "eyJhbGci..."
```

### 3. Deploy to Netlify

#### Automatic Deployment (Recommended):
```bash
# Push to your repository
git push origin main

# Netlify will automatically deploy
```

#### Manual Deployment:
```bash
# Build and deploy
netlify deploy --prod

# Or deploy specific directory
netlify deploy --prod --dir=.
```

### 4. Verify Deployment

#### Check Function Status:
```bash
# List all functions
netlify functions:list

# Should show newsletter_signup
```

#### Test the Endpoint:
```bash
# Replace with your actual domain
curl -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "source": "deployment_test",
    "consent": true
  }'
```

Expected response: `{"ok":true,"status":"inserted","message":"Successfully subscribed"}`

### 5. Monitor Initial Signups

#### Check Netlify Function Logs:
1. Netlify Dashboard → Functions
2. Click on `newsletter_signup`
3. View logs tab

#### Check Supabase Database:
```sql
-- View recent signups
SELECT 
  email, 
  status, 
  source, 
  created_at 
FROM newsletter_subscribers 
ORDER BY created_at DESC 
LIMIT 10;
```

## Rollback Plan

If issues arise after deployment:

### 1. Quick Rollback (Netlify)
```bash
# List recent deploys
netlify deploys:list

# Rollback to previous deploy
netlify rollback
```

### 2. Disable Function (Emergency)
If you need to immediately disable the function:
- Rename the function file temporarily
- Redeploy

### 3. Database Rollback
If bad data was inserted:
```sql
-- Remove test entries
DELETE FROM newsletter_subscribers 
WHERE email LIKE '%@example.com';

-- Or remove all entries from specific time
DELETE FROM newsletter_subscribers 
WHERE created_at > '2024-01-01 12:00:00';
```

## Post-Deployment Checklist

- [ ] Environment variables are set correctly
- [ ] Database table exists with correct schema
- [ ] Function deploys successfully
- [ ] Test endpoint with curl (new email)
- [ ] Test endpoint with curl (duplicate email)
- [ ] Test endpoint with invalid email
- [ ] Test UI popup flow
- [ ] Verify data appears in Supabase
- [ ] Check Netlify function logs for errors
- [ ] Monitor first 10-20 signups

## Monitoring & Maintenance

### Key Metrics to Track
1. **Signup Success Rate**: Successful signups / Total attempts
2. **Duplicate Rate**: 409 responses / Total requests
3. **Error Rate**: 5xx responses / Total requests
4. **Response Time**: p50, p95, p99 latencies

### Netlify Function Logs
Monitor for:
- Database connection errors
- Validation errors
- Unexpected 500 errors

### Supabase Metrics
Monitor:
- Connection pool usage
- Query performance
- Storage usage

## Common Issues & Solutions

### Issue: 500 Error - "Service not configured"
**Cause**: Supabase environment variables not set or incorrect
**Solution**: 
```bash
netlify env:get SUPABASE_URL
netlify env:get SUPABASE_SERVICE_KEY
# Verify both are set correctly
```

### Issue: 500 Error - "Database error"
**Cause**: Table doesn't exist or schema mismatch
**Solution**: Apply schema from `supabase-schema.sql`

### Issue: Emails not saving
**Cause**: Using anon key instead of service key
**Solution**: Ensure `SUPABASE_SERVICE_KEY` is the service role key

### Issue: Duplicate emails with different cases
**Cause**: Index not using `lower(email)`
**Solution**: Recreate unique index:
```sql
DROP INDEX IF EXISTS newsletter_subscribers_email_unique;
CREATE UNIQUE INDEX newsletter_subscribers_email_unique 
  ON newsletter_subscribers ((lower(email)));
```

### Issue: Function times out
**Cause**: Supabase connection issues or slow queries
**Solution**: 
- Check Supabase status
- Verify indexes exist
- Consider connection pooling

## Performance Optimization

### Current Performance
- New signup: ~300-500ms (includes database write)
- Duplicate check: ~200-300ms (index lookup only)
- Invalid email: ~50ms (no database call)

### If Performance Degrades
1. Add indexes on frequently queried columns
2. Consider connection pooling
3. Implement caching for duplicate checks
4. Add rate limiting to prevent abuse

## Security Considerations

### Current Security Features
- ✅ Email validation (regex check)
- ✅ Email normalization (lowercase, trim)
- ✅ Unique constraint (no duplicates)
- ✅ Service key (not exposed to frontend)
- ✅ HTTPS only
- ✅ POST method only

### Additional Security (Optional)
1. **Rate Limiting**: Add per-IP rate limiting
2. **Captcha**: Add hCaptcha or reCAPTCHA
3. **Email Verification**: Add double opt-in flow
4. **Honeypot Field**: Add hidden field to catch bots

## Maintenance Schedule

### Weekly
- [ ] Review signup metrics
- [ ] Check error logs
- [ ] Verify database growth

### Monthly
- [ ] Review and optimize queries
- [ ] Check for suspicious patterns
- [ ] Update dependencies

### Quarterly
- [ ] Review security practices
- [ ] Performance audit
- [ ] Backup verification

## Support & Contact

For issues related to:
- **Netlify Functions**: Check Netlify docs or support
- **Supabase**: Check Supabase docs or dashboard
- **Code Issues**: Open issue in repository

## Related Documentation
- [Testing Guide](./NEWSLETTER_TESTING.md)
- [Implementation Notes](./IMPLEMENTATION.md)
- [Newsletter Pipeline](../ops/newsletter.md)
