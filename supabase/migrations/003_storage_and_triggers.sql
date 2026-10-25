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
