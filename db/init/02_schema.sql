-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(200) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    hashed_password VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'agent',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    wa_contact_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(300),
    address VARCHAR(300) NOT NULL,
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    property_type VARCHAR(30) NOT NULL,
    operation_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    price NUMERIC(14,2) NOT NULL,
    currency VARCHAR(5) NOT NULL DEFAULT 'USD',
    sqm_total NUMERIC(10,2),
    sqm_covered NUMERIC(10,2),
    bedrooms INTEGER,
    bathrooms INTEGER,
    parking INTEGER,
    floor INTEGER,
    amenities TEXT[],
    description TEXT,
    source_url VARCHAR(500),
    source_id VARCHAR(100),
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_properties_embedding ON properties
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(200),
    wa_contact_id VARCHAR(50),
    lead_stage VARCHAR(30) NOT NULL DEFAULT 'new',
    budget NUMERIC(14,2),
    currency VARCHAR(5) DEFAULT 'USD',
    preferred_operation VARCHAR(20),
    preferred_property_type VARCHAR(50),
    preferred_neighborhoods TEXT[],
    min_bedrooms INTEGER,
    notes TEXT,
    assigned_agent_id UUID REFERENCES users(id),
    preference_embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_clients_wa_contact_id ON clients (wa_contact_id);

-- Interactions
CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES users(id),
    interaction_type VARCHAR(30) NOT NULL,
    content TEXT,
    direction VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_interactions_client_id ON interactions (client_id);

-- Events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES users(id),
    property_id UUID REFERENCES properties(id),
    event_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
    scheduled_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_events_client_id ON events (client_id);
CREATE INDEX IF NOT EXISTS ix_events_agent_id ON events (agent_id);

-- RAG Documents
CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(300),
    source VARCHAR(200),
    chunk_index INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_rag_documents_embedding ON rag_documents
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Feedback (objections)
CREATE TABLE IF NOT EXISTS objection_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target VARCHAR(40) NOT NULL,
    target_id UUID,
    sentiment VARCHAR(20) NOT NULL,
    comment TEXT,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scraping sources
CREATE TABLE IF NOT EXISTS scraping_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    source_type VARCHAR(30) NOT NULL,
    url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID,
    action VARCHAR(10) NOT NULL,
    changed_by UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    diff JSONB
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['users','properties','clients','interactions','events','rag_documents','objection_feedback','scraping_sources']
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            t, t
        );
    END LOOP;
END $$;
