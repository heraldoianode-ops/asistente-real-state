-- 07_fix_is_admin.sql
-- Fix: is_admin() must match on auth_user_id (Supabase Auth uid), not users.id.
--
-- ES: Desde la Fase 8, cada fila de `users` se enlaza con Supabase Auth a traves
--     de `auth_user_id`, mientras que `users.id` es una PK independiente. La
--     definicion original en 04_rls_policies.sql usaba `id = auth.uid()`, que
--     nunca coincide, por lo que el bypass admin en RLS quedaba inoperativo.
--     Esta migracion supersede esa definicion. (Produccion ya estaba corregida;
--     este archivo deja el repo en lockstep para recreaciones desde cero.)
-- EN: Since Fase 8 each `users` row links to Supabase Auth via `auth_user_id`,
--     while `users.id` is an independent PK. The original definition in
--     04_rls_policies.sql used `id = auth.uid()`, which never matched, so the
--     admin RLS bypass was broken. This migration supersedes it. (Production was
--     already patched; this file keeps the repo in lockstep for clean rebuilds.)

CREATE OR REPLACE FUNCTION asistente_real_state.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM asistente_real_state.users
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;
