-- allow live gift fee percent setting
CREATE OR REPLACE FUNCTION public.admin_set_setting(_key text, _value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  IF _key NOT IN ('vodafone_cash_number','instapay_handle','etisalat_cash_number','orange_cash_number','live_gift_fee_percent') THEN
    RAISE EXCEPTION 'invalid setting key';
  END IF;
  IF length(trim(_value)) = 0 OR length(_value) > 120 THEN RAISE EXCEPTION 'invalid value'; END IF;
  IF _key = 'live_gift_fee_percent' THEN
    IF trim(_value) !~ '^[0-9]{1,2}$' OR trim(_value)::int > 90 THEN
      RAISE EXCEPTION 'invalid percent';
    END IF;
  END IF;
  INSERT INTO public.app_settings(key, value, updated_at) VALUES (_key, trim(_value), now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
  PERFORM public.log_admin_action('update_setting', 'setting', NULL,
    jsonb_build_object('key', _key, 'value', trim(_value)));
END; $function$;

-- admin: list live streams
CREATE OR REPLACE FUNCTION public.admin_list_streams(_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, host_id uuid, host_username text, title text, status text,
  viewers_count integer, peak_viewers integer, total_gift_points integer,
  started_at timestamptz, ended_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.host_id, p.username, s.title, s.status,
         s.viewers_count, s.peak_viewers, s.total_gift_points, s.started_at, s.ended_at
  FROM public.live_streams s
  LEFT JOIN public.profiles p ON p.id = s.host_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY (s.status = 'live') DESC, s.started_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 500)
$$;

-- admin: list all gifts across surfaces
CREATE OR REPLACE FUNCTION public.admin_list_gifts(_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, source text, gift_type text, value integer, platform_points integer,
  sender_username text, recipient_username text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH all_gifts AS (
    SELECT g.id, CASE WHEN g.post_id IS NULL THEN 'direct' ELSE 'post' END AS source,
           g.gift_type, g.value, 0 AS platform_points, g.sender_id, g.recipient_id, g.created_at
    FROM public.gifts g
    UNION ALL
    SELECT g.id, 'video', g.gift_type, g.value, 0, g.sender_id, g.recipient_id, g.created_at
    FROM public.video_gifts g
    UNION ALL
    SELECT g.id, 'live', g.gift_type, g.value, g.platform_points, g.sender_id, g.recipient_id, g.created_at
    FROM public.live_gifts g
  )
  SELECT a.id, a.source, a.gift_type, a.value, a.platform_points,
         ps.username, pr.username, a.created_at
  FROM all_gifts a
  LEFT JOIN public.profiles ps ON ps.id = a.sender_id
  LEFT JOIN public.profiles pr ON pr.id = a.recipient_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY a.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 500)
$$;

REVOKE ALL ON FUNCTION public.admin_list_streams(integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_list_gifts(integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_streams(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_gifts(integer) TO authenticated;

-- extend admin stats with live + gift aggregates
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    'credits_total', (SELECT COALESCE(sum(credits),0) FROM public.profiles),
    'gifts_value', (SELECT COALESCE(sum(value),0) FROM public.gifts),
    'referrals', (SELECT count(*) FROM public.referrals),
    'pending_recharges', (SELECT count(*) FROM public.recharge_requests WHERE status='pending'),
    'pending_withdrawals', (SELECT count(*) FROM public.withdrawal_requests WHERE status='pending'),
    'platform_fees_points', (SELECT COALESCE(sum(fee_points),0) FROM public.platform_fees),
    'platform_fees_count', (SELECT count(*) FROM public.platform_fees),
    'live_streams', (SELECT count(*) FROM public.live_streams),
    'live_now', (SELECT count(*) FROM public.live_streams WHERE status='live'),
    'live_gifts_value', (SELECT COALESCE(sum(value),0) FROM public.live_gifts),
    'live_platform_points', (SELECT COALESCE(sum(platform_points),0) FROM public.live_gifts),
    'video_gifts_value', (SELECT COALESCE(sum(value),0) FROM public.video_gifts)
  ) INTO _r;
  RETURN _r;
END; $$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;