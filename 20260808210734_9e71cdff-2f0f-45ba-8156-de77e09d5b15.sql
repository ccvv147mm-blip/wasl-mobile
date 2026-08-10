CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id) WHERE read = false;

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notifications delete" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.push_notification(
  _user_id uuid, _actor_id uuid, _kind text, _title text, _body text, _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL OR _user_id = _actor_id THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, actor_id, kind, title, body, link)
  VALUES (_user_id, _actor_id, _kind, _title, _body, _link);
END; $$;

CREATE OR REPLACE FUNCTION public.actor_name(_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(trim(full_name), ''), username, 'أحد المستخدمين') FROM public.profiles WHERE id = _id
$$;

-- Post likes
CREATE OR REPLACE FUNCTION public.notify_post_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT author_id INTO _owner FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.push_notification(_owner, NEW.user_id, 'like',
    public.actor_name(NEW.user_id) || ' أعجبه منشورك', NULL, '/');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_post_like AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

-- Post comments
CREATE OR REPLACE FUNCTION public.notify_post_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT author_id INTO _owner FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.push_notification(_owner, NEW.author_id, 'comment',
    public.actor_name(NEW.author_id) || ' علّق على منشورك',
    COALESCE(left(NEW.content, 120), 'تعليق صوتي'), '/');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_post_comment AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

-- Post shares
CREATE OR REPLACE FUNCTION public.notify_post_share() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT author_id INTO _owner FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.push_notification(_owner, NEW.user_id, 'share',
    public.actor_name(NEW.user_id) || ' شارك منشورك', NULL, '/');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_post_share AFTER INSERT ON public.shares
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_share();

-- Gifts
CREATE OR REPLACE FUNCTION public.notify_gift() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_notification(NEW.recipient_id, NEW.sender_id, 'gift',
    public.actor_name(NEW.sender_id) || ' أرسل لك هدية',
    NEW.gift_type || ' بقيمة ' || NEW.value::text || ' نقطة', '/wallet');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_gift AFTER INSERT ON public.gifts
  FOR EACH ROW EXECUTE FUNCTION public.notify_gift();
CREATE TRIGGER trg_notify_video_gift AFTER INSERT ON public.video_gifts
  FOR EACH ROW EXECUTE FUNCTION public.notify_gift();

-- Video likes
CREATE OR REPLACE FUNCTION public.notify_video_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT author_id INTO _owner FROM public.videos WHERE id = NEW.video_id;
  PERFORM public.push_notification(_owner, NEW.user_id, 'like',
    public.actor_name(NEW.user_id) || ' أعجبه فيديوك', NULL, '/videos');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_video_like AFTER INSERT ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_video_like();

-- Video comments
CREATE OR REPLACE FUNCTION public.notify_video_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT author_id INTO _owner FROM public.videos WHERE id = NEW.video_id;
  PERFORM public.push_notification(_owner, NEW.author_id, 'comment',
    public.actor_name(NEW.author_id) || ' علّق على فيديوك', left(NEW.content, 120), '/videos');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_video_comment AFTER INSERT ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_video_comment();

-- Friendships
CREATE OR REPLACE FUNCTION public.notify_friendship() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    PERFORM public.push_notification(NEW.addressee_id, NEW.requester_id, 'friend_request',
      public.actor_name(NEW.requester_id) || ' أرسل لك طلب صداقة', NULL, '/friends');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    PERFORM public.push_notification(NEW.requester_id, NEW.addressee_id, 'friend_accept',
      public.actor_name(NEW.addressee_id) || ' قبل طلب صداقتك', NULL, '/friends');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_friendship_ins AFTER INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.notify_friendship();
CREATE TRIGGER trg_notify_friendship_upd AFTER UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.notify_friendship();

-- Messages
CREATE OR REPLACE FUNCTION public.notify_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_notification(NEW.recipient_id, NEW.sender_id, 'message',
    public.actor_name(NEW.sender_id) || ' أرسل لك رسالة', left(NEW.content, 120),
    '/messages?to=' || NEW.sender_id::text);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;