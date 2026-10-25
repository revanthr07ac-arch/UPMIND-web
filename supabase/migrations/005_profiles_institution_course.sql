-- ==============================================================================
-- UPMIND Database Schema Migration 005: Student, Institution & Portfolio Fields
-- ==============================================================================

-- Add institution, course, and website_url to public.profiles if not present
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS institution TEXT,
ADD COLUMN IF NOT EXISTS course TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Update trigger function handle_new_user() to accept institution & course if provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    raw_username TEXT;
    clean_username TEXT;
    raw_full_name TEXT;
BEGIN
    raw_username := NEW.raw_user_meta_data->>'username';
    raw_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'UPMIND Member');

    IF raw_username IS NULL OR raw_username = '' THEN
        clean_username := 'user_' || SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 8);
    ELSE
        clean_username := LOWER(REGEXP_REPLACE(raw_username, '[^a-zA-Z0-9_]', '', 'g'));
        IF char_length(clean_username) < 3 THEN
            clean_username := clean_username || '_' || SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 4);
        END IF;
    END IF;

    INSERT INTO public.profiles (
        id,
        username,
        full_name,
        avatar_url,
        bio,
        institution,
        course,
        website_url
    )
    VALUES (
        NEW.id,
        clean_username,
        raw_full_name,
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'bio',
        NEW.raw_user_meta_data->>'institution',
        NEW.raw_user_meta_data->>'course',
        NEW.raw_user_meta_data->>'website_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        updated_at = TIMEZONE('utc'::TEXT, NOW());

    RETURN NEW;
END;
$$;
