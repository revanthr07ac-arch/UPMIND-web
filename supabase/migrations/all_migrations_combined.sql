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
-- ==============================================================================
-- UPMIND Database Schema Migration 002: Row Level Security (RLS)
-- Explicit, strict policies for SELECT, INSERT, UPDATE, DELETE across all tables
-- ==============================================================================

-- Helper function to check if two users have a block relationship
CREATE OR REPLACE FUNCTION public.is_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.blocks
        WHERE (blocker_id = user_a AND blocked_id = user_b)
           OR (blocker_id = user_b AND blocked_id = user_a)
    );
$$;

-- -----------------------------------------------------------------------------
-- 1. PROFILES RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view public profiles, provided neither user blocked the other
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (
    auth.uid() = id OR NOT public.is_blocked(auth.uid(), id)
);

-- Users can only insert their own profile
CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = id
);

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 2. SKILLS RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

-- Public read access to skills catalog
CREATE POLICY "Skills are viewable by all authenticated users"
ON public.skills FOR SELECT
TO authenticated
USING (true);

-- -----------------------------------------------------------------------------
-- 3. USER_SKILLS RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

-- Viewable if not blocked
CREATE POLICY "User skills are viewable by authenticated users"
ON public.user_skills FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR NOT public.is_blocked(auth.uid(), user_id)
);

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

-- -----------------------------------------------------------------------------
-- 4. POSTS RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Viewable if public and not blocked, or if own post
CREATE POLICY "Public posts are viewable if not blocked"
ON public.posts FOR SELECT
TO authenticated
USING (
    author_id = auth.uid() OR (
        visibility = 'public' AND NOT public.is_blocked(auth.uid(), author_id)
    )
);

CREATE POLICY "Users can create their own posts"
ON public.posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts"
ON public.posts FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts"
ON public.posts FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- -----------------------------------------------------------------------------
-- 5. LIKES RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes are viewable by authenticated users"
ON public.likes FOR SELECT
TO authenticated
USING (NOT public.is_blocked(auth.uid(), user_id));

CREATE POLICY "Users can like posts"
ON public.likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
ON public.likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6. COMMENTS RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by authenticated users"
ON public.comments FOR SELECT
TO authenticated
USING (NOT public.is_blocked(auth.uid(), author_id));

CREATE POLICY "Users can post comments"
ON public.comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own comments"
ON public.comments FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own comments or post authors can delete"
ON public.comments FOR DELETE
TO authenticated
USING (
    auth.uid() = author_id OR 
    EXISTS (SELECT 1 FROM public.posts WHERE id = comments.post_id AND author_id = auth.uid())
);

-- -----------------------------------------------------------------------------
-- 7. FOLLOWS RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by authenticated users"
ON public.follows FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can follow other non-blocked users"
ON public.follows FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = follower_id AND 
    follower_id <> following_id AND
    NOT public.is_blocked(follower_id, following_id)
);

CREATE POLICY "Users can unfollow"
ON public.follows FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);

-- -----------------------------------------------------------------------------
-- 8. SAVED_POSTS RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own saved posts"
ON public.saved_posts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can save posts"
ON public.saved_posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave posts"
ON public.saved_posts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 9. LEARNING_REQUESTS RLS (Private between Learner & Teacher)
-- -----------------------------------------------------------------------------
ALTER TABLE public.learning_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view learning requests"
ON public.learning_requests FOR SELECT
TO authenticated
USING (auth.uid() = learner_id OR auth.uid() = teacher_id);

CREATE POLICY "Learner can create learning requests"
ON public.learning_requests FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = learner_id AND 
    learner_id <> teacher_id AND
    NOT public.is_blocked(learner_id, teacher_id)
);

-- Teacher can accept/decline; Learner can cancel pending
CREATE POLICY "Participants can update learning request status"
ON public.learning_requests FOR UPDATE
TO authenticated
USING (auth.uid() = learner_id OR auth.uid() = teacher_id)
WITH CHECK (
    -- Teacher can only transition status
    (auth.uid() = teacher_id AND status IN ('accepted', 'declined', 'completed')) OR
    -- Learner can only cancel
    (auth.uid() = learner_id AND status = 'cancelled')
);

-- -----------------------------------------------------------------------------
-- 10. NOTIFICATIONS RLS (Strictly Private to Recipient)
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = recipient_id);

CREATE POLICY "Users can mark their own notifications as read"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

-- -----------------------------------------------------------------------------
-- 11. REPORTS RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Reporter can insert a report
CREATE POLICY "Users can submit reports"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- Users can view only their own submitted reports
CREATE POLICY "Users can view their own submitted reports"
ON public.reports FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id);

-- -----------------------------------------------------------------------------
-- 12. BLOCKS RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks"
ON public.blocks FOR SELECT
TO authenticated
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block other users"
ON public.blocks FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);

CREATE POLICY "Users can unblock users"
ON public.blocks FOR DELETE
TO authenticated
USING (auth.uid() = blocker_id);
-- ==============================================================================
-- UPMIND Database Schema Migration 003: Storage Buckets, Triggers & Automation
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. STORAGE BUCKETS SETUP
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('post_images', 'post_images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies
CREATE POLICY "Public avatar viewing"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public post images viewing"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post_images');

CREATE POLICY "Users can upload post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'post_images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own post images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'post_images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- -----------------------------------------------------------------------------
-- 2. AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- -----------------------------------------------------------------------------
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

    INSERT INTO public.profiles (id, username, full_name, avatar_url, bio)
    VALUES (
        NEW.id,
        clean_username,
        raw_full_name,
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'bio'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. COUNTER CACHE TRIGGERS (Followers, Following, Likes, Comments)
-- -----------------------------------------------------------------------------

-- Follow counters
CREATE OR REPLACE FUNCTION public.handle_follow_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
        UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
        
        -- Create notification for new follower
        INSERT INTO public.notifications (recipient_id, actor_id, type, related_entity_id)
        VALUES (NEW.following_id, NEW.follower_id, 'follow', NEW.follower_id);
        
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
        UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_counters ON public.follows;
CREATE TRIGGER trg_follow_counters
    AFTER INSERT OR DELETE ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.handle_follow_counters();

-- Like counters
CREATE OR REPLACE FUNCTION public.handle_like_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    post_author_id UUID;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
        
        -- Fetch post author to notify (if not liking own post)
        SELECT author_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
        IF post_author_id IS NOT NULL AND post_author_id <> NEW.user_id THEN
            INSERT INTO public.notifications (recipient_id, actor_id, type, related_entity_id)
            VALUES (post_author_id, NEW.user_id, 'like', NEW.post_id);
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_like_counters ON public.likes;
CREATE TRIGGER trg_like_counters
    AFTER INSERT OR DELETE ON public.likes
    FOR EACH ROW EXECUTE FUNCTION public.handle_like_counters();

-- Comment counters
CREATE OR REPLACE FUNCTION public.handle_comment_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    post_author_id UUID;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
        
        SELECT author_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
        IF post_author_id IS NOT NULL AND post_author_id <> NEW.author_id THEN
            INSERT INTO public.notifications (recipient_id, actor_id, type, related_entity_id)
            VALUES (post_author_id, NEW.author_id, 'comment', NEW.post_id);
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_counters ON public.comments;
CREATE TRIGGER trg_comment_counters
    AFTER INSERT OR DELETE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_comment_counters();

-- -----------------------------------------------------------------------------
-- 4. LEARNING REQUEST NOTIFICATION TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_learning_request_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Notify teacher of incoming request
        INSERT INTO public.notifications (recipient_id, actor_id, type, related_entity_id)
        VALUES (NEW.teacher_id, NEW.learner_id, 'learning_request_new', NEW.id);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Notify learner if status transitioned to accepted or declined
        IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
            INSERT INTO public.notifications (recipient_id, actor_id, type, related_entity_id)
            VALUES (NEW.learner_id, NEW.teacher_id, 'learning_request_accepted', NEW.id);
        ELSIF OLD.status = 'pending' AND NEW.status = 'declined' THEN
            INSERT INTO public.notifications (recipient_id, actor_id, type, related_entity_id)
            VALUES (NEW.learner_id, NEW.teacher_id, 'learning_request_declined', NEW.id);
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_learning_request_notifications ON public.learning_requests;
CREATE TRIGGER trg_learning_request_notifications
    AFTER INSERT OR UPDATE ON public.learning_requests
    FOR EACH ROW EXECUTE FUNCTION public.handle_learning_request_notifications();

-- -----------------------------------------------------------------------------
-- 5. AUTO UPDATE UPDATED_AT TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::TEXT, NOW());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.posts;
CREATE TRIGGER trg_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_learning_requests_updated_at ON public.learning_requests;
CREATE TRIGGER trg_learning_requests_updated_at
    BEFORE UPDATE ON public.learning_requests
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
-- ==============================================================================
-- UPMIND Database Schema Migration 004: Seed Initial Skills Catalog
-- ==============================================================================

INSERT INTO public.skills (name, category, description)
VALUES
    ('Flutter & Dart', 'Mobile Development', 'Build cross-platform mobile apps for Android and iOS using Flutter and Dart.'),
    ('UI/UX Design', 'Design', 'User experience research, wireframing, prototyping, and modern interface design with Figma.'),
    ('Python Programming', 'Programming', 'Python fundamentals, automation, web backends with FastAPI/Django, and scripting.'),
    ('Graphic Design', 'Design', 'Visual identity, logo design, poster layout, and typography using Adobe tools.'),
    ('Video Editing', 'Video & Audio', 'Cinematic video cutting, color grading, sound design, and pacing using Premiere Pro / DaVinci.'),
    ('Portrait Photography', 'Photography', 'Camera settings, lighting composition, model posing, and photo retouching.'),
    ('JavaScript & TypeScript', 'Web Development', 'Modern frontend and backend JavaScript with ES6+, Node.js, and type safety.'),
    ('Prompt Engineering & AI', 'Artificial Intelligence', 'Crafting effective prompts, fine-tuning workflows, and LLM application design.'),
    ('Data Analysis & SQL', 'Data Science', 'Querying relational databases, exploratory data analysis, and dashboard visualization.'),
    ('Content Writing & Copywriting', 'Writing', 'Engaging storytelling, persuasive copy for landing pages, and educational blogging.'),
    ('Digital Marketing & SEO', 'Marketing', 'Search engine optimization, content strategy, growth analytics, and social campaigns.'),
    ('Music Production', 'Video & Audio', 'Beat making, synth design, recording vocals, and mastering tracks in digital audio workstations.'),
    ('Public Speaking & Communication', 'Personal Growth', 'Presentation skills, stage presence, overcoming nervousness, and clear articulation.'),
    ('Product Management', 'Business', 'User story mapping, sprint planning, roadmapping, and agile product development.')
ON CONFLICT (name) DO UPDATE SET
    category = EXCLUDED.category,
    description = EXCLUDED.description;
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

-- -----------------------------------------------------------------------------
-- STEP 2 FOUNDATION UPDATES: display_name, education, proficiency_level
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS proficiency_level TEXT DEFAULT 'intermediate';

UPDATE public.profiles
SET display_name = COALESCE(display_name, full_name, username),
    full_name = COALESCE(full_name, display_name, username),
    education = COALESCE(education, institution, course)
WHERE display_name IS NULL OR education IS NULL;

-- Updated handle_new_user to populate display_name and education
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
        education = COALESCE(EXCLUDED.education, public.profiles.education),
        updated_at = TIMEZONE('utc'::TEXT, NOW());

    RETURN NEW;
END;
$$;

-- ==============================================================================
-- 011_auth_email_and_autoconfirm_repair.sql
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

