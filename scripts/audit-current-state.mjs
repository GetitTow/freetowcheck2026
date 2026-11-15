#!/usr/bin/env node
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
  SEED_VEHICLE_SUMMARIES,
} from '../src/lib/seed-data.ts';
import { CATALOG_YEARS_SCOPE } from '../src/lib/catalog-years.ts';

console.log('=== TOWINGSPECS COMPREHENSIVE PRE-EDIT AUDIT ===\n');

// 1. Model Years breakdown
const publishedYearsMap = new Map();
for (const my of SEED_MODEL_YEARS) {
  if (!publishedYearsMap.has(my.year)) {
    publishedYearsMap.set(my.year, []);
  }
  publishedYearsMap.get(my.year).push(my);
}

const allScopeYears = CATALOG_YEARS_SCOPE.map(c => c.year);
const publishedYears = Array.from(publishedYearsMap.keys()).sort((a,b) => b - a);
const roadmapOnlyYears = allScopeYears.filter(y => !publishedYears.includes(y));

console.log('--- 1. Published Model Years vs Roadmap Only Years ---');
console.log(`Scope years (${allScopeYears.length}):`, allScopeYears.join(', '));
console.log(`Published years with data (${publishedYears.length}):`, publishedYears.join(', '));
console.log(`Roadmap-only years with 0 records (${roadmapOnlyYears.length}):`, roadmapOnlyYears.join(', '));

// 2. Year-by-year detail
console.log('\n--- 2. Year-by-Year Published Vehicle Configuration Breakdown ---');
for (const yr of publishedYears) {
  const myIds = SEED_MODEL_YEARS.filter(my => my.year === yr).map(my => my.id);
  const trims = SEED_TRIMS.filter(t => myIds.includes(t.model_year_id));
  const trimIds = trims.map(t => t.id);
  const configs = SEED_CONFIGS.filter(c => trimIds.includes(c.trim_id));
  
  // Model info
  const modelIdsInYear = SEED_MODEL_YEARS.filter(my => my.year === yr).map(my => my.model_id);
  const modelsInYear = SEED_MODELS.filter(m => modelIdsInYear.includes(m.id));
  const makeIdsInYear = [...new Set(modelsInYear.map(m => m.make_id))];
  const makesInYear = SEED_MAKES.filter(mk => makeIdsInYear.includes(mk.id));

  console.log(`\nModel Year ${yr}:`);
  console.log(`  Makes (${makesInYear.length}): ${makesInYear.map(m => m.name).join(', ')}`);
  console.log(`  Models (${modelsInYear.length}): ${modelsInYear.map(m => m.name).join(', ')}`);
  console.log(`  Trims (${trims.length}) | Configurations (${configs.length})`);
  
  // Config details
  for (const cfg of configs) {
    const tr = trims.find(t => t.id === cfg.trim_id);
    const my = SEED_MODEL_YEARS.find(m => m.id === tr.model_year_id);
    const mdl = SEED_MODELS.find(m => m.id === my.model_id);
    const mk = SEED_MAKES.find(m => m.id === mdl.make_id);
    const spc = SEED_SPECS.find(s => s.configuration_id === cfg.id);
    const link = SEED_SPEC_SOURCE_LINKS.find(l => l.spec_id === spc?.id);
    const src = SEED_SOURCES.find(s => s.id === link?.source_id);
    
    console.log(`    - [${mk.name} ${mdl.name} ${tr.name}] ${cfg.engine_description} | ${cfg.drivetrain} | ${cfg.cab_style || 'N/A'} | Tow Pkg: ${cfg.has_tow_package ? 'Yes' : 'No'} | Max Tow: ${spc?.max_towing_capacity_lbs ?? 'N/A'} lbs | Source: ${src?.document_title ?? 'NONE'} (${src?.verification_status ?? 'N/A'})`);
  }
}

// 3. Agreement between representations
console.log('\n--- 3. Consistency Across Datasets & Coverage Dashboard ---');
const rawJson = JSON.parse(fs.readFileSync('scripts/seed-data.json', 'utf-8'));
const rawSql = fs.readFileSync('supabase/seed/0002_seed_data.sql', 'utf-8');

function countSqlInserts(table) {
  const marker = `INSERT INTO ${table}`;
  const idx = rawSql.indexOf(marker);
  if (idx === -1) return 0;
  const endIdx = rawSql.indexOf(';\n', idx);
  const block = rawSql.substring(idx, endIdx);
  return (block.match(/\n\s+\(/g) || []).length;
}

const comparison = [
  { table: 'data_sources', ts: SEED_SOURCES.length, json: rawJson.sources.length, sql: countSqlInserts('data_sources') },
  { table: 'makes', ts: SEED_MAKES.length, json: rawJson.makes.length, sql: countSqlInserts('makes') },
  { table: 'models', ts: SEED_MODELS.length, json: rawJson.models.length, sql: countSqlInserts('models') },
  { table: 'model_years', ts: SEED_MODEL_YEARS.length, json: rawJson.model_years.length, sql: countSqlInserts('model_years') },
  { table: 'trims', ts: SEED_TRIMS.length, json: rawJson.trims.length, sql: countSqlInserts('trims') },
  { table: 'vehicle_configurations', ts: SEED_CONFIGS.length, json: rawJson.vehicle_configurations.length, sql: countSqlInserts('vehicle_configurations') },
  { table: 'towing_specs', ts: SEED_SPECS.length, json: rawJson.towing_specs.length, sql: countSqlInserts('towing_specs') },
  { table: 'spec_source_links', ts: SEED_SPEC_SOURCE_LINKS.length, json: rawJson.spec_source_links.length, sql: countSqlInserts('spec_source_links') },
];
console.table(comparison);
