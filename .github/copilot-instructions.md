# Copilot Instructions for DropCharge

## Project Overview
DropCharge is a high-conversion gaming-credit landing page optimised for social (TikTok) traffic. It consists of a static frontend, Netlify serverless functions, and a Supabase Postgres backend.

## Tech Stack
- **Frontend:** Static HTML/CSS/JS (`index.html`, `admin.html`, `admin-login.html`, `spin.html`, `assets/`)
- **Serverless Functions:** Node.js CommonJS modules in `netlify/functions/` (deployed via Netlify)
- **Database:** Supabase Postgres — tables: `clicks`, `emails`, `events`, `newsletter_subscribers`, `newsletter_campaigns`, `settings`
- **Email:** Resend API (optional — signup still works without it)
- **Testing:** Playwright E2E tests in `tests/` (run with `npx playwright test`)
- **Package manager:** npm (`package.json`, `package-lock.json`)

## Repository Structure
```
netlify/functions/   # Serverless function handlers (CommonJS .js files)
netlify/functions/_lib/  # Shared helpers (supabase client, auth, etc.)
assets/              # Frontend JS/CSS
tests/               # Playwright E2E tests
scripts/             # Utility scripts (e.g. hash-password.js)
supabase/migrations/ # SQL migration files (run in order)
docs/                # Additional documentation
```

## Coding Conventions
- All Netlify functions are **CommonJS** (`require`/`module.exports`). Do not use ESM `import`/`export` in function files.
- Keep shared logic in `netlify/functions/_lib/`.
- Return JSON responses with appropriate HTTP status codes and CORS headers.
- Admin endpoints must verify the `x-admin-token` request header against the `ADMIN_TOKEN` environment variable.
- Never log or expose secrets; hash passwords with `bcryptjs`.

## Environment Variables
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key |
| `ADMIN_TOKEN` | Secret token for admin API access |
| `RESEND_API_KEY` | Resend API key (optional – enables emails) |
| `EMAIL_FROM` | Sender address for campaigns |
| `APP_BASE_URL` | Base URL for unsubscribe links (optional) |
| `EMAIL_REPLY_TO` | Reply-to for campaigns (optional) |
| `ADMIN_PASSWORD_HASH` | bcrypt hash for legacy admin login |
| `ENABLE_DOUBLE_OPT_IN` | Set to `1` to require email confirmation |
| `TIKTOK_PIXEL_ID` | TikTok pixel ID |

## How to Run Locally
```bash
npm install
npx netlify dev   # starts local dev server on http://localhost:8888
```

## How to Test
```bash
# Run E2E tests (requires ADMIN_TOKEN and a live deployment)
ADMIN_TOKEN=<token> PLAYWRIGHT_BASE_URL=https://<your-site>.netlify.app npx playwright test

# Hash an admin password
node scripts/hash-password.js "yourpassword"
```

## Database Migrations
Run SQL files in `supabase/migrations/` in numeric order against your Supabase project before deploying.

## Deployment
- Push to the connected GitHub branch, or run `netlify deploy --prod`.
- Set all required environment variables under **Netlify → Site settings → Environment variables**.
- The `netlify.toml` defines redirects, function directory, and security headers — do not remove existing headers.

## Security Notes
- Admin routes inject `noindex, nofollow`; `robots.txt` disallows `/admin`.
- Security headers (CSP, HSTS, X-Frame-Options, etc.) are set in `netlify.toml` — keep them intact.
- Rate limiting and bcrypt are used for admin login.
- Do not commit secrets or API keys to the repository.
