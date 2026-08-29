CREATE TYPE data_origin_type AS ENUM ('official_reference', 'synthetic_demo', 'partner_reported');
CREATE TYPE blood_group_type AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
CREATE TYPE blood_component_type AS ENUM ('Whole Blood', 'Packed Red Cells', 'Fresh Frozen Plasma', 'Platelets', 'Cryoprecipitate');

CREATE TABLE blood_banks (
    id SERIAL PRIMARY KEY,
    bank_ref_code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    state VARCHAR(100),
    district VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    pincode VARCHAR(20),
    phone VARCHAR(100),
    helpline VARCHAR(100),
    email VARCHAR(255),
    website TEXT,
    category VARCHAR(100),
    blood_components_available VARCHAR(50),
    apheresis_available BOOLEAN,
    service_time VARCHAR(100),
    license_number VARCHAR(100),
    nodal_officer_name VARCHAR(255),
    nodal_officer_contact VARCHAR(100),
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    data_origin data_origin_type NOT NULL DEFAULT 'official_reference',
    is_demo_data BOOLEAN NOT NULL DEFAULT false,
    source_url TEXT,
    source_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_updates (
    id BIGSERIAL PRIMARY KEY,
    reference_id VARCHAR(100) UNIQUE,
    corrected_from_reference_id VARCHAR(100),
    is_superseded BOOLEAN NOT NULL DEFAULT false,
    bank_id INTEGER NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
    blood_group blood_group_type NOT NULL,
    component blood_component_type NOT NULL,
    units INTEGER NOT NULL CHECK (units >= 0),
    reported_by VARCHAR(100),
    source VARCHAR(50) DEFAULT 'web',
    data_origin data_origin_type NOT NULL DEFAULT 'partner_reported',
    is_demo_data BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_current (
    id SERIAL PRIMARY KEY,
    bank_id INTEGER NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
    blood_group blood_group_type NOT NULL,
    component blood_component_type NOT NULL,
    units INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bank_id, blood_group, component)
);

CREATE INDEX idx_blood_banks_city ON blood_banks(city);
CREATE INDEX idx_blood_banks_state ON blood_banks(state);
CREATE INDEX idx_blood_banks_district ON blood_banks(district);
CREATE INDEX idx_blood_banks_location ON blood_banks(latitude, longitude);
CREATE INDEX idx_stock_updates_bank_id ON stock_updates(bank_id);
CREATE INDEX idx_stock_updates_created_at ON stock_updates(created_at DESC);
CREATE INDEX idx_stock_current_bank_id ON stock_current(bank_id);
CREATE INDEX idx_stock_current_blood_group ON stock_current(blood_group);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_blood_banks_updated_at
BEFORE UPDATE ON blood_banks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
