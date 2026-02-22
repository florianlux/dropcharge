-- Gaming drops table for outbound redirect system
CREATE TABLE IF NOT EXISTS public.drops (
  id text PRIMARY KEY,
  title text,
  platform text,
  value_eur integer,
  destination_url text,
  active boolean DEFAULT true,
  featured boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drops_active_idx ON public.drops (active, sort_order);

-- Seed initial drops
INSERT INTO public.drops (id, title, platform, value_eur, destination_url) VALUES
  ('nintendo15', 'Nintendo eShop 15€', 'Nintendo', 15, 'https://www.g2a.com/n/nintendo15_lux'),
  ('psn20', 'PSN Card 20€', 'PSN', 20, 'https://www.g2a.com/n/psn5_lux'),
  ('xbox3m', 'Xbox Game Pass 3 Monate', 'Xbox', 30, 'https://www.g2a.com/n/xbox_lux1'),
  ('steam20', 'Steam Card 20€', 'Steam', 20, 'https://www.g2a.com/n/reanimalux')
ON CONFLICT (id) DO NOTHING;
