-- Remove blanket column access on live_games and re-grant every column EXCEPT "answer"
REVOKE SELECT ON public.live_games FROM authenticated;
REVOKE SELECT ON public.live_games FROM anon;

GRANT SELECT (
  id, stream_id, host_id, kind, title, prompt, prize_points,
  status, winner_id, started_at, ended_at, created_at, updated_at
) ON public.live_games TO authenticated;

GRANT ALL ON public.live_games TO service_role;