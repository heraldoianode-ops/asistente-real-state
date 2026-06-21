-- 16: deal lifecycle / operations (M3/F136, D025)
-- ES: Ciclo de vida de una operación (cliente↔propiedad) hasta el cierre.
--     Cierre: VENTA = reserva confirmada Y aceptada; ALQUILER = reserva confirmada.
--     El bot consulta post-visita y pide confirmaciones de reserva/aceptación.
-- EN: Deal lifecycle to closing. VENTA closes on reserved+accepted; ALQUILER on
--     reserved. The bot follows up post-visit and confirms reservation/acceptance.

CREATE TABLE IF NOT EXISTS asistente_real_state.operations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES asistente_real_state.clients(id) ON DELETE SET NULL,
  property_id     UUID REFERENCES asistente_real_state.properties(id) ON DELETE SET NULL,
  agent_id        UUID REFERENCES asistente_real_state.users(id),
  operation_type  TEXT,  -- venta | alquiler (from property)
  stage           TEXT NOT NULL DEFAULT 'visita' CHECK (stage IN (
                    'visita','post_visita','sigue','descartado',
                    'reunion_reserva','reserva_confirmada','reserva_aceptada','caido')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost')),
  reserved_at     TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  followup_sent_at TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, property_id)
);
CREATE INDEX IF NOT EXISTS operations_status_idx ON asistente_real_state.operations (status, closed_at DESC);
CREATE INDEX IF NOT EXISTS operations_stage_idx  ON asistente_real_state.operations (stage);
CREATE INDEX IF NOT EXISTS operations_agent_idx  ON asistente_real_state.operations (agent_id);

ALTER TABLE asistente_real_state.operations ENABLE ROW LEVEL SECURITY;

-- Edge Functions use service role (bypass RLS). Dashboard: admins all; the
-- handling agent (or the property's listing agent) reads their operations.
DROP POLICY IF EXISTS operations_read ON asistente_real_state.operations;
CREATE POLICY operations_read ON asistente_real_state.operations
  FOR SELECT TO authenticated
  USING (
    asistente_real_state.is_admin()
    OR agent_id = (SELECT u.id FROM asistente_real_state.users u WHERE u.auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM asistente_real_state.properties p
               JOIN asistente_real_state.users u ON u.id = p.listing_agent_id
               WHERE u.auth_user_id = auth.uid() AND p.id = operations.property_id)
  );

GRANT SELECT ON asistente_real_state.operations TO authenticated;
