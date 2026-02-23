# Environment Variables

All environment variables used by DropCharge. Set these in **Netlify → Site settings → Environment variables**.

## Required

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-side only, never expose to client) |
| `ADMIN_TOKEN` | Secret token for admin API access. Sent via `x-admin-token` header. |

## Optional

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key for sending emails. Signup still works without it. |
| `EMAIL_FROM` | Sender address for campaigns (e.g. `DropCharge <hello@dropcharge.io>`) |
| `APP_BASE_URL` | Base URL for unsubscribe links. Falls back to site URL if not set. |
| `EMAIL_REPLY_TO` | Reply-to address for campaigns |
| `ADMIN_PASSWORD_HASH` | bcrypt hash for legacy admin login (`node scripts/hash-password.js "pw"`) |
| `ENABLE_DOUBLE_OPT_IN` | Set to `1` to require email confirmation before subscribing |
| `TIKTOK_PIXEL_ID` | TikTok pixel ID for conversion tracking |
| `ADMIN_ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (default: `https://dropcharge.io,http://localhost:8888,http://localhost:3000`) |

## Notes

- **Never** commit secrets or API keys to the repository.
- The `health` endpoint (`/.netlify/functions/health`) checks which env vars are present (boolean only, never exposes values).
- `SUPABASE_SERVICE_ROLE_KEY` also accepts aliases: `SUPABASE_SERVICE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE`.
- `ADMIN_TOKEN` also accepts aliases: `ADMIN_API_TOKEN`, `DASHBOARD_TOKEN`, `ADMIN_SECRET`.
