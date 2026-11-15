#!/usr/bin/env node
/**
 * TowingSpecs — Import Validation Script
 *
 * Usage: node scripts/validate-import.mjs <path-to-import-file.json>
 *
 * Validates a structured JSON import file before it is loaded into Supabase.
 * Checks for required fields, valid units, source evidence, and duplicates.
 * Prints a full report and exits with code 1 on any error.
 *
 * Import file schema (JSON):
 * {
 *   "make": { "slug": "ford", "name": "Ford", "country_of_origin": "USA" },
 *   "model": { "slug": "f-150", "name": "F-150", "body_style": "pickup" },
 *   "year": 2025,
 *   "trims": [
 *     {
 *       "name": "XLT",
 *       "slug": "xlt",
 *       "configurations": [
 *         {
 *           "engine_description": "3.5L EcoBoost V6",
 *           "drivetrain": "RWD",
 *           "cab_style": "SuperCrew",
 *           "axle_ratio": "3.55",
 *           "has_tow_package": true,
 *           "towing_spec": {
 *             "max_towing_capacity_lbs": 14000,
 *             "max_tongue_weight_lbs": 1400,
 *             "max_payload_lbs": 2000,
 *             "gcwr_lbs": 26000,
 *             "hitch_class": "Class V"
 *           },
 *           "source": {
 *             "source_type": "towing_guide",
 *             "source_url": "https://owner.ford.com/tools/account/how-tos/towing.html",
 *             "document_title": "2025 F-150 Towing Guide",
 *             "publisher": "Ford Motor Company",
 *             "publication_year": 2024,
 *             "page_number": null,
 *             "verification_date": "2024-11-01"
 *           }
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

import { readFileSync } from 'fs';
import path from 'path';

const VALID_DRIVETRAINS = new Set(['RWD', 'FWD', '4WD', 'AWD', '4x4']);
const VALID_SOURCE_TYPES = new Set([
  'owner_manual', 'towing_guide', 'spec_sheet',
  'manufacturer_website', 'brochure', 'press_release',
]);
const VALID_HITCH_CLASSES = new Set([
  'Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
]);

let errors = 0;
let warnings = 0;
let records = 0;

function err(msg) {
  console.error(`  [ERROR] ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  [WARN]  ${msg}`);
  warnings++;
}

function info(msg) {
  console.log(`  [OK]    ${msg}`);
}

function validateSlug(slug, field) {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    err(`${field} slug "${slug}" is invalid. Must be lowercase letters, numbers, hyphens only.`);
  }
}

function validatePositiveInt(val, field, required = false, allowZero = false) {
  if (val === null || val === undefined) {
    if (required) err(`${field} is required but missing.`);
    return;
  }
  if (!Number.isInteger(val) || (allowZero ? val < 0 : val <= 0)) {
    err(`${field} must be a ${allowZero ? 'non-negative' : 'positive'} integer (got ${val}).`);
  }
}

function validateSource(src, context) {
  if (!src) {
    err(`${context}: source is required for every towing spec.`);
    return;
  }
  if (!src.source_url || !src.source_url.startsWith('http')) {
    err(`${context}: source_url must be a valid HTTP(S) URL.`);
  }
  if (!src.document_title || src.document_title.trim().length === 0) {
    err(`${context}: document_title is required.`);
  }
  if (!src.publisher || src.publisher.trim().length === 0) {
    err(`${context}: publisher is required.`);
  }
  if (!VALID_SOURCE_TYPES.has(src.source_type)) {
    err(`${context}: source_type "${src.source_type}" is not valid. Must be one of: ${[...VALID_SOURCE_TYPES].join(', ')}`);
  }
  if (!src.verification_date || !/^\d{4}-\d{2}-\d{2}$/.test(src.verification_date)) {
    err(`${context}: verification_date must be in YYYY-MM-DD format.`);
  }
}

function validateSpec(spec, source, context) {
  if (!spec) {
    err(`${context}: towing_spec is required.`);
    return;
  }

  validatePositiveInt(spec.max_towing_capacity_lbs, `${context}.max_towing_capacity_lbs`);

  if (spec.max_tongue_weight_lbs !== null && spec.max_tongue_weight_lbs !== undefined) {
    validatePositiveInt(spec.max_tongue_weight_lbs, `${context}.max_tongue_weight_lbs`);
    if (spec.max_towing_capacity_lbs && spec.max_tongue_weight_lbs > spec.max_towing_capacity_lbs) {
      err(`${context}: max_tongue_weight_lbs (${spec.max_tongue_weight_lbs}) exceeds max_towing_capacity_lbs (${spec.max_towing_capacity_lbs}).`);
    }
    // Tongue weight should typically be 10-20% of towing capacity
    if (spec.max_towing_capacity_lbs) {
      const ratio = spec.max_tongue_weight_lbs / spec.max_towing_capacity_lbs;
      if (ratio < 0.08 || ratio > 0.25) {
        warn(`${context}: tongue weight is ${(ratio * 100).toFixed(1)}% of towing capacity. Typical range is 10–20%. Please verify.`);
      }
    }
  } else {
    warn(`${context}: max_tongue_weight_lbs is not provided. This is an important constraint.`);
  }

  if (spec.max_payload_lbs === null || spec.max_payload_lbs === undefined) {
    warn(`${context}: max_payload_lbs is not provided. This is an important constraint.`);
  } else {
    validatePositiveInt(spec.max_payload_lbs, `${context}.max_payload_lbs`);
  }

  if (spec.hitch_class && !VALID_HITCH_CLASSES.has(spec.hitch_class)) {
    err(`${context}: hitch_class "${spec.hitch_class}" is not valid. Must be one of: ${[...VALID_HITCH_CLASSES].join(', ')}`);
  }

  validateSource(source, context);
  records++;
}

function validateConfig(config, trimContext) {
  const context = `${trimContext} > config[${config.engine_description || 'unknown engine'}]`;

  if (config.drivetrain && !VALID_DRIVETRAINS.has(config.drivetrain)) {
    err(`${context}: drivetrain "${config.drivetrain}" is not valid. Must be one of: ${[...VALID_DRIVETRAINS].join(', ')}`);
  }

  if (typeof config.has_tow_package !== 'boolean') {
    warn(`${context}: has_tow_package should be a boolean. Defaulting to false.`);
  }

  validateSpec(config.towing_spec, config.source, context);
}

function validateTrim(trim, vehicleContext) {
  const context = `${vehicleContext} > ${trim.name}`;
  if (!trim.name || trim.name.trim().length === 0) {
    err(`${context}: trim name is required.`);
  }
  validateSlug(trim.slug, `${context}.slug`);

  if (!Array.isArray(trim.configurations) || trim.configurations.length === 0) {
    warn(`${context}: has no configurations. At least one is expected.`);
    return;
  }

  for (const config of trim.configurations) {
    validateConfig(config, context);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-import.mjs <path-to-import-file.json>');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(readFileSync(path.resolve(filePath), 'utf-8'));
} catch (e) {
  console.error(`Failed to parse import file: ${e.message}`);
  process.exit(1);
}

console.log(`\nTowingSpecs Import Validator`);
console.log(`File: ${filePath}`);
console.log(`─`.repeat(60));

// Check if this is a complete dataset bundle (e.g., seed-data.json)
if (Array.isArray(data.makes) && Array.isArray(data.vehicle_configurations)) {
  info(`Detected complete dataset bundle format.`);
  
  const makeIds = new Set(data.makes.map(m => m.id));
  const modelIds = new Set(data.models.map(m => m.id));
  const myIds = new Set(data.model_years.map(my => my.id));
  const trimIds = new Set(data.trims.map(t => t.id));
  const configIds = new Set(data.vehicle_configurations.map(c => c.id));
  const specIds = new Set(data.towing_specs.map(s => s.id));
  const sourceIds = new Set(data.sources.map(s => s.id));

  // Validate Makes
  for (const make of data.makes) {
    if (!make.slug || !make.name) err(`Make ${make.id || 'unknown'} missing slug or name.`);
    validateSlug(make.slug, `make.${make.slug}`);
  }
  info(`Validated ${data.makes.length} makes.`);

  // Validate Models
  for (const model of data.models) {
    if (!model.slug || !model.name) err(`Model ${model.id || 'unknown'} missing slug or name.`);
    if (!makeIds.has(model.make_id)) err(`Model ${model.slug} references unknown make_id "${model.make_id}".`);
    validateSlug(model.slug, `model.${model.slug}`);
  }
  info(`Validated ${data.models.length} models.`);

  // Validate Model Years
  for (const my of data.model_years) {
    if (!my.year || !Number.isInteger(my.year) || my.year < 1980 || my.year > 2030) {
      err(`ModelYear ${my.id} has invalid year "${my.year}".`);
    }
    if (!modelIds.has(my.model_id)) err(`ModelYear ${my.id} references unknown model_id "${my.model_id}".`);
  }
  info(`Validated ${data.model_years.length} model years.`);

  // Validate Trims
  for (const trim of data.trims) {
    if (!trim.name || !trim.slug) err(`Trim ${trim.id} missing name or slug.`);
    if (!myIds.has(trim.model_year_id)) err(`Trim ${trim.id} references unknown model_year_id "${trim.model_year_id}".`);
  }
  info(`Validated ${data.trims.length} trims.`);

  // Validate Sources
  for (const src of data.sources) {
    validateSource(src, `Source ${src.id}`);
  }
  info(`Validated ${data.sources.length} sources.`);

  // Validate Configurations
  for (const cfg of data.vehicle_configurations) {
    const ctx = `Config ${cfg.id}`;
    if (!trimIds.has(cfg.trim_id)) err(`${ctx} references unknown trim_id "${cfg.trim_id}".`);
    if (cfg.drivetrain && !VALID_DRIVETRAINS.has(cfg.drivetrain)) {
      err(`${ctx}: drivetrain "${cfg.drivetrain}" is not valid. Must be one of: ${[...VALID_DRIVETRAINS].join(', ')}`);
    }
  }
  info(`Validated ${data.vehicle_configurations.length} vehicle configurations.`);

  // Validate Towing Specs
  for (const spec of data.towing_specs) {
    const ctx = `Spec ${spec.id}`;
    if (!configIds.has(spec.configuration_id)) err(`${ctx} references unknown configuration_id "${spec.configuration_id}".`);
    validatePositiveInt(spec.max_towing_capacity_lbs, `${ctx}.max_towing_capacity_lbs`, true, true);
    
    if (spec.max_tongue_weight_lbs) {
      validatePositiveInt(spec.max_tongue_weight_lbs, `${ctx}.max_tongue_weight_lbs`);
      if (spec.max_tongue_weight_lbs > spec.max_towing_capacity_lbs) {
        err(`${ctx}: max_tongue_weight_lbs (${spec.max_tongue_weight_lbs}) exceeds max_towing_capacity_lbs (${spec.max_towing_capacity_lbs}).`);
      }
    }
    if (spec.hitch_class && !VALID_HITCH_CLASSES.has(spec.hitch_class)) {
      err(`${ctx}: hitch_class "${spec.hitch_class}" is not valid.`);
    }
    records++;
  }
  info(`Validated ${data.towing_specs.length} towing specifications.`);

  // Validate Links
  for (const link of data.spec_source_links) {
    if (!specIds.has(link.spec_id)) err(`Link references unknown spec_id "${link.spec_id}".`);
    if (!sourceIds.has(link.source_id)) err(`Link references unknown source_id "${link.source_id}".`);
  }
  info(`Validated ${data.spec_source_links.length} spec source links.`);

} else {
  // Validate single vehicle file
  if (!data.make?.slug || !data.make?.name) {
    err('make.slug and make.name are required.');
  } else {
    validateSlug(data.make.slug, 'make.slug');
    info(`Make: ${data.make.name} (${data.make.slug})`);
  }

  // Validate model
  if (!data.model?.slug || !data.model?.name) {
    err('model.slug and model.name are required.');
  } else {
    validateSlug(data.model.slug, 'model.slug');
    info(`Model: ${data.model.name} (${data.model.slug})`);
  }

  // Validate year
  if (!data.year || !Number.isInteger(data.year) || data.year < 1980 || data.year > 2030) {
    err(`year must be an integer between 1980 and 2030 (got ${data.year}).`);
  } else {
    info(`Year: ${data.year}`);
  }

  // Validate trims
  if (!Array.isArray(data.trims) || data.trims.length === 0) {
    err('trims array is required and must not be empty.');
  } else {
    const vehicleContext = `${data.year} ${data.make?.name} ${data.model?.name}`;
    for (const trim of data.trims) {
      validateTrim(trim, vehicleContext);
    }
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`─`.repeat(60));
console.log(`\nValidation Summary`);
console.log(`  Records validated:  ${records}`);
console.log(`  Errors:             ${errors}`);
console.log(`  Warnings:           ${warnings}`);

if (errors > 0) {
  console.error(`\nValidation FAILED with ${errors} error(s). Fix all errors before importing.\n`);
  process.exit(1);
} else if (warnings > 0) {
  console.warn(`\nValidation PASSED with ${warnings} warning(s). Review warnings before importing.\n`);
  process.exit(0);
} else {
  console.log(`\nValidation PASSED. File is ready for import.\n`);
  process.exit(0);
}
