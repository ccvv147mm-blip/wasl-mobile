ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_length CHECK (full_name IS NULL OR char_length(full_name) <= 100),
  ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 500),
  ADD CONSTRAINT profiles_interests_length CHECK (interests IS NULL OR char_length(interests) <= 1000),
  ADD CONSTRAINT profiles_avatar_url_length CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048),
  ADD CONSTRAINT profiles_username_length CHECK (char_length(username) BETWEEN 1 AND 50);