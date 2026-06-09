-- RPC: find clients from OTHER agents matching a property embedding
-- Used by supabase/functions/match-properties
CREATE OR REPLACE FUNCTION asistente_real_state.find_cross_agent_matches(
  p_property_id   UUID,
  p_embedding     VECTOR(1536),
  p_listing_agent_id UUID,
  p_threshold     FLOAT DEFAULT 0.72
)
RETURNS TABLE (
  client_id   UUID,
  client_name TEXT,
  agent_id    UUID,
  agent_name  TEXT,
  similarity  FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = asistente_real_state
AS $$
  SELECT
    c.id                              AS client_id,
    c.full_name                       AS client_name,
    u.id                              AS agent_id,
    COALESCE(u.full_name, u.email)    AS agent_name,
    1 - (c.embedding <=> p_embedding) AS similarity
  FROM asistente_real_state.clients c
  JOIN asistente_real_state.users   u ON u.id = c.agent_id
  WHERE c.agent_id != p_listing_agent_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> p_embedding) >= p_threshold
  ORDER BY similarity DESC
  LIMIT 20;
$$;
