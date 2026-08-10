CREATE OR REPLACE FUNCTION public.approve_recharge(_request_id uuid, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _r record;
  _new_balance integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;

  SELECT * INTO _r FROM public.recharge_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'already reviewed'; END IF;

  PERFORM set_config('app.bypass_credit_guard', 'on', true);
  UPDATE public.profiles
    SET credits = credits + _r.points
    WHERE id = _r.user_id
    RETURNING credits INTO _new_balance;
  PERFORM set_config('app.bypass_credit_guard', 'off', true);

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  UPDATE public.recharge_requests
    SET status='approved', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id = _request_id;

  INSERT INTO public.messages(sender_id, recipient_id, content)
  VALUES (auth.uid(), _r.user_id,
    'وَصْل | إيصال شحن: تم استلام طلب الشحن الخاص بك والموافقة عليه. تمت إضافة ' || _r.points::text ||
    ' نقطة إلى رصيدك الحالي بنجاح، ويمكنك استخدامها الآن لإرسال الهدايا. رصيدك الحالي: ' || _new_balance::text || ' نقطة.' ||
    CASE WHEN _note IS NOT NULL AND length(trim(_note)) > 0 THEN ' ملاحظة الإدارة: ' || trim(_note) ELSE '' END
  );
END;
$function$;

CREATE TABLE public.video_likes (
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.video_likes TO authenticated;
GRANT ALL ON public.video_likes TO service_role;
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Video likes are viewable by authenticated users"
  ON public.video_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like videos as themselves"
  ON public.video_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own video likes"
  ON public.video_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.video_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.video_comments TO authenticated;
GRANT ALL ON public.video_comments TO service_role;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Video comments are viewable by authenticated users"
  ON public.video_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can comment on videos as themselves"
  ON public.video_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND length(trim(content)) > 0);
CREATE POLICY "Users can delete their own video comments"
  ON public.video_comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE public.video_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.video_shares TO authenticated;
GRANT ALL ON public.video_shares TO service_role;
ALTER TABLE public.video_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Video shares are viewable by authenticated users"
  ON public.video_shares FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can share videos as themselves"
  ON public.video_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own video shares"
  ON public.video_shares FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.video_gifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  gift_type text NOT NULL,
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_gifts TO authenticated;
GRANT ALL ON public.video_gifts TO service_role;
ALTER TABLE public.video_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Video gifts are viewable by authenticated users"
  ON public.video_gifts FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_video_comments_video ON public.video_comments(video_id, created_at);
CREATE INDEX idx_video_shares_video ON public.video_shares(video_id);
CREATE INDEX idx_video_gifts_video ON public.video_gifts(video_id);
CREATE INDEX idx_video_gifts_recipient ON public.video_gifts(recipient_id);

CREATE OR REPLACE FUNCTION public.send_video_gift(_video_id uuid, _gift_type text, _value integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sender uuid := auth.uid();
  _recipient uuid;
  _gift_id uuid;
  _balance int;
  _sender_name text;
  _video_title text;
BEGIN
  IF _sender IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _value <= 0 OR _value > 5000 THEN RAISE EXCEPTION 'invalid value'; END IF;

  SELECT author_id, title INTO _recipient, _video_title FROM public.videos WHERE id = _video_id;
  IF _recipient IS NULL THEN RAISE EXCEPTION 'video not found'; END IF;
  IF _sender = _recipient THEN RAISE EXCEPTION 'cannot gift self'; END IF;

  SELECT credits INTO _balance FROM public.profiles WHERE id = _sender FOR UPDATE;
  IF _balance IS NULL OR _balance < _value THEN RAISE EXCEPTION 'insufficient credits'; END IF;

  PERFORM set_config('app.bypass_credit_guard', 'on', true);
  UPDATE public.profiles SET credits = credits - _value WHERE id = _sender;
  UPDATE public.profiles SET credits = credits + _value WHERE id = _recipient;
  PERFORM set_config('app.bypass_credit_guard', 'off', true);

  INSERT INTO public.video_gifts (video_id, sender_id, recipient_id, gift_type, value)
  VALUES (_video_id, _sender, _recipient, _gift_type, _value)
  RETURNING id INTO _gift_id;

  SELECT COALESCE(full_name, username, 'صديق') INTO _sender_name FROM public.profiles WHERE id = _sender;
  INSERT INTO public.messages (sender_id, recipient_id, content)
  VALUES (_sender, _recipient,
    '🎁 أرسل لك ' || _sender_name || ' هدية (' || _gift_type || ') بقيمة ' || _value::text ||
    ' نقطة على فيديو "' || COALESCE(_video_title, 'بدون عنوان') || '". تمت إضافتها إلى رصيدك!');

  RETURN _gift_id;
END;
$function$;