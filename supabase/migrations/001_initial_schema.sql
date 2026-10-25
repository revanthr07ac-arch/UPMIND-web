-- ==============================================================================
-- UPMIND Database Schema Migration 001: Initial Schema
-- Tables: profiles, skills, user_skills, posts, likes, comments, follows,
--         saved_posts, learning_requests, notifications, reports, blocks
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
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

-- Case-insensitive index on username for quick lookups & search
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles USING gin (to_tsvector('english', full_name));
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. SKILLS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_name_lower ON public.skills (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills (category);
CREATE INDEX IF NOT EXISTS idx_skills_name_trgm ON public.skills USING gin (to_tsvector('english', name));

-- -----------------------------------------------------------------------------
-- 3. USER_SKILLS (Can Teach & Want to Learn)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    intent TEXT NOT NULL CHECK (intent IN ('teaching', 'learning')),
    experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT uq_user_skill_intent UNIQUE (user_id, skill_id, intent)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON public.user_skills (user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON public.user_skills (skill_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_intent ON public.user_skills (intent);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill_intent ON public.user_skills (skill_id, intent);

-- -----------------------------------------------------------------------------
-- 4. POSTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    caption TEXT NOT NULL,
    image_url TEXT,
    post_type TEXT NOT NULL CHECK (post_type IN ('text', 'image', 'tutorial')),
    educational_description TEXT,
    skill_tags TEXT[] DEFAULT '{}'::TEXT[],
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    likes_count INTEGER DEFAULT 0 NOT NULL,
    comments_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility_created ON public.posts (visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_skill_tags ON public.posts USING gin (skill_tags);

-- -----------------------------------------------------------------------------
-- 5. LIKES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT uq_user_post_like UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes (post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes (user_id);

-- -----------------------------------------------------------------------------
-- 6. COMMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments (author_id);

-- -----------------------------------------------------------------------------
-- 7. FOLLOWS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT uq_follow_relationship UNIQUE (follower_id, following_id),
    CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);

-- -----------------------------------------------------------------------------
-- 8. SAVED_POSTS (Bookmarks)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT uq_user_saved_post UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON public.saved_posts (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 9. LEARNING_REQUESTS (Core Differentiating Feature)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT chk_no_self_learning_request CHECK (learner_id <> teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_requests_learner ON public.learning_requests (learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_requests_teacher ON public.learning_requests (teacher_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_requests_skill ON public.learning_requests (skill_id);

-- -----------------------------------------------------------------------------
-- 10. NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('follow', 'comment', 'like', 'learning_request_new', 'learning_request_accepted', 'learning_request_declined')),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications (recipient_id, is_read, created_at DESC);

-- -----------------------------------------------------------------------------
-- 11. REPORTS (Moderation & Safety)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports (status);

-- -----------------------------------------------------------------------------
-- 12. BLOCKS (Safety & Harassment Prevention)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT uq_block_relationship UNIQUE (blocker_id, blocked_id),
    CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks (blocked_id);
