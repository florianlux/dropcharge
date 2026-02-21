# Live Preview Feature

This document describes the Live Preview feature for deals in DropCharge.

## Overview

The Live Preview feature allows admins to preview deals (both active and inactive) on a public-facing page before they go live. This is useful for:
- Reviewing deal content and layout before activation
- Sharing preview links with team members
- Testing deal data and formatting

## Components

### 1. Public Deal Page (`/deal/:slug`)

Public route that displays a single deal by its slug.

**URL Pattern:** `https://dropcharge.netlify.app/deal/psn-20`

**Behavior:**
- Shows active deals to everyone
- Returns 404 for inactive deals (unless preview token provided)
- Displays a preview banner for inactive deals when accessed with preview token

### 2. Deal API Endpoint (`/api/deal/:slug`)

Serverless function that fetches deal data from Supabase.

**Request:**
```
GET /api/deal/psn-20
Headers:
  x-preview-token: <optional-token>
```

**Response (Active Deal):**
```json
{
  "deal": {
    "id": "uuid",
    "slug": "psn-20",
    "title": "PSN 20€",
    "description": "PlayStation Store Credit",
    "price": "17,99€",
    "active": true,
    ...
  },
  "preview": false
}
```

**Response (Inactive Deal with Token):**
```json
{
  "deal": { ... },
  "preview": true
}
```

### 3. Preview Token System

Server-side token generation for secure preview access.

**Token Format:**
- Base64-encoded: `slug:expiresAt:hmac`
- HMAC-SHA256 signed with PREVIEW_SECRET
- Valid for 5 minutes

**Admin Endpoint:**
```
POST /api/preview-token
Headers:
  x-admin-token: <admin-token>
Body:
  { "slug": "psn-20" }

Response:
{
  "ok": true,
  "token": "dGVzdC1kZWFsLTEyMzo...",
  "slug": "psn-20",
  "expiresIn": 300
}
```

### 4. Admin UI Integration

The admin interface includes a "Preview" button for each deal.

**Functionality:**
- Active deals: Opens `/deal/:slug` directly
- Inactive deals: Generates preview token and opens `/deal/:slug?preview_token=...`
- Opens in new tab
- Shows toast notification

## Setup

### Environment Variables

Set the following environment variables in your Netlify dashboard:

```bash
# Required for preview tokens
PREVIEW_SECRET=your-secure-random-string-here

# Required for admin access (already exists)
ADMIN_TOKEN=your-admin-token
```

**Generate a secure PREVIEW_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Deployment

The feature is automatically deployed with the application. No additional setup required.

## Usage

### As an Admin

1. Navigate to the admin panel: `/admin`
2. Go to "Deals & Spotlights" tab
3. Find the deal you want to preview
4. Click the "Preview" button
5. New tab opens with the deal preview
6. If the deal is inactive, you'll see a preview banner

### Preview URL Format

**Active deals (public):**
```
https://dropcharge.netlify.app/deal/psn-20
```

**Inactive deals (admin only):**
```
https://dropcharge.netlify.app/deal/psn-20?preview_token=dGVzdC1kZWFsLTEyMzo...
```

⚠️ **Security Note:** Preview URLs with tokens should be treated as sensitive. They:
- Expire after 5 minutes
- Should not be shared publicly
- Grant access to inactive deals

## Deal Status Logic

A deal is considered "active" when:
1. `active` field is `true`
2. Current time >= `starts_at` (or `starts_at` is null)
3. Current time <= `ends_at` (or `ends_at` is null)

## Testing

### Test Active Deal Preview

1. Create a deal with `active = true`
2. Click Preview button
3. Should open without token and display normally

### Test Inactive Deal Preview

1. Create a deal with `active = false`
2. Click Preview button
3. Should open with preview token and show preview banner

### Test Public Access to Inactive Deal

1. Copy preview URL and remove the `?preview_token=...` part
2. Access the URL
3. Should return 404 error

## Troubleshooting

### "PREVIEW_SECRET environment variable is not set"

**Problem:** Preview token generation fails
**Solution:** Set PREVIEW_SECRET in Netlify environment variables

### Preview token expired

**Problem:** Token no longer works after 5 minutes
**Solution:** Generate a new preview token by clicking Preview button again

### Deal not found

**Problem:** 404 error when accessing deal
**Solution:** 
- Check that the slug is correct
- Verify deal exists in database
- For inactive deals, ensure preview token is provided

### Preview banner not showing

**Problem:** Banner doesn't appear for inactive deals
**Solution:**
- Clear browser cache
- Check browser console for errors
- Verify preview token is valid

## Architecture Decisions

### Why server-side preview tokens?

- More secure than client-side tokens
- Can't be forged without PREVIEW_SECRET
- Short expiry time limits exposure
- Admin control over token generation

### Why 5-minute expiry?

- Balance between usability and security
- Long enough for typical review workflows
- Short enough to limit unauthorized access
- Easy to regenerate if needed

### Why query parameter for token?

- Allows sharing complete preview URLs
- Works with browser navigation
- Can be easily copied and pasted
- Token is moved to header in API request for security

## Future Enhancements

Potential improvements for future versions:

- [ ] Custom token expiry times
- [ ] Token usage tracking
- [ ] Preview analytics
- [ ] Shareable preview links with extended expiry
- [ ] Preview history in admin panel
- [ ] Preview comments/feedback system
