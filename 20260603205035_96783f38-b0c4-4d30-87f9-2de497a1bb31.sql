CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  route text,
  message text NOT NULL,
  stack text,
  user_agent text,
  context jsonb,
  ai_diagnosis text,
  ai_suggestion text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.error_reports TO authenticated;
GRANT ALL ON public.error_reports TO service_role;

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own errors" ON public.error_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "users view own errors" ON public.error_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_error_reports_user_created ON public.error_reports(user_id, created_at DESC);