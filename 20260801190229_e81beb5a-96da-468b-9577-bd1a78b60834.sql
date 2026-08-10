CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
ON public.admin_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_log_actor_idx ON public.admin_audit_log (actor_id);

CREATE OR REPLACE FUNCTION public.log_admin_action(_action text, _target_type text, _target_id uuid, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_audit_log(actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), _action, _target_type, _target_id, COALESCE(_details, '{}'::jsonb));
END; $$;

REVOKE ALL ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_audit_log(_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, actor_id uuid, actor_username text, action text, target_type text, target_id uuid, target_username text, details jsonb, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  RETURN QUERY
  SELECT l.id, l.actor_id, a.username, l.action, l.target_type, l.target_id, t.username, l.details, l.created_at
  FROM public.admin_audit_log l
  LEFT JOIN public.profiles a ON a.id = l.actor_id
  LEFT JOIN public.profiles t ON t.id = l.target_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END; $$;

-- Add logging to admin actions
CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role app_role, _grant boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    IF _role = 'admin' AND _user_id = auth.uid() THEN
      RAISE EXCEPTION 'لا يمكنك إزالة صلاحيتك الإدارية عن نفسك';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
  PERFORM public.log_admin_action(
    CASE WHEN _grant THEN 'grant_role' ELSE 'revoke_role' END,
    'user', _user_id, jsonb_build_object('role', _role::text));
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_user_id uuid, _delta integer, _note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _new int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  IF _delta = 0 OR abs(_delta) > 10000000 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  PERFORM set_config('app.bypass_credit_guard','on',true);
  UPDATE public.profiles SET credits = GREATEST(0, credits + _delta)
    WHERE id = _user_id RETURNING credits INTO _new;
  PERFORM set_config('app.bypass_credit_guard','off',true);

  IF _new IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;

  INSERT INTO public.messages(sender_id, recipient_id, content)
  VALUES (auth.uid(), _user_id,
    CASE WHEN _delta > 0
      THEN 'وَصْل | الإدارة: تمت إضافة ' || _delta::text || ' نقطة إلى رصيدك. رصيدك الحالي: ' || _new::text || ' نقطة.'
      ELSE 'وَصْل | الإدارة: تم خصم ' || abs(_delta)::text || ' نقطة من رصيدك. رصيدك الحالي: ' || _new::text || ' نقطة.'
    END || CASE WHEN _note IS NOT NULL AND length(trim(_note)) > 0 THEN ' ملاحظة: ' || trim(_note) ELSE '' END);

  PERFORM public.log_admin_action('adjust_credits', 'user', _user_id,
    jsonb_build_object('delta', _delta, 'new_balance', _new, 'note', _note));

  RETURN _new;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_delete_content(_kind text, _id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  IF _kind = 'post' THEN DELETE FROM public.posts WHERE id = _id;
  ELSIF _kind = 'video' THEN DELETE FROM public.videos WHERE id = _id;
  ELSIF _kind = 'listing' THEN DELETE FROM public.listings WHERE id = _id;
  ELSIF _kind = 'comment' THEN DELETE FROM public.comments WHERE id = _id;
  ELSE RAISE EXCEPTION 'invalid kind';
  END IF;
  PERFORM public.log_admin_action('delete_content', _kind, _id, '{}'::jsonb);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_set_setting(_key text, _value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  IF _key NOT IN ('vodafone_cash_number','instapay_handle','etisalat_cash_number','orange_cash_number') THEN
    RAISE EXCEPTION 'invalid setting key';
  END IF;
  IF length(trim(_value)) = 0 OR length(_value) > 120 THEN RAISE EXCEPTION 'invalid value'; END IF;
  INSERT INTO public.app_settings(key, value, updated_at) VALUES (_key, trim(_value), now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
  PERFORM public.log_admin_action('update_setting', 'setting', NULL,
    jsonb_build_object('key', _key, 'value', trim(_value)));
END; $function$;

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

  PERFORM public.log_admin_action('approve_recharge', 'recharge_request', _request_id,
    jsonb_build_object('user_id', _r.user_id, 'points', _r.points, 'amount_egp', _r.amount_egp, 'note', _note));
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_recharge(_request_id uuid, _note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _r record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  SELECT * INTO _r FROM public.recharge_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'already reviewed'; END IF;

  UPDATE public.recharge_requests
    SET status='rejected', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id = _request_id;

  INSERT INTO public.messages(sender_id, recipient_id, content)
  VALUES (auth.uid(), _r.user_id,
    '❌ تم رفض طلب الشحن: ' || COALESCE(_note, 'يرجى مراجعة البيانات وإعادة المحاولة'));

  PERFORM public.log_admin_action('reject_recharge', 'recharge_request', _request_id,
    jsonb_build_object('user_id', _r.user_id, 'points', _r.points, 'note', _note));
END; $function$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _r record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _r.status<>'pending' THEN RAISE EXCEPTION 'already reviewed'; END IF;
  UPDATE public.withdrawal_requests
    SET status='approved', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_id;
  INSERT INTO public.messages(sender_id, recipient_id, content)
  VALUES (auth.uid(), _r.user_id,
    '💸 تم تحويل ' || _r.amount_egp::text || ' جنيه إلى محفظتك (' || _r.recipient_number || '). شكراً لك!');

  PERFORM public.log_admin_action('approve_withdrawal', 'withdrawal_request', _id,
    jsonb_build_object('user_id', _r.user_id, 'points', _r.points, 'amount_egp', _r.amount_egp,
                       'recipient_number', _r.recipient_number, 'method', _r.method, 'note', _note));
END; $function$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_id uuid, _note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _r record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  SELECT * INTO _r FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _r.status<>'pending' THEN RAISE EXCEPTION 'already reviewed'; END IF;

  PERFORM set_config('app.bypass_credit_guard','on',true);
  UPDATE public.profiles SET credits = credits + _r.points WHERE id = _r.user_id;
  PERFORM set_config('app.bypass_credit_guard','off',true);

  UPDATE public.withdrawal_requests
    SET status='rejected', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_id;

  INSERT INTO public.messages(sender_id, recipient_id, content)
  VALUES (auth.uid(), _r.user_id,
    '❌ تم رفض طلب السحب وإعادة ' || _r.points::text || ' نقطة إلى رصيدك. ' || COALESCE(_note,''));

  PERFORM public.log_admin_action('reject_withdrawal', 'withdrawal_request', _id,
    jsonb_build_object('user_id', _r.user_id, 'points', _r.points, 'note', _note));
END; $function$;