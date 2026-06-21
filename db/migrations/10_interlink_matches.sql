-- 10: interlinked-business matches (M2/F121, F122)
-- ES: Negocios entrelazados. Un comprador candidato (matching aditivo pgvector)
--     que TAMBIÉN es dueño de otra propiedad de la agencia => negocio entrelazado.
--     Se guarda como 'candidate' (analizar antes de validar). link_type:
--     'active' (cadena en curso) | 'hidden' (latente). Nada se valida solo.
-- EN: Interlinked deals. A candidate buyer (additive pgvector match) who ALSO
--     owns another agency property => interlinked business. Stored as 'candidate'
--     (analyze before validating). Nothing auto-validates.

CREATE TABLE IF NOT EXISTS asistente_real_state.interlink_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id        UUID REFERENCES asistente_real_state.properties(id) ON DELETE CASCADE,
  client_id          UUID REFERENCES asistente_real_state.clients(id) ON DELETE SET NULL,
  linked_property_id UUID REFERENCES asistente_real_state.properties(id) ON DELETE SET NULL,
  link_type          TEXT NOT NULL CHECK (link_type IN ('active','hidden')),
  similarity         NUMERIC,
  explanation        TEXT,
  status             TEXT NOT NULL DEFAULT 'candidate'
                     CHECK (status IN ('candidate','validated','discarded')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, client_id, linked_property_id)
);
CREATE INDEX IF NOT EXISTS interlink_status_idx
  ON asistente_real_state.interlink_matches (status, created_at DESC);

ALTER TABLE asistente_real_state.interlink_matches ENABLE ROW LEVEL SECURITY;

-- Edge Functions use service role (bypass RLS). Dashboard: admins all; agents
-- see interlinks touching one of their listings.
DROP POLICY IF EXISTS interlink_read ON asistente_real_state.interlink_matches;
CREATE POLICY interlink_read ON asistente_real_state.interlink_matches
  FOR SELECT TO authenticated
  USING (
    asistente_real_state.is_admin()
    OR EXISTS (
      SELECT 1 FROM asistente_real_state.properties p
      JOIN asistente_real_state.users u ON u.id = p.listing_agent_id
      WHERE u.auth_user_id = auth.uid()
        AND p.id IN (interlink_matches.property_id, interlink_matches.linked_property_id)
    )
  );

GRANT SELECT ON asistente_real_state.interlink_matches TO authenticated;
