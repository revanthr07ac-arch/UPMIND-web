-- ==============================================================================
-- UPMIND Database Schema Migration 009: Profile Highlights & Collections
-- ==============================================================================

-- Highlights table to support Instagram-style profile story highlights
CREATE TABLE IF NOT EXISTS public.highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    cover_url TEXT,
    icon_name TEXT,
    post_ids UUID[] DEFAULT '{}'::UUID[],
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON public.highlights (user_id, created_at DESC);

-- Enable RLS on highlights
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Highlights are viewable by all authenticated users"
ON public.highlights FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create their own highlights"
ON public.highlights FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights"
ON public.highlights FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights"
ON public.highlights FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
