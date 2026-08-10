REVOKE EXECUTE ON FUNCTION public.start_live_stream(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.end_live_stream(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_live_viewers(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_live_gift(uuid, text, integer) FROM anon;