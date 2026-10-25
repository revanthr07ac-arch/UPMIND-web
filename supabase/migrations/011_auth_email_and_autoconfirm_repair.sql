-- ==============================================================================
-- UPMIND Migration 011: Auth Email & Auto-Confirm Cross-Device Repair
-- ==============================================================================
-- Purpose:
-- 1. Auto-confirms all existing users whose email_confirmed_at is NULL (e.g. Device B accounts).
-- 2. Installs a SECURITY DEFINER trigger on auth.users to auto-confirm new registrations
--    at insertion time. This completely bypasses Supabase's free-tier built-in mailer
--    rate limit (429 over_email_send_rate_limit: 3 emails/hour), enabling seamless
--    cross-device registration and immediate login.
-- 3. Idempotently backfills profile records in public.profiles for any auth users
--    missing a profile.
-- ==============================================================================

-- 1. Auto-confirm all existing users in auth.users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- 2. Trigger function to auto-confirm new users at insert time
CREATE OR REPLACE FUNCTION public.handle_auto_confirm_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auto_confirm_user();

-- 3. Backfill any auth user that might be missing a profile record
INSERT INTO public.profiles (id, username, full_name, created_at, updated_at)
SELECT
  u.id,
  COALESCE(
    NULLIF(LOWER(REGEXP_REPLACE(u.raw_user_meta_data->>'username', '[^a-zA-Z0-9_]', '', 'g')), ''),
    'user_' || SUBSTRING(REPLACE(u.id::TEXT, '-', ''), 1, 8)
  ),
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), 'UPMIND Member'),
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;
