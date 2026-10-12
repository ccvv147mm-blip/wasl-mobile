ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS music_url text,
  ADD COLUMN IF NOT EXISTS music_title text;

CREATE TABLE IF NOT EXISTS public.music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  prompt text,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.music_tracks TO authenticated;
GRANT ALL ON public.music_tracks TO service_role;

ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "music tracks readable" ON public.music_tracks;
CREATE POLICY "music tracks readable"
ON public.music_tracks FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "story music readable" ON storage.objects;
CREATE POLICY "story music readable"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'story-music');

DROP POLICY IF EXISTS "story music user write" ON storage.objects;
CREATE POLICY "story music user write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'story-music'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND public.storage_mime_allowed(name, metadata->>'mimetype', array['audio'])
);

DROP POLICY IF EXISTS "story music user delete" ON storage.objects;
CREATE POLICY "story music user delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'story-music'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);