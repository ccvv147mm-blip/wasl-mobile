-- Country on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;

-- Marketplace listings
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('product','service')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_points INTEGER NOT NULL DEFAULT 0 CHECK (price_points >= 0),
  category TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  country TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listings viewable by authenticated" ON public.listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "users create own listings" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "users update own listings" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "users delete own listings" ON public.listings FOR DELETE TO authenticated USING (auth.uid() = seller_id);

CREATE INDEX idx_listings_created ON public.listings (created_at DESC);
CREATE INDEX idx_listings_country ON public.listings (country);
CREATE INDEX idx_listings_seller ON public.listings (seller_id);

-- Storage bucket for listing images
INSERT INTO storage.buckets (id, name, public) VALUES ('listing-media','listing-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "listing media public read" ON storage.objects FOR SELECT USING (bucket_id = 'listing-media');
CREATE POLICY "users upload own listing media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own listing media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-media' AND auth.uid()::text = (storage.foldername(name))[1]);