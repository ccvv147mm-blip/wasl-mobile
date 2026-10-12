-- Restrict reads on app_health_logs to the owner or admins
DROP POLICY IF EXISTS "own or admin can read health logs" ON public.app_health_logs;
CREATE POLICY "own or admin can read health logs"
ON public.app_health_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

REVOKE UPDATE, DELETE ON public.app_health_logs FROM authenticated, anon;
GRANT SELECT, INSERT ON public.app_health_logs TO authenticated;
GRANT ALL ON public.app_health_logs TO service_role;

-- Make the no-direct-update rule on live_game_participants explicit
DROP POLICY IF EXISTS "no direct score updates" ON public.live_game_participants;
CREATE POLICY "no direct score updates"
ON public.live_game_participants
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

REVOKE UPDATE, DELETE ON public.live_game_participants FROM authenticated, anon;
GRANT SELECT ON public.live_game_participants TO authenticated;
GRANT ALL ON public.live_game_participants TO service_role;