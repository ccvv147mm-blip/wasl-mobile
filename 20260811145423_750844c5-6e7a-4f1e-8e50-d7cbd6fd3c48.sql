-- ألعاب وتحديات داخل البث المباشر
CREATE TABLE public.live_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  host_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reaction','quiz','emoji')),
  title text NOT NULL,
  prompt text,
  answer text,
  prize_points integer NOT NULL DEFAULT 0 CHECK (prize_points >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','ended')),
  winner_id uuid,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.live_games TO authenticated;
GRANT ALL ON public.live_games TO service_role;
ALTER TABLE public.live_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live games readable by authenticated"
  ON public.live_games FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_live_games_updated_at
  BEFORE UPDATE ON public.live_games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_live_games_stream ON public.live_games(stream_id, started_at DESC);

CREATE TABLE public.live_game_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.live_games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  answer text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);

GRANT SELECT ON public.live_game_participants TO authenticated;
GRANT ALL ON public.live_game_participants TO service_role;
ALTER TABLE public.live_game_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live game scores readable by authenticated"
  ON public.live_game_participants FOR SELECT TO authenticated USING (true);

-- بدء تحدٍ جديد (المضيف فقط) مع حجز الجائزة من رصيده
CREATE OR REPLACE FUNCTION public.start_live_game(
  _stream_id uuid, _kind text, _title text, _prompt text DEFAULT NULL,
  _answer text DEFAULT NULL, _prize_points integer DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _host uuid := auth.uid(); _status text; _balance int; _id uuid;
BEGIN
  IF _host IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _kind NOT IN ('reaction','quiz','emoji') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  IF COALESCE(_prize_points,0) < 0 THEN RAISE EXCEPTION 'invalid prize'; END IF;

  SELECT status INTO _status FROM public.live_streams
    WHERE id = _stream_id AND host_id = _host;
  IF _status IS NULL THEN RAISE EXCEPTION 'المضيف فقط يمكنه بدء التحدي'; END IF;
  IF _status <> 'live' THEN RAISE EXCEPTION 'البث غير مباشر الآن'; END IF;

  UPDATE public.live_games SET status='ended', ended_at=now()
    WHERE stream_id = _stream_id AND status='open';

  IF COALESCE(_prize_points,0) > 0 THEN
    SELECT credits INTO _balance FROM public.profiles WHERE id = _host FOR UPDATE;
    IF _balance IS NULL OR _balance < _prize_points THEN RAISE EXCEPTION 'رصيد غير كافٍ للجائزة'; END IF;
    PERFORM set_config('app.bypass_credit_guard','on',true);
    UPDATE public.profiles SET credits = credits - _prize_points WHERE id = _host;
    PERFORM set_config('app.bypass_credit_guard','off',true);
  END IF;

  INSERT INTO public.live_games(stream_id, host_id, kind, title, prompt, answer, prize_points)
  VALUES (_stream_id, _host, _kind,
          COALESCE(NULLIF(trim(_title),''), 'تحدٍ مباشر'),
          NULLIF(trim(_prompt),''), NULLIF(trim(_answer),''),
          COALESCE(_prize_points,0))
  RETURNING id INTO _id;

  RETURN _id;
END; $$;

-- إرسال نتيجة مشارك (مرة واحدة لكل تحدٍ)
CREATE OR REPLACE FUNCTION public.submit_live_game_score(
  _game_id uuid, _score integer, _answer text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _user uuid := auth.uid(); _g record; _final int;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _g FROM public.live_games WHERE id = _game_id;
  IF _g IS NULL THEN RAISE EXCEPTION 'التحدي غير موجود'; END IF;
  IF _g.status <> 'open' THEN RAISE EXCEPTION 'انتهى هذا التحدي'; END IF;
  IF _g.host_id = _user THEN RAISE EXCEPTION 'المضيف لا يشارك في تحديه'; END IF;
  IF COALESCE(_score,0) < 0 OR COALESCE(_score,0) > 1000000 THEN RAISE EXCEPTION 'نتيجة غير صحيحة'; END IF;

  _final := COALESCE(_score,0);
  IF _g.kind IN ('quiz','emoji') AND _g.answer IS NOT NULL THEN
    _final := CASE WHEN lower(trim(COALESCE(_answer,''))) = lower(_g.answer) THEN GREATEST(_final, 1) ELSE 0 END;
  END IF;

  INSERT INTO public.live_game_participants(game_id, user_id, score, answer)
  VALUES (_game_id, _user, _final, NULLIF(trim(_answer),''))
  ON CONFLICT (game_id, user_id) DO NOTHING;
END; $$;

-- إنهاء التحدي ومنح الجائزة لأعلى نتيجة
CREATE OR REPLACE FUNCTION public.end_live_game(_game_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _g record; _winner uuid;
BEGIN
  SELECT * INTO _g FROM public.live_games WHERE id = _game_id FOR UPDATE;
  IF _g IS NULL THEN RAISE EXCEPTION 'التحدي غير موجود'; END IF;
  IF _g.host_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  IF _g.status = 'ended' THEN RETURN _g.winner_id; END IF;

  SELECT user_id INTO _winner FROM public.live_game_participants
    WHERE game_id = _game_id AND score > 0
    ORDER BY score DESC, created_at ASC LIMIT 1;

  IF _g.prize_points > 0 THEN
    PERFORM set_config('app.bypass_credit_guard','on',true);
    IF _winner IS NOT NULL THEN
      UPDATE public.profiles SET credits = credits + _g.prize_points WHERE id = _winner;
    ELSE
      UPDATE public.profiles SET credits = credits + _g.prize_points WHERE id = _g.host_id;
    END IF;
    PERFORM set_config('app.bypass_credit_guard','off',true);
  END IF;

  UPDATE public.live_games SET status='ended', ended_at=now(), winner_id=_winner WHERE id = _game_id;

  IF _winner IS NOT NULL THEN
    PERFORM public.push_notification(_winner, _g.host_id, 'gift',
      'فزت في تحدي «' || _g.title || '» 🏆',
      CASE WHEN _g.prize_points > 0
        THEN 'تم إضافة ' || _g.prize_points::text || ' نقطة إلى رصيدك'
        ELSE 'مبروك على الفوز!' END,
      '/live/' || _g.stream_id::text);
  END IF;

  RETURN _winner;
END; $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_game_participants;