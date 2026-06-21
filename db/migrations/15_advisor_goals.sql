-- 15: configurable monthly goals (M3/F130-F131, D024)
-- ES: Objetivos mensuales por asesor: captaciones, ventas, alquileres. Defaults
--     de la agencia en app_settings (configurables por admin/martillero en su
--     panel); override por asesor en advisor_goals.
-- EN: Monthly per-advisor goals (captaciones/ventas/alquileres). Agency defaults
--     in app_settings; per-advisor overrides in advisor_goals.

CREATE TABLE IF NOT EXISTS asistente_real_state.advisor_goals (
  agent_id        UUID PRIMARY KEY REFERENCES asistente_real_state.users(id) ON DELETE CASCADE,
  captaciones_mes INT,
  ventas_mes      INT,
  alquileres_mes  INT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES asistente_real_state.users(id)
);

ALTER TABLE asistente_real_state.advisor_goals ENABLE ROW LEVEL SECURITY;

-- Edge Functions use service role (bypass RLS). Dashboard: admins manage; an
-- advisor reads their own goal. (M4 extends write to the martillero role N3.)
DROP POLICY IF EXISTS advisor_goals_read ON asistente_real_state.advisor_goals;
CREATE POLICY advisor_goals_read ON asistente_real_state.advisor_goals
  FOR SELECT TO authenticated
  USING (asistente_real_state.is_admin()
         OR agent_id = (SELECT u.id FROM asistente_real_state.users u WHERE u.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS advisor_goals_write ON asistente_real_state.advisor_goals;
CREATE POLICY advisor_goals_write ON asistente_real_state.advisor_goals
  FOR ALL TO authenticated
  USING (asistente_real_state.is_admin()) WITH CHECK (asistente_real_state.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON asistente_real_state.advisor_goals TO authenticated;

-- Agency-wide default monthly goals (configurable by admin/martillero).
INSERT INTO asistente_real_state.app_settings (key, value) VALUES
  ('goal_captaciones_mes', '3'),
  ('goal_ventas_mes', '1'),
  ('goal_alquileres_mes', '2')
ON CONFLICT (key) DO NOTHING;
