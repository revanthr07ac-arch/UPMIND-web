-- =============================================================================
-- UPMIND MIGRATION 008: Peer Learning, Messaging, Conversations & Shared Resources (Step 5)
-- Safe, idempotent migration establishing real 1-on-1 conversations, messaging,
-- private resource sharing in Supabase Storage, and granular Row Level Security.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. UPDATE NOTIFICATIONS CONSTRAINTS
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    -- Update type check to include new_message and learning_request_completed
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
        CHECK (type IN ('follow', 'comment', 'like', 'learning_request_new', 'learning_request_accepted', 'learning_request_declined', 'learning_request_completed', 'new_message'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. PREVENT DUPLICATE PENDING LEARNING REQUESTS
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_learning_request 
    ON public.learning_requests(learner_id, teacher_id, skill_id) 
    WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- 3. CONVERSATIONS & CONVERSATION MEMBERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid();

CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_conversation_member UNIQUE (conversation_id, user_id)
);
ALTER TABLE public.conversation_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON public.conversation_members(conversation_id);

-- -----------------------------------------------------------------------------
-- 4. MESSAGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'resource')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- -----------------------------------------------------------------------------
-- 5. SHARED RESOURCES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('link', 'note', 'file')),
    url TEXT,
    file_path TEXT,
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_shared_resources_conv ON public.shared_resources(conversation_id);

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

-- Conversations RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can update conversations" ON public.conversations;

CREATE POLICY "Members can view conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = conversations.id
          AND cm.user_id = auth.uid()
    )
);

CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Members can update conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = conversations.id
          AND cm.user_id = auth.uid()
    )
);

-- Conversation Members RLS
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join or add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can update their own member state" ON public.conversation_members;

CREATE POLICY "Members can view conversation members"
ON public.conversation_members FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = conversation_members.conversation_id
          AND cm.user_id = auth.uid()
    )
);

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
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = conversation_members.conversation_id
          AND cm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own member state"
ON public.conversation_members FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Messages RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Members can insert messages" ON public.messages;

CREATE POLICY "Members can view messages"
ON public.messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = messages.conversation_id
          AND cm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can insert messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = messages.conversation_id
          AND cm.user_id = auth.uid()
    )
);

-- Shared Resources RLS
ALTER TABLE public.shared_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view shared resources" ON public.shared_resources;
DROP POLICY IF EXISTS "Members can insert shared resources" ON public.shared_resources;

CREATE POLICY "Members can view shared resources"
ON public.shared_resources FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = shared_resources.conversation_id
          AND cm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can insert shared resources"
ON public.shared_resources FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = uploader_id AND
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = shared_resources.conversation_id
          AND cm.user_id = auth.uid()
    )
);

-- Refined Learning Requests RLS (Strict state transitions)
DROP POLICY IF EXISTS "Participants can update learning requests" ON public.learning_requests;
CREATE POLICY "Participants can update learning requests"
ON public.learning_requests FOR UPDATE
TO authenticated
USING (
    auth.uid() = learner_id OR auth.uid() = teacher_id
)
WITH CHECK (
    (auth.uid() = teacher_id AND status IN ('accepted', 'declined', 'completed')) OR
    (auth.uid() = learner_id AND status IN ('cancelled', 'completed'))
);

-- -----------------------------------------------------------------------------
-- 7. TRIGGERS: CONVERSATION ACTIVITY & NOTIFICATIONS
-- -----------------------------------------------------------------------------

-- Trigger 1: Touch conversation updated_at when message is sent
CREATE OR REPLACE FUNCTION public.handle_new_message_conversation_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_message_update_conversation ON public.messages;
CREATE TRIGGER trg_message_update_conversation
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_message_conversation_update();

-- Trigger 2: Auto-create notification for other conversation members on new message
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (recipient_id, actor_id, type, related_entity_id, created_at)
    SELECT 
        cm.user_id,
        NEW.sender_id,
        'new_message',
        NEW.conversation_id,
        NOW()
    FROM public.conversation_members cm
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.user_id <> NEW.sender_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_message_notification ON public.messages;
CREATE TRIGGER trg_new_message_notification
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_message_notification();

-- -----------------------------------------------------------------------------
-- 8. PRIVATE STORAGE: LEARNING_RESOURCES BUCKET & RLS
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'learning_resources',
    'learning_resources',
    false, -- STRICTLY PRIVATE BUCKET
    10485760, -- 10MB limit
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/zip',
        'application/x-zip-compressed'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Conversation members can read learning resources" ON storage.objects;
DROP POLICY IF EXISTS "Conversation members can upload learning resources" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their learning resources" ON storage.objects;

-- Read requires being a conversation member
CREATE POLICY "Conversation members can read learning resources"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'learning_resources' AND (
        auth.uid() = owner OR
        EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id::text = (storage.foldername(name))[1]
              AND cm.user_id = auth.uid()
        )
    )
);

-- Upload requires being an authenticated conversation member
CREATE POLICY "Conversation members can upload learning resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'learning_resources' AND
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id::text = (storage.foldername(name))[1]
          AND cm.user_id = auth.uid()
    )
);

-- Delete requires object owner
CREATE POLICY "Owners can delete their learning resources"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'learning_resources' AND
    auth.uid() = owner
);

-- -----------------------------------------------------------------------------
-- 9. PERMISSIONS & REALTIME REPLICATION
-- -----------------------------------------------------------------------------
GRANT ALL ON public.conversations TO authenticated;
GRANT ALL ON public.conversation_members TO authenticated;
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.shared_resources TO authenticated;

-- Enable Realtime for live updates where configured
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 10. RELOAD POSTGREST SCHEMA CACHE
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
