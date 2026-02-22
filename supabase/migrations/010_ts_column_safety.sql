-- 010_ts_column_safety.sql
-- Ensure the `ts` column and its index exist on the events table.
-- This is a safety net for environments where migration 009 was only partially
-- applied or the table was created without the tracking columns.

alter table events add column if not exists ts timestamptz default now();

-- Backfill ts from created_at for any rows that still have it null
update events set ts = created_at where ts is null and created_at is not null;

-- Ensure the descending index exists for analytics ORDER BY / range queries
create index if not exists idx_events_ts_desc on events(ts desc);
