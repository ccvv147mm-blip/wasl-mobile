
REVOKE EXECUTE ON FUNCTION public.send_gift(uuid, uuid, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_gift(uuid, uuid, text, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_video_views(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_video_views(uuid) TO authenticated;
