CREATE TABLE public.stories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX stories_expires_idx ON public.stories (expires_at DESC);
CREATE INDEX stories_author_idx ON public.stories (author_id);

GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view active stories"
  ON public.stories FOR SELECT TO authenticated
  USING (expires_at > now() OR author_id = auth.uid());

CREATE POLICY "Users create their own stories"
  ON public.stories FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users delete their own stories"
  ON public.stories FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers and story owners can read views"
  ON public.story_views FOR SELECT TO authenticated
  USING (viewer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid()));

CREATE POLICY "Users record their own views"
  ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());