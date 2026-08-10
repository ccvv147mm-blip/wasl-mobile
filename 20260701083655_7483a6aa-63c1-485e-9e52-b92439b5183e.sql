
-- 1 & 4: Protect profiles.credits from direct writes and hide from other users via column grants
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username, full_name, bio, avatar_url, interests, cover_url, country, phone)
  ON public.profiles TO authenticated;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, full_name, bio, avatar_url, interests, cover_url, country, created_at, updated_at)
  ON public.profiles TO authenticated;

-- Defense in depth: trigger guard on credits
CREATE OR REPLACE FUNCTION public.profiles_protect_credits()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.credits IS DISTINCT FROM OLD.credits AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'credits may not be modified directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_credits ON public.profiles;
CREATE TRIGGER trg_profiles_protect_credits
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_credits();

-- 2: Restrict friendship addressee response values
DROP POLICY IF EXISTS "addressee responds to request" ON public.friendships;
CREATE POLICY "addressee responds to request"
  ON public.friendships
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (
    auth.uid() = addressee_id
    AND status IN ('accepted'::friendship_status, 'rejected'::friendship_status)
  );

-- 3: Restrict message recipient updates to the `read` column only via column grants
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (read) ON public.messages TO authenticated;
