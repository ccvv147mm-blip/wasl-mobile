-- Videos table
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok')),
  video_id TEXT NOT NULL,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Videos viewable by authenticated"
ON public.videos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own videos"
ON public.videos FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users delete own videos"
ON public.videos FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE POLICY "Users update own videos"
ON public.videos FOR UPDATE TO authenticated USING (auth.uid() = author_id);

CREATE INDEX idx_videos_created_at ON public.videos (created_at DESC);
CREATE INDEX idx_videos_author ON public.videos (author_id);

-- Function to increment views (bypasses RLS for view counting)
CREATE OR REPLACE FUNCTION public.increment_video_views(_video_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.videos SET views_count = views_count + 1 WHERE id = _video_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_video_views(UUID) TO authenticated;