# DropCharge Implementation Notes

## Ist-Stand (Discovery)
- **Frontend:** Plain HTML/CSS/JS (index.html, assets/app.js). TikTok pixel, popup-based newsletter form posts to Netlify function.
- **Admin Dashboard:** Static admin.html with JS (assets/admin.js) hitting Netlify Functions (`stats`, `spotlight`, etc.). Auth via admin token/password hash env.
- **Serverless Layer:** Netlify Functions under `netlify/functions/` already handle clicks, spotlight, stats, factory, campaigns (draft), etc. Supabase client uses service key via env.
- **Supabase Schema:** Defined in `supabase-schema.sql` (clicks, emails, events, spotlights, campaigns). Lacks hardened newsletter-specific tables / RLS.
- **Newsletter Flow (derzeit):** Popup calls `/.netlify/functions/newsletter_signup` (recent iteration) but DB + admin UI still referencing legacy tables. No confirm/unsubscribe pages yet.
- **Admin “Email & Leads”:** Table hooks to old endpoints (`admin-subscribers`). Needs rewire to new secure leads API + CSV export + filters.
- **Deploy/Infra:** Netlify for frontend/functions (dropchargeadmin), Supabase for DB. Env variables already include SUPABASE_URL/SERVICE_KEY, TikTok IDs, etc.

## Gap zum Soll-Stand
- Newsletter tables need redesign (status, tokens, events) + RLS.
- Netlify functions must provide signup, confirm, unsubscribe, admin list/export endpoints with Resend integration.
- Frontend popup + confirm/unsubscribe pages missing robust UX & messaging.
- Admin dashboard buttons beyond “Email & Leads” need wiring (Analytics, Campaigns, Templates, Settings...).
- Domain alignment dropcharge.io ↔ Netlify prod must be ensured; envs consistent.

## Nächste Schritte
1. Build Supabase migrations (`supabase-schema.sql`) for newsletter_subscribers with constraints.
2. Implement Netlify functions:
   - newsletter_signup (double opt-in + welcome via Resend + rate limiting)
   - newsletter_confirm / newsletter_unsubscribe endpoints
   - admin-list-leads / admin-export-leads (auth protected)
3. Update frontend popup + add /newsletter/confirm + /newsletter/unsubscribe pages.
4. Rewire Admin “Email & Leads” tab to new endpoints, add filters/export.
5. Expand dashboard nav (Analytics, Campaigns, Templates, Settings) with real data binding.
6. Document env vars + runbook in `/docs/NEWSLETTER.md`.
