# Newsletter Signup Testing Guide

## Overview
This guide provides test cases and curl commands to validate the newsletter signup endpoint.

## Endpoint
`POST /.netlify/functions/newsletter_signup`

## Expected Response Format
```json
{
  "ok": boolean,
  "status": "inserted" | "exists" | "reactivated",
  "message": string,
  "error": string (only on failure)
}
```

## Test Cases

### 1. Successful Signup (New Email)
**Request:**
```bash
curl -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "source": "popup",
    "page": "/",
    "utm": {
      "utm_source": "test",
      "utm_campaign": "manual_test"
    },
    "consent": true
  }'
```

**Expected Response:**
- Status Code: `200`
- Body:
```json
{
  "ok": true,
  "status": "inserted",
  "message": "Successfully subscribed"
}
```

### 2. Duplicate Signup (Already Subscribed)
**Request:**
```bash
curl -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existing@example.com",
    "source": "popup",
    "page": "/",
    "consent": true
  }'
```

**Expected Response:**
- Status Code: `409`
- Body:
```json
{
  "ok": true,
  "status": "exists",
  "message": "Email already subscribed"
}
```

### 3. Invalid Email Format
**Request:**
```bash
curl -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "source": "popup",
    "consent": true
  }'
```

**Expected Response:**
- Status Code: `400`
- Body:
```json
{
  "ok": false,
  "error": "invalid_email"
}
```

### 4. Missing Email
**Request:**
```bash
curl -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{
    "source": "popup",
    "consent": true
  }'
```

**Expected Response:**
- Status Code: `400`
- Body:
```json
{
  "ok": false,
  "error": "Email is required"
}
```

### 5. Invalid JSON Body
**Request:**
```bash
curl -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d 'invalid json'
```

**Expected Response:**
- Status Code: `400`
- Body:
```json
{
  "ok": false,
  "error": "Invalid JSON body"
}
```

### 6. Wrong HTTP Method
**Request:**
```bash
curl -X GET https://dropcharge.io/.netlify/functions/newsletter_signup
```

**Expected Response:**
- Status Code: `405`
- Body:
```json
{
  "ok": false,
  "error": "Method not allowed"
}
```

### 7. Reactivation (Previously Unsubscribed)
**Request:**
```bash
curl -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "unsubscribed@example.com",
    "source": "popup",
    "consent": true
  }'
```

**Expected Response:**
- Status Code: `200`
- Body:
```json
{
  "ok": true,
  "status": "reactivated",
  "message": "Subscription reactivated"
}
```

## Email Normalization Tests

The endpoint normalizes emails by:
- Converting to lowercase
- Trimming whitespace

```bash
# These should all be treated as the same email
curl -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{"email": "Test@Example.COM", "source": "test", "consent": true}'

curl -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{"email": "  test@example.com  ", "source": "test", "consent": true}'
```

## Database Verification

After successful signup, verify in Supabase:

```sql
-- Check if email was inserted
SELECT 
  id, 
  email, 
  status, 
  source, 
  utm_source, 
  utm_campaign, 
  created_at 
FROM newsletter_subscribers 
WHERE email = 'newuser@example.com';

-- Count total subscribers
SELECT status, COUNT(*) 
FROM newsletter_subscribers 
GROUP BY status;
```

## Frontend Testing

### Manual UI Testing
1. Open https://dropcharge.io
2. Wait 5 seconds for popup to appear
3. Enter email and submit
4. Verify:
   - Button shows "Lädt..." during submission
   - Success message appears ("✅ Danke! Check dein Postfach.")
   - Popup closes after 2.5 seconds

### Test Cases in Browser
1. **Valid new email**: Should show success message
2. **Same email twice**: Second attempt should show "✅ Du bist schon eingetragen."
3. **Invalid email**: Should show alert "Bitte eine gültige E-Mail eingeben."
4. **Empty email**: Browser validation should prevent submission

## Local Testing with Netlify CLI

If you want to test locally:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Set up environment variables in .env file
# SUPABASE_URL=your_url
# SUPABASE_SERVICE_KEY=your_key

# Start local dev server
netlify dev

# Test endpoint
curl -X POST http://localhost:8888/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@local.dev",
    "source": "local_test",
    "consent": true
  }'
```

## Troubleshooting

### 500 Internal Server Error
- Check Supabase connection (SUPABASE_URL and SUPABASE_SERVICE_KEY env vars)
- Check function logs in Netlify dashboard
- Verify `newsletter_subscribers` table exists in Supabase

### 409 on First Signup
- Email already exists in database
- Check for case-insensitive duplicates (the unique index uses `lower(email)`)

### No Response/Timeout
- Check network connectivity
- Verify Netlify function deployment status
- Check Netlify function logs for errors

## Performance Notes
- Typical response time: 200-500ms
- Database query uses index on `lower(email)` for fast lookups
- Single database roundtrip for new signups
- Two database operations for existing emails (check + insert)
