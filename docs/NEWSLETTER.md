# DropCharge Newsletter System

## Architecture

```
Frontend popup (index.html / app.js)
  └─ POST /.netlify/functions/newsletter_signup
       ├─ Upsert → newsletter_leads (Supabase)
       ├─ Event  → newsletter_events (audit)
       └─ Welcome email → Resend API

Admin dashboard (admin.html / admin.js)
  ├─ GET  /.netlify/functions/admin-list-leads   → paginated leads
  ├─ GET  /.netlify/functions/admin-export-leads  → CSV download
  └─ POST /.netlify/functions/admin-send-campaign → bulk campaign

Unsubscribe
  └─ GET /unsubscribe?token=... → /.netlify/functions/unsubscribe
```

## Supabase Schema

Defined in `supabase/newsletter.sql`:

- **`newsletter_leads`** – email (citext, unique), status (`pending|confirmed|unsubscribed|bounced`), source, page, user_agent, timestamps, `unsubscribe_token` (auto-generated hex), metadata (JSONB).
- **`newsletter_events`** – audit log per lead (`created`, `welcome_sent`, `lead_updated`, …).
- Row Level Security enabled; functions use the service role key to bypass RLS.

## Netlify Functions

| Function | Method | Auth | Description |
|---|---|---|---|
| `newsletter_signup` | POST | public | Email capture, Supabase upsert, Resend welcome |
| `newsletter-signup` | POST | public | Alias → `newsletter_signup` |
| `unsubscribe` | GET | token param | Mark lead as unsubscribed |
| `admin-list-leads` | GET | `x-admin-token` | Paginated leads list with search/filter |
| `admin-export-leads` | GET | `x-admin-token` | CSV export |
| `admin-send-campaign` | POST | `x-admin-token` | Batch campaign sends via Resend |

## Required Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (bypasses RLS) |
| `RESEND_API_KEY` | Resend email provider API key |
| `EMAIL_FROM` | Sender address, e.g. `DropCharge <news@dropcharge.io>` |
| `PUBLIC_BASE_URL` | Public site URL for unsubscribe links, e.g. `https://dropcharge.io` |
| `ADMIN_TOKEN` | Admin API authentication token |
| `EMAIL_API_KEY` | Resend key used by campaign sender |

## Signup Flow

1. User visits landing page → popup appears after 5 seconds.
2. User enters email → `POST /.netlify/functions/newsletter_signup`.
3. Function validates email, upserts into `newsletter_leads`, logs event.
4. If new subscriber: sends welcome email via Resend with unsubscribe link.
5. Returns `{ ok: true, status: "inserted" | "exists" }`.
6. Frontend shows confirmation message.

## Unsubscribe Flow

1. Welcome email (and campaign emails) contain `${PUBLIC_BASE_URL}/unsubscribe?token=<hex>`.
2. Netlify redirect sends `/unsubscribe` → `/.netlify/functions/unsubscribe`.
3. Function looks up lead by token, sets `status: 'unsubscribed'` and `unsubscribed_at`.
4. Returns German-language HTML confirmation.

## Campaign Sending

`admin-send-campaign` supports:
- **Test mode**: `{ testEmail: "test@example.com" }` sends to one address.
- **Bulk mode**: fetches all `pending`/`confirmed` leads from `newsletter_leads`.
- Batch processing with configurable `CAMPAIGN_BATCH_SIZE` (default 50) and delay.
- Auto-appends unsubscribe footer if `__UNSUB__` placeholder not present.
- Rate-limited to one campaign per 5 minutes.
- Logs campaigns to the `campaigns` table.
