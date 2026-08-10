
ALTER TABLE public.gifts ALTER COLUMN post_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.send_direct_gift(_recipient_id uuid, _gift_type text, _value integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sender uuid := auth.uid();
  _gift_id uuid;
  _balance int;
  _sender_name text;
BEGIN
  IF _sender IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _sender = _recipient_id THEN RAISE EXCEPTION 'cannot gift self'; END IF;
  IF _value <= 0 OR _value > 5000 THEN RAISE EXCEPTION 'invalid value'; END IF;

  SELECT credits INTO _balance FROM public.profiles WHERE id = _sender FOR UPDATE;
  IF _balance IS NULL OR _balance < _value THEN RAISE EXCEPTION 'insufficient credits'; END IF;

  PERFORM set_config('app.bypass_credit_guard', 'on', true);
  UPDATE public.profiles SET credits = credits - _value WHERE id = _sender;
  UPDATE public.profiles SET credits = credits + _value WHERE id = _recipient_id;
  PERFORM set_config('app.bypass_credit_guard', 'off', true);

  INSERT INTO public.gifts (post_id, sender_id, recipient_id, gift_type, value)
  VALUES (NULL, _sender, _recipient_id, _gift_type, _value)
  RETURNING id INTO _gift_id;

  SELECT COALESCE(full_name, username, 'صديق') INTO _sender_name FROM public.profiles WHERE id = _sender;
  INSERT INTO public.messages (sender_id, recipient_id, content)
  VALUES (_sender, _recipient_id,
    '🎁 أرسل لك ' || _sender_name || ' هدية (' || _gift_type || ') بقيمة ' || _value::text || ' نقطة. تم إضافتها إلى رصيدك!');

  RETURN _gift_id;
END; $$;
