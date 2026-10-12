CREATE TABLE public.content_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post','video','comment','listing','user')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 60),
  details text CHECK (details IS NULL OR char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);

GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users create own reports" ON public.content_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "users read own reports" ON public.content_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

CREATE POLICY "admins read all reports" ON public.content_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_content_reports_updated_at
  BEFORE UPDATE ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_content_reports_status ON public.content_reports(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_list_reports(_status text DEFAULT NULL, _limit integer DEFAULT 100)
RETURNS TABLE(id uuid, reporter_id uuid, reporter_username text, target_type text, target_id uuid,
              reason text, details text, status text, admin_note text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  RETURN QUERY
  SELECT r.id, r.reporter_id, p.username, r.target_type, r.target_id,
         r.reason, r.details, r.status, r.admin_note, r.created_at
  FROM public.content_reports r
  LEFT JOIN public.profiles p ON p.id = r.reporter_id
  WHERE _status IS NULL OR r.status = _status
  ORDER BY r.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_list_reports(text, integer) FROM anon;

CREATE OR REPLACE FUNCTION public.admin_review_report(_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  IF _status NOT IN ('reviewed','dismissed','actioned') THEN RAISE EXCEPTION 'invalid status'; END IF;
  UPDATE public.content_reports
    SET status = _status, admin_note = _note, reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _id;
  PERFORM public.log_admin_action('review_report', 'content_report', _id,
    jsonb_build_object('status', _status, 'note', _note));
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_review_report(uuid, text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.submit_report(_target_type text, _target_id uuid, _reason text, _details text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _u uuid := auth.uid(); _id uuid; _recent int;
BEGIN
  IF _u IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _target_type NOT IN ('post','video','comment','listing','user') THEN RAISE EXCEPTION 'invalid target'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 2 THEN RAISE EXCEPTION 'اختر سبب البلاغ'; END IF;

  SELECT count(*) INTO _recent FROM public.content_reports
    WHERE reporter_id = _u AND created_at > now() - interval '1 hour';
  IF _recent >= 20 THEN RAISE EXCEPTION 'تم إرسال بلاغات كثيرة، حاول لاحقاً'; END IF;

  INSERT INTO public.content_reports(reporter_id, target_type, target_id, reason, details)
  VALUES (_u, _target_type, _target_id, trim(_reason), NULLIF(trim(_details), ''))
  ON CONFLICT (reporter_id, target_type, target_id) DO UPDATE
    SET reason = excluded.reason, details = excluded.details, updated_at = now()
  RETURNING id INTO _id;

  RETURN _id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.submit_report(text, uuid, text, text) FROM anon;