
-- 1) Friendships: split UPDATE policy to prevent requester from accepting own request
DROP POLICY IF EXISTS "respond to requests" ON public.friendships;

CREATE POLICY "addressee responds to request"
  ON public.friendships
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "requester withdraws pending"
  ON public.friendships
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id AND status = 'pending')
  WITH CHECK (auth.uid() = requester_id AND status = 'pending');

-- 2) Profiles: revoke phone column read for everyone, then re-grant all other columns
REVOKE SELECT ON public.profiles FROM authenticated, anon;

GRANT SELECT
  (id, username, full_name, avatar_url, bio, interests, created_at, updated_at, cover_url, credits, country)
  ON public.profiles TO authenticated;

-- service_role keeps full access for server-side admin operations
GRANT ALL ON public.profiles TO service_role;
