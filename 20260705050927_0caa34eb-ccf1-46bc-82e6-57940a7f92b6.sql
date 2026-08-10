
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points int NOT NULL CHECK (points > 0),
  amount_egp int NOT NULL CHECK (amount_egp > 0),
  method text NOT NULL CHECK (method IN ('vodafone_cash','instapay','etisalat_cash','orange_cash')),
  recipient_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users create own withdrawals" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_withdrawal_updated_at BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.submit_withdrawal(_points int, _method text, _recipient_number text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _user uuid := auth.uid(); _balance int; _id uuid; _egp int;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _points < 500 THEN RAISE EXCEPTION 'الحد الأدنى للسحب 500 نقطة'; END IF;
  IF _method NOT IN ('vodafone_cash','instapay','etisalat_cash','orange_cash') THEN RAISE EXCEPTION 'invalid method'; END IF;
  IF length(trim(_recipient_number)) < 6 THEN RAISE EXCEPTION 'رقم استلام غير صحيح'; END IF;

  SELECT credits INTO _balance FROM public.profiles WHERE id = _user FOR UPDATE;
  IF _balance IS NULL OR _balance < _points THEN RAISE EXCEPTION 'رصيد غير كافٍ'; END IF;

  _egp := (_points / 10);
  IF _egp < 1 THEN RAISE EXCEPTION 'المبلغ صغير جداً'; END IF;

  PERFORM set_config('app.bypass_credit_guard','on',true);
  UPDATE public.profiles SET credits = credits - _points WHERE id = _user;
  PERFORM set_config('app.bypass_credit_guard','off',true);

  INSERT INTO public.withdrawal_requests(user_id, points, amount_egp, method, recipient_number)
  VALUES (_user, _points, _egp, _method, trim(_recipient_number))
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
END; $$;
