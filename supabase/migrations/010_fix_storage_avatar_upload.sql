-- ==============================================================================
-- UPMIND Database Schema Migration 010: Fix Storage Avatar Upload (Error 503 / 42P17)
--
-- Root Cause:
-- 1. Table `public.conversation_members` had a self-referencing SELECT RLS policy
--    that queried `public.conversation_members` itself, causing PostgreSQL error
--    42P17 (infinite_recursion / DatabaseInvalidObjectDefinition).
-- 2. Because `storage.objects` had an INSERT policy ("Conversation members can upload learning resources")
--    that queried `public.conversation_members`, ANY file upload to `storage.objects`
--    (including avatar uploads to the 'avatars' bucket) evaluated all INSERT policies,
--    triggering the infinite recursion loop in `conversation_members` and causing
--    Supabase Storage to fail with HTTP 503 DatabaseInvalidObjectDefinition.
-- 3. The `storage.buckets` table lacked a SELECT policy for public/authenticated users,
--    causing `getBucket('avatars')` to return 404.
--
-- This migration safely fixes the recursion using a SECURITY DEFINER helper function,
-- ensures the `avatars` bucket is configured, and repairs storage policies without
-- touching or deleting any existing user records or data.
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

-- -----------------------------------------------------------------------------
-- 2. REPAIR CONVERSATION MEMBERS RLS (ELIMINATE RECURSION)
-- -----------------------------------------------------------------------------

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

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
-- 3. REPAIR CONVERSATIONS RLS (USE NON-RECURSIVE HELPER)
-- -----------------------------------------------------------------------------

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
CREATE POLICY "Members can view conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
    public.is_conversation_member(id, auth.uid())
);

DROP POLICY IF EXISTS "Members can update conversations" ON public.conversations;
CREATE POLICY "Members can update conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (
    public.is_conversation_member(id, auth.uid())
);

-- -----------------------------------------------------------------------------
-- 4. ENSURE STORAGE BUCKETS (avatars, post_images, learning_resources)
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('post_images', 'post_images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('learning_resources', 'learning_resources', false, 10485760, ARRAY['application/pdf', 'text/plain', 'text/markdown', 'image/jpeg', 'image/png', 'image/webp', 'application/zip', 'application/x-zip-compressed'])
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
-- 5. REPAIR STORAGE OBJECT POLICIES (AVATARS & LEARNING RESOURCES)
-- -----------------------------------------------------------------------------

-- Avatar Policies
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

-- Post Images Policies
DROP POLICY IF EXISTS "Public post images viewing" ON storage.objects;
CREATE POLICY "Public post images viewing"
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

DROP POLICY IF EXISTS "Users can delete their own post images" ON storage.objects;
CREATE POLICY "Users can delete their own post images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'post_images' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Learning Resources Storage Policies (Non-recursive)
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
-- 6. RELOAD SCHEMA CACHE
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
