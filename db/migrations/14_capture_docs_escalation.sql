-- 14: capture-docs escalation flow (M2/F123 corrected)
-- ES: El bot pide la doc PRIMERO al asesor. Si tras 3 pedidos no la entrega,
--     avisa al martillero y le pregunta si quiere que el bot la pida. Si autoriza,
--     el bot la solicita; si aún no se recibe, avisa al martillero para que tome
--     medidas. Estados: asesor -> await_martillero -> bot -> measures -> done.
-- EN: Bot asks the ADVISOR first; after 3 failed asks it escalates to the
--     martillero for permission, then (if authorized) requests directly, then
--     escalates to "take measures".

ALTER TABLE asistente_real_state.capture_documents
  ADD COLUMN IF NOT EXISTS escalation_stage TEXT NOT NULL DEFAULT 'asesor'
    CHECK (escalation_stage IN ('asesor','await_martillero','bot','measures','done')),
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS martillero_authorized BOOLEAN NOT NULL DEFAULT FALSE;
