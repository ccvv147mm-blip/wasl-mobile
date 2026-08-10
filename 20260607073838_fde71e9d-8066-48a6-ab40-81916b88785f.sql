
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_platform_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_platform_check
  CHECK (platform = ANY (ARRAY['youtube'::text,'tiktok'::text,'instagram'::text,'x'::text,'native'::text]));
ALTER TABLE public.videos ALTER COLUMN video_id DROP NOT NULL;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS duration_seconds numeric;

-- storage policies for the upcoming 'videos' bucket (bucket itself is created via tool)
DROP POLICY IF EXISTS "videos read public" ON storage.objects;
DROP POLICY IF EXISTS "videos upload own" ON storage.objects;
DROP POLICY IF EXISTS "videos delete own" ON storage.objects;

CREATE POLICY "videos read public" ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');
CREATE POLICY "videos upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "videos delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);
