-- 1) profiles: hide phone from everyone except the owner
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, username, full_name, bio, avatar_url, interests, created_at, updated_at, cover_url, credits, country) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_phone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_phone() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_phone() TO authenticated;

-- 2) live_games: hide the correct answer from participants
REVOKE SELECT ON public.live_games FROM authenticated;
REVOKE SELECT ON public.live_games FROM anon;
GRANT SELECT (id, stream_id, host_id, kind, title, prompt, prize_points, status, winner_id, started_at, ended_at, created_at, updated_at) ON public.live_games TO authenticated;
GRANT ALL ON public.live_games TO service_role;

CREATE OR REPLACE FUNCTION public.get_live_game_answer(_game_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.answer
  FROM public.live_games g
  WHERE g.id = _game_id
    AND (g.host_id = auth.uid() OR g.status <> 'open' OR g.ended_at IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.get_live_game_answer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_game_answer(uuid) TO authenticated;

-- 3) live_game_participants: hide other players' submitted answers
REVOKE SELECT ON public.live_game_participants FROM authenticated;
REVOKE SELECT ON public.live_game_participants FROM anon;
GRANT SELECT (id, game_id, user_id, score, created_at) ON public.live_game_participants TO authenticated;
GRANT ALL ON public.live_game_participants TO service_role;

CREATE OR REPLACE FUNCTION public.get_live_game_answers(_game_id uuid)
RETURNS TABLE(user_id uuid, answer text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.answer
  FROM public.live_game_participants p
  JOIN public.live_games g ON g.id = p.game_id
  WHERE p.game_id = _game_id
    AND (
      p.user_id = auth.uid()
      OR g.host_id = auth.uid()
      OR g.status <> 'open'
      OR g.ended_at IS NOT NULL
    );
$$;

REVOKE ALL ON FUNCTION public.get_live_game_answers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_game_answers(uuid) TO authenticated;