# Copilot Instructions for DropCharge

## Project Overview
DropCharge is a high-conversion gaming-credit landing page ("dropsite") optimized for social (TikTok) traffic. It is a static frontend hosted on Netlify with serverless backend functions and Supabase as the database.

## Tech Stack
- **Frontend:** Static HTML/CSS/JS (`index.html`, `admin.html`, `admin-login.html`, `assets/`)
- **Serverless functions:** Netlify Functions (Node.js, CommonJS) in `netlify/functions/`
- **Database:** Supabase Postgres — tables `clicks`, `emails`, `events`
- **Shared helpers:** `netlify/functions/_lib/` (Supabase client, auth utilities, etc.)
- **E2E tests:** Playwright (`tests/`, config in `playwright.config.ts`)

## Repository Structure
```
.
├── assets/            # Frontend JS/CSS (app.js, styles, images)
├── netlify/
│   └── functions/     # Netlify serverless functions (Node CommonJS)
│       └── _lib/      # Shared helpers (supabase client, auth, etc.)
├── scripts/           # Utility scripts (e.g. hash-password.js)
├── tests/             # Playwright E2E tests
├── docs/              # Additional documentation
├── index.html         # Main landing page
├── admin.html         # Admin dashboard (auth-gated)
├── admin-login.html   # Admin login page
├── netlify.toml       # Netlify build + redirect + security-header config
├── supabase-schema.sql  # Database schema
└── package.json
```

## Development Guidelines

### Netlify Functions
- All functions live in `netlify/functions/` and use **CommonJS** (`require`/`module.exports`).
- Shared utilities (Supabase client, CORS helpers, auth middleware) are in `netlify/functions/_lib/`. Always reuse these instead of duplicating logic.
- Functions must return a valid Netlify handler response: `{ statusCode, headers, body }`.
- Always set appropriate CORS headers using the shared helper.
- Use the `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` environment variables — never hardcode credentials.

### Security
- Admin routes are protected with bcrypt-hashed passwords (`ADMIN_PASSWORD_HASH` env var) + rate limiting + httpOnly session cookies.
- Never expose service-role keys to the client.
- All security headers (CSP, HSTS, X-Frame-Options, etc.) are defined in `netlify.toml` — update them there, not in individual functions.
- Validate and sanitise all user inputs server-side in Netlify Functions.

### Frontend
- The UI uses plain HTML/CSS/JS — no framework. Keep changes vanilla.
- TikTok Pixel integration is in `assets/app.js`. Fire client-side events and also persist them server-side via the `track-event` function.
- Admin pages must inject `<meta name="robots" content="noindex, nofollow">` and are blocked via `robots.txt`.

### Database (Supabase)
- Schema is defined in `supabase-schema.sql`. When adding tables or columns, update this file.
- Use the Supabase JS client from `_lib/` rather than raw fetch calls.
- Duplicate email submissions should be ignored (upsert / conflict handling).

### Environment Variables
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service-role key (server only) |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password |
| `ENABLE_DOUBLE_OPT_IN` | Set to `1` to keep emails in pending state |
| `TIKTOK_PIXEL_ID` | TikTok pixel identifier |

## Testing
- **E2E tests** use [Playwright](https://playwright.dev/). Run with:
  ```bash
  npx playwright test
  ```
- Tests require a live Netlify deployment. Set `PLAYWRIGHT_BASE_URL` (defaults to `https://dropchargeadmin.netlify.app`).
- Admin tests additionally require `ADMIN_TOKEN` to be set.
- There is currently no unit-test suite. Prefer adding Playwright tests for new features that have a UI or API surface.
- Do **not** remove or skip existing tests unless the underlying feature is removed.

## Code Style
- Use 2-space indentation for JS/HTML/CSS.
- Prefer `const`/`let` over `var`.
- Keep functions small and focused. Extract shared logic into `_lib/`.
- Match the existing comment style in each file — do not add unnecessary comments.

## Common Tasks

### Adding a new Netlify Function
1. Create `netlify/functions/<name>.js` (CommonJS).
2. Reuse the Supabase client from `_lib/supabase.js`.
3. Add a redirect in `netlify.toml` if needed.
4. Handle errors gracefully and return appropriate HTTP status codes.

### Changing security headers
Edit the `[[headers]]` blocks in `netlify.toml`.

### Generating an admin password hash
```bash
node scripts/hash-password.js "your-password"
```
Set the output as the `ADMIN_PASSWORD_HASH` environment variable in Netlify.
