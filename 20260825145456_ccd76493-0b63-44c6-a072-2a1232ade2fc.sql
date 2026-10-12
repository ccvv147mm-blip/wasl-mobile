REVOKE EXECUTE ON FUNCTION public.get_referral_count(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.get_live_game_answer(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.get_live_game_answers(uuid) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_referral_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_live_game_answer(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_live_game_answers(uuid) TO service_role;