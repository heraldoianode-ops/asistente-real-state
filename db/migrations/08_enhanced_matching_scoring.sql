-- ============================================================
-- Migration 08: Enhanced matching + lead scoring (Nodo 9.3)
-- Adds conversation context to matching RPC and lead score function
-- ============================================================

SET search_path TO asistente_real_state, public;

-- Enhanced matching: considers both preference_embedding AND latest conversation summary
CREATE OR REPLACE FUNCTION asistente_real_state.find_cross_agent_matches_v2(
  p_property_id      UUID,
  p_embedding        public.vector,
  p_listing_agent_id UUID,
  p_threshold        FLOAT DEFAULT 0.65
)
RETURNS TABLE (client_id UUID, client_name TEXT, agent_id UUID, agent_name TEXT, similarity FLOAT, has_conversation_context BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = asistente_real_state, public
AS $$
  WITH client_scores AS (
    SELECT
      c.id AS client_id,
      c.full_name AS client_name,
      c.assigned_agent_id AS agent_id,
      COALESCE(u.full_name, u.email) AS agent_name,
      -- Base similarity from preference embedding
      CASE WHEN c.preference_embedding IS NOT NULL
        THEN 1 - (c.preference_embedding <=> p_embedding)
        ELSE 0
      END AS pref_similarity,
      -- Conversation summary similarity (latest summary embedding)
      (
        SELECT MAX(1 - (cs.embedding <=> p_embedding))
        FROM asistente_real_state.conversation_summaries cs
        WHERE cs.client_id = c.id AND cs.embedding IS NOT NULL
      ) AS conv_similarity
    FROM asistente_real_state.clients c
    JOIN asistente_real_state.users u ON u.id = c.assigned_agent_id
    WHERE c.assigned_agent_id != p_listing_agent_id
      AND (c.preference_embedding IS NOT NULL
           OR EXISTS (
             SELECT 1 FROM asistente_real_state.conversation_summaries cs
             WHERE cs.client_id = c.id AND cs.embedding IS NOT NULL
           ))
  )
  SELECT
    cs.client_id,
    cs.client_name,
    cs.agent_id,
    cs.agent_name,
    -- Weighted: 40% preference, 60% conversation (conversation is fresher context)
    GREATEST(
      COALESCE(cs.pref_similarity, 0),
      COALESCE(cs.conv_similarity, 0),
      COALESCE(cs.pref_similarity * 0.4 + cs.conv_similarity * 0.6, cs.pref_similarity, cs.conv_similarity, 0)
    ) AS similarity,
    cs.conv_similarity IS NOT NULL AS has_conversation_context
  FROM client_scores cs
  WHERE GREATEST(
      COALESCE(cs.pref_similarity, 0),
      COALESCE(cs.conv_similarity, 0),
      COALESCE(cs.pref_similarity * 0.4 + cs.conv_similarity * 0.6, cs.pref_similarity, cs.conv_similarity, 0)
    ) >= p_threshold
  ORDER BY similarity DESC
  LIMIT 20;
$$;

-- Lead scoring function: rule-based scoring using client data + conversation summaries
CREATE OR REPLACE FUNCTION asistente_real_state.score_lead(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = asistente_real_state, public
AS $$
DECLARE
  v_score FLOAT := 0;
  v_factors JSONB := '[]'::JSONB;
  v_client RECORD;
  v_interaction_count INT;
  v_summary_count INT;
  v_latest_summary JSONB;
  v_days_since_last INT;
  v_has_budget BOOLEAN;
  v_has_preferences BOOLEAN;
  v_objection_count INT;
BEGIN
  SELECT * INTO v_client FROM asistente_real_state.clients WHERE id = p_client_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'client not found'); END IF;

  -- Factor 1: Lead stage progression (0-25 points)
  v_score := v_score + CASE v_client.lead_stage
    WHEN 'new' THEN 5
    WHEN 'contacted' THEN 10
    WHEN 'qualified' THEN 15
    WHEN 'visit_scheduled' THEN 20
    WHEN 'negotiating' THEN 23
    WHEN 'closing' THEN 25
    ELSE 0
  END;
  v_factors := v_factors || jsonb_build_object('factor', 'lead_stage', 'value', v_client.lead_stage, 'points', v_score);

  -- Factor 2: Interaction volume (0-20 points)
  SELECT COUNT(*) INTO v_interaction_count FROM asistente_real_state.interactions WHERE client_id = p_client_id;
  v_score := v_score + LEAST(v_interaction_count * 2, 20);
  v_factors := v_factors || jsonb_build_object('factor', 'interactions', 'value', v_interaction_count, 'points', LEAST(v_interaction_count * 2, 20));

  -- Factor 3: Has budget defined (0-10 points)
  v_has_budget := v_client.budget IS NOT NULL AND v_client.budget > 0;
  IF v_has_budget THEN v_score := v_score + 10; END IF;
  v_factors := v_factors || jsonb_build_object('factor', 'budget_defined', 'value', v_has_budget, 'points', CASE WHEN v_has_budget THEN 10 ELSE 0 END);

  -- Factor 4: Has preferences (0-10 points)
  v_has_preferences := v_client.preferred_neighborhoods IS NOT NULL OR v_client.preferred_property_type IS NOT NULL OR v_client.min_bedrooms IS NOT NULL;
  IF v_has_preferences THEN v_score := v_score + 10; END IF;
  v_factors := v_factors || jsonb_build_object('factor', 'preferences_defined', 'value', v_has_preferences, 'points', CASE WHEN v_has_preferences THEN 10 ELSE 0 END);

  -- Factor 5: Conversation summary insights (0-25 points)
  SELECT COUNT(*) INTO v_summary_count FROM asistente_real_state.conversation_summaries WHERE client_id = p_client_id;
  IF v_summary_count > 0 THEN
    v_score := v_score + LEAST(v_summary_count * 5, 15);

    SELECT summary_json INTO v_latest_summary
    FROM asistente_real_state.conversation_summaries
    WHERE client_id = p_client_id
    ORDER BY period_end DESC LIMIT 1;

    -- Bonus for positive sentiment
    IF v_latest_summary->>'sentiment' = 'positive' THEN v_score := v_score + 5; END IF;
    -- Bonus for next_steps defined
    IF jsonb_array_length(COALESCE(v_latest_summary->'next_steps', '[]'::JSONB)) > 0 THEN v_score := v_score + 5; END IF;

    v_objection_count := jsonb_array_length(COALESCE(v_latest_summary->'objections', '[]'::JSONB));
    IF v_objection_count > 3 THEN v_score := v_score - 5; END IF;

    v_factors := v_factors || jsonb_build_object('factor', 'conversation_context', 'value', jsonb_build_object('summaries', v_summary_count, 'sentiment', v_latest_summary->>'sentiment', 'objections', v_objection_count), 'points', LEAST(v_summary_count * 5, 15));
  END IF;

  -- Factor 6: Recency (0-10 points)
  SELECT EXTRACT(DAY FROM NOW() - MAX(created_at))::INT INTO v_days_since_last
  FROM asistente_real_state.interactions WHERE client_id = p_client_id;
  IF v_days_since_last IS NOT NULL THEN
    v_score := v_score + CASE
      WHEN v_days_since_last <= 1 THEN 10
      WHEN v_days_since_last <= 3 THEN 8
      WHEN v_days_since_last <= 7 THEN 5
      WHEN v_days_since_last <= 14 THEN 2
      ELSE 0
    END;
    v_factors := v_factors || jsonb_build_object('factor', 'recency_days', 'value', v_days_since_last, 'points', CASE WHEN v_days_since_last <= 1 THEN 10 WHEN v_days_since_last <= 3 THEN 8 WHEN v_days_since_last <= 7 THEN 5 WHEN v_days_since_last <= 14 THEN 2 ELSE 0 END);
  END IF;

  RETURN jsonb_build_object(
    'client_id', p_client_id,
    'score', LEAST(v_score, 100),
    'max_score', 100,
    'factors', v_factors,
    'scored_at', NOW()
  );
END;
$$;
