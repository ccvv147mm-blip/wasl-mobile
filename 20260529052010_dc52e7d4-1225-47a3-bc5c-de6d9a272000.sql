
-- Drop broad SELECT policies that allowed listing every object in public buckets.
-- Files remain reachable via their direct public CDN URL (bucket.public = true),
-- but clients can no longer enumerate the bucket contents via the Storage API.
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "media public read" ON storage.objects;
DROP POLICY IF EXISTS "voice public read" ON storage.objects;
DROP POLICY IF EXISTS "listing media public read" ON storage.objects;
