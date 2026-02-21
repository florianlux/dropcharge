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
   - `SUPABASE_SERVICE_ROLE_KEY` (also accepted: `SUPABASE_SERVICE_KEY`)
4. Optional envs:
   - `ADMIN_TOKEN` (token for admin API calls)
   - `ADMIN_PASSWORD_HASH` (bcrypt hash via `node scripts/hash-password.js "pass"`)
   - `ADMIN_ALLOWED_ORIGINS` (comma-separated allowed CORS origins)
   - `TIKTOK_PIXEL_ID` (or override in HTML bundle)

## Netlify Deployment
```bash
# install deps, run dev
npm install
npx netlify dev
```

### Local testing with curl

```bash
# Newsletter signup (success)
curl -s -X POST http://localhost:8888/.netlify/functions/newsletter_signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'

# Newsletter signup (duplicate – returns ok with status "exists")
curl -s -X POST http://localhost:8888/.netlify/functions/newsletter_signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'

# Track event
curl -s -X POST http://localhost:8888/.netlify/functions/track-event \
  -H 'Content-Type: application/json' \
  -d '{"name":"ViewContent"}'

# Spotlight
curl -s http://localhost:8888/.netlify/functions/spotlight
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
- Popup after 5 s, stores email in Supabase.
- Duplicate submissions ignored.
- Double opt-in ready via env flag.

## Security & Robots
- `/admin` pages inject `noindex, nofollow` meta; `robots.txt` disallows `/admin`.
- Security headers defined in `netlify.toml` (CSP, HSTS ready, frame busting).
- Login protected with bcrypt hash + rate limiting + session cookies (httpOnly, SameSite=Lax, Secure in prod).

## Development Notes
- `scripts/hash-password.js` → generate bcrypt hash for admin password.
- `assets/app.js` handles sticky CTA, click counters, popup, TikTok tracking.
- For local testing without Supabase env, functions will error (set envs or mock Supabase).

## TODO Ideas
- Add Supabase Row Level Security / service key rotation.
- Add Webhook/email notifications on large drops.
- Build CSV export button in admin.
- Add reCAPTCHA for email capture if bots show up.
