-- 08_align_users_id_to_auth_uid.sql
-- TD-007: align users.id with auth_user_id so the agent-scoping RLS policies
-- (`<fk> = auth.uid()`) match.
--
-- ES: Las FKs de ownership (listing_agent_id, assigned_agent_id, agent_id, ...)
--     apuntan a users.id, pero las politicas RLS comparan contra auth.uid()
--     (= auth_user_id). Como users.id != auth_user_id, un agente no veria sus
--     propios datos. Realineamos la PK a la uid de Supabase Auth, repuntamos las
--     filas que la referencian, y un trigger BEFORE INSERT mantiene la invariante
--     id = auth_user_id para filas futuras. is_admin() (07) ya usa auth_user_id.
-- EN: Ownership FKs (listing_agent_id, assigned_agent_id, agent_id, ...) reference
--     users.id, but RLS policies compare against auth.uid() (= auth_user_id).
--     Since users.id != auth_user_id, an agent would not see their own data. We
--     realign the PK to the Supabase Auth uid, repoint referencing rows, and a
--     BEFORE INSERT trigger keeps the invariant id = auth_user_id for future rows.
--     is_admin() (07) already matches on auth_user_id.

-- 1) Drop FKs that have referencing rows (only whatsapp_numbers.agent_id today)
ALTER TABLE asistente_real_state.whatsapp_numbers
  DROP CONSTRAINT IF EXISTS whatsapp_numbers_agent_id_fkey;

-- 2) Repoint child rows to the future PK value while users.id is still old
UPDATE asistente_real_state.whatsapp_numbers wn
  SET agent_id = u.auth_user_id
  FROM asistente_real_state.users u
  WHERE wn.agent_id = u.id AND u.auth_user_id IS NOT NULL AND u.id <> u.auth_user_id;

UPDATE asistente_real_state.whatsapp_numbers wn
  SET enabled_by = u.auth_user_id
  FROM asistente_real_state.users u
  WHERE wn.enabled_by = u.id AND u.auth_user_id IS NOT NULL AND u.id <> u.auth_user_id;

-- 3) Realign the parent PK
UPDATE asistente_real_state.users
  SET id = auth_user_id
  WHERE auth_user_id IS NOT NULL AND id <> auth_user_id;

-- 4) Restore the FK exactly as before (ON DELETE CASCADE)
ALTER TABLE asistente_real_state.whatsapp_numbers
  ADD CONSTRAINT whatsapp_numbers_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES asistente_real_state.users(id) ON DELETE CASCADE;

-- 5) Enforce id = auth_user_id for every future insert
CREATE OR REPLACE FUNCTION asistente_real_state.enforce_user_id_equals_auth()
RETURNS trigger AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL THEN
    NEW.id := NEW.auth_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_id_equals_auth ON asistente_real_state.users;
CREATE TRIGGER trg_user_id_equals_auth
  BEFORE INSERT ON asistente_real_state.users
  FOR EACH ROW EXECUTE FUNCTION asistente_real_state.enforce_user_id_equals_auth();
