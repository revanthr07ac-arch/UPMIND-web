-- ==============================================================================
-- UPMIND Database Schema Migration 013: Full Communities System
-- ==============================================================================

-- 1. COMMUNITIES TABLE
CREATE TABLE IF NOT EXISTS public.communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    cover_image_path TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    is_private BOOLEAN DEFAULT FALSE NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    members_count INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Ensure all columns and constraints exist safely if table was partially created
DO $$
BEGIN
    ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS cover_url TEXT;
    ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS cover_image_path TEXT;
    ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';
    ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS members_count INTEGER DEFAULT 1;
    ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Synchronize legacy columns if table previously had data
UPDATE public.communities SET owner_id = created_by WHERE owner_id IS NULL AND created_by IS NOT NULL;
UPDATE public.communities SET created_by = owner_id WHERE created_by IS NULL AND owner_id IS NOT NULL;
UPDATE public.communities SET is_private = (visibility = 'private') WHERE is_private IS NULL;
UPDATE public.communities SET visibility = CASE WHEN is_private = TRUE THEN 'private' ELSE 'public' END WHERE visibility IS NULL;

-- Indexes for Communities
CREATE UNIQUE INDEX IF NOT EXISTS idx_communities_slug ON public.communities (LOWER(slug));
CREATE INDEX IF NOT EXISTS idx_communities_category ON public.communities (category);
CREATE INDEX IF NOT EXISTS idx_communities_owner ON public.communities (owner_id);
CREATE INDEX IF NOT EXISTS idx_communities_created_by ON public.communities (created_by);
CREATE INDEX IF NOT EXISTS idx_communities_visibility ON public.communities (visibility);
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON public.communities (created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. COMMUNITY MEMBERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member', 'admin')),
    joined_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT uq_community_member UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_comm ON public.community_members (community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON public.community_members (user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_role ON public.community_members (community_id, role);

-- -----------------------------------------------------------------------------
-- 3. COMMUNITY JOIN REQUESTS (Private Communities)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT uq_community_join_request UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_comm_status ON public.community_join_requests (community_id, status);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON public.community_join_requests (user_id);

-- -----------------------------------------------------------------------------
-- 4. COMMUNITY POSTS (Discussions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comm_posts_comm ON public.community_posts (community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_posts_author ON public.community_posts (author_id);

-- -----------------------------------------------------------------------------
-- 5. COMMUNITY POST COMMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comm_comments_post ON public.community_post_comments (community_post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comm_comments_author ON public.community_post_comments (author_id);

-- -----------------------------------------------------------------------------
-- 6. COMMUNITY POST MEDIA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_post_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comm_media_post ON public.community_post_media (community_post_id);

-- -----------------------------------------------------------------------------
-- 7. HELPER FUNCTIONS FOR SECURITY DEFINER CHECKS (Avoids RLS Recursion)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_community_member(comm_id UUID, u_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = comm_id AND user_id = u_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_community_moderator_or_owner(comm_id UUID, u_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = comm_id AND (owner_id = u_id OR created_by = u_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = comm_id AND user_id = u_id AND role IN ('owner', 'admin', 'moderator')
  );
$$;

-- -----------------------------------------------------------------------------
-- 8. TRIGGERS: AUTOMATIC MEMBER COUNT & OWNER SYNCHRONIZATION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_community_members_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.communities
        SET members_count = (SELECT COUNT(*) FROM public.community_members WHERE community_id = NEW.community_id),
            updated_at = NOW()
        WHERE id = NEW.community_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.communities
        SET members_count = (SELECT COUNT(*) FROM public.community_members WHERE community_id = OLD.community_id),
            updated_at = NOW()
        WHERE id = OLD.community_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_community_members_count ON public.community_members;
CREATE TRIGGER trg_sync_community_members_count
AFTER INSERT OR DELETE ON public.community_members
FOR EACH ROW EXECUTE FUNCTION public.sync_community_members_count();

-- Automatically add owner into community_members on community creation
CREATE OR REPLACE FUNCTION public.handle_new_community_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.community_members (community_id, user_id, role, joined_at)
    VALUES (NEW.id, COALESCE(NEW.owner_id, NEW.created_by), 'owner', NOW())
    ON CONFLICT (community_id, user_id) DO UPDATE SET role = 'owner';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_add_community_owner ON public.communities;
CREATE TRIGGER trg_auto_add_community_owner
AFTER INSERT ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.handle_new_community_owner();

-- -----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_media ENABLE ROW LEVEL SECURITY;

-- Communities RLS Policies
DROP POLICY IF EXISTS "Public communities are viewable by all" ON public.communities;
CREATE POLICY "Public communities are viewable by all"
ON public.communities FOR SELECT
TO public
USING (
    visibility = 'public' 
    OR NOT is_private 
    OR owner_id = auth.uid() 
    OR created_by = auth.uid()
    OR public.is_community_member(communities.id, auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can create communities" ON public.communities;
CREATE POLICY "Authenticated users can create communities"
ON public.communities FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = COALESCE(owner_id, created_by)
);

DROP POLICY IF EXISTS "Owners and moderators can update communities" ON public.communities;
CREATE POLICY "Owners and moderators can update communities"
ON public.communities FOR UPDATE
TO authenticated
USING (
    auth.uid() = COALESCE(owner_id, created_by)
    OR public.is_community_moderator_or_owner(communities.id, auth.uid())
);

DROP POLICY IF EXISTS "Only owners can delete communities" ON public.communities;
CREATE POLICY "Only owners can delete communities"
ON public.communities FOR DELETE
TO authenticated
USING (
    auth.uid() = COALESCE(owner_id, created_by)
);

-- Community Members RLS Policies
DROP POLICY IF EXISTS "Members are viewable by all" ON public.community_members;
CREATE POLICY "Members are viewable by all"
ON public.community_members FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Users can join public communities or admins can add" ON public.community_members;
CREATE POLICY "Users can join public communities or admins can add"
ON public.community_members FOR INSERT
TO authenticated
WITH CHECK (
    -- Normal user joining themselves to a public community as 'member'
    (
        auth.uid() = user_id 
        AND role = 'member'
        AND EXISTS (
            SELECT 1 FROM public.communities 
            WHERE id = community_id AND (visibility = 'public' OR NOT is_private)
        )
    )
    -- Owner joining during community creation as 'owner'
    OR (
        auth.uid() = user_id
        AND role = 'owner'
        AND EXISTS (
            SELECT 1 FROM public.communities 
            WHERE id = community_id AND (owner_id = auth.uid() OR created_by = auth.uid())
        )
    )
    -- Or authorized owner/moderator adding a member
    OR public.is_community_moderator_or_owner(community_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can leave communities or owners can remove" ON public.community_members;
CREATE POLICY "Users can leave communities or owners can remove"
ON public.community_members FOR DELETE
TO authenticated
USING (
    -- Member leaving themselves (cannot leave if owner)
    (auth.uid() = user_id AND role != 'owner')
    -- Or owner/moderator removing member
    OR public.is_community_moderator_or_owner(community_id, auth.uid())
);

-- Community Posts RLS Policies
DROP POLICY IF EXISTS "Posts viewable if community is public or user is member" ON public.community_posts;
CREATE POLICY "Posts viewable if community is public or user is member"
ON public.community_posts FOR SELECT
TO public
USING (
    EXISTS (
        SELECT 1 FROM public.communities c
        WHERE c.id = community_posts.community_id 
        AND (c.visibility = 'public' OR NOT c.is_private)
    )
    OR public.is_community_member(community_posts.community_id, auth.uid())
);

DROP POLICY IF EXISTS "Members can create posts" ON public.community_posts;
CREATE POLICY "Members can create posts"
ON public.community_posts FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = author_id
    AND public.is_community_member(community_posts.community_id, auth.uid())
);

DROP POLICY IF EXISTS "Authors can update their own posts" ON public.community_posts;
CREATE POLICY "Authors can update their own posts"
ON public.community_posts FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors and moderators can delete posts" ON public.community_posts;
CREATE POLICY "Authors and moderators can delete posts"
ON public.community_posts FOR DELETE
TO authenticated
USING (
    auth.uid() = author_id
    OR public.is_community_moderator_or_owner(community_posts.community_id, auth.uid())
);

-- Community Post Comments RLS Policies
DROP POLICY IF EXISTS "Comments viewable by all who can see post" ON public.community_post_comments;
CREATE POLICY "Comments viewable by all who can see post"
ON public.community_post_comments FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Members can comment on community posts" ON public.community_post_comments;
CREATE POLICY "Members can comment on community posts"
ON public.community_post_comments FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = author_id
);

DROP POLICY IF EXISTS "Authors and moderators can delete comments" ON public.community_post_comments;
CREATE POLICY "Authors and moderators can delete comments"
ON public.community_post_comments FOR DELETE
TO authenticated
USING (
    auth.uid() = author_id
    OR EXISTS (
        SELECT 1 FROM public.community_posts p
        WHERE p.id = community_post_comments.community_post_id
        AND public.is_community_moderator_or_owner(p.community_id, auth.uid())
    )
);

-- Community Join Requests RLS Policies
DROP POLICY IF EXISTS "Users can view own requests or owners see community requests" ON public.community_join_requests;
CREATE POLICY "Users can view own requests or owners see community requests"
ON public.community_join_requests FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_community_moderator_or_owner(community_join_requests.community_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can submit join requests" ON public.community_join_requests;
CREATE POLICY "Users can submit join requests"
ON public.community_join_requests FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
);

DROP POLICY IF EXISTS "Owners and moderators can update join requests" ON public.community_join_requests;
CREATE POLICY "Owners and moderators can update join requests"
ON public.community_join_requests FOR UPDATE
TO authenticated
USING (
    public.is_community_moderator_or_owner(community_join_requests.community_id, auth.uid())
);

-- Community Post Media RLS Policies
DROP POLICY IF EXISTS "Media viewable by all" ON public.community_post_media;
CREATE POLICY "Media viewable by all"
ON public.community_post_media FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Authors can insert media" ON public.community_post_media;
CREATE POLICY "Authors can insert media"
ON public.community_post_media FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.community_posts p
        WHERE p.id = community_post_media.community_post_id AND p.author_id = auth.uid()
    )
);

-- -----------------------------------------------------------------------------
-- 10. REALTIME PUBLICATION REPLICATION
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.communities;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_members;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Reload schema cache in PostgREST
NOTIFY pgrst, 'reload schema';
