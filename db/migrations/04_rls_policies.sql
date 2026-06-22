-- ============================================================
-- Migration 04: Row Level Security — Supabase
-- Nodo 7.1 — Privacy layer
-- Admin: bypass all. Agent: own data only.
-- Properties: read all, write own listing.
-- ============================================================

-- ── Fase 7: align users table with Supabase Auth ──────────────
-- Password auth (hashed_password from 02_schema) is replaced by Supabase Auth.
-- auth_user_id links a profile row to its auth.users record and MUST exist
-- before migration 05, whose storage policies reference users.auth_user_id.
-- Idempotent so it is a no-op on environments already migrated (e.g. prod).
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE users DROP COLUMN IF EXISTS hashed_password;

-- Enable RLS
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties             ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_owner_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients                ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_numbers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_agent_matches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_feedback     ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_sources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ── USERS ──────────────────────────────────────────────────
-- All agents visible to each other (needed for collaboration/match display)
CREATE POLICY users_read_all   ON users FOR SELECT USING (true);
CREATE POLICY users_update_own ON users FOR UPDATE USING (id = auth.uid() OR is_admin());
CREATE POLICY users_insert_admin ON users FOR INSERT WITH CHECK (is_admin());
CREATE POLICY users_delete_admin ON users FOR DELETE USING (is_admin());

-- ── PROPERTIES ─────────────────────────────────────────────
-- Full catalog visible to all; write restricted to listing agent
CREATE POLICY prop_read_all    ON properties FOR SELECT USING (true);
CREATE POLICY prop_insert_own  ON properties FOR INSERT WITH CHECK (listing_agent_id = auth.uid() OR is_admin());
CREATE POLICY prop_update_own  ON properties FOR UPDATE USING (listing_agent_id = auth.uid() OR is_admin());
CREATE POLICY prop_delete_own  ON properties FOR DELETE USING (listing_agent_id = auth.uid() OR is_admin());

-- ── PROPERTY OWNER CONTACTS (private) ─────────────────────
CREATE POLICY poc_select_own ON property_owner_contacts FOR SELECT USING (listing_agent_id = auth.uid() OR is_admin());
CREATE POLICY poc_insert_own ON property_owner_contacts FOR INSERT WITH CHECK (listing_agent_id = auth.uid() OR is_admin());
CREATE POLICY poc_update_own ON property_owner_contacts FOR UPDATE USING (listing_agent_id = auth.uid() OR is_admin());
CREATE POLICY poc_delete_own ON property_owner_contacts FOR DELETE USING (listing_agent_id = auth.uid() OR is_admin());

-- ── CLIENTS (private to assigned agent) ───────────────────
CREATE POLICY clients_select_own ON clients FOR SELECT USING (assigned_agent_id = auth.uid() OR is_admin());
CREATE POLICY clients_insert_own ON clients FOR INSERT WITH CHECK (assigned_agent_id = auth.uid() OR is_admin());
CREATE POLICY clients_update_own ON clients FOR UPDATE USING (assigned_agent_id = auth.uid() OR is_admin());
CREATE POLICY clients_delete_own ON clients FOR DELETE USING (assigned_agent_id = auth.uid() OR is_admin());

-- ── INTERACTIONS ──────────────────────────────────────────
CREATE POLICY inter_select_own ON interactions FOR SELECT USING (agent_id = auth.uid() OR is_admin());
CREATE POLICY inter_insert_own ON interactions FOR INSERT WITH CHECK (agent_id = auth.uid() OR is_admin());
CREATE POLICY inter_update_own ON interactions FOR UPDATE USING (agent_id = auth.uid() OR is_admin());

-- ── EVENTS ────────────────────────────────────────────────
CREATE POLICY events_select_own ON events FOR SELECT USING (agent_id = auth.uid() OR is_admin());
CREATE POLICY events_insert_own ON events FOR INSERT WITH CHECK (agent_id = auth.uid() OR is_admin());
CREATE POLICY events_update_own ON events FOR UPDATE USING (agent_id = auth.uid() OR is_admin());

-- ── WHATSAPP NUMBERS (admin manages, agent sees own) ──────
CREATE POLICY wa_select     ON whatsapp_numbers FOR SELECT USING (agent_id = auth.uid() OR is_admin());
CREATE POLICY wa_insert_admin ON whatsapp_numbers FOR INSERT WITH CHECK (is_admin());
CREATE POLICY wa_update_admin ON whatsapp_numbers FOR UPDATE USING (is_admin());
CREATE POLICY wa_delete_admin ON whatsapp_numbers FOR DELETE USING (is_admin());

-- ── CROSS AGENT MATCHES (visible to both involved agents) ─
CREATE POLICY matches_select ON cross_agent_matches FOR SELECT USING (
    listing_agent_id = auth.uid() OR buyer_agent_id = auth.uid() OR is_admin()
);
CREATE POLICY matches_insert ON cross_agent_matches FOR INSERT WITH CHECK (
    buyer_agent_id = auth.uid() OR is_admin()
);
CREATE POLICY matches_update ON cross_agent_matches FOR UPDATE USING (
    listing_agent_id = auth.uid() OR buyer_agent_id = auth.uid() OR is_admin()
);

-- ── RAG DOCUMENTS (shared, admin manages) ─────────────────
CREATE POLICY rag_read_all     ON rag_documents FOR SELECT USING (true);
CREATE POLICY rag_insert_admin ON rag_documents FOR INSERT WITH CHECK (is_admin());
CREATE POLICY rag_update_admin ON rag_documents FOR UPDATE USING (is_admin());
CREATE POLICY rag_delete_admin ON rag_documents FOR DELETE USING (is_admin());

-- ── SCRAPING SOURCES (shared read, admin manages) ─────────
CREATE POLICY scraping_read_all ON scraping_sources FOR SELECT USING (true);
CREATE POLICY scraping_admin    ON scraping_sources FOR ALL USING (is_admin());

-- ── OBJECTION FEEDBACK ────────────────────────────────────
CREATE POLICY feedback_insert ON objection_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY feedback_read   ON objection_feedback FOR SELECT USING (is_admin());

-- ── AUDIT LOG (admin only) ────────────────────────────────
CREATE POLICY audit_admin ON audit_log FOR ALL USING (is_admin());
