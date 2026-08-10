
-- Allow SECURITY DEFINER credit operations to bypass the credit-protection trigger
CREATE OR REPLACE FUNCTION public.profiles_protect_credits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.credits IS DISTINCT FROM OLD.credits
     AND auth.uid() IS NOT NULL
     AND coalesce(current_setting('app.bypass_credit_guard', true), '') <> 'on' THEN
    RAISE EXCEPTION 'credits may not be modified directly';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_recharge(_request_id uuid, _note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _r record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  SELECT * INTO _r FROM public.recharge_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'already reviewed'; END IF;

  UPDATE public.recharge_requests
    SET status='approved', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id = _request_id;

  PERFORM set_config('app.bypass_credit_guard', 'on', true);
  UPDATE public.profiles SET credits = credits + _r.points WHERE id = _r.user_id;
  PERFORM set_config('app.bypass_credit_guard', 'off', true);

  INSERT INTO public.messages(sender_id, recipient_id, content)
  VALUES (auth.uid(), _r.user_id,
    '✅ تم شحن محفظتك بـ ' || _r.points::text || ' نقطة (' || _r.amount_egp::text || ' جنيه). شكراً لك!');
END; $$;

CREATE OR REPLACE FUNCTION public.send_gift(_post_id uuid, _recipient_id uuid, _gift_type text, _value integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  PERFORM set_config('app.bypass_credit_guard', 'on', true);
  UPDATE public.profiles SET credits = credits - _value WHERE id = _sender;
  UPDATE public.profiles SET credits = credits + _value WHERE id = _recipient_id;
  PERFORM set_config('app.bypass_credit_guard', 'off', true);

  INSERT INTO public.gifts (post_id, sender_id, recipient_id, gift_type, value)
  VALUES (_post_id, _sender, _recipient_id, _gift_type, _value)
  RETURNING id INTO _gift_id;

  RETURN _gift_id;
END; $$;

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
BEGIN
  IF _buyer IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT id, seller_id, title, price_points, status
    INTO _listing FROM public.listings WHERE id = _listing_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'listing not found'; END IF;
  IF _listing.status <> 'active' THEN RAISE EXCEPTION 'listing not active'; END IF;
  IF _listing.seller_id = _buyer THEN RAISE EXCEPTION 'cannot buy own listing'; END IF;

  SELECT credits INTO _balance FROM public.profiles WHERE id = _buyer FOR UPDATE;
  IF _balance IS NULL OR _balance < _listing.price_points THEN
    RAISE EXCEPTION 'insufficient credits';
  END IF;

  PERFORM set_config('app.bypass_credit_guard', 'on', true);
  UPDATE public.profiles SET credits = credits - _listing.price_points WHERE id = _buyer;
  UPDATE public.profiles SET credits = credits + _listing.price_points WHERE id = _listing.seller_id;
  PERFORM set_config('app.bypass_credit_guard', 'off', true);

  INSERT INTO public.messages (sender_id, recipient_id, content)
  VALUES (_buyer, _listing.seller_id,
    '🛒 طلب شراء جديد: "' || _listing.title || '" بسعر ' || _listing.price_points::text || ' نقطة. تم تحويل النقاط إلى رصيدك.')
  RETURNING id INTO _msg_id;

  RETURN _msg_id;
END; $$;

-- Update the Vodafone Cash receiving number
UPDATE public.app_settings SET value='01065049558' WHERE key='vodafone_cash_number';
