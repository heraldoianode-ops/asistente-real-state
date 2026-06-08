-- ============================================================
-- Migration 03: Multi-tenant schema
-- Nodo 7.1 — Multi-tenant + Supabase
-- ============================================================

-- Add listing_agent_id and conversation_summary to properties
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS listing_agent_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS conversation_summary TEXT,
  ADD COLUMN IF NOT EXISTS owner_visible_name VARCHAR(200);

CREATE INDEX IF NOT EXISTS ix_properties_listing_agent ON properties(listing_agent_id);

-- Property owner contact (private: only listing agent or admin)
CREATE TABLE IF NOT EXISTS property_owner_contacts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    listing_agent_id UUID NOT NULL REFERENCES users(id),
    owner_name   VARCHAR(200),
    phone        VARCHAR(30),
    email        VARCHAR(200),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_poc_property    ON property_owner_contacts(property_id);
CREATE INDEX IF NOT EXISTS ix_poc_agent       ON property_owner_contacts(listing_agent_id);

-- WhatsApp numbers — managed by admin, one per agent
CREATE TABLE IF NOT EXISTS whatsapp_numbers (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number     VARCHAR(30)  NOT NULL UNIQUE,
    phone_number_id  VARCHAR(100) NOT NULL,  -- Meta API phone_number_id
    display_name     VARCHAR(100),
    is_active        BOOLEAN NOT NULL DEFAULT FALSE,
    enabled_by       UUID REFERENCES users(id),
    enabled_at       TIMESTAMPTZ,
    disabled_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_wa_agent ON whatsapp_numbers(agent_id);

-- Cross-agent match log
CREATE TABLE IF NOT EXISTS cross_agent_matches (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id       UUID NOT NULL REFERENCES properties(id),
    listing_agent_id  UUID NOT NULL REFERENCES users(id),
    buyer_client_id   UUID NOT NULL REFERENCES clients(id),
    buyer_agent_id    UUID NOT NULL REFERENCES users(id),
    match_score       NUMERIC(5,4),
    match_explanation TEXT,
    buyer_client_name VARCHAR(200),  -- denormalized: shown to listing agent only
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | contacted | closed
    notified_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_matches_property      ON cross_agent_matches(property_id);
CREATE INDEX IF NOT EXISTS ix_matches_listing_agent ON cross_agent_matches(listing_agent_id);
CREATE INDEX IF NOT EXISTS ix_matches_buyer_agent   ON cross_agent_matches(buyer_agent_id);

-- Add client_type to clients (buyer | seller | both)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) NOT NULL DEFAULT 'buyer';

-- Add updated_at triggers for new tables
DO $$ DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'property_owner_contacts',
        'whatsapp_numbers',
        'cross_agent_matches'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at ON %I;
             CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            t, t
        );
    END LOOP;
END $$;
