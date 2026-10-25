-- ==============================================================================
-- UPMIND Database Schema Migration 006: Step 2 Backend Foundation
-- Tables: profiles, skills, user_skills, follows
-- Features:
--   - Explicit display_name & education columns on public.profiles
--   - Unique constraint & check constraint preventing self-follow on public.follows
--   - proficiency_level support on public.user_skills
--   - Automatic profile creation on auth signup (handle_new_user trigger)
--   - Explicit Row Level Security (RLS) least-privilege policies
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2. PROFILES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    education TEXT,
    institution TEXT,
    course TEXT,
    location TEXT,
    website_url TEXT,
    interests TEXT[] DEFAULT '{}'::TEXT[],
    experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
    portfolio_links JSONB DEFAULT '[]'::JSONB,
    followers_count INTEGER DEFAULT 0 NOT NULL,
    following_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
    CONSTRAINT username_format CHECK (username ~* '^[a-zA-Z0-9_]+$')
);

-- Ensure display_name and education columns exist if table was previously created
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS institution TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS course TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Synchronize existing records if display_name or full_name is null
UPDATE public.profiles
SET display_name = COALESCE(display_name, full_name, username),
    full_name = COALESCE(full_name, display_name, username)
WHERE display_name IS NULL OR full_name IS NULL;

-- Fast index lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. SKILLS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT 'General' NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_name_lower ON public.skills (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills (category);

-- -----------------------------------------------------------------------------
-- 4. USER_SKILLS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    intent TEXT DEFAULT 'learning' NOT NULL CHECK (intent IN ('teaching', 'learning')),
    proficiency_level TEXT DEFAULT 'intermediate' NOT NULL,
    experience_level TEXT DEFAULT 'intermediate' NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT uq_user_skill_intent UNIQUE (user_id, skill_id, intent)
);

-- Ensure proficiency_level column exists if table was previously created
ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS proficiency_level TEXT DEFAULT 'intermediate';
ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'intermediate';

CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON public.user_skills (user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON public.user_skills (skill_id);

-- -----------------------------------------------------------------------------
-- 5. FOLLOWS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT uq_follow_pair UNIQUE (follower_id, following_id),
    CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);

-- -----------------------------------------------------------------------------
-- 6. AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- -----------------------------------------------------------------------------
-- Creates public.profiles record automatically when a user signs up via auth.users
-- Uses SECURITY DEFINER with safe search_path to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    raw_username TEXT;
    clean_username TEXT;
    raw_display_name TEXT;
    raw_bio TEXT;
    raw_avatar TEXT;
    raw_education TEXT;
BEGIN
    raw_username := NEW.raw_user_meta_data->>'username';
    raw_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'full_name',
        'UPMIND Member'
    );
    raw_bio := NEW.raw_user_meta_data->>'bio';
    raw_avatar := NEW.raw_user_meta_data->>'avatar_url';
    raw_education := COALESCE(
        NEW.raw_user_meta_data->>'education',
        NEW.raw_user_meta_data->>'institution',
        NEW.raw_user_meta_data->>'course'
    );

    -- Fallback username generation if not provided
    IF raw_username IS NULL OR raw_username = '' THEN
        clean_username := 'user_' || SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 8);
    ELSE
        clean_username := LOWER(REGEXP_REPLACE(raw_username, '[^a-zA-Z0-9_]', '', 'g'));
        IF char_length(clean_username) < 3 THEN
            clean_username := clean_username || '_' || SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 4);
        END IF;
    END IF;

    -- Upsert profile row belonging strictly to NEW.id
    INSERT INTO public.profiles (
        id,
        username,
        display_name,
        full_name,
        avatar_url,
        bio,
        education,
        institution
    )
    VALUES (
        NEW.id,
        clean_username,
        raw_display_name,
        raw_display_name,
        raw_avatar,
        raw_bio,
        raw_education,
        raw_education
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = TIMEZONE('utc'::TEXT, NOW());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

-- --- PROFILES RLS ---
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

-- Anyone authenticated can view public profiles
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Users can only insert their own profile matching auth.uid()
CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can delete only their own profile
CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- --- SKILLS RLS ---
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Skills are viewable by all authenticated users" ON public.skills;
DROP POLICY IF EXISTS "Skills are viewable by public" ON public.skills;

CREATE POLICY "Skills are viewable by all authenticated users"
ON public.skills FOR SELECT
TO authenticated
USING (true);

-- --- USER_SKILLS RLS ---
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User skills are viewable by authenticated users" ON public.user_skills;
DROP POLICY IF EXISTS "Users can add their own skills" ON public.user_skills;
DROP POLICY IF EXISTS "Users can update their own skills" ON public.user_skills;
DROP POLICY IF EXISTS "Users can delete their own skills" ON public.user_skills;

CREATE POLICY "User skills are viewable by authenticated users"
ON public.user_skills FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can add their own skills"
ON public.user_skills FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own skills"
ON public.user_skills FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own skills"
ON public.user_skills FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- --- FOLLOWS RLS ---
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Follows are viewable by authenticated users" ON public.follows;
DROP POLICY IF EXISTS "Users can follow other users" ON public.follows;
DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;

CREATE POLICY "Follows are viewable by authenticated users"
ON public.follows FOR SELECT
TO authenticated
USING (true);

-- User can only create follow record where they are the follower and not following self
CREATE POLICY "Users can follow other users"
ON public.follows FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = follower_id AND 
    follower_id <> following_id
);

-- User can only delete follow record where they are the follower
CREATE POLICY "Users can unfollow"
ON public.follows FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);
