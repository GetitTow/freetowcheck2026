import {
  SEED_CONFIGS,
  SEED_SPECS,
  SEED_SPEC_SOURCE_LINKS,
  SEED_SOURCES,
  SEED_TRIMS,
  SEED_MODEL_YEARS,
  SEED_MODELS,
  SEED_MAKES
} from '../src/lib/seed-data.ts';

const configs = SEED_CONFIGS;
const specs = SEED_SPECS;
const links = SEED_SPEC_SOURCE_LINKS;
const sources = SEED_SOURCES;
const trims = SEED_TRIMS;
const modelYears = SEED_MODEL_YEARS;
const models = SEED_MODELS;
const makes = SEED_MAKES;

console.log('Total Configurations:', configs.length);
console.log('Total Specs:', specs.length);

const report = configs.map((cfg, idx) => {
  const trim = trims.find(t => t.id === cfg.trim_id);
  const my = modelYears.find(y => y.id === trim?.model_year_id);
  const model = models.find(m => m.id === my?.model_id);
  const make = makes.find(m => m.id === model?.make_id);
  const spec = specs.find(s => s.configuration_id === cfg.id);
  const link = links.find(l => l.spec_id === spec?.id);
  const src = sources.find(s => s.id === link?.source_id);

  return {
    num: idx + 1,
    id: cfg.id,
    vehicle: `${my?.year} ${make?.name} ${model?.name} ${trim?.name}`,
    engine: cfg.engine_description,
    drivetrain: cfg.drivetrain,
    cab_bed: `${cfg.cab_style || 'N/A'} / ${cfg.bed_length || 'N/A'}`,
    axle: cfg.axle_ratio,
    tow_pkg: cfg.has_tow_package,
    tow_lbs: spec?.max_towing_capacity_lbs,
    tongue_lbs: spec?.max_tongue_weight_lbs,
    payload_lbs: spec?.max_payload_lbs,
    gcwr_lbs: spec?.gcwr_lbs,
    gvwr_lbs: spec?.gvwr_lbs,
    curb_lbs: spec?.curb_weight_lbs,
    hitch: spec?.hitch_class,
    src_title: src?.document_title,
    src_url: src?.source_url,
    src_page: src?.page_number,
    src_section: src?.section,
    src_status: src?.verification_status,
    verified_date: src?.verification_date,
    notes: spec?.equipment_notes
  };
});

import fs from 'fs';
fs.writeFileSync('scripts/all-specs.json', JSON.stringify(report, null, 2), 'utf8');
console.log('Saved 21 configs to scripts/all-specs.json');
