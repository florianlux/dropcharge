# DropCharge Newsletter Pipeline

## Flow
1. Frontend popup (`assets/app.js`) POSTs to `/.netlify/functions/newsletter_signup`.
2. Netlify function validates, inserts into `newsletter_subscribers` via service role, optionally sends welcome mail (Resend).
3. Admin dashboard (`Email & Leads` tab) calls:
   - `/.netlify/functions/admin-list-leads`
   - `/.netlify/functions/admin-export-leads`
4. Users can unsubscribe via `/unsubscribe?token=...` handled by Netlify function `unsubscribe.js`.

## Supabase Schema
Defined in `supabase-schema.sql`:
- `newsletter_subscribers`: email (unique), status (`active|unsubscribed`), source, utm fields, timestamps, last_sent_at, meta.

## Required ENV (Netlify)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (service role)
- `RESEND_API_KEY`
- `EMAIL_FROM` (e.g. `DropCharge <news@dropcharge.io>`)
- `PUBLIC_BASE_URL` (e.g. `https://dropcharge.io`)
- `ADMIN_TOKEN` (existing admin auth header)

## Admin API
- `/.netlify/functions/admin-list-leads` → JSON list, filters `status`, `search`.
- `/.netlify/functions/admin-export-leads` → CSV download.
- Auth via `Authorization: Bearer <ADMIN_TOKEN>` (handled in `buildHeaders`).

## Unsubscribe
- Unique token stored per lead.
- Link inside welcome mail: `${PUBLIC_BASE_URL}/unsubscribe?token=...`.
- Function marks status `unsubscribed` + timestamp.
