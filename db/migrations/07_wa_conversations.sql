-- ============================================================
-- Migration 07: WhatsApp conversation memory for VALKIRYA RS
-- Stores chat history per phone number for context-aware AI replies
-- ============================================================

CREATE TABLE IF NOT EXISTS asistente_real_state.wa_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(30) NOT NULL,
    agent_id UUID REFERENCES asistente_real_state.users(id),
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_wa_conversations_phone
    ON asistente_real_state.wa_conversations (phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_wa_conversations_agent
    ON asistente_real_state.wa_conversations (agent_id, created_at DESC);

-- RLS: agents see only conversations with their assigned numbers
ALTER TABLE asistente_real_state.wa_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_conversations_admin_all ON asistente_real_state.wa_conversations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM asistente_real_state.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

CREATE POLICY wa_conversations_agent_own ON asistente_real_state.wa_conversations
    FOR SELECT TO authenticated
    USING (agent_id = auth.uid());

-- Service role (Edge Functions) bypasses RLS automatically
