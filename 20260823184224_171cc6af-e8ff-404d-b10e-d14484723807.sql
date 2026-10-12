CREATE TABLE IF NOT EXISTS public.daily_news (
  country text NOT NULL,
  news_date date NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  date_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country, news_date)
);

GRANT SELECT ON public.daily_news TO authenticated;
GRANT ALL ON public.daily_news TO service_role;

ALTER TABLE public.daily_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read daily news"
ON public.daily_news FOR SELECT TO authenticated USING (true);