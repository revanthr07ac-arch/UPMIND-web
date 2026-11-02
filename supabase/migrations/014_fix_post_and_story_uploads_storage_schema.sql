-- ==============================================================================
-- UPMIND Database Schema Migration 014: Fix Post & Story Uploads, Storage & Schema
-- ==============================================================================
--
-- This migration resolves:
-- 1. HTTP 503 / 42P17 DatabaseInvalidObjectDefinition ("The database schema is invalid or incompatible")
--    caused by recursive conversation_members RLS evaluation on storage.objects uploads.
-- 2. Missing storage buckets 'reels_videos' and 'stories' (with video & image MIME types and limits).
-- 3. Storage RLS policies for 'reels_videos', 'stories', 'post_images', and 'avatars'.
-- 4. Missing columns 'video_url', 'is_reel', 'media_urls' and check constraint on 'public.posts'.
-- 5. Missing 'public.stories' table and its RLS policies.
-- 6. Reloads PostgREST schema cache.
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. SECURITY DEFINER HELPER: BREAK RLS RECURSION ON CONVERSATION MEMBERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(UUID, UUID) TO authenticated, anon, service_role;

-- Repair conversation_members RLS policies to eliminate recursive queries
ALTER TABLE IF EXISTS public.conversation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
CREATE POLICY "Members can view conversation members"
ON public.conversation_members FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can join or add members" ON public.conversation_members;
CREATE POLICY "Users can join or add members"
ON public.conversation_members FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_members.conversation_id
          AND c.created_by = auth.uid()
    ) OR
    public.is_conversation_member(conversation_id, auth.uid())
);

-- -----------------------------------------------------------------------------
-- 2. STORAGE BUCKETS SETUP (reels_videos, stories, post_images, avatars, learning_resources)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'post_images',
        'post_images',
        true,
        20971520, -- 20 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
    ),
    (
        'reels_videos',
        'reels_videos',
        true,
        104857600, -- 100 MB
        ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/x-matroska']
    ),
    (
        'stories',
        'stories',
        true,
        52428800, -- 50 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
    ),
    (
        'avatars',
        'avatars',
        true,
        5242880, -- 5 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    ),
    (
        'learning_resources',
        'learning_resources',
        false,
        52428800, -- 50 MB
        ARRAY['application/pdf', 'text/plain', 'text/markdown', 'image/jpeg', 'image/png', 'image/webp', 'application/zip', 'application/x-zip-compressed']
    )
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow public viewing of public buckets in storage.buckets
DROP POLICY IF EXISTS "Public can view public buckets" ON storage.buckets;
CREATE POLICY "Public can view public buckets"
ON storage.buckets FOR SELECT
TO public
USING (public = true);

-- -----------------------------------------------------------------------------
-- 3. STORAGE OBJECTS RLS POLICIES
-- -----------------------------------------------------------------------------

-- A. POST_IMAGES POLICIES
DROP POLICY IF EXISTS "Public post images viewing" ON storage.objects;
DROP POLICY IF EXISTS "Public can view public post_images" ON storage.objects;
CREATE POLICY "Public can view public post_images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post_images');

DROP POLICY IF EXISTS "Users can upload post images" ON storage.objects;
CREATE POLICY "Users can upload post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'post_images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own post images" ON storage.objects;
CREATE POLICY "Users can update their own post images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'post_images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own post images" ON storage.objects;
CREATE POLICY "Users can delete their own post images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'post_images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- B. REELS_VIDEOS POLICIES
DROP POLICY IF EXISTS "Public can view public reels_videos" ON storage.objects;
CREATE POLICY "Public can view public reels_videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'reels_videos');

DROP POLICY IF EXISTS "Users can upload reels videos" ON storage.objects;
CREATE POLICY "Users can upload reels videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'reels_videos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own reels videos" ON storage.objects;
CREATE POLICY "Users can update their own reels videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'reels_videos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own reels videos" ON storage.objects;
CREATE POLICY "Users can delete their own reels videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'reels_videos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- C. STORIES POLICIES
DROP POLICY IF EXISTS "Public can view public stories" ON storage.objects;
CREATE POLICY "Public can view public stories"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stories');

DROP POLICY IF EXISTS "Users can upload stories" ON storage.objects;
CREATE POLICY "Users can upload stories"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'stories' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own stories" ON storage.objects;
CREATE POLICY "Users can update their own stories"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'stories' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own stories" ON storage.objects;
CREATE POLICY "Users can delete their own stories"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'stories' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- D. AVATARS POLICIES
DROP POLICY IF EXISTS "Public avatar viewing" ON storage.objects;
CREATE POLICY "Public avatar viewing"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- E. LEARNING RESOURCES STORAGE POLICIES (Non-recursive)
DROP POLICY IF EXISTS "Conversation members can read learning resources" ON storage.objects;
CREATE POLICY "Conversation members can read learning resources"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'learning_resources' AND (
        auth.uid() = owner OR (
            (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND
            public.is_conversation_member(((storage.foldername(name))[1])::uuid, auth.uid())
        )
    )
);

DROP POLICY IF EXISTS "Conversation members can upload learning resources" ON storage.objects;
CREATE POLICY "Conversation members can upload learning resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'learning_resources' AND
    (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND
    public.is_conversation_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "Owners can delete their learning resources" ON storage.objects;
CREATE POLICY "Owners can delete their learning resources"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'learning_resources' AND
    auth.uid() = owner
);

-- -----------------------------------------------------------------------------
-- 4. POSTS TABLE EXTENSIONS
-- -----------------------------------------------------------------------------
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
-- 5. STORIES TABLE CREATION
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

DROP POLICY IF EXISTS "Unexpired stories are viewable by all users" ON public.stories;
DROP POLICY IF EXISTS "Unexpired stories are viewable by authenticated users" ON public.stories;
CREATE POLICY "Unexpired stories are viewable by all users"
ON public.stories FOR SELECT
TO public
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
-- 6. REALTIME REPLICATION & POSTGREST SCHEMA CACHE RELOAD
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

