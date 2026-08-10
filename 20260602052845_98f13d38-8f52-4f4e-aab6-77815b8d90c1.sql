-- Allow posts that contain only media (image or video) without text.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_content_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_content_length_check
  CHECK (char_length(content) <= 5000);

ALTER TABLE public.posts
  ADD CONSTRAINT posts_has_content_or_media_check
  CHECK (
    char_length(coalesce(content, '')) >= 1
    OR image_url IS NOT NULL
    OR video_url IS NOT NULL
  );