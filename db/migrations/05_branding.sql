-- 05: branding (logo/banner), agent avatars, storage buckets
-- ES: Logo y banner de empresa + foto de agente. Buckets públicos de lectura; escritura por RLS.
-- EN: Company logo and banner + agent photo. Public-read buckets; writes gated by RLS.

ALTER TABLE asistente_real_state.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS asistente_real_state.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);
ALTER TABLE asistente_real_state.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_read ON asistente_real_state.app_settings;
CREATE POLICY app_settings_read ON asistente_real_state.app_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS app_settings_write ON asistente_real_state.app_settings;
CREATE POLICY app_settings_write ON asistente_real_state.app_settings
  FOR ALL TO authenticated
  USING (asistente_real_state.is_admin())
  WITH CHECK (asistente_real_state.is_admin());

GRANT SELECT ON asistente_real_state.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON asistente_real_state.app_settings TO authenticated;

INSERT INTO asistente_real_state.app_settings (key, value) VALUES
  ('logo_url', NULL), ('banner_url', NULL)
ON CONFLICT (key) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES
  ('branding', 'branding', true), ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS branding_admin_insert ON storage.objects;
CREATE POLICY branding_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND asistente_real_state.is_admin());
DROP POLICY IF EXISTS branding_admin_update ON storage.objects;
CREATE POLICY branding_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND asistente_real_state.is_admin());
DROP POLICY IF EXISTS branding_admin_delete ON storage.objects;
CREATE POLICY branding_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND asistente_real_state.is_admin());

DROP POLICY IF EXISTS avatars_insert ON storage.objects;
CREATE POLICY avatars_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (
    asistente_real_state.is_admin() OR
    name LIKE (SELECT u.id::text || '%' FROM asistente_real_state.users u WHERE u.auth_user_id = auth.uid())
  ));
DROP POLICY IF EXISTS avatars_update ON storage.objects;
CREATE POLICY avatars_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (
    asistente_real_state.is_admin() OR
    name LIKE (SELECT u.id::text || '%' FROM asistente_real_state.users u WHERE u.auth_user_id = auth.uid())
  ));
DROP POLICY IF EXISTS avatars_delete ON storage.objects;
CREATE POLICY avatars_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND asistente_real_state.is_admin());
