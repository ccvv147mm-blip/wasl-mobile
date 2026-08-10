
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS trim_start numeric;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS trim_end numeric;
