-- Cross-agent matching: given a freshly-embedded listing, find buyer clients of
-- OTHER agents whose preference vector is close enough to the property.
-- Embeddings are vector(768) (see 02_schema.sql); clients link to their agent via
-- assigned_agent_id and store their vector in preference_embedding.
CREATE OR REPLACE FUNCTION asistente_real_state.find_cross_agent_matches(
  p_property_id      UUID,
  p_embedding        VECTOR(768),
  p_listing_agent_id UUID,
  p_threshold        FLOAT DEFAULT 0.72
)
RETURNS TABLE (client_id UUID, client_name TEXT, agent_id UUID, agent_name TEXT, similarity FLOAT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = asistente_real_state, public  -- public: pgvector <=> operator
AS $$
  SELECT
    c.id                                         AS client_id,
    c.full_name                                  AS client_name,
    u.id                                         AS agent_id,
    COALESCE(u.full_name, u.email)               AS agent_name,
    1 - (c.preference_embedding <=> p_embedding) AS similarity
  FROM asistente_real_state.clients c
  JOIN asistente_real_state.users   u ON u.id = c.assigned_agent_id
  WHERE c.assigned_agent_id <> p_listing_agent_id
    AND c.client_type IN ('buyer', 'both')
    AND c.preference_embedding IS NOT NULL
    AND 1 - (c.preference_embedding <=> p_embedding) >= p_threshold
  ORDER BY similarity DESC
  LIMIT 20;
$$;
