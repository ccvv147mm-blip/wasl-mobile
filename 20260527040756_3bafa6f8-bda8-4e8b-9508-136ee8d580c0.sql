
-- 1. Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own messages" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "mark own received as read" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id);
CREATE POLICY "delete own sent" ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);
CREATE INDEX idx_messages_thread ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_messages_recipient ON public.messages (recipient_id, created_at DESC);

-- 2. Gifts
CREATE TABLE public.gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  gift_type text NOT NULL CHECK (gift_type IN ('rose','heart','star','crown','diamond')),
  value integer NOT NULL CHECK (value > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.gifts TO authenticated;
GRANT ALL ON public.gifts TO service_role;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gifts viewable" ON public.gifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "send gifts" ON public.gifts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE INDEX idx_gifts_post ON public.gifts (post_id);
CREATE INDEX idx_gifts_recipient ON public.gifts (recipient_id);

-- 3. Shares
CREATE TABLE public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.shares TO authenticated;
GRANT ALL ON public.shares TO service_role;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shares viewable" ON public.shares FOR SELECT TO authenticated USING (true);
CREATE POLICY "share own" ON public.shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "unshare own" ON public.shares FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_shares_post ON public.shares (post_id);

-- 4. Add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 100;

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS audio_duration_ms integer;
ALTER TABLE public.comments ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.comments ADD CONSTRAINT comments_has_body
  CHECK (content IS NOT NULL OR audio_url IS NOT NULL);

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS image_url text;

-- 5. Allow more platforms on videos
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_platform_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_platform_check
  CHECK (platform IN ('youtube','tiktok','instagram','x'));

-- 6. Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars','avatars',true), ('voice-comments','voice-comments',true), ('post-media','post-media',true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (per-user folder = auth.uid())
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars user write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars user update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "voice public read" ON storage.objects FOR SELECT USING (bucket_id = 'voice-comments');
CREATE POLICY "voice user write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-comments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "voice user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'voice-comments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "media public read" ON storage.objects FOR SELECT USING (bucket_id = 'post-media');
CREATE POLICY "media user write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "media user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 7. Send gift function: deduct sender credits, credit recipient atomically
CREATE OR REPLACE FUNCTION public.send_gift(_post_id uuid, _recipient_id uuid, _gift_type text, _value int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender uuid := auth.uid();
  _gift_id uuid;
  _balance int;
BEGIN
  IF _sender IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _sender = _recipient_id THEN RAISE EXCEPTION 'cannot gift self'; END IF;
  IF _value <= 0 OR _value > 1000 THEN RAISE EXCEPTION 'invalid value'; END IF;

  SELECT credits INTO _balance FROM public.profiles WHERE id = _sender FOR UPDATE;
  IF _balance IS NULL OR _balance < _value THEN RAISE EXCEPTION 'insufficient credits'; END IF;

  UPDATE public.profiles SET credits = credits - _value WHERE id = _sender;
  UPDATE public.profiles SET credits = credits + _value WHERE id = _recipient_id;

  INSERT INTO public.gifts (post_id, sender_id, recipient_id, gift_type, value)
  VALUES (_post_id, _sender, _recipient_id, _gift_type, _value)
  RETURNING id INTO _gift_id;

  RETURN _gift_id;
END;
$$;
