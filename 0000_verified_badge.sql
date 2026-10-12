ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.protect_profile_verified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     AND current_setting('app.allow_verify', true) IS DISTINCT FROM 'on' THEN
    NEW.is_verified := OLD.is_verified;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.protect_profile_verified() FROM anon, public, authenticated;
DROP TRIGGER IF EXISTS trg_protect_profile_verified ON public.profiles;
CREATE TRIGGER trg_protect_profile_verified BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_verified();

CREATE OR REPLACE FUNCTION public.admin_set_verified(_user_id uuid, _verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  PERFORM set_config('app.allow_verify', 'on', true);
  UPDATE public.profiles SET is_verified = _verified WHERE id = _user_id;
  PERFORM set_config('app.allow_verify', 'off', true);
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_verified(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_verified(uuid, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_list_users(text, int);
CREATE FUNCTION public.admin_list_users(_search text DEFAULT NULL, _limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, username text, full_name text, avatar_url text, country text,
  credits int, created_at timestamptz, is_admin boolean, is_moderator boolean,
  posts_count int, videos_count int, referrals_count int, is_verified boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not admin'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.full_name, p.avatar_url, p.country,
         p.credits, p.created_at,
         public.has_role(p.id, 'admin'), public.has_role(p.id, 'moderator'),
         (SELECT count(*)::int FROM public.posts x WHERE x.author_id = p.id),
         (SELECT count(*)::int FROM public.videos v WHERE v.author_id = p.id),
         (SELECT count(*)::int FROM public.referrals r WHERE r.referrer_id = p.id),
         p.is_verified
  FROM public.profiles p
  WHERE _search IS NULL OR length(trim(_search)) = 0
     OR p.username ILIKE '%' || trim(_search) || '%'
     OR COALESCE(p.full_name,'') ILIKE '%' || trim(_search) || '%'
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_users(text,int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text,int) TO authenticated;