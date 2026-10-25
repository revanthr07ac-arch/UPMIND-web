-- ==============================================================================
-- UPMIND Database Schema Migration 012: Reels, Stories, Communities & Resource Requests
-- ==============================================================================

-- 1. POSTS EXTENSIONS (Reels, Videos, Multiple Media URLs)
DO $$
BEGIN
    ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_post_type_check;
    ALTER TABLE public.posts ADD CONSTRAINT posts_post_type_check 
        CHECK (post_type IN ('text', 'image', 'tutorial', 'reel', 'video'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_reel BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_posts_is_reel ON public.posts (is_reel, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. STORIES TABLE (Instagram-style 24hr ephemeral stories)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (TIMEZONE('utc'::TEXT, NOW()) + INTERVAL '24 hours') NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stories_user_expires ON public.stories (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_active ON public.stories (expires_at);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Unexpired stories are viewable by authenticated users" ON public.stories;
CREATE POLICY "Unexpired stories are viewable by authenticated users"
ON public.stories FOR SELECT
TO authenticated
USING (
    expires_at > NOW() OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can create their own stories" ON public.stories;
CREATE POLICY "Users can create their own stories"
ON public.stories FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own stories" ON public.stories;
CREATE POLICY "Users can delete their own stories"
ON public.stories FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. COMMUNITIES & COMMUNITY MEMBERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    is_private BOOLEAN DEFAULT FALSE NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    members_count INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_communities_category ON public.communities (category);
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON public.communities (created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
    joined_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT uq_community_member UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_comm ON public.community_members (community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON public.community_members (user_id);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public communities viewable by all authenticated users" ON public.communities;
CREATE POLICY "Public communities viewable by all authenticated users"
ON public.communities FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can create communities" ON public.communities;
CREATE POLICY "Authenticated users can create communities"
ON public.communities FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Community creators can update their communities" ON public.communities;
CREATE POLICY "Community creators can update their communities"
ON public.communities FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Community members viewable by authenticated users" ON public.community_members;
CREATE POLICY "Community members viewable by authenticated users"
ON public.community_members FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;
CREATE POLICY "Users can join communities"
ON public.community_members FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave communities" ON public.community_members;
CREATE POLICY "Users can leave communities"
ON public.community_members FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. ENHANCED LEARNING REQUESTS (Direct resource fulfillment & tracking)
-- -----------------------------------------------------------------------------
ALTER TABLE public.learning_requests ADD COLUMN IF NOT EXISTS resource_url TEXT;
ALTER TABLE public.learning_requests ADD COLUMN IF NOT EXISTS resource_note TEXT;
ALTER TABLE public.learning_requests ADD COLUMN IF NOT EXISTS resource_name TEXT;
ALTER TABLE public.learning_requests ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;
ALTER TABLE public.learning_requests ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 5. REALTIME REPLICATION
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.communities;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
