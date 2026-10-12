
-- 1) Server-side scoring for live reaction games
CREATE OR REPLACE FUNCTION public.submit_live_game_score(_game_id uuid, _score integer, _answer text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _user uuid := auth.uid(); _g record; _final int; _elapsed_ms int;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _g FROM public.live_games WHERE id = _game_id;
  IF _g IS NULL THEN RAISE EXCEPTION 'التحدي غير موجود'; END IF;
  IF _g.status <> 'open' THEN RAISE EXCEPTION 'انتهى هذا التحدي'; END IF;
  IF _g.host_id = _user THEN RAISE EXCEPTION 'المضيف لا يشارك في تحديه'; END IF;

  IF _g.kind = 'reaction' THEN
    -- Score is derived from server-recorded timing only; client value is ignored.
    _elapsed_ms := GREATEST(1, (EXTRACT(EPOCH FROM (now() - _g.started_at)) * 1000)::int);
    _final := GREATEST(1, 600000 - _elapsed_ms);
  ELSE
    IF COALESCE(_score,0) < 0 OR COALESCE(_score,0) > 1000000 THEN RAISE EXCEPTION 'نتيجة غير صحيحة'; END IF;
    _final := COALESCE(_score,0);
    IF _g.answer IS NOT NULL THEN
      _final := CASE WHEN lower(trim(COALESCE(_answer,''))) = lower(_g.answer) THEN GREATEST(_final, 1) ELSE 0 END;
    END IF;
  END IF;

  INSERT INTO public.live_game_participants(game_id, user_id, score, answer)
  VALUES (_game_id, _user, _final, NULLIF(trim(_answer),''))
  ON CONFLICT (game_id, user_id) DO NOTHING;
END; $function$;

REVOKE ALL ON FUNCTION public.submit_live_game_score(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_live_game_score(uuid, integer, text) TO authenticated;

-- 2) app_settings: writes only via admin_set_setting (SECURITY DEFINER)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.app_settings FROM anon, authenticated;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

DROP POLICY IF EXISTS "no direct settings writes" ON public.app_settings;
CREATE POLICY "admins manage settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) listing-media: explicit owner-only update path
DROP POLICY IF EXISTS "users update own listing media" ON storage.objects;
CREATE POLICY "users update own listing media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-media' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (
    bucket_id = 'listing-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND public.storage_mime_allowed(name, (metadata ->> 'mimetype'), ARRAY['image'])
  );

-- 4) Remove anon EXECUTE on SECURITY DEFINER functions not meant for signed-out callers
REVOKE ALL ON FUNCTION public.admin_list_reports(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_report(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_review_report(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_report(text, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_report(text, uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
