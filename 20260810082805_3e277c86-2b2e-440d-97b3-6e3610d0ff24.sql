CREATE TABLE public.translations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lang text NOT NULL,
  source_hash text NOT NULL,
  source text NOT NULL,
  translated text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX translations_lang_hash_idx ON public.translations (lang, source_hash);

GRANT SELECT ON public.translations TO anon;
GRANT SELECT ON public.translations TO authenticated;
GRANT ALL ON public.translations TO service_role;

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translations_public_read" ON public.translations FOR SELECT USING (true);