-- 08: conversational channel settings (M1/F110)
-- ES: Números de derivación para contextos que no maneja el bot directamente.
--     wa_martillera -> Trámites varios; wa_alquileres -> Inquilinos/Arrendatarios.
-- EN: Derivation numbers for contexts the bot does not handle directly.
--     wa_martillera -> misc paperwork; wa_alquileres -> tenants/renters.

INSERT INTO asistente_real_state.app_settings (key, value) VALUES
  ('wa_martillera', NULL),
  ('wa_alquileres', NULL)
ON CONFLICT (key) DO NOTHING;
