-- DropCharge Academy tables
-- Run after all previous migrations

-- Stripe customer mapping
CREATE TABLE IF NOT EXISTS stripe_customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Stripe webhook event log (idempotency)
CREATE TABLE IF NOT EXISTS stripe_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processed_at timestamptz DEFAULT now()
);

-- Academy access (per-user plan entitlement)
CREATE TABLE IF NOT EXISTS academy_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'pro')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'revoked')),
  valid_until timestamptz,
  granted_by text, -- 'stripe' or 'admin'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Academy orders
CREATE TABLE IF NOT EXISTS academy_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('basic', 'pro')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  amount integer, -- cents
  currency text DEFAULT 'eur',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamptz DEFAULT now()
);

-- Academy modules
CREATE TABLE IF NOT EXISTS academy_modules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  plan_required text DEFAULT 'basic' CHECK (plan_required IN ('basic', 'pro')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Academy lessons
CREATE TABLE IF NOT EXISTS academy_lessons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id uuid NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text, -- markdown or HTML
  sort_order integer DEFAULT 0,
  plan_required text DEFAULT 'basic' CHECK (plan_required IN ('basic', 'pro')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User progress
CREATE TABLE IF NOT EXISTS academy_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Tool usage tracking (for Pro quota)
CREATE TABLE IF NOT EXISTS academy_tool_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  tool text NOT NULL,
  used_at timestamptz DEFAULT now()
);

-- Seed initial modules and lessons
INSERT INTO academy_modules (id, title, description, sort_order, plan_required) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Willkommen & Grundlagen', 'Lerne die Basics von DropCharge und Gaming-Affiliate-Marketing.', 1, 'basic'),
  ('00000000-0000-0000-0000-000000000002', 'Traffic-Quellen meistern', 'TikTok, Instagram, YouTube – so generierst du Klicks.', 2, 'basic'),
  ('00000000-0000-0000-0000-000000000003', 'Conversion-Optimierung', 'Vom Klick zum Sale: Landingpages, Funnels & A/B-Tests.', 3, 'basic'),
  ('00000000-0000-0000-0000-000000000004', 'Skalierung & Automatisierung', 'Prozesse automatisieren, Team aufbauen, Einnahmen steigern.', 4, 'pro'),
  ('00000000-0000-0000-0000-000000000005', 'Fortgeschrittene Strategien', 'Retargeting, Email-Funnels, Cross-Selling für maximale Profite.', 5, 'pro')
ON CONFLICT DO NOTHING;

INSERT INTO academy_lessons (id, module_id, title, content, sort_order, plan_required) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Was ist DropCharge?', '<h2>Willkommen bei DropCharge Academy</h2><p>DropCharge ist die #1 Plattform für Gaming-Credit Deals. In diesem Kurs lernst du, wie du mit Affiliate-Links ein nachhaltiges Einkommen aufbaust.</p><h3>Was du lernen wirst</h3><ul><li>Wie Gaming-Affiliate-Marketing funktioniert</li><li>Die besten Traffic-Quellen und Strategien</li><li>Tools und Techniken der Profis</li></ul>', 1, 'basic'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Account einrichten', '<h2>Dein Account</h2><p>Nach dem Kauf hast du sofort Zugriff auf alle Basic-Inhalte. Dein Fortschritt wird automatisch gespeichert.</p><h3>Nächste Schritte</h3><ol><li>Profil vervollständigen</li><li>Erste Lektion abschließen</li><li>Community beitreten</li></ol>', 2, 'basic'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'TikTok Traffic Masterclass', '<h2>TikTok als Traffic-Maschine</h2><p>TikTok ist die #1 Quelle für viralen Gaming-Traffic. Hier lernst du die Grundlagen.</p><h3>Kernstrategien</h3><ul><li>Content-Formate die funktionieren</li><li>Hashtag-Strategie für Gaming-Nische</li><li>Posting-Zeiten und Frequenz</li></ul>', 1, 'basic'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'Instagram & YouTube Shorts', '<h2>Kurzform-Video auf allen Plattformen</h2><p>Repurpose deinen TikTok-Content für Instagram Reels und YouTube Shorts.</p>', 2, 'basic'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'Landingpage-Optimierung', '<h2>Die perfekte Landingpage</h2><p>Deine Landingpage entscheidet über Conversion. Lerne die wichtigsten Elemente.</p><h3>Must-haves</h3><ul><li>Klarer CTA above the fold</li><li>Social Proof und Trust-Elemente</li><li>Mobile-First Design</li></ul>', 1, 'basic'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', 'Automatisierung mit Tools', '<h2>Automatisiere dein Business</h2><p>Pro-Mitglieder haben Zugriff auf exklusive Tools: Commission Calculator, Funnel Analyzer und den AI Mentor.</p><p><strong>Dieses Modul erfordert Pro-Zugang.</strong></p>', 1, 'pro'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', 'Email-Funnel Strategien', '<h2>Email-Marketing für Affiliates</h2><p>Baue eine Email-Liste auf und monetarisiere sie mit automatisierten Funnels.</p><p><strong>Dieses Modul erfordert Pro-Zugang.</strong></p>', 1, 'pro')
ON CONFLICT DO NOTHING;

-- RLS Policies
ALTER TABLE academy_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_tool_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Public read for modules and lessons (content listing)
CREATE POLICY IF NOT EXISTS academy_modules_public_read ON academy_modules FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS academy_lessons_public_read ON academy_lessons FOR SELECT USING (true);

-- Service role has full access (used by Netlify functions)
-- Supabase service role bypasses RLS by default
