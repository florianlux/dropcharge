-- Index optimization for analytics queries
-- This composite index improves performance for queries that filter by type and created_at
-- Used by the admin-stats endpoint: GET /admin/stats?window=24h|7d

create index if not exists events_type_created_idx on public.events (type, created_at desc);

-- Optional: If the table grows large, consider a partial index for specific event types
-- create index if not exists events_analytics_idx on public.events (created_at desc) 
--   where type in ('deal_click', 'email_submit');
