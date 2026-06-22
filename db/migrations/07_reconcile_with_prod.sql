-- ============================================================
-- Migration 07: Reconcile repo with the live production schema
-- TD-008 / TD-009 — Fase 8.10
-- ES: Producción evolucionó fuera del control de migraciones (Fase 7/8 +
--     integración Google Calendar/OAuth). Esta migración declara el estado
--     VIVO y autoritativo. Es idempotente: no-op sobre producción.
-- EN: Production drifted out of migration control (Fase 7/8 + Google
--     Calendar/OAuth integration). This migration declares the authoritative
--     LIVE state. It is idempotent: a no-op on production.
--
-- Identity convention: users.id == users.auth_user_id == auth.uid().
-- A BEFORE INSERT trigger forces id := auth_user_id, so every profile row's
-- PK equals its Supabase Auth uid (admins AND agents). This is why is_admin(),
-- current_agent_id() and id-based FK scoping all resolve consistently.
-- ============================================================

SET search_path = asistente_real_state, public;

-- ── Identity enforcement: users.id := auth_user_id on insert ──────────────────
CREATE OR REPLACE FUNCTION enforce_user_id_equals_auth()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL THEN
    NEW.id := NEW.auth_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_id_equals_auth ON users;
CREATE TRIGGER trg_user_id_equals_auth
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_equals_auth();

-- ── updated_at maintenance trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','properties','clients','interactions','events','rag_documents',
    'objection_feedback','scraping_sources','property_owner_contacts',
    'whatsapp_numbers','cross_agent_matches'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I '
                || 'FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
  END LOOP;
END $$;

-- ── Auth helpers (authoritative live definitions) ─────────────────────────────
-- Supersedes the id-based is_admin() from migration 04.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Resolves the internal users.id for the calling auth user.
CREATE OR REPLACE FUNCTION current_agent_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid();
$$;

-- ── Consolidated RLS policies (supersede migration 04 per-command names) ──────
-- Drop stale names created by migration 04, then create the live ones.
DROP POLICY IF EXISTS users_read_all     ON users;
DROP POLICY IF EXISTS users_update_own   ON users;
DROP POLICY IF EXISTS users_insert_admin ON users;
DROP POLICY IF EXISTS users_delete_admin ON users;
CREATE POLICY users_read_all     ON users FOR SELECT USING (true);
CREATE POLICY users_update_own   ON users FOR UPDATE USING (auth_user_id = auth.uid() OR is_admin());
CREATE POLICY users_insert_admin ON users FOR INSERT WITH CHECK (is_admin());
CREATE POLICY users_delete_admin ON users FOR DELETE USING (is_admin());

-- properties (per-command; current_agent_id scoping)
DROP POLICY IF EXISTS prop_read_all   ON properties;
DROP POLICY IF EXISTS prop_insert_own ON properties;
DROP POLICY IF EXISTS prop_update_own ON properties;
DROP POLICY IF EXISTS prop_delete_own ON properties;
CREATE POLICY prop_read_all   ON properties FOR SELECT USING (true);
CREATE POLICY prop_insert_own ON properties FOR INSERT WITH CHECK (listing_agent_id = current_agent_id() OR is_admin());
CREATE POLICY prop_update_own ON properties FOR UPDATE USING (listing_agent_id = current_agent_id() OR is_admin());
CREATE POLICY prop_delete_own ON properties FOR DELETE USING (listing_agent_id = current_agent_id() OR is_admin());

-- clients / property_owner_contacts / interactions / events / matches (consolidated ALL)
DROP POLICY IF EXISTS clients_select_own ON clients;
DROP POLICY IF EXISTS clients_insert_own ON clients;
DROP POLICY IF EXISTS clients_update_own ON clients;
DROP POLICY IF EXISTS clients_delete_own ON clients;
DROP POLICY IF EXISTS clients_own        ON clients;
CREATE POLICY clients_own ON clients FOR ALL USING (assigned_agent_id = current_agent_id() OR is_admin());

DROP POLICY IF EXISTS poc_select_own ON property_owner_contacts;
DROP POLICY IF EXISTS poc_insert_own ON property_owner_contacts;
DROP POLICY IF EXISTS poc_update_own ON property_owner_contacts;
DROP POLICY IF EXISTS poc_delete_own ON property_owner_contacts;
DROP POLICY IF EXISTS poc_own        ON property_owner_contacts;
CREATE POLICY poc_own ON property_owner_contacts FOR ALL USING (listing_agent_id = current_agent_id() OR is_admin());

DROP POLICY IF EXISTS inter_select_own ON interactions;
DROP POLICY IF EXISTS inter_insert_own ON interactions;
DROP POLICY IF EXISTS inter_update_own ON interactions;
DROP POLICY IF EXISTS inter_own        ON interactions;
CREATE POLICY inter_own ON interactions FOR ALL USING (agent_id = current_agent_id() OR is_admin());

DROP POLICY IF EXISTS events_select_own ON events;
DROP POLICY IF EXISTS events_insert_own ON events;
DROP POLICY IF EXISTS events_update_own ON events;
DROP POLICY IF EXISTS events_own        ON events;
CREATE POLICY events_own ON events FOR ALL USING (agent_id = current_agent_id() OR is_admin());

DROP POLICY IF EXISTS matches_select ON cross_agent_matches;
DROP POLICY IF EXISTS matches_insert ON cross_agent_matches;
DROP POLICY IF EXISTS matches_update ON cross_agent_matches;
DROP POLICY IF EXISTS matches_own    ON cross_agent_matches;
CREATE POLICY matches_own ON cross_agent_matches FOR ALL USING (
  listing_agent_id = current_agent_id() OR buyer_agent_id = current_agent_id() OR is_admin()
);

-- whatsapp_numbers (select own; admin manages)
DROP POLICY IF EXISTS wa_select       ON whatsapp_numbers;
DROP POLICY IF EXISTS wa_insert_admin ON whatsapp_numbers;
DROP POLICY IF EXISTS wa_update_admin ON whatsapp_numbers;
DROP POLICY IF EXISTS wa_delete_admin ON whatsapp_numbers;
DROP POLICY IF EXISTS wa_manage_admin ON whatsapp_numbers;
CREATE POLICY wa_select       ON whatsapp_numbers FOR SELECT USING (agent_id = current_agent_id() OR is_admin());
CREATE POLICY wa_manage_admin ON whatsapp_numbers FOR ALL USING (is_admin());

-- rag_documents / scraping_sources (shared read; admin manages)
DROP POLICY IF EXISTS rag_read_all     ON rag_documents;
DROP POLICY IF EXISTS rag_insert_admin ON rag_documents;
DROP POLICY IF EXISTS rag_update_admin ON rag_documents;
DROP POLICY IF EXISTS rag_delete_admin ON rag_documents;
DROP POLICY IF EXISTS rag_admin        ON rag_documents;
CREATE POLICY rag_read_all ON rag_documents FOR SELECT USING (true);
CREATE POLICY rag_admin    ON rag_documents FOR ALL USING (is_admin());

DROP POLICY IF EXISTS scraping_read_all ON scraping_sources;
DROP POLICY IF EXISTS scraping_admin    ON scraping_sources;
DROP POLICY IF EXISTS scraping_read     ON scraping_sources;
CREATE POLICY scraping_read  ON scraping_sources FOR SELECT USING (true);
CREATE POLICY scraping_admin ON scraping_sources FOR ALL USING (is_admin());

-- objection_feedback / audit_log
DROP POLICY IF EXISTS feedback_insert ON objection_feedback;
DROP POLICY IF EXISTS feedback_read   ON objection_feedback;
DROP POLICY IF EXISTS feedback_admin  ON objection_feedback;
CREATE POLICY feedback_insert ON objection_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY feedback_admin  ON objection_feedback FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS audit_admin ON audit_log;
CREATE POLICY audit_admin ON audit_log FOR ALL USING (is_admin());

-- ── Google Calendar / OAuth integration (was only in production) ──────────────
CREATE TABLE IF NOT EXISTS agent_google_credentials (
  agent_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  access_token  TEXT,
  token_expiry  TIMESTAMPTZ,
  calendar_id   TEXT DEFAULT 'primary',
  google_email  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE agent_google_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agc_select_own ON agent_google_credentials;
DROP POLICY IF EXISTS agc_delete_own ON agent_google_credentials;
CREATE POLICY agc_select_own ON agent_google_credentials FOR SELECT USING (agent_id = current_agent_id() OR is_admin());
CREATE POLICY agc_delete_own ON agent_google_credentials FOR DELETE USING (agent_id = current_agent_id() OR is_admin());
-- INSERT/UPDATE performed by edge functions via the service role (bypasses RLS).

-- Transient OAuth CSRF state; written/cleared by the OAuth edge function (service role).
CREATE TABLE IF NOT EXISTS google_oauth_states (
  state      TEXT PRIMARY KEY,
  agent_id   UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE google_oauth_states ENABLE ROW LEVEL SECURITY;
