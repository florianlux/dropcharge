-- Spotlight Pages table for affiliate landing subpages
CREATE TABLE IF NOT EXISTS spotlight_pages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  subtitle    text,
  brand       text,
  affiliate_url text NOT NULL,
  coupon_code text,
  gradient    text DEFAULT 'linear-gradient(135deg, #7c3aed, #06b6d4)',
  logo_url    text,
  hero_url    text,
  badge_text  text,
  cta_text    text DEFAULT 'Jetzt sichern',
  countdown_date timestamptz,
  is_active   boolean DEFAULT true,
  clicks      integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_spotlight_pages_slug ON spotlight_pages (slug);
CREATE INDEX IF NOT EXISTS idx_spotlight_pages_active ON spotlight_pages (is_active);

-- RPC function used by spotlight-click to atomically increment clicks
CREATE OR REPLACE FUNCTION increment_spotlight_clicks(page_slug text)
RETURNS void AS $$
BEGIN
  UPDATE spotlight_pages SET clicks = clicks + 1 WHERE slug = page_slug;
END;
$$ LANGUAGE plpgsql;
