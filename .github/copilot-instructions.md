# Copilot Instructions for DropCharge

## Project Overview
DropCharge is a high-conversion gaming-credit landing page with TikTok-ready UI, Netlify Functions serverless backend, and Supabase Postgres persistence.

## Stack
- **Frontend:** Static HTML/CSS/JS (`index.html`, `admin.html`, `admin-login.html`, `assets/`)
- **Serverless:** Netlify Functions (`netlify/functions/`) — Node.js CommonJS modules
- **Database:** Supabase Postgres (tables: `clicks`, `emails`, `events`, `newsletter_subscribers`)
- **Testing:** Playwright E2E tests (`tests/`, `playwright.config.ts`)

## Repository Structure
```
assets/          # Client-side JS, CSS, images
netlify/
  functions/     # Serverless functions (Node.js CommonJS)
  functions/_lib # Shared helpers (supabase client, auth, etc.)
scripts/         # Utility scripts (e.g. hash-password.js)
tests/           # Playwright E2E tests
docs/            # Documentation
ops/             # Operational scripts
supabase/        # Supabase migrations/config
```

## How to Build & Run
```bash
# Install dependencies
npm install

# Run locally with Netlify Dev (requires env vars)
npx netlify dev

# Run E2E tests (requires PLAYWRIGHT_BASE_URL and ADMIN_TOKEN)
PLAYWRIGHT_BASE_URL=https://dropchargeadmin.netlify.app \
ADMIN_TOKEN=<token> \
npx playwright test
```

## Environment Variables
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (preferred); legacy alias `SUPABASE_SERVICE_KEY` is also accepted |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password |
| `RESEND_API_KEY` | Optional — enables welcome emails via Resend |
| `ENABLE_DOUBLE_OPT_IN` | Set to `1` to hold signups in pending state |
| `TIKTOK_PIXEL_ID` | TikTok Pixel ID for analytics |

Generate a bcrypt password hash:
```bash
node scripts/hash-password.js "yourpassword"
```

## Coding Conventions
- Netlify Functions use **CommonJS** (`require`/`module.exports`), not ES modules.
- Shared database/auth helpers live in `netlify/functions/_lib/` — reuse them instead of duplicating.
- Always return proper CORS headers from functions (see existing functions for the pattern).
- Hash/anonymise any PII (e.g. IP addresses) before storing in Supabase.
- Admin endpoints must validate the session token via the shared auth helper.
- Client-side code targets modern evergreen browsers — no transpilation step.

## Testing
- E2E tests are in `tests/` and use Playwright.
- Tests that need a live environment are guarded with `test.skip(!ADMIN_TOKEN, ...)`.
- Run a specific test file: `npx playwright test tests/admin-actions.spec.ts`
- There is no unit test framework; logic should be tested via E2E or manual `curl` commands (see README for examples).

## Security Notes
- Never commit secrets or `.env` files.
- Admin routes are protected by bcrypt + rate limiting + httpOnly session cookies.
- CSP and security headers are defined in `netlify.toml` — keep them strict.
- `robots.txt` disallows `/admin`; admin pages inject `noindex, nofollow`.
