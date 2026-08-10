
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Recharge requests
CREATE TABLE public.recharge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_egp integer NOT NULL CHECK (amount_egp >= 10 AND amount_egp <= 100000),
  points integer NOT NULL CHECK (points > 0),
  method text NOT NULL CHECK (method IN ('vodafone_cash','instapay','etisalat_cash','orange_cash')),
  sender_phone text NOT NULL,
  transaction_ref text,
  proof_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.recharge_requests TO authenticated;
GRANT ALL ON public.recharge_requests TO service_role;
ALTER TABLE public.recharge_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own recharge" ON public.recharge_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "users read own recharge" ON public.recharge_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_recharge_pending ON public.recharge_requests(status, created_at DESC);

-- Approve/reject functions
CREATE OR REPLACE FUNCTION public.approve_recharge(_request_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  SELECT * INTO _r FROM public.recharge_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'already reviewed'; END IF;

  UPDATE public.recharge_requests
    SET status='approved', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id = _request_id;
  UPDATE public.profiles SET credits = credits + _r.points WHERE id = _r.user_id;

  INSERT INTO public.messages(sender_id, recipient_id, content)
  VALUES (auth.uid(), _r.user_id,
    '✅ تم شحن محفظتك بـ ' || _r.points::text || ' نقطة (' || _r.amount_egp::text || ' جنيه). شكراً لك!');
END; $$;

CREATE OR REPLACE FUNCTION public.reject_recharge(_request_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END; $$;

-- App settings for wallet numbers
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated, anon;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read settings" ON public.app_settings FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.app_settings(key, value) VALUES
  ('vodafone_cash_number', '01000000000'),
  ('instapay_handle', 'wasl@instapay'),
  ('etisalat_cash_number', '01100000000'),
  ('orange_cash_number', '01200000000');
