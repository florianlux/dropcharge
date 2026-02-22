-- Drops table: single source of truth for gaming voucher drops
CREATE TABLE IF NOT EXISTS drops (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  platform    TEXT NOT NULL,
  value_eur   NUMERIC(10,2),
  destination_url TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  featured    BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the Top-4 drops
INSERT INTO drops (id, title, platform, value_eur, destination_url, active, featured, sort_order)
VALUES
  ('nintendo15', 'Nintendo eShop 15 €',       'Nintendo', 15.00, 'https://www.g2a.com/n/nintendo15_lux', true, true, 1),
  ('psn20',      'PSN Guthaben 20 €',         'PSN',      20.00, 'https://www.g2a.com/n/psn5_lux',      true, true, 2),
  ('xbox3m',     'Xbox Game Pass 3 Monate',    'Xbox',     30.00, 'https://www.g2a.com/n/xbox_lux1',     true, true, 3),
  ('steam20',    'Steam Guthaben 20 €',        'Steam',    20.00, 'https://www.g2a.com/n/reanimalux',    true, true, 4)
ON CONFLICT (id) DO NOTHING;
