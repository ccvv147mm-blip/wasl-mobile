
-- ===== Admin control panel functions =====

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'posts', (SELECT count(*) FROM public.posts),
    'videos', (SELECT count(*) FROM public.videos),
    'listings', (SELECT count(*) FROM public.listings),
    'messages', (SELECT count(*) FROM public.messages),
    'gifts_value', (SELECT COALESCE(sum(value),0) FROM public.gifts),
    'credits_total', (SELECT COALESCE(sum(credits),0) FROM public.profiles),
    'pending_recharges', (SELECT count(*) FROM public.recharge_requests WHERE status='pending'),
    'pending_withdrawals', (SELECT count(*) FROM public.withdrawal_requests WHERE status='pending'),
    'referrals', (SELECT count(*) FROM public.referrals)
  ) INTO _r;
  RETURN _r;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT NULL, _limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, username text, full_name text, avatar_url text, country text,
  credits int, created_at timestamptz, is_admin boolean, is_moderator boolean,
  posts_count int, videos_count int, referrals_count int
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, p.avatar_url, p.country,
         p.credits, p.created_at,
         public.has_role(p.id, 'admin'), public.has_role(p.id, 'moderator'),
         (SELECT count(*)::int FROM public.posts x WHERE x.author_id = p.id),
         (SELECT count(*)::int FROM public.videos v WHERE v.author_id = p.id),
         (SELECT count(*)::int FROM public.referrals r WHERE r.referrer_id = p.id)
  FROM public.profiles p
  WHERE _search IS NULL OR length(trim(_search)) = 0
     OR p.username ILIKE '%' || trim(_search) || '%'
     OR COALESCE(p.full_name,'') ILIKE '%' || trim(_search) || '%'
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role app_role, _grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_user_id uuid, _delta int, _note text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  RETURN _new;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_content(_kind text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  IF _kind = 'post' THEN DELETE FROM public.posts WHERE id = _id;
  ELSIF _kind = 'video' THEN DELETE FROM public.videos WHERE id = _id;
  ELSIF _kind = 'listing' THEN DELETE FROM public.listings WHERE id = _id;
  ELSIF _kind = 'comment' THEN DELETE FROM public.comments WHERE id = _id;
  ELSE RAISE EXCEPTION 'invalid kind';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_setting(_key text, _value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  IF _key NOT IN ('vodafone_cash_number','instapay_handle','etisalat_cash_number','orange_cash_number') THEN
    RAISE EXCEPTION 'invalid setting key';
  END IF;
  IF length(trim(_value)) = 0 OR length(_value) > 120 THEN RAISE EXCEPTION 'invalid value'; END IF;
  INSERT INTO public.app_settings(key, value, updated_at) VALUES (_key, trim(_value), now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
END; $$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_list_users(text,int) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, app_role, boolean) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_adjust_credits(uuid,int,text) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_delete_content(text,uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_set_setting(text,text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_content(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_setting(text,text) TO authenticated;
