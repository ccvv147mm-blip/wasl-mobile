REVOKE EXECUTE ON FUNCTION public.approve_recharge(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_recharge(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_video_gift(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_video_gift(uuid, text, integer) TO authenticated;