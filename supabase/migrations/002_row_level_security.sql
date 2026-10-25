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
