-- 08: Google Calendar (OAuth por agente)
-- ES: Guarda el refresh_token de Google de cada agente y vincula los eventos con su id
--     de Google Calendar. La escritura la hacen las Edge Functions con service role.
-- EN: Stores each agent's Google refresh_token and links events to their Google Calendar
--     event id. Writes are performed by Edge Functions using the service role.

-- Per-agent Google credentials
CREATE TABLE IF NOT EXISTS asistente_real_state.agent_google_credentials (
  agent_id      uuid PRIMARY KEY REFERENCES asistente_real_state.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token  text,
  token_expiry  timestamptz,
  calendar_id   text DEFAULT 'primary',
  google_email  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE asistente_real_state.agent_google_credentials ENABLE ROW LEVEL SECURITY;

-- The owning agent (or admin) can see whether they are connected; the secret token
-- is never selected by the client (dashboard only reads agent_id/google_email/updated_at).
DROP POLICY IF EXISTS agc_select_own ON asistente_real_state.agent_google_credentials;
CREATE POLICY agc_select_own ON asistente_real_state.agent_google_credentials
  FOR SELECT USING (agent_id = asistente_real_state.current_agent_id() OR asistente_real_state.is_admin());

-- The owning agent can disconnect (delete) their own credentials.
DROP POLICY IF EXISTS agc_delete_own ON asistente_real_state.agent_google_credentials;
CREATE POLICY agc_delete_own ON asistente_real_state.agent_google_credentials
  FOR DELETE USING (agent_id = asistente_real_state.current_agent_id() OR asistente_real_state.is_admin());

-- Short-lived OAuth state for CSRF protection during the connect flow.
CREATE TABLE IF NOT EXISTS asistente_real_state.google_oauth_states (
  state      text PRIMARY KEY,
  agent_id   uuid NOT NULL REFERENCES asistente_real_state.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE asistente_real_state.google_oauth_states ENABLE ROW LEVEL SECURITY;
-- No client access: only the service role (Edge Functions) touches this table.

-- Link local events to their Google Calendar event id (idempotency / sync).
ALTER TABLE asistente_real_state.events ADD COLUMN IF NOT EXISTS google_event_id text;
