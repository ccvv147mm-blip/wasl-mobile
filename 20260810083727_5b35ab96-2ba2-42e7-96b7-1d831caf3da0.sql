-- ===== جلسات البث المباشر =====
CREATE TABLE public.live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'بث مباشر',
  status text NOT NULL DEFAULT 'live',
  viewers_count integer NOT NULL DEFAULT 0,
  peak_viewers integer NOT NULL DEFAULT 0,
  total_gift_points integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_streams TO authenticated;
GRANT ALL ON public.live_streams TO service_role;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_streams_select_authenticated" ON public.live_streams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "live_streams_insert_own" ON public.live_streams
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "live_streams_update_own" ON public.live_streams
  FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
CREATE POLICY "live_streams_delete_own" ON public.live_streams
  FOR DELETE TO authenticated USING (auth.uid() = host_id);

CREATE INDEX live_streams_status_idx ON public.live_streams (status, started_at DESC);

CREATE TRIGGER trg_live_streams_updated_at
  BEFORE UPDATE ON public.live_streams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- منع المضيف من تعديل الأرقام المالية/الإحصائية يدوياً
CREATE OR REPLACE FUNCTION public.live_streams_protect_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.total_gift_points IS DISTINCT FROM OLD.total_gift_points
     AND auth.uid() IS NOT NULL
     AND coalesce(current_setting('app.bypass_live_guard', true), '') <> 'on' THEN
    RAISE EXCEPTION 'total_gift_points may not be modified directly';
  END IF;
  IF NEW.host_id IS DISTINCT FROM OLD.host_id THEN
    RAISE EXCEPTION 'host_id cannot be changed';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_live_streams_protect_totals
  BEFORE UPDATE ON public.live_streams
  FOR EACH ROW EXECUTE FUNCTION public.live_streams_protect_totals();

-- ===== دردشة البث =====
CREATE TABLE public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_chat_content_len CHECK (char_length(content) BETWEEN 1 AND 500)
);

GRANT SELECT, INSERT, DELETE ON public.live_chat_messages TO authenticated;
GRANT ALL ON public.live_chat_messages TO service_role;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_chat_select_authenticated" ON public.live_chat_messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "live_chat_insert_own" ON public.live_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "live_chat_delete_own_or_host" ON public.live_chat_messages
  FOR DELETE TO authenticated USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id AND s.host_id = auth.uid())
  );

CREATE INDEX live_chat_stream_idx ON public.live_chat_messages (stream_id, created_at DESC);

-- ===== هدايا البث =====
CREATE TABLE public.live_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  gift_type text NOT NULL,
  value integer NOT NULL,
  host_points integer NOT NULL,
  platform_points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.live_gifts TO authenticated;
GRANT ALL ON public.live_gifts TO service_role;
ALTER TABLE public.live_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_gifts_select_authenticated" ON public.live_gifts
  FOR SELECT TO authenticated USING (true);

CREATE INDEX live_gifts_stream_idx ON public.live_gifts (stream_id, created_at DESC);

-- نسبة التطبيق من هدايا البث
INSERT INTO public.app_settings(key, value, updated_at)
VALUES ('live_gift_fee_percent', '10', now())
ON CONFLICT (key) DO NOTHING;

-- ===== بدء / إنهاء البث =====
CREATE OR REPLACE FUNCTION public.start_live_stream(_title text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _host uuid := auth.uid(); _id uuid;
BEGIN
  IF _host IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  UPDATE public.live_streams SET status='ended', ended_at=now()
    WHERE host_id = _host AND status='live';
  INSERT INTO public.live_streams(host_id, title)
  VALUES (_host, COALESCE(NULLIF(trim(_title), ''), 'بث مباشر'))
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.end_live_stream(_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.live_streams SET status='ended', ended_at=now(), viewers_count=0
    WHERE id = _stream_id AND (host_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
END; $$;

CREATE OR REPLACE FUNCTION public.set_live_viewers(_stream_id uuid, _count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _count < 0 OR _count > 100000 THEN RETURN; END IF;
  UPDATE public.live_streams
    SET viewers_count = _count,
        peak_viewers = GREATEST(peak_viewers, _count)
    WHERE id = _stream_id AND host_id = auth.uid();
END; $$;

-- ===== إرسال هدية داخل البث (مع نسبة التطبيق) =====
CREATE OR REPLACE FUNCTION public.send_live_gift(_stream_id uuid, _gift_type text, _value integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender uuid := auth.uid();
  _host uuid;
  _status text;
  _balance int;
  _pct numeric := 10;
  _fee int;
  _host_points int;
  _id uuid;
BEGIN
  IF _sender IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _value <= 0 THEN RAISE EXCEPTION 'invalid value'; END IF;

  SELECT host_id, status INTO _host, _status FROM public.live_streams WHERE id = _stream_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'stream not found'; END IF;
  IF _status <> 'live' THEN RAISE EXCEPTION 'البث غير مباشر الآن'; END IF;
  IF _host = _sender THEN RAISE EXCEPTION 'cannot gift self'; END IF;

  SELECT COALESCE(NULLIF(value,'')::numeric, 10) INTO _pct
    FROM public.app_settings WHERE key = 'live_gift_fee_percent';
  IF _pct IS NULL OR _pct < 0 OR _pct > 90 THEN _pct := 10; END IF;

  _fee := FLOOR(_value * _pct / 100.0)::int;
  _host_points := _value - _fee;

  SELECT credits INTO _balance FROM public.profiles WHERE id = _sender FOR UPDATE;
  IF _balance IS NULL OR _balance < _value THEN RAISE EXCEPTION 'insufficient credits'; END IF;

  PERFORM set_config('app.bypass_credit_guard', 'on', true);
  UPDATE public.profiles SET credits = credits - _value WHERE id = _sender;
  UPDATE public.profiles SET credits = credits + _host_points WHERE id = _host;
  PERFORM set_config('app.bypass_credit_guard', 'off', true);

  INSERT INTO public.live_gifts(stream_id, sender_id, recipient_id, gift_type, value, host_points, platform_points)
  VALUES (_stream_id, _sender, _host, _gift_type, _value, _host_points, _fee)
  RETURNING id INTO _id;

  PERFORM set_config('app.bypass_live_guard', 'on', true);
  UPDATE public.live_streams SET total_gift_points = total_gift_points + _value WHERE id = _stream_id;
  PERFORM set_config('app.bypass_live_guard', 'off', true);

  PERFORM public.push_notification(_host, _sender, 'gift',
    public.actor_name(_sender) || ' أرسل لك هدية في البث المباشر',
    _gift_type || ' بقيمة ' || _value::text || ' نقطة (صافي ' || _host_points::text || ')',
    '/live/' || _stream_id::text);

  RETURN _id;
END; $$;

-- إتاحة التحديث اللحظي
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_gifts;
ALTER TABLE public.live_streams REPLICA IDENTITY FULL;
ALTER TABLE public.live_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.live_gifts REPLICA IDENTITY FULL;