-- 07: theme colors (interface color selection)
-- ES: Claves de color de la interfaz, elegidas por el admin desde el panel de Marca.
-- EN: Interface color keys, chosen by the admin from the Branding panel.

INSERT INTO asistente_real_state.app_settings (key, value) VALUES
  ('theme_primary', NULL),
  ('theme_accent', NULL)
ON CONFLICT (key) DO NOTHING;
