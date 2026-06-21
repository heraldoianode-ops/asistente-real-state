-- 11: matching rules & scoring fields (M2, D022)
-- ES: Campos para reglas obligatorias y scoring del match comprador↔oferta:
--     target_sqm/desired_amenities (búsqueda), allow_adjacent_zones (zonas
--     limítrofes), accepts_permuta (cliente ofrece permuta) y accepts_permuta
--     en properties (oferta habilitada para permuta).
-- EN: Fields for mandatory filters and buyer↔offer match scoring.

ALTER TABLE asistente_real_state.clients
  ADD COLUMN IF NOT EXISTS target_sqm NUMERIC,
  ADD COLUMN IF NOT EXISTS desired_amenities TEXT[],
  ADD COLUMN IF NOT EXISTS allow_adjacent_zones BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accepts_permuta BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE asistente_real_state.properties
  ADD COLUMN IF NOT EXISTS accepts_permuta BOOLEAN NOT NULL DEFAULT FALSE;
