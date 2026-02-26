-- User profiles table with Supabase Auth integration
-- Run after all previous migrations

-- 1) Extensions (if not present)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2) User profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  username text UNIQUE,
  phone text,
  newsletter_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Auto-maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Signup hook: create profile on new auth.users entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, username, phone, newsletter_opt_in)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->'newsletter_opt_in')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5) Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 6) Policies: user can read/update own profile
DROP POLICY IF EXISTS "read own profile" ON public.user_profiles;
CREATE POLICY "read own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "update own profile" ON public.user_profiles;
CREATE POLICY "update own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert own profile" ON public.user_profiles;
CREATE POLICY "insert own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 7) PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');
