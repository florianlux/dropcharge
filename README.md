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

## Newsletter Smoke Test

After deploying, verify the newsletter signup end-to-end:

**A) Test endpoint directly:**
```bash
curl -i -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest@example.com","source":"curl-test"}'
```
Expected: `HTTP 200` with `{"ok":true,"status":"inserted","message":"Subscribed"}`

**B) Test duplicate handling:**
```bash
curl -i -X POST https://dropcharge.io/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest@example.com","source":"curl-test"}'
```
Expected: `HTTP 200` with `{"ok":true,"status":"exists","message":"Email already subscribed"}`

**C) Test CORS preflight:**
```bash
curl -i -X OPTIONS https://dropcharge.io/.netlify/functions/newsletter_signup
```
Expected: `HTTP 200` with `Access-Control-Allow-Methods` header.

**D) Verify in Supabase:**
```sql
SELECT email, status, source, created_at
FROM newsletter_subscribers
WHERE email = 'smoketest@example.com';
```

## TODO Ideas
- Add Supabase Row Level Security / service key rotation.
- Add Webhook/email notifications on large drops.
- Build CSV export button in admin.
- Add reCAPTCHA for email capture if bots show up.
