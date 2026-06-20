-- 10: Work planner / autonomous follow-up
-- ES: Próximos pasos sugeridos por cliente (seguimiento, búsqueda, visita). En modo
--     asistido se notifican al agente; en modo autónomo el agente los ejecuta solo.
-- EN: Per-client suggested next steps (follow-up, search, visit). In assisted mode they
--     are surfaced to the agent; in autonomous mode the agent executes them on its own.

CREATE TABLE IF NOT EXISTS asistente_real_state.suggested_actions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   uuid REFERENCES asistente_real_state.clients(id) ON DELETE CASCADE,
  agent_id    uuid REFERENCES asistente_real_state.users(id),
  action_type varchar(30) NOT NULL,  -- follow_up | search | schedule_visit
  due_at      timestamptz,
  status      varchar(20) NOT NULL DEFAULT 'pending',  -- pending | sent | done | dismissed
  rationale   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_suggested_actions_client ON asistente_real_state.suggested_actions(client_id);
CREATE INDEX IF NOT EXISTS ix_suggested_actions_agent  ON asistente_real_state.suggested_actions(agent_id);
CREATE INDEX IF NOT EXISTS ix_suggested_actions_status ON asistente_real_state.suggested_actions(status);

ALTER TABLE asistente_real_state.suggested_actions ENABLE ROW LEVEL SECURITY;

-- An agent sees/acts on their own suggested actions; admins see all. Writes go through
-- the backend (service role), which bypasses RLS.
DROP POLICY IF EXISTS sa_select_own ON asistente_real_state.suggested_actions;
CREATE POLICY sa_select_own ON asistente_real_state.suggested_actions
  FOR SELECT USING (agent_id = asistente_real_state.current_agent_id() OR asistente_real_state.is_admin());

DROP POLICY IF EXISTS sa_update_own ON asistente_real_state.suggested_actions;
CREATE POLICY sa_update_own ON asistente_real_state.suggested_actions
  FOR UPDATE USING (agent_id = asistente_real_state.current_agent_id() OR asistente_real_state.is_admin());

-- Per-agent autonomy toggle: when true, the planner executes follow-ups automatically.
ALTER TABLE asistente_real_state.users ADD COLUMN IF NOT EXISTS autonomous_mode boolean NOT NULL DEFAULT false;
