-- 12: compliance / non-compliance alarms (M2/F120)
-- ES: Alarmas de incumplimiento (visita vencida, confirmación pendiente, etc.)
--     dirigidas al martillero. Índice único parcial evita re-alertar lo mismo
--     mientras esté abierta; al resolverse puede volver a generarse.
-- EN: Non-compliance alarms routed to the auctioneer. Partial unique index
--     prevents duplicate OPEN alarms for the same item.

CREATE TABLE IF NOT EXISTS asistente_real_state.compliance_alarms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL,             -- visita_vencida | confirmacion_pendiente | ...
  ref_type    TEXT NOT NULL,             -- event | property | client
  ref_id      UUID,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS compliance_alarms_open_uniq
  ON asistente_real_state.compliance_alarms (kind, ref_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS compliance_alarms_status_idx
  ON asistente_real_state.compliance_alarms (status, created_at DESC);

ALTER TABLE asistente_real_state.compliance_alarms ENABLE ROW LEVEL SECURITY;

-- Edge Functions use service role (bypass RLS). Dashboard: admins read.
-- (M4 will extend read access to the martillero role N3.)
DROP POLICY IF EXISTS compliance_alarms_read ON asistente_real_state.compliance_alarms;
CREATE POLICY compliance_alarms_read ON asistente_real_state.compliance_alarms
  FOR SELECT TO authenticated USING (asistente_real_state.is_admin());

GRANT SELECT ON asistente_real_state.compliance_alarms TO authenticated;
