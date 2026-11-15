-- TowingSpecs — Initial Schema Migration
-- Version: 0001
-- Description: Core normalized schema for vehicle towing specifications
-- All measurements stored in lbs (US pounds) as canonical unit.

-- ─── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE verification_status AS ENUM (
  'manufacturer_verified',
  'partially_verified',
  'pending_verification',
  'conflicting_sources',
  'source_unavailable'
);

CREATE TYPE source_type AS ENUM (
  'owner_manual',
  'towing_guide',
  'spec_sheet',
  'manufacturer_website',
  'brochure',
  'press_release'
);

CREATE TYPE drivetrain AS ENUM (
  'RWD', 'FWD', '4WD', 'AWD', '4x4'
);

-- ─── Makes ───────────────────────────────────────────────────────────────────

CREATE TABLE makes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT NOT NULL UNIQUE,   -- 'ford', 'chevrolet', 'ram'
  name               TEXT NOT NULL,           -- 'Ford', 'Chevrolet', 'Ram'
  country_of_origin  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT makes_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_makes_slug ON makes (slug);

-- ─── Models ──────────────────────────────────────────────────────────────────

CREATE TABLE models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id     UUID NOT NULL REFERENCES makes(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,                 -- 'f-150', 'silverado-1500'
  name        TEXT NOT NULL,                 -- 'F-150', 'Silverado 1500'
  body_style  TEXT,                          -- 'pickup', 'suv', 'van', 'minivan', 'crossover'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (make_id, slug),
  CONSTRAINT models_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_models_make_id ON models (make_id);
CREATE INDEX idx_models_slug ON models (slug);
CREATE INDEX idx_models_body_style ON models (body_style);

-- ─── Model Years ─────────────────────────────────────────────────────────────

CREATE TABLE model_years (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id      UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  year          SMALLINT NOT NULL,
  is_published  BOOLEAN NOT NULL DEFAULT false,  -- only show if data is ready
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, year),
  CONSTRAINT model_years_year_range CHECK (year BETWEEN 1980 AND 2030)
);

CREATE INDEX idx_model_years_model_id ON model_years (model_id);
CREATE INDEX idx_model_years_year ON model_years (year);
CREATE INDEX idx_model_years_published ON model_years (is_published);

-- ─── Trims ───────────────────────────────────────────────────────────────────

CREATE TABLE trims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_year_id  UUID NOT NULL REFERENCES model_years(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,    -- 'XLT', 'Lariat', 'Platinum', 'Pro-4X'
  slug           TEXT NOT NULL,    -- 'xlt', 'lariat', 'platinum'
  msrp_usd       INTEGER,          -- base MSRP in USD cents (nullable)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_year_id, slug)
);

CREATE INDEX idx_trims_model_year_id ON trims (model_year_id);

-- ─── Vehicle Configurations ───────────────────────────────────────────────────

CREATE TABLE vehicle_configurations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trim_id               UUID NOT NULL REFERENCES trims(id) ON DELETE CASCADE,
  engine_description    TEXT,                  -- '3.5L EcoBoost V6 Twin Turbo'
  transmission          TEXT,                  -- '10-speed SelectShift automatic'
  drivetrain            drivetrain,
  cab_style             TEXT,                  -- 'Regular Cab', 'SuperCab', 'SuperCrew'
  bed_length            TEXT,                  -- '5.5 ft', '6.5 ft', '8 ft'
  axle_ratio            TEXT,                  -- '3.73', '4.10'
  has_tow_package       BOOLEAN NOT NULL DEFAULT false,
  configuration_notes   TEXT,                  -- important restrictions or requirements
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_configs_trim_id ON vehicle_configurations (trim_id);

-- ─── Towing Specs ─────────────────────────────────────────────────────────────

CREATE TABLE towing_specs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id          UUID NOT NULL REFERENCES vehicle_configurations(id) ON DELETE CASCADE,
  max_towing_capacity_lbs   INTEGER,             -- Maximum Conventional Towing Capacity
  max_tongue_weight_lbs     INTEGER,             -- Maximum Tongue Weight
  max_payload_lbs           INTEGER,             -- Maximum Payload (per door sticker or guide)
  gcwr_lbs                  INTEGER,             -- Gross Combined Weight Rating
  gvwr_lbs                  INTEGER,             -- Gross Vehicle Weight Rating
  curb_weight_lbs           INTEGER,             -- Base curb weight (config-specific)
  hitch_class               TEXT,                -- 'Class I' through 'Class V'
  max_trailer_height_in     SMALLINT,            -- Max trailer height in inches
  fifth_wheel_capacity_lbs  INTEGER,             -- Fifth-wheel towing, if applicable
  gooseneck_capacity_lbs    INTEGER,             -- Gooseneck towing, if applicable
  equipment_notes           TEXT,                -- 'Requires Tow Package', etc.
  applies_when              TEXT,                -- 'When equipped with 36-gallon fuel tank'
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One spec record per configuration (use multiple config rows for variants)
  UNIQUE (configuration_id),
  -- Basic sanity constraints on capacities
  CONSTRAINT towing_capacity_positive CHECK (max_towing_capacity_lbs IS NULL OR max_towing_capacity_lbs > 0),
  CONSTRAINT tongue_weight_positive   CHECK (max_tongue_weight_lbs IS NULL OR max_tongue_weight_lbs > 0),
  CONSTRAINT payload_positive         CHECK (max_payload_lbs IS NULL OR max_payload_lbs > 0),
  CONSTRAINT gcwr_positive            CHECK (gcwr_lbs IS NULL OR gcwr_lbs > 0),
  -- Tongue weight should not exceed towing capacity
  CONSTRAINT tongue_le_towing CHECK (
    max_tongue_weight_lbs IS NULL OR max_towing_capacity_lbs IS NULL OR
    max_tongue_weight_lbs <= max_towing_capacity_lbs
  )
);

CREATE INDEX idx_towing_specs_config_id ON towing_specs (configuration_id);

-- ─── Data Sources ─────────────────────────────────────────────────────────────

CREATE TABLE data_sources (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type           source_type NOT NULL,
  source_url            TEXT NOT NULL,
  document_title        TEXT NOT NULL,
  publisher             TEXT NOT NULL,           -- Vehicle manufacturer name
  publication_year      SMALLINT,
  page_number           TEXT,                    -- Could be 'A-12' or '47'
  section               TEXT,                    -- Chapter/section name
  verification_status   verification_status NOT NULL DEFAULT 'pending_verification',
  verification_date     DATE NOT NULL,
  verified_by           TEXT,                    -- Internal reviewer identifier
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT data_sources_url_not_empty CHECK (trim(source_url) != ''),
  CONSTRAINT data_sources_title_not_empty CHECK (trim(document_title) != '')
);

CREATE INDEX idx_data_sources_status ON data_sources (verification_status);
CREATE INDEX idx_data_sources_publisher ON data_sources (publisher);

-- ─── Spec ↔ Source Link ───────────────────────────────────────────────────────

CREATE TABLE spec_source_links (
  spec_id        UUID NOT NULL REFERENCES towing_specs(id) ON DELETE CASCADE,
  source_id      UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  covers_fields  TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {'max_towing_capacity_lbs', 'max_payload_lbs'}
  PRIMARY KEY (spec_id, source_id)
);

CREATE INDEX idx_spec_source_links_spec_id ON spec_source_links (spec_id);
CREATE INDEX idx_spec_source_links_source_id ON spec_source_links (source_id);

-- ─── Trailer Makes ────────────────────────────────────────────────────────────

CREATE TABLE trailer_makes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Trailer Models ───────────────────────────────────────────────────────────

CREATE TABLE trailer_models (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trailer_make_id   UUID NOT NULL REFERENCES trailer_makes(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,  -- 'travel_trailer', 'fifth_wheel', 'toy_hauler', 'utility', 'boat', 'horse'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trailer_make_id, slug)
);

-- ─── Trailer Specs ────────────────────────────────────────────────────────────

CREATE TABLE trailer_specs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trailer_model_id        UUID NOT NULL REFERENCES trailer_models(id) ON DELETE CASCADE,
  year                    SMALLINT,
  floorplan               TEXT,
  dry_weight_lbs          INTEGER,
  gvwr_lbs                INTEGER,
  tongue_weight_lbs       INTEGER,
  tongue_weight_percent   NUMERIC(5,2),   -- percentage if absolute not available
  hitch_type              TEXT,           -- 'conventional', 'fifth_wheel', 'gooseneck'
  source_id               UUID REFERENCES data_sources(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trailer_dry_weight_positive CHECK (dry_weight_lbs IS NULL OR dry_weight_lbs > 0),
  CONSTRAINT trailer_gvwr_ge_dry CHECK (
    gvwr_lbs IS NULL OR dry_weight_lbs IS NULL OR gvwr_lbs >= dry_weight_lbs
  )
);

-- ─── Convenience View: vehicle_summaries ─────────────────────────────────────
-- Used by the browse page and cascading selector API endpoints.

CREATE OR REPLACE VIEW vehicle_summaries AS
SELECT
  mk.slug                     AS make_slug,
  mk.name                     AS make_name,
  mo.slug                     AS model_slug,
  mo.name                     AS model_name,
  mo.body_style,
  my.year,
  my.id                       AS model_year_id,
  MAX(ts.max_towing_capacity_lbs) AS max_towing_lbs,
  BOOL_OR(
    ds.verification_status = 'manufacturer_verified'
  )                           AS has_verified_data
FROM makes mk
JOIN models mo          ON mo.make_id = mk.id
JOIN model_years my     ON my.model_id = mo.id AND my.is_published = true
JOIN trims tr           ON tr.model_year_id = my.id
JOIN vehicle_configurations vc ON vc.trim_id = tr.id
LEFT JOIN towing_specs ts    ON ts.configuration_id = vc.id
LEFT JOIN spec_source_links ssl ON ssl.spec_id = ts.id
LEFT JOIN data_sources ds    ON ds.id = ssl.source_id
GROUP BY mk.slug, mk.name, mo.slug, mo.name, mo.body_style, my.year, my.id
ORDER BY mk.name, mo.name, my.year DESC;

-- ─── Updated At Trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_makes_updated_at BEFORE UPDATE ON makes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_models_updated_at BEFORE UPDATE ON models FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_model_years_updated_at BEFORE UPDATE ON model_years FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_trims_updated_at BEFORE UPDATE ON trims FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_vehicle_configs_updated_at BEFORE UPDATE ON vehicle_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_towing_specs_updated_at BEFORE UPDATE ON towing_specs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_data_sources_updated_at BEFORE UPDATE ON data_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_trailer_specs_updated_at BEFORE UPDATE ON trailer_specs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE trims ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE towing_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE trailer_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trailer_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE trailer_specs ENABLE ROW LEVEL SECURITY;

-- Public read access on lookup tables (restricted to published models/trims/specs)
CREATE POLICY "Public read access on makes"              ON makes              FOR SELECT USING (true);
CREATE POLICY "Public read access on models"             ON models             FOR SELECT USING (true);
CREATE POLICY "Public read on published model_years"     ON model_years        FOR SELECT USING (is_published = true);
CREATE POLICY "Public read on published trims"          ON trims              FOR SELECT USING (
  EXISTS (SELECT 1 FROM model_years WHERE model_years.id = trims.model_year_id AND model_years.is_published = true)
);
CREATE POLICY "Public read on published configs"        ON vehicle_configurations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM trims 
    JOIN model_years ON model_years.id = trims.model_year_id 
    WHERE trims.id = vehicle_configurations.trim_id AND model_years.is_published = true
  )
);
CREATE POLICY "Public read on published towing_specs"   ON towing_specs       FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM vehicle_configurations vc
    JOIN trims t ON t.id = vc.trim_id
    JOIN model_years my ON my.id = t.model_year_id
    WHERE vc.id = towing_specs.configuration_id AND my.is_published = true
  )
);
CREATE POLICY "Public read on verified sources"          ON data_sources       FOR SELECT USING (
  verification_status != 'source_unavailable'
);
CREATE POLICY "Public read on spec_source_links"         ON spec_source_links  FOR SELECT USING (true);
CREATE POLICY "Public read access on trailer_makes"      ON trailer_makes      FOR SELECT USING (true);
CREATE POLICY "Public read access on trailer_models"     ON trailer_models     FOR SELECT USING (true);
CREATE POLICY "Public read access on trailer_specs"      ON trailer_specs      FOR SELECT USING (true);

-- Writes require service role (handled server-side via service key — never exposed to browser)
-- No INSERT/UPDATE/DELETE policies for anon role

COMMENT ON TABLE makes IS 'Vehicle manufacturers / brands';
COMMENT ON TABLE models IS 'Vehicle model lines, grouped by make';
COMMENT ON TABLE model_years IS 'A specific model year for a vehicle model, controls publication status';
COMMENT ON TABLE trims IS 'Trim levels within a model year (XLT, Lariat, etc.)';
COMMENT ON TABLE vehicle_configurations IS 'Specific drivetrain/cab/bed/equipment combinations within a trim';
COMMENT ON TABLE towing_specs IS 'Towing, payload, GCWR, and related specs per vehicle configuration';
COMMENT ON TABLE data_sources IS 'Source documents — manufacturer manuals, guides, brochures';
COMMENT ON TABLE spec_source_links IS 'Many-to-many: which specs are supported by which source documents';
