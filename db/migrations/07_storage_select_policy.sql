-- 07: Storage objects SELECT policy
-- ES: La API de Storage lee el objeto recién creado al subir (INSERT ... RETURNING).
--     Sin política SELECT en storage.objects cada subida fallaba RLS con 400.
-- EN: The Storage API reads the newly created object on upload (INSERT ... RETURNING).
--     Without a SELECT policy on storage.objects every upload failed RLS with a 400.
-- Applied to production on 2026-06-12 via MCP.

CREATE POLICY app_buckets_select ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id IN ('branding', 'avatars'));
