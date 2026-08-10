ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS price_egp integer NOT NULL DEFAULT 0;
UPDATE public.listings SET price_egp = price_points WHERE price_egp = 0;

CREATE TABLE IF NOT EXISTS public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  price_egp integer NOT NULL,
  fee_points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_fees TO authenticated;
GRANT ALL ON public.platform_fees TO service_role;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read platform fees" ON public.platform_fees;
CREATE POLICY "admins read platform fees" ON public.platform_fees
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value) VALUES ('marketplace_fee_percent', '5')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.purchase_listing(_listing_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _buyer uuid := auth.uid();
  _listing record;
  _balance int;
  _msg_id uuid;
  _pct numeric := 5;
  _fee int;
BEGIN
  IF _buyer IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT id, seller_id, title, price_egp, status
    INTO _listing FROM public.listings WHERE id = _listing_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'listing not found'; END IF;
  IF _listing.status <> 'active' THEN RAISE EXCEPTION 'listing not active'; END IF;
  IF _listing.seller_id = _buyer THEN RAISE EXCEPTION 'cannot buy own listing'; END IF;

  SELECT COALESCE(NULLIF(value, '')::numeric, 5) INTO _pct
    FROM public.app_settings WHERE key = 'marketplace_fee_percent';
  IF _pct IS NULL THEN _pct := 5; END IF;

  _fee := GREATEST(1, CEIL(_listing.price_egp * _pct / 100.0)::int);

  SELECT credits INTO _balance FROM public.profiles WHERE id = _buyer FOR UPDATE;
  IF _balance IS NULL OR _balance < _fee THEN
    RAISE EXCEPTION 'insufficient credits';
  END IF;

  PERFORM set_config('app.bypass_credit_guard', 'on', true);
  UPDATE public.profiles SET credits = credits - _fee WHERE id = _buyer;
  PERFORM set_config('app.bypass_credit_guard', 'off', true);

  INSERT INTO public.platform_fees (listing_id, buyer_id, seller_id, price_egp, fee_points)
  VALUES (_listing.id, _buyer, _listing.seller_id, _listing.price_egp, _fee);

  INSERT INTO public.messages (sender_id, recipient_id, content)
  VALUES (
    _buyer,
    _listing.seller_id,
    '🛒 طلب شراء جديد: "' || _listing.title || '" بسعر ' || _listing.price_egp::text ||
    ' جنيه مصري — الدفع عند الاستلام. تم خصم رسوم الوساطة (' || _fee::text || ' نقطة) من المشتري لصالح التطبيق.'
  )
  RETURNING id INTO _msg_id;

  RETURN _msg_id;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_listing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _out jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
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
    'pending_recharges', (SELECT count(*) FROM public.recharge_requests WHERE status = 'pending'),
    'pending_withdrawals', (SELECT count(*) FROM public.withdrawal_requests WHERE status = 'pending'),
    'platform_fees_points', (SELECT COALESCE(sum(fee_points),0) FROM public.platform_fees),
    'platform_fees_count', (SELECT count(*) FROM public.platform_fees)
  ) INTO _out;
  RETURN _out;
END;
$$;