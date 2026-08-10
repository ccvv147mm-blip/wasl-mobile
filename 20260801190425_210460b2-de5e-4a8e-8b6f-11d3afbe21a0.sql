DROP POLICY IF EXISTS "read settings" ON public.app_settings;

REVOKE SELECT ON public.app_settings FROM anon;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

CREATE POLICY "authenticated read settings"
ON public.app_settings FOR SELECT TO authenticated
USING (true);

-- withdrawal_requests: keep fail-closed; explicitly deny client UPDATE/DELETE.
REVOKE UPDATE, DELETE ON public.withdrawal_requests FROM anon, authenticated;

CREATE POLICY "no client updates to withdrawals"
ON public.withdrawal_requests FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "no client deletes of withdrawals"
ON public.withdrawal_requests FOR DELETE TO authenticated
USING (false);