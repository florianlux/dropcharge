# Release Checklist

## Pre-deploy

- [ ] **Environment Variables** — Set all required vars in Netlify → Site settings → Environment variables (see [ENV_VARS.md](./ENV_VARS.md))
- [ ] **Supabase Migrations** — Run all SQL files in `supabase/migrations/` in numeric order:
  ```
  001_safe_schema_sync.sql
  002_campaigns_and_columns.sql
  003_spin_wheel_newsletter.sql
  004_email_logs.sql
  004_add_subscriber_prize.sql
  005_drops_table.sql
  005_unsubscribe_token_default.sql
  006_drops_table.sql
  007_spotlight_pages.sql
  008_product_spotlight.sql
  009_tracking.sql
  010_ts_column_safety.sql
  ```
- [ ] **Node Dependencies** — Run `npm install` (or let Netlify handle it on deploy)

## Deploy

- [ ] Push to the connected GitHub branch **or** run `netlify deploy --prod`
- [ ] Verify build log has no errors

## Post-deploy Smoke Tests

Run the commands from [SMOKE_TESTS.md](./SMOKE_TESTS.md):

- [ ] `health` — returns `ok: true`
- [ ] `track-event` — returns `ok: true`
- [ ] `tracking-stats` — returns KPI data
- [ ] `tracking-funnel` — returns funnel steps
- [ ] `stats-advanced` — returns ROI metrics
- [ ] `newsletter_signup` — accepts signup (or duplicate)
- [ ] `admin-health` — all table checks pass
- [ ] Admin dashboard loads, widgets render

## Rollback Plan

1. **Revert deploy**: In Netlify dashboard → Deploys → click the previous good deploy → "Publish deploy"
2. **Database**: Migrations are additive (add column if not exists). No rollback SQL needed for normal cases.
3. **If schema issue**: Check Supabase logs, manually drop the problematic column/table if safe.
