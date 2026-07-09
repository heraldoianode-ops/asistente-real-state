-- ============================================================
-- Migration 07: Fix column-name/dimension drift in cross-agent matching
-- find_cross_agent_matches referenced clients.agent_id / clients.embedding,
-- neither of which exist — the real columns are assigned_agent_id and
-- preference_embedding vector(768). p_embedding was also declared as
-- vector(1536), incompatible with the 768-dim vectors actually stored
-- (see properties.embedding / clients.preference_embedding).
-- ============================================================

CREATE OR REPLACE FUNCTION asistente_real_state.find_cross_agent_matches(
  p_property_id      UUID,
  p_embedding        VECTOR(768),
  p_listing_agent_id UUID,
  p_threshold        FLOAT DEFAULT 0.72
)
RETURNS TABLE (client_id UUID, client_name TEXT, agent_id UUID, agent_name TEXT, similarity FLOAT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = asistente_real_state
AS $$
  SELECT
    c.id                                         AS client_id,
    c.full_name                                  AS client_name,
    u.id                                          AS agent_id,
    COALESCE(u.full_name, u.email)                AS agent_name,
    1 - (c.preference_embedding <=> p_embedding)  AS similarity
  FROM asistente_real_state.clients c
  JOIN asistente_real_state.users   u ON u.id = c.assigned_agent_id
  WHERE c.assigned_agent_id != p_listing_agent_id
    AND c.preference_embedding IS NOT NULL
    AND 1 - (c.preference_embedding <=> p_embedding) >= p_threshold
  ORDER BY similarity DESC
  LIMIT 20;
$$;
