# DropCharge Landing Page

High-conversion gaming-credit dropsite: TikTok-ready UI, Netlify Functions, Supabase persistence.

## Stack Overview
- **Frontend:** `index.html` + `assets/` (Space Grotesk, glass UI, sticky CTA, TikTok pixel helper)
- **Serverless:** Netlify Functions in `netlify/functions/`
- **Storage:** Supabase Postgres (tables `clicks`, `emails`, `events`)
- **Admin:** `admin.html` dashboard (password protected, sessions + rate limit)

## Supabase Setup
1. Create a new Supabase project (or use existing project at `https://qoinlxpumoakfmkfrwqb.supabase.co`).
2. Run [`supabase-schema.sql`](./supabase-schema.sql) to create tables.
3. Grab **Project URL** + keys from your Supabase dashboard → set as env vars:
   - For **local development**: Copy `.env.example` to `.env` and fill in your values
   - For **production**: Set in Netlify dashboard (Site settings → Environment)

4. **Environment Variables** (choose one naming convention):

   **Standard naming (recommended for Netlify):**
   - `SUPABASE_URL=https://qoinlxpumoakfmkfrwqb.supabase.co`
   - `SUPABASE_SERVICE_KEY=sb_secret_VOTFopyG5pqE_RgYbUkYuQ_sfUDFdum` (service_role key for server-side)

   **Next.js-style naming (also supported):**
   - `NEXT_PUBLIC_SUPABASE_URL=https://qoinlxpumoakfmkfrwqb.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_WLf3k1wUdS8oCm8Jwame8A_foZ2djIF` (anon/publishable key)

   **Direct Database Access (optional):**
   - `SUPABASE_DATABASE_PASSWORD=<your-database-password>` (store password separately)
   - `DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.qoinlxpumoakfmkfrwqb.supabase.co:5432/postgres` (or use full connection string)
   - Use for running migrations, SQL scripts, or connecting database management tools
   - Get the database password from Supabase dashboard → Settings → Database
   - You can either set the password separately or embed it directly in DATABASE_URL

   > **Key Types:**
   > - **Service Key** (`sb_secret_*`): Full database permissions, use server-side only (Netlify Functions)
   > - **Publishable Key** (`sb_publishable_*`): Restricted by RLS policies, safe for client-side use
   > - **Database URL**: Direct PostgreSQL connection for migrations and admin tools
   > 
   > The system supports both naming conventions and will fallback to `NEXT_PUBLIC_*` variables if standard ones aren't set.

5. Optional environment variables:
   - `ADMIN_PASSWORD_HASH` (bcrypt hash via `node scripts/hash-password.js "pass"`)
   - `ENABLE_DOUBLE_OPT_IN=1` (keeps emails in pending state)
   - `TIKTOK_PIXEL_ID` (or override in HTML bundle)

## Local Development
```bash
# 1. Copy environment template and configure
cp .env.example .env
# Edit .env with your Supabase credentials

# 2. Install dependencies
npm install

# 3. Run dev server
npx netlify dev
```
- **netlify.toml** already defines redirects + security headers.
- `/go/*` → `go` function (logs click → Supabase → 302 affiliate).
- `/admin` + `/admin/*` → `admin-proxy` (auth gate).
- `/admin/login` → password form → `admin-login` (rate limited + audit log).

## Production Deploy
1. Push repo or use `netlify deploy --prod`.
2. Set environment variables in Netlify dashboard (Site settings → Environment):
   
   **Option 1 - Standard naming:**
   - `SUPABASE_URL=https://qoinlxpumoakfmkfrwqb.supabase.co`
   - `SUPABASE_SERVICE_KEY=<your-service-role-key>`
   
   **Option 2 - Next.js-style naming:**
   - `NEXT_PUBLIC_SUPABASE_URL=https://qoinlxpumoakfmkfrwqb.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_WLf3k1wUdS8oCm8Jwame8A_foZ2djIF`
   
   **Other required/optional variables:**
   - `ADMIN_PASSWORD_HASH=<bcrypt-hash>`
   - Optional: `SUPABASE_DATABASE_PASSWORD=<db-password>` (for direct database access)
   - Optional: `DATABASE_URL=postgresql://...` (or construct from SUPABASE_DATABASE_PASSWORD)
   - Optional: `ENABLE_DOUBLE_OPT_IN`, `TIKTOK_PIXEL_ID`, `ADMIN_ALLOWED_ORIGINS`

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
