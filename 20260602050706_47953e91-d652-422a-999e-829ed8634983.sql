-- 1) Gifts: remove direct INSERT policy. send_gift() RPC is the only valid path
--    (SECURITY DEFINER, atomically deducts credits). Direct inserts bypassed the check.
DROP POLICY IF EXISTS "send gifts" ON public.gifts;

-- 2) Listings: prevent owners from reassigning seller_id via UPDATE.
DROP POLICY IF EXISTS "users update own listings" ON public.listings;
CREATE POLICY "users update own listings"
ON public.listings
FOR UPDATE
TO authenticated
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

CREATE OR REPLACE FUNCTION public.listings_prevent_seller_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN
    RAISE EXCEPTION 'seller_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listings_prevent_seller_change ON public.listings;
CREATE TRIGGER trg_listings_prevent_seller_change
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.listings_prevent_seller_change();

-- 3) Messages: restrict recipient updates to only the `read` column.
DROP POLICY IF EXISTS "mark own received as read" ON public.messages;
CREATE POLICY "mark own received as read"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.messages_recipient_read_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() = OLD.recipient_id AND auth.uid() <> OLD.sender_id THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'recipients may only update the read flag';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_recipient_read_only ON public.messages;
CREATE TRIGGER trg_messages_recipient_read_only
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_recipient_read_only();

-- 4) Lock down SECURITY DEFINER function EXECUTE grants.
--    handle_new_user is a trigger only — no API callers.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

--    send_gift / purchase_listing / increment_video_views are called by signed-in users only.
REVOKE ALL ON FUNCTION public.send_gift(uuid, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_gift(uuid, uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.purchase_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_listing(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.increment_video_views(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_video_views(uuid) TO authenticated;
