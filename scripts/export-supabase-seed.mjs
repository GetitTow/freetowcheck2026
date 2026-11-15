#!/usr/bin/env node
/**
 * TowingSpecs — Supabase Seed Exporter
 * Exports the verified seed dataset from src/lib/seed-data.ts
 * to supabase/seed/0002_seed_data.sql and scripts/seed-data.json.
 */

import fs from 'fs';
import path from 'path';
import {
  SEED_MAKES,
  SEED_MODELS,
  SEED_MODEL_YEARS,
  SEED_TRIMS,
  SEED_CONFIGS,
  SEED_SPECS,
  SEED_SOURCES,
  SEED_SPEC_SOURCE_LINKS,
} from '../src/lib/seed-data.ts';

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

console.log('Exporting verified seed dataset to SQL and JSON...');

// 1. JSON Export
const jsonBundle = {
  sources: SEED_SOURCES,
  makes: SEED_MAKES,
  models: SEED_MODELS,
  model_years: SEED_MODEL_YEARS,
  trims: SEED_TRIMS,
  vehicle_configurations: SEED_CONFIGS,
  towing_specs: SEED_SPECS,
  spec_source_links: SEED_SPEC_SOURCE_LINKS,
};

fs.writeFileSync(
  path.resolve('scripts/seed-data.json'),
  JSON.stringify(jsonBundle, null, 2),
  'utf-8'
);
console.log('✓ Wrote scripts/seed-data.json');

// 2. SQL Export
let sql = `-- TowingSpecs — Production Seed Data
-- Version: 0002 Expanded (Includes 2013, 2024, 2025 verified manufacturer records)
-- Toyota models certified under SAE J2807 standard testing

`;

// Sources
sql += `-- ─── Data Sources ─────────────────────────────────────────────────────────────\n`;
sql += `INSERT INTO data_sources (id, source_type, source_url, document_title, publisher, publication_year, page_number, section, verification_status, verification_date, verified_by, notes)\nVALUES\n`;
sql += SEED_SOURCES.map(s => `  (${esc(s.id)}, ${esc(s.source_type)}, ${esc(s.source_url)}, ${esc(s.document_title)}, ${esc(s.publisher)}, ${esc(s.publication_year)}, ${esc(s.page_number)}, ${esc(s.section)}, ${esc(s.verification_status)}, ${esc(s.verification_date)}, ${esc(s.verified_by)}, ${esc(s.notes)})`).join(',\n') + '\nON CONFLICT (id) DO UPDATE SET verification_status = EXCLUDED.verification_status, updated_at = NOW();\n\n';

// Makes
sql += `-- ─── Makes ────────────────────────────────────────────────────────────────────\n`;
sql += `INSERT INTO makes (id, slug, name, country_of_origin)\nVALUES\n`;
sql += SEED_MAKES.map(m => `  (${esc(m.id)}, ${esc(m.slug)}, ${esc(m.name)}, ${esc(m.country_of_origin)})`).join(',\n') + '\nON CONFLICT (slug) DO NOTHING;\n\n';

// Models
sql += `-- ─── Models ───────────────────────────────────────────────────────────────────\n`;
sql += `INSERT INTO models (id, make_id, slug, name, body_style)\nVALUES\n`;
sql += SEED_MODELS.map(m => `  (${esc(m.id)}, ${esc(m.make_id)}, ${esc(m.slug)}, ${esc(m.name)}, ${esc(m.body_style)})`).join(',\n') + '\nON CONFLICT (make_id, slug) DO NOTHING;\n\n';

// Model Years
sql += `-- ─── Model Years ─────────────────────────────────────────────────────────────\n`;
sql += `INSERT INTO model_years (id, model_id, year, is_published)\nVALUES\n`;
sql += SEED_MODEL_YEARS.map(my => `  (${esc(my.id)}, ${esc(my.model_id)}, ${esc(my.year)}, ${esc(my.is_published)})`).join(',\n') + '\nON CONFLICT (model_id, year) DO NOTHING;\n\n';

// Trims
sql += `-- ─── Trims ───────────────────────────────────────────────────────────────────\n`;
sql += `INSERT INTO trims (id, model_year_id, name, slug, msrp_usd)\nVALUES\n`;
sql += SEED_TRIMS.map(t => `  (${esc(t.id)}, ${esc(t.model_year_id)}, ${esc(t.name)}, ${esc(t.slug)}, ${esc(t.msrp_usd)})`).join(',\n') + '\nON CONFLICT (model_year_id, slug) DO NOTHING;\n\n';

// Configurations
sql += `-- ─── Vehicle Configurations ───────────────────────────────────────────────────\n`;
sql += `INSERT INTO vehicle_configurations (id, trim_id, engine_description, transmission, drivetrain, cab_style, bed_length, axle_ratio, has_tow_package, configuration_notes)\nVALUES\n`;
sql += SEED_CONFIGS.map(c => `  (${esc(c.id)}, ${esc(c.trim_id)}, ${esc(c.engine_description)}, ${esc(c.transmission)}, ${esc(c.drivetrain)}, ${esc(c.cab_style)}, ${esc(c.bed_length)}, ${esc(c.axle_ratio)}, ${esc(c.has_tow_package)}, ${esc(c.configuration_notes)})`).join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n\n';

// Towing Specs
sql += `-- ─── Towing Specs ─────────────────────────────────────────────────────────────\n`;
sql += `INSERT INTO towing_specs (id, configuration_id, max_towing_capacity_lbs, max_tongue_weight_lbs, max_payload_lbs, gcwr_lbs, gvwr_lbs, curb_weight_lbs, hitch_class, max_trailer_height_in, fifth_wheel_capacity_lbs, gooseneck_capacity_lbs, equipment_notes, applies_when)\nVALUES\n`;
sql += SEED_SPECS.map(s => `  (${esc(s.id)}, ${esc(s.configuration_id)}, ${esc(s.max_towing_capacity_lbs)}, ${esc(s.max_tongue_weight_lbs)}, ${esc(s.max_payload_lbs)}, ${esc(s.gcwr_lbs)}, ${esc(s.gvwr_lbs)}, ${esc(s.curb_weight_lbs)}, ${esc(s.hitch_class)}, ${esc(s.max_trailer_height_in)}, ${esc(s.fifth_wheel_capacity_lbs)}, ${esc(s.gooseneck_capacity_lbs)}, ${esc(s.equipment_notes)}, ${esc(s.applies_when)})`).join(',\n') + '\nON CONFLICT (configuration_id) DO NOTHING;\n\n';

// Spec Source Links
sql += `-- ─── Spec Source Links ─────────────────────────────────────────────────────\n`;
sql += `INSERT INTO spec_source_links (spec_id, source_id)\nVALUES\n`;
sql += SEED_SPEC_SOURCE_LINKS.map(l => `  (${esc(l.spec_id)}, ${esc(l.source_id)})`).join(',\n') + '\nON CONFLICT (spec_id, source_id) DO NOTHING;\n';

fs.writeFileSync(
  path.resolve('supabase/seed/0002_seed_data.sql'),
  sql,
  'utf-8'
);
console.log('✓ Wrote supabase/seed/0002_seed_data.sql');
console.log('Seed export complete.');
