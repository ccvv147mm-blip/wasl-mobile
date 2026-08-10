create or replace function public.storage_mime_allowed(_object_name text, _mimetype text, _kinds text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    (
      ('image' = any(_kinds) and lower(_object_name) ~ '\.(jpg|jpeg|png|webp|gif)$')
      or ('video' = any(_kinds) and lower(_object_name) ~ '\.(mp4|webm|mov|m4v)$')
      or ('audio' = any(_kinds) and lower(_object_name) ~ '\.(webm|mp3|m4a|ogg|oga|wav)$')
    )
    and
    (
      _mimetype is null or _mimetype = ''
      or ('image' = any(_kinds) and lower(split_part(_mimetype, ';', 1)) in ('image/jpeg','image/jpg','image/png','image/webp','image/gif'))
      or ('video' = any(_kinds) and lower(split_part(_mimetype, ';', 1)) in ('video/mp4','video/webm','video/quicktime','video/x-m4v'))
      or ('audio' = any(_kinds) and lower(split_part(_mimetype, ';', 1)) in ('audio/webm','audio/mpeg','audio/mp3','audio/mp4','audio/m4a','audio/x-m4a','audio/ogg','audio/wav','audio/wave','audio/x-wav'))
    )
$$;

grant execute on function public.storage_mime_allowed(text, text, text[]) to authenticated, anon, service_role;

drop policy if exists "avatars user write" on storage.objects;
create policy "avatars user write"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (auth.uid())::text = (storage.foldername(name))[1]
  and public.storage_mime_allowed(name, metadata->>'mimetype', array['image'])
);

drop policy if exists "media user write" on storage.objects;
create policy "media user write"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'post-media'
  and (auth.uid())::text = (storage.foldername(name))[1]
  and public.storage_mime_allowed(name, metadata->>'mimetype', array['image','video'])
);

drop policy if exists "users upload own listing media" on storage.objects;
create policy "users upload own listing media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'listing-media'
  and (auth.uid())::text = (storage.foldername(name))[1]
  and public.storage_mime_allowed(name, metadata->>'mimetype', array['image'])
);

drop policy if exists "voice user write" on storage.objects;
create policy "voice user write"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'voice-comments'
  and (auth.uid())::text = (storage.foldername(name))[1]
  and public.storage_mime_allowed(name, metadata->>'mimetype', array['audio'])
);

drop policy if exists "videos upload own" on storage.objects;
create policy "videos upload own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (auth.uid())::text
  and public.storage_mime_allowed(name, metadata->>'mimetype', array['video','image'])
);

drop policy if exists "users upload own proof" on storage.objects;
create policy "users upload own proof"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = (auth.uid())::text
  and (
    public.storage_mime_allowed(name, metadata->>'mimetype', array['image'])
    or (lower(name) ~ '\.pdf$' and coalesce(lower(split_part(metadata->>'mimetype', ';', 1)), 'application/pdf') = 'application/pdf')
  )
);