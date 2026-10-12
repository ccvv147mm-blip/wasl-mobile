ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS filter text,
  ADD COLUMN IF NOT EXISTS mute_original boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS music_path text,
  ADD COLUMN IF NOT EXISTS music_title text;