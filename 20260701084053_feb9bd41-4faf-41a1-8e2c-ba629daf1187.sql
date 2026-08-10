
CREATE TABLE public.referrals (
  invitee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_id <> invitee_id)
);

CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_id);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can see referrals where they are the referrer or the invitee
CREATE POLICY "view own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = invitee_id);

-- Function called by a newly signed-up user to claim their inviter
CREATE OR REPLACE FUNCTION public.claim_referral(_referrer_username text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitee uuid := auth.uid();
  _referrer uuid;
BEGIN
  IF _invitee IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _referrer_username IS NULL OR length(trim(_referrer_username)) = 0 THEN
    RETURN NULL;
  END IF;

  -- Only allow claiming within 24h of signup
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = _invitee AND created_at > now() - interval '24 hours'
  ) THEN
    RETURN NULL;
  END IF;

  -- Prevent double-claim
  IF EXISTS (SELECT 1 FROM public.referrals WHERE invitee_id = _invitee) THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _referrer FROM public.profiles
    WHERE username = lower(trim(_referrer_username)) LIMIT 1;
  IF _referrer IS NULL OR _referrer = _invitee THEN RETURN NULL; END IF;

  INSERT INTO public.referrals (invitee_id, referrer_id)
  VALUES (_invitee, _referrer);

  RETURN _referrer;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_referral(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_referral_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.referrals WHERE referrer_id = _user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_referral_count(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_referral_count(uuid) TO authenticated;
