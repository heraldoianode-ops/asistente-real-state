-- 07: chat storage + context-preserving summaries (M0/F102)
-- ES: Conversaciones de WhatsApp y mensajes, con resumen compacto que preserva
--     contexto. El resumen se genera con LLM gratis (Ollama) — cero tokens Claude.
-- EN: WhatsApp conversations and messages, with a context-preserving compact
--     summary. Summaries are produced by the free LLM (Ollama) — zero Claude tokens.

-- 5 conversational contexts (M1): ventas, compras, tramites, inquilinos, ia.
CREATE TABLE IF NOT EXISTS asistente_real_state.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_phone TEXT NOT NULL,
  context TEXT,                       -- ventas|compras|tramites|inquilinos|ia (null until classified)
  agent_id UUID REFERENCES asistente_real_state.users(id),
  summary TEXT,                       -- compact context-preserving summary
  summary_updated_at TIMESTAMPTZ,
  messages_since_summary INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_phone)
);

CREATE TABLE IF NOT EXISTS asistente_real_state.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES asistente_real_state.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_conv_idx
  ON asistente_real_state.chat_messages (conversation_id, created_at);

ALTER TABLE asistente_real_state.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistente_real_state.chat_messages ENABLE ROW LEVEL SECURITY;

-- Edge Functions use the service role (bypasses RLS). Dashboard access:
-- admins see all; agents see conversations assigned to them.
DROP POLICY IF EXISTS chat_conv_read ON asistente_real_state.chat_conversations;
CREATE POLICY chat_conv_read ON asistente_real_state.chat_conversations
  FOR SELECT TO authenticated
  USING (asistente_real_state.is_admin()
         OR agent_id = (SELECT u.id FROM asistente_real_state.users u WHERE u.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS chat_msg_read ON asistente_real_state.chat_messages;
CREATE POLICY chat_msg_read ON asistente_real_state.chat_messages
  FOR SELECT TO authenticated
  USING (asistente_real_state.is_admin()
         OR EXISTS (SELECT 1 FROM asistente_real_state.chat_conversations c
                    JOIN asistente_real_state.users u ON u.id = c.agent_id
                    WHERE c.id = conversation_id AND u.auth_user_id = auth.uid()));

GRANT SELECT ON asistente_real_state.chat_conversations, asistente_real_state.chat_messages
  TO authenticated;
