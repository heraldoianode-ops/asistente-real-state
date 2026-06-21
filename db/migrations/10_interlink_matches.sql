-- 10: interlinked-business matches (M2/F121, F122) — D021 oferta/demanda model
-- ES: Negocio entrelazado entre DOS partes (A y B). Cada parte tiene OFERTA
--     (propiedad que vende) y/o DEMANDA (búsqueda). El entrelazamiento se
--     DEDUCE/BUSCA cruzando oferta↔demanda con pgvector (aditivo, gratis):
--       opt1: la oferta de A satisface la demanda de B
--       opt2: la oferta de B satisface la demanda de A
--       opt3: ambas (recíproco)
--     Se guarda como 'candidate' (analizar antes de validar). Nada se valida solo.
-- EN: Interlinked business between TWO parties, deduced by crossing offer↔demand
--     via pgvector. opt1/opt2/opt3 per D021. Stored as 'candidate'.

CREATE TABLE IF NOT EXISTS asistente_real_state.interlink_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  a_phone             TEXT NOT NULL,
  b_phone             TEXT NOT NULL,
  match_option        TEXT NOT NULL CHECK (match_option IN ('opt1','opt2','opt3')),
  a_offer_property_id UUID REFERENCES asistente_real_state.properties(id) ON DELETE SET NULL, -- satisfies B's demand (opt1/opt3)
  b_offer_property_id UUID REFERENCES asistente_real_state.properties(id) ON DELETE SET NULL, -- satisfies A's demand (opt2/opt3)
  link_type           TEXT NOT NULL CHECK (link_type IN ('active','hidden')),
  similarity          NUMERIC,
  explanation         TEXT,
  status              TEXT NOT NULL DEFAULT 'candidate'
                      CHECK (status IN ('candidate','validated','discarded')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (a_phone, b_phone, link_type)
);
CREATE INDEX IF NOT EXISTS interlink_status_idx
  ON asistente_real_state.interlink_matches (status, link_type, created_at DESC);

ALTER TABLE asistente_real_state.interlink_matches ENABLE ROW LEVEL SECURITY;

-- Edge Functions use service role (bypass RLS). Dashboard: admins all; agents
-- see interlinks touching one of their listings (either offer side).
DROP POLICY IF EXISTS interlink_read ON asistente_real_state.interlink_matches;
CREATE POLICY interlink_read ON asistente_real_state.interlink_matches
  FOR SELECT TO authenticated
  USING (
    asistente_real_state.is_admin()
    OR EXISTS (
      SELECT 1 FROM asistente_real_state.properties p
      JOIN asistente_real_state.users u ON u.id = p.listing_agent_id
      WHERE u.auth_user_id = auth.uid()
        AND p.id IN (interlink_matches.a_offer_property_id, interlink_matches.b_offer_property_id)
    )
  );

GRANT SELECT ON asistente_real_state.interlink_matches TO authenticated;

-- Reverse semantic search: properties owned by a given phone whose OFERTA matches
-- a DEMANDA embedding. Powers the opt2/opt3 reciprocity check (additive, free).
CREATE OR REPLACE FUNCTION asistente_real_state.find_offers_for_demand(
  p_embedding   vector(768),
  p_owner_phone TEXT,
  p_threshold   FLOAT DEFAULT 0.72
)
RETURNS TABLE (property_id UUID, similarity FLOAT)
LANGUAGE sql STABLE
AS $$
  SELECT p.id, 1 - (p.embedding <=> p_embedding) AS similarity
  FROM asistente_real_state.properties p
  JOIN asistente_real_state.property_owner_contacts poc ON poc.property_id = p.id
  WHERE poc.phone = p_owner_phone
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> p_embedding) >= p_threshold
  ORDER BY similarity DESC;
$$;

GRANT EXECUTE ON FUNCTION asistente_real_state.find_offers_for_demand(vector, TEXT, FLOAT)
  TO authenticated, service_role;
