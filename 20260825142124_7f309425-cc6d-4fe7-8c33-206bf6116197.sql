
REVOKE EXECUTE ON FUNCTION public.admin_list_reports(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_review_report(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_report(text, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_report(text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
