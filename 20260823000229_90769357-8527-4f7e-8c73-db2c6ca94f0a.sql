CREATE OR REPLACE FUNCTION public.notify_post_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT author_id INTO _owner FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.push_notification(_owner, NEW.user_id, 'like',
    public.actor_name(NEW.user_id) || ' أعجبه منشورك', NULL, '/post/' || NEW.post_id::text);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_post_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT author_id INTO _owner FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.push_notification(_owner, NEW.author_id, 'comment',
    public.actor_name(NEW.author_id) || ' علّق على منشورك',
    COALESCE(left(NEW.content, 120), 'تعليق صوتي'), '/post/' || NEW.post_id::text);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_post_share() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT author_id INTO _owner FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.push_notification(_owner, NEW.user_id, 'share',
    public.actor_name(NEW.user_id) || ' شارك منشورك', NULL, '/post/' || NEW.post_id::text);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_gift() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _link text := '/wallet';
BEGIN
  IF TG_TABLE_NAME = 'gifts' AND NEW.post_id IS NOT NULL THEN
    _link := '/post/' || NEW.post_id::text;
  ELSIF TG_TABLE_NAME = 'video_gifts' THEN
    _link := '/videos';
  END IF;
  PERFORM public.push_notification(NEW.recipient_id, NEW.sender_id, 'gift',
    public.actor_name(NEW.sender_id) || ' أرسل لك هدية',
    NEW.gift_type || ' بقيمة ' || NEW.value::text || ' نقطة', _link);
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.notify_post_like() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_post_comment() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_post_share() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_gift() FROM anon, authenticated;

UPDATE public.notifications n
SET link = '/post/' || l.post_id::text
FROM public.likes l
WHERE n.kind = 'like' AND n.link = '/' AND n.actor_id = l.user_id
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = l.post_id AND p.author_id = n.user_id);

UPDATE public.notifications n
SET link = '/post/' || c.post_id::text
FROM public.comments c
WHERE n.kind = 'comment' AND n.link = '/' AND n.actor_id = c.author_id
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = c.post_id AND p.author_id = n.user_id);

UPDATE public.notifications n
SET link = '/post/' || s.post_id::text
FROM public.shares s
WHERE n.kind = 'share' AND n.link = '/' AND n.actor_id = s.user_id
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = s.post_id AND p.author_id = n.user_id);