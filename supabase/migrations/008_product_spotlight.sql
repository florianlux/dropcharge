-- Add product-related columns to spotlight_pages
ALTER TABLE spotlight_pages ADD COLUMN IF NOT EXISTS theme text;
ALTER TABLE spotlight_pages ADD COLUMN IF NOT EXISTS product_url text;
ALTER TABLE spotlight_pages ADD COLUMN IF NOT EXISTS product_title text;
ALTER TABLE spotlight_pages ADD COLUMN IF NOT EXISTS product_description text;
ALTER TABLE spotlight_pages ADD COLUMN IF NOT EXISTS product_price numeric;
ALTER TABLE spotlight_pages ADD COLUMN IF NOT EXISTS product_currency text;
ALTER TABLE spotlight_pages ADD COLUMN IF NOT EXISTS product_image_url text;
ALTER TABLE spotlight_pages ADD COLUMN IF NOT EXISTS product_source text;
ALTER TABLE spotlight_pages ADD COLUMN IF NOT EXISTS product_last_fetched_at timestamptz;

-- Product fetch cache table
CREATE TABLE IF NOT EXISTS product_cache (
  url text PRIMARY KEY,
  json jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
