-- 09: Conversation persistence (WhatsApp messages)
-- ES: Persiste cada mensaje entrante/saliente de WhatsApp (hoy solo viven en Redis de
--     forma efímera). Habilita resúmenes de conversación y matching sobre texto libre.
--     La escritura la hace el backend con service role; los agentes leen lo suyo.
-- EN: Persists every inbound/outbound WhatsApp message (today only ephemeral in Redis).
--     Enables conversation summaries and free-text matching. Writes are done by the
--     backend using the service role; agents read their own.

CREATE TABLE IF NOT EXISTS asistente_real_state.messages (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wa_contact_id varchar(50) NOT NULL,
  client_id     uuid REFERENCES asistente_real_state.clients(id) ON DELETE SET NULL,
  agent_id      uuid REFERENCES asistente_real_state.users(id),
  direction     varchar(10) NOT NULL,  -- 'in' | 'out'
  body          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_messages_wa_contact ON asistente_real_state.messages(wa_contact_id);
CREATE INDEX IF NOT EXISTS ix_messages_client     ON asistente_real_state.messages(client_id);
CREATE INDEX IF NOT EXISTS ix_messages_created     ON asistente_real_state.messages(created_at);

ALTER TABLE asistente_real_state.messages ENABLE ROW LEVEL SECURITY;

-- An agent sees the messages tied to them; admins see all. Writes go through the
-- service role (backend), which bypasses RLS.
DROP POLICY IF EXISTS messages_select_own ON asistente_real_state.messages;
CREATE POLICY messages_select_own ON asistente_real_state.messages
  FOR SELECT USING (agent_id = asistente_real_state.current_agent_id() OR asistente_real_state.is_admin());

-- Per-client rolling conversation summary (LLM-generated) used to enrich matching.
ALTER TABLE asistente_real_state.clients ADD COLUMN IF NOT EXISTS conversation_summary text;
