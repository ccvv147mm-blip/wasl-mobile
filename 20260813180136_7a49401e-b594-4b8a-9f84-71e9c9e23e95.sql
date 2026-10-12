CREATE POLICY "Post owner or admin can delete comments"
ON public.comments FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND p.author_id = auth.uid())
);