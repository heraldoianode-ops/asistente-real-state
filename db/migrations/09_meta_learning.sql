-- 09: meta-learning insights (M1/F115)
-- ES: Aprendizajes extraídos de chats (qué funcionó / qué falló / tips de
--     comunicación asertiva). Outcome opcional por conversación.
-- EN: Insights mined from chats (what worked / failed / assertive-comm tips).
--     Optional per-conversation outcome.

ALTER TABLE asistente_real_state.chat_conversations
  ADD COLUMN IF NOT EXISTS outcome TEXT; -- won | lost | open

CREATE TABLE IF NOT EXISTS asistente_real_state.meta_learning_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES asistente_real_state.chat_conversations(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('success','failure','tip')),
  insight TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meta_insights_created_idx
  ON asistente_real_state.meta_learning_insights (created_at DESC);

ALTER TABLE asistente_real_state.meta_learning_insights ENABLE ROW LEVEL SECURITY;

-- Edge Functions use the service role (bypasses RLS). Dashboard: admins read.
DROP POLICY IF EXISTS meta_insights_read ON asistente_real_state.meta_learning_insights;
CREATE POLICY meta_insights_read ON asistente_real_state.meta_learning_insights
  FOR SELECT TO authenticated
  USING (asistente_real_state.is_admin());

GRANT SELECT ON asistente_real_state.meta_learning_insights TO authenticated;
