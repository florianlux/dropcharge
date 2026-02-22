# DropCharge Landing Page

High-conversion gaming-credit dropsite: TikTok-ready UI, Netlify Functions, Supabase persistence.

## Stack Overview
- **Frontend:** `index.html` + `assets/` (Space Grotesk, glass UI, sticky CTA, TikTok pixel helper)
- **Serverless:** Netlify Functions in `netlify/functions/`
- **Storage:** Supabase Postgres (tables `clicks`, `emails`, `events`)
- **Admin:** `admin.html` dashboard (password protected, sessions + rate limit)

## Supabase Setup
1. Create a new Supabase project.
2. Run [`supabase-schema.sql`](./supabase-schema.sql) to create tables.
3. Grab **Project URL** + **service_role key** → set as Netlify env vars:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Optional envs:
   - `RESEND_API_KEY` (optional – enables welcome email on newsletter signup; signup works without it)
   - `ADMIN_PASSWORD_HASH` (bcrypt hash via `node scripts/hash-password.js "pass"`)
   - `ENABLE_DOUBLE_OPT_IN=1` (keeps emails in pending state)
   - `TIKTOK_PIXEL_ID` (or override in HTML bundle)

## Netlify Deployment
```bash
# install deps, run dev
cd price-compare-site
npm install
npx netlify dev
```
- **netlify.toml** already defines redirects + security headers.
- `/go/*` → `go` function (logs click → Supabase → 302 affiliate).
- `/admin` + `/admin/*` → `admin-proxy` (auth gate).
- `/admin/login` → password form → `admin-login` (rate limited + audit log).

### Production Deploy
1. Push repo or use `netlify deploy --prod`.
2. Set ENV variables (Site settings → Environment).
3. Point domain DNS (CNAME to `<site>.netlify.app` or Netlify nameservers).
4. After deploy: visit `/admin/login`, enter plaintext password (hash stored in env), verify dashboard stats (clicks/emails/events show from Supabase).

## Admin Dashboard
- Live feed of clicks (IP hashed, geo country, UTMs, referrer).
- Email KPI (count + conversion) + latest signups table.
- Toast notification on new clicks.
- Email list + click list fetch Supabase every 15 s.

## Tracking & Pixel
- TikTok pixel bootstrap in `<head>` (set `window.TIKTOK_PIXEL_ID="TT-XXXX"`).
- Events fired client-side + persisted server-side via `track-event` function:
  - `ViewContent`
  - `TimeOnPage15s`
  - `ScrollDepth` (≥60%)
  - `ClickOutbound` (per /go click)

## Email Capture
- Popup after 5 s, stores email in Supabase `newsletter_subscribers` table.
- Duplicate submissions return `{ ok:true, status:"exists" }` (no error).
- Welcome email sent via Resend if `RESEND_API_KEY` is set; signup succeeds without it.
- Double opt-in ready via env flag.

### Testing Newsletter Signup

```bash
# Local (netlify dev)
curl -X POST http://localhost:8888/.netlify/functions/newsletter_signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","source":"curl"}'

# Production
curl -X POST https://YOUR-SITE.netlify.app/.netlify/functions/newsletter_signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","source":"curl"}'

# OPTIONS (CORS preflight)
curl -X OPTIONS http://localhost:8888/.netlify/functions/newsletter_signup -i

# GET → 405
curl http://localhost:8888/.netlify/functions/newsletter_signup
```

## Security & Robots
- `/admin` pages inject `noindex, nofollow` meta; `robots.txt` disallows `/admin`.
- Security headers defined in `netlify.toml` (CSP, HSTS ready, frame busting).
- Login protected with bcrypt hash + rate limiting + session cookies (httpOnly, SameSite=Lax, Secure in prod).

## Development Notes
- `scripts/hash-password.js` → generate bcrypt hash for admin password.
- `assets/app.js` handles sticky CTA, click counters, popup, TikTok tracking.
- For local testing without Supabase env, functions will error (set envs or mock Supabase).

## Admin Setup

The admin dashboard (`/admin.html`) provides subscriber management, campaign sending, tracking links, and analytics.

### Required Environment Variables

Set these in **Netlify → Site settings → Environment variables** (scope: _All scopes_ or at least _Functions_):

| Variable | Required | Description |
|---|---|---|
| `ADMIN_TOKEN` | **Yes** | Secret token for admin API access. The client sends this via `x-admin-token` header. |
| `SUPABASE_URL` | **Yes** | Your Supabase project URL (e.g. `https://xyz.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase service-role key (not the anon key). |
| `RESEND_API_KEY` | **Yes** (for email) | Resend API key for sending campaigns and welcome emails. |
| `RESEND_FROM` | **Yes** (for email) | Sender address (e.g. `DropCharge <noreply@dropcharge.de>`). Must be verified in Resend. |
| `PUBLIC_SITE_URL` | Optional | Base URL for unsubscribe links etc. Defaults to `https://dropcharge.io`. |
| `EMAIL_REPLY_TO` | Optional | Reply-to address for campaign emails. |
| `RESEND_FALLBACK_FROM` | Optional | Fallback sender address used if `RESEND_FROM` is not set (useful for testing before domain verification). |

### Email Diagnostics

- **`GET /.netlify/functions/email-health`** – Returns env/DB status (no auth required).
- **`GET /.netlify/functions/email-debug`** – Returns current sender config and sample payload (admin auth required).

### Admin Login

1. Navigate to `/admin-login.html` (or `/admin/login`).
2. Enter your `ADMIN_TOKEN` value. It is stored in `localStorage` as `admin_token`.
3. All API requests include the header `x-admin-token: <your-token>`.

### Database Migrations

Run the SQL files in `supabase/migrations/` in order against your Supabase project:

1. `001_safe_schema_sync.sql` – adds `source`, `last_sent_at` columns, settings table
2. `002_campaigns_and_columns.sql` – adds `newsletter_campaigns` table, `unsubscribed_at` column, ensures click/event columns
3. `003_spin_wheel_newsletter.sql` – spin wheel feature integration
4. `004_email_logs.sql` – creates `email_logs` table for tracking all outbound email events

**Required tables:**

| Table | Purpose |
|---|---|
| `newsletter_subscribers` | Subscriber list (email, status, source) |
| `newsletter_campaigns` | Campaign send history |
| `email_logs` | Per-email delivery log (recipient, status, template, errors) |
| `clicks` | Tracking link click log |
| `events` | Custom event log (page views, scrolls, etc.) |

To apply migrations, open your **Supabase SQL Editor** and run each file in order.
If the `email_logs` table is missing, the admin Email Logs section will show a warning with instructions.

### Testing (curl)

```bash
# List leads
curl -H "x-admin-token: YOUR_TOKEN" \
  https://YOUR-SITE.netlify.app/.netlify/functions/admin-list-leads?status=active

# Send test email
curl -X POST -H "x-admin-token: YOUR_TOKEN" -H "Content-Type: application/json" \
  -d '{"subject":"Test","html":"<h1>Hello</h1>","testEmail":"you@example.com"}' \
  https://YOUR-SITE.netlify.app/.netlify/functions/admin-send-campaign

# Email logs (smoke test)
curl -i -H "x-admin-token: YOUR_TOKEN" \
  https://YOUR-SITE.netlify.app/.netlify/functions/admin-email-logs

# Analytics
curl -H "x-admin-token: YOUR_TOKEN" \
  https://YOUR-SITE.netlify.app/.netlify/functions/admin-analytics
```

## TODO Ideas
- Add Supabase Row Level Security / service key rotation.
- Add Webhook/email notifications on large drops.
- Build CSV export button in admin.
- Add reCAPTCHA for email capture if bots show up.
