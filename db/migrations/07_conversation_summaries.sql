-- ============================================================
-- Migration 07: Conversation summaries pipeline (Nodo 9.2)
-- Stores structured LLM-generated summaries from WhatsApp conversations
-- ============================================================

SET search_path TO asistente_real_state, public;

CREATE TABLE IF NOT EXISTS conversation_summaries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_id         UUID NOT NULL REFERENCES users(id),
    summary_json     JSONB NOT NULL,
    raw_message_count INTEGER NOT NULL DEFAULT 0,
    period_start     TIMESTAMPTZ NOT NULL,
    period_end       TIMESTAMPTZ NOT NULL,
    embedding        vector(768),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_conv_summaries_client ON conversation_summaries(client_id);
CREATE INDEX IF NOT EXISTS ix_conv_summaries_agent  ON conversation_summaries(agent_id);
CREATE INDEX IF NOT EXISTS ix_conv_summaries_embedding ON conversation_summaries
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

COMMENT ON TABLE conversation_summaries IS 'Structured LLM summaries extracted from WhatsApp conversation cycles';
COMMENT ON COLUMN conversation_summaries.summary_json IS '{"preferences":{},"objections":[],"operation_status":"","key_facts":[],"next_steps":[]}';

-- Track which interactions have been summarized
ALTER TABLE interactions
    ADD COLUMN IF NOT EXISTS summarized BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_interactions_unsummarized
    ON interactions(client_id) WHERE summarized = FALSE;

-- RLS policies
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents see own summaries" ON conversation_summaries
    FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Service role full access summaries" ON conversation_summaries
    FOR ALL USING (auth.role() = 'service_role');

-- updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON conversation_summaries;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversation_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
