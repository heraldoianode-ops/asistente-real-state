-- 13: capture documentation management (M2/F123)
-- ES: Documentación requerida para publicar una captación. Estados:
--     required -> requested -> received -> validated|rejected.
--     El bot solicita lo faltante al dueño; al recibirlo, el martillero valida.
-- EN: Required documentation to list a captured property. The bot requests the
--     missing docs from the owner; on receipt the martillero validates.

CREATE TABLE IF NOT EXISTS asistente_real_state.capture_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES asistente_real_state.properties(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'required'
               CHECK (status IN ('required','requested','received','validated','rejected')),
  file_url     TEXT,
  requested_at TIMESTAMPTZ,
  received_at  TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES asistente_real_state.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, doc_type)
);
CREATE INDEX IF NOT EXISTS capture_docs_property_idx
  ON asistente_real_state.capture_documents (property_id, status);

ALTER TABLE asistente_real_state.capture_documents ENABLE ROW LEVEL SECURITY;

-- Edge Functions use service role (bypass RLS). Dashboard: admins all; the
-- listing agent of the property sees its docs.
DROP POLICY IF EXISTS capture_docs_read ON asistente_real_state.capture_documents;
CREATE POLICY capture_docs_read ON asistente_real_state.capture_documents
  FOR SELECT TO authenticated
  USING (
    asistente_real_state.is_admin()
    OR EXISTS (
      SELECT 1 FROM asistente_real_state.properties p
      JOIN asistente_real_state.users u ON u.id = p.listing_agent_id
      WHERE u.auth_user_id = auth.uid() AND p.id = capture_documents.property_id
    )
  );

GRANT SELECT ON asistente_real_state.capture_documents TO authenticated;

-- Configurable required-doc list (comma-separated). NULL => code default.
INSERT INTO asistente_real_state.app_settings (key, value) VALUES
  ('required_capture_docs', NULL)
ON CONFLICT (key) DO NOTHING;
