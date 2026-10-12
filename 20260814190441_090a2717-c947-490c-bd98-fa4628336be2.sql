-- 1) Internal-only helpers and trigger functions: not callable from the API at all
REVOKE EXECUTE ON FUNCTION public.actor_name(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.push_notification(uuid, uuid, text, text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_friendship() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_gift() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_message() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_post_comment() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_post_like() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_post_share() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_video_comment() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_video_like() FROM anon, authenticated, PUBLIC;

-- 2) Signed-in-only routines: remove anonymous access
REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_recharge(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit_log(integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_referral(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_referral_count(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.end_live_game(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.end_live_stream(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_live_game(uuid, text, text, text, text, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_live_stream(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_live_game_score(uuid, integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_live_viewers(uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_direct_gift(uuid, text, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_live_gift(uuid, text, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_withdrawal(integer, text, text) FROM anon, PUBLIC;

-- 3) Ensure signed-in users keep the access the app relies on
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_recharge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_log(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_live_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_live_stream(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_live_game(uuid, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_live_stream(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_live_game_score(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_live_viewers(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_direct_gift(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_live_gift(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_withdrawal(integer, text, text) TO authenticated;

-- 4) has_role is used inside row-level access rules, so it must stay callable
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
