
-- 1) FRIENDSHIPS
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted', 'rejected');

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_distinct CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_pair_unique UNIQUE (requester_id, addressee_id)
);

CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "send friend requests" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id AND status = 'pending');

CREATE POLICY "respond to requests" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

CREATE POLICY "delete own friendship" ON public.friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 2) PHONE column on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- 3) APP HEALTH LOGS
CREATE TABLE public.app_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  kind text NOT NULL,
  message text NOT NULL,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_logs_created ON public.app_health_logs(created_at DESC);

GRANT INSERT ON public.app_health_logs TO authenticated;
GRANT ALL ON public.app_health_logs TO service_role;

ALTER TABLE public.app_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert their own logs" ON public.app_health_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 4) MARKETPLACE PURCHASE function
CREATE OR REPLACE FUNCTION public.purchase_listing(_listing_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _buyer uuid := auth.uid();
  _listing record;
  _balance int;
  _msg_id uuid;
BEGIN
  IF _buyer IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT id, seller_id, title, price_points, status
    INTO _listing
    FROM public.listings
    WHERE id = _listing_id
    FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'listing not found'; END IF;
  IF _listing.status <> 'active' THEN RAISE EXCEPTION 'listing not active'; END IF;
  IF _listing.seller_id = _buyer THEN RAISE EXCEPTION 'cannot buy own listing'; END IF;

  SELECT credits INTO _balance FROM public.profiles WHERE id = _buyer FOR UPDATE;
  IF _balance IS NULL OR _balance < _listing.price_points THEN
    RAISE EXCEPTION 'insufficient credits';
  END IF;

  UPDATE public.profiles SET credits = credits - _listing.price_points WHERE id = _buyer;
  UPDATE public.profiles SET credits = credits + _listing.price_points WHERE id = _listing.seller_id;

  INSERT INTO public.messages (sender_id, recipient_id, content)
  VALUES (
    _buyer,
    _listing.seller_id,
    '🛒 طلب شراء جديد: "' || _listing.title || '" بسعر ' || _listing.price_points::text || ' نقطة. تم تحويل النقاط إلى رصيدك.'
  )
  RETURNING id INTO _msg_id;

  RETURN _msg_id;
END;
$$;
