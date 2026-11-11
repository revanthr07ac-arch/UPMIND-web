-- ==============================================================================
-- UPMIND MIGRATION 016: Strict Private Messaging & Conversation Security
-- Enforces zero-leak, database-level Row Level Security (RLS) for 1-on-1 chats:
-- 1. Conversations: Viewable and modifiable ONLY by enrolled participants.
-- 2. Conversation Members: Anti-tamper policy. Outsiders CANNOT force-join.
--    Only conversation creator can add members, capped strictly at 2 members.
-- 3. Messages: Viewable, insertable, editable, and deletable ONLY by verified
--    participants. Strict auth.uid() = sender_id enforcement.
-- 4. Shared Resources & Attachments: Stored in private bucket with RLS verification.
-- 5. Supabase Realtime: Scoped replication with REPLICA IDENTITY FULL.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CONVERSATIONS TABLE: Strictly Private to Enrolled Participants
-- ------------------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- SELECT: Only actual participants enrolled in conversation_members can view the conversation.
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
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

-- INSERT: Authenticated users can create a conversation, but created_by must strictly match auth.uid().
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = created_by
);

-- UPDATE: Only enrolled participants can touch conversation timestamps.
DROP POLICY IF EXISTS "Members can update conversations" ON public.conversations;
CREATE POLICY "Members can update conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = conversations.id
          AND cm.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = conversations.id
          AND cm.user_id = auth.uid()
    )
);

-- DELETE: Conversations cannot be deleted arbitrarily by individual users.
DROP POLICY IF EXISTS "Users cannot delete conversations" ON public.conversations;
CREATE POLICY "Users cannot delete conversations"
ON public.conversations FOR DELETE
TO authenticated
USING (false);


-- ------------------------------------------------------------------------------
-- 2. CONVERSATION MEMBERS TABLE: Anti-Tamper & Strict 2-Participant Limit
-- ------------------------------------------------------------------------------
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- SELECT: Only enrolled members of that specific conversation can view participant records.
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
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

-- INSERT: ANTI-TAMPER POLICY.
-- Outsiders CANNOT force-join. Only the verified conversation creator can add members,
-- and the total member count is strictly capped at 2 participants for 1-on-1 privacy.
DROP POLICY IF EXISTS "Users can join or add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Only conversation creator can add members up to 2" ON public.conversation_members;
CREATE POLICY "Only conversation creator can add members up to 2"
ON public.conversation_members FOR INSERT
TO authenticated
WITH CHECK (
    -- 1. The inserting user must be the verified creator of the conversation
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_members.conversation_id
          AND c.created_by = auth.uid()
    )
    -- 2. Enforce strict 1-on-1 limit: cannot exceed 2 participants
    AND (
        SELECT count(*)
        FROM public.conversation_members cm
        WHERE cm.conversation_id = conversation_members.conversation_id
    ) < 2
);

-- UPDATE: Users can only update their own member state (e.g., last_read_at timestamp).
DROP POLICY IF EXISTS "Users can update their own member state" ON public.conversation_members;
CREATE POLICY "Users can update their own member state"
ON public.conversation_members FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Members cannot arbitrarily remove other participants.
DROP POLICY IF EXISTS "Users cannot delete conversation members" ON public.conversation_members;
CREATE POLICY "Users cannot delete conversation members"
ON public.conversation_members FOR DELETE
TO authenticated
USING (false);


-- ------------------------------------------------------------------------------
-- 3. MESSAGES TABLE: Zero Cross-User Leakage
-- ------------------------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- SELECT: Strictly restricted to enrolled participants of the message's conversation.
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
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

-- INSERT: Strictly requires auth.uid() = sender_id AND sender must be an enrolled participant.
DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Members can insert messages" ON public.messages;
CREATE POLICY "Members can send messages"
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

-- UPDATE: Only the original author can edit their own message, provided they remain a participant.
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages"
ON public.messages FOR UPDATE
TO authenticated
USING (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = messages.conversation_id
          AND cm.user_id = auth.uid()
    )
)
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = messages.conversation_id
          AND cm.user_id = auth.uid()
    )
);

-- DELETE: Only the original author can delete their own message.
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages"
ON public.messages FOR DELETE
TO authenticated
USING (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = messages.conversation_id
          AND cm.user_id = auth.uid()
    )
);


-- ------------------------------------------------------------------------------
-- 4. SHARED RESOURCES TABLE: Private to Conversation Participants
-- ------------------------------------------------------------------------------
ALTER TABLE public.shared_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view shared resources" ON public.shared_resources;
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

DROP POLICY IF EXISTS "Members can insert shared resources" ON public.shared_resources;
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


-- ------------------------------------------------------------------------------
-- 5. STORAGE BUCKET: Private Learning Resources & Chat Attachments
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'learning_resources',
    'learning_resources',
    false, -- STRICTLY PRIVATE BUCKET (Not accessible without authentication)
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

-- Storage RLS: Ensure only participants of the folder's conversation_id can read/upload
DROP POLICY IF EXISTS "Conversation members can read learning resources" ON storage.objects;
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

DROP POLICY IF EXISTS "Conversation members can upload learning resources" ON storage.objects;
CREATE POLICY "Conversation members can upload learning resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'learning_resources' AND
    auth.uid() = owner AND
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id::text = (storage.foldername(name))[1]
          AND cm.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Owners can delete their learning resources" ON storage.objects;
CREATE POLICY "Owners can delete their learning resources"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'learning_resources' AND
    auth.uid() = owner
);


-- ------------------------------------------------------------------------------
-- 6. REALTIME REPLICATION & REPLICA IDENTITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;
END $$;

