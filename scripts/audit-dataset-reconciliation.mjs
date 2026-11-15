import fs from 'node:fs';
import {
  SEED_MAKES,
  SEED_MODELS,
  SEED_MODEL_YEARS,
  SEED_TRIMS,
  SEED_CONFIGS,
  SEED_SPECS,
  SEED_SOURCES,
  SEED_SPEC_SOURCE_LINKS
} from '../src/lib/seed-data.ts';

const json = JSON.parse(fs.readFileSync('scripts/seed-data.json', 'utf8'));
const sql = fs.readFileSync('supabase/seed/0002_seed_data.sql', 'utf8');

console.log('=== DATASET RECONCILIATION AUDIT ===\n');

// 1. Entities counts
console.log('--- 1. Record Counts Across Fallback, JSON, and SQL ---');

function parseSqlTableIds(tableName) {
  // Finds the INSERT INTO tableName ... VALUES (...) block
  const pattern = new RegExp(`INSERT INTO\\s+${tableName}\\s*\\([^)]+\\)\\s*VALUES\\s*([\\s\\S]*?)(?:ON CONFLICT|;\\s*--)`, 'i');
  const match = sql.match(pattern);
  if (!match) return [];
  const body = match[1];
  const ids = [];
  // Match lines starting with ('id'
  const rowPattern = /\(\s*'([^']+)'/g;
  let m;
  while ((m = rowPattern.exec(body)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

const sqlSources = parseSqlTableIds('data_sources');
const sqlMakes = parseSqlTableIds('makes');
const sqlModels = parseSqlTableIds('models');
const sqlModelYears = parseSqlTableIds('model_years');
const sqlTrims = parseSqlTableIds('trims');
const sqlConfigs = parseSqlTableIds('vehicle_configurations');
const sqlSpecs = parseSqlTableIds('towing_specs');

const statsTable = [
  { Entity: 'Sources', TS: SEED_SOURCES.length, JSON: json.sources.length, SQL: sqlSources.length },
  { Entity: 'Makes', TS: SEED_MAKES.length, JSON: json.makes.length, SQL: sqlMakes.length },
  { Entity: 'Models', TS: SEED_MODELS.length, JSON: json.models.length, SQL: sqlModels.length },
  { Entity: 'Model Years', TS: SEED_MODEL_YEARS.length, JSON: json.model_years.length, SQL: sqlModelYears.length },
  { Entity: 'Trims', TS: SEED_TRIMS.length, JSON: json.trims.length, SQL: sqlTrims.length },
  { Entity: 'Configurations', TS: SEED_CONFIGS.length, JSON: json.vehicle_configurations.length, SQL: sqlConfigs.length },
  { Entity: 'Towing Specs', TS: SEED_SPECS.length, JSON: json.towing_specs.length, SQL: sqlSpecs.length },
  { Entity: 'Spec Source Links', TS: SEED_SPEC_SOURCE_LINKS.length, JSON: json.spec_source_links.length, SQL: parseSqlTableIds('spec_source_links').length },
];

console.table(statsTable);

// 2. ID Comparisons
function compareIds(name, tsList, jsonList, sqlList) {
  const tsSet = new Set(tsList);
  const jsonSet = new Set(jsonList);
  const sqlSet = new Set(sqlList);

  const missingInJson = [...tsSet].filter(x => !jsonSet.has(x));
  const missingInSql = [...tsSet].filter(x => !sqlSet.has(x));
  const extraInSql = [...sqlSet].filter(x => !tsSet.has(x));

  if (missingInJson.length || missingInSql.length || extraInSql.length) {
    console.error(`Discrepancy in ${name}:`);
    if (missingInJson.length) console.error(`  Missing in JSON:`, missingInJson);
    if (missingInSql.length) console.error(`  Missing in SQL:`, missingInSql);
    if (extraInSql.length) console.error(`  Extra in SQL:`, extraInSql);
    return false;
  }
  return true;
}

console.log('\n--- 2. ID Alignment Verification ---');
const okConfigs = compareIds('Configurations', SEED_CONFIGS.map(c => c.id), json.vehicle_configurations.map(c => c.id), sqlConfigs);
const okSpecs = compareIds('Towing Specs', SEED_SPECS.map(s => s.id), json.towing_specs.map(s => s.id), sqlSpecs);
const okSources = compareIds('Sources', SEED_SOURCES.map(s => s.id), json.sources.map(s => s.id), sqlSources);

console.log('Configs align:', okConfigs);
console.log('Specs align:', okSpecs);
console.log('Sources align:', okSources);

// 3. Status Check for Sources and Specs
console.log('\n--- 3. Verification Status Consistency ---');
// In SQL, let's extract source ID and verification_status
const sqlSourceStatusPattern = /\(\s*'([^']+)'\s*,\s*'[^']+'\s*,\s*'[^']+'\s*,\s*'[^']+'\s*,\s*'[^']+'\s*,\s*\d+\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'([^']+)'/g;
const sqlSourceStatuses = new Map();
let sm;
while ((sm = sqlSourceStatusPattern.exec(sql)) !== null) {
  sqlSourceStatuses.set(sm[1], sm[2]);
}

const tsSourceMap = new Map(SEED_SOURCES.map(s => [s.id, s.verification_status]));
const jsonSourceMap = new Map(json.sources.map(s => [s.id, s.verification_status]));

let statusMismatches = 0;
for (const [id, tsStatus] of tsSourceMap.entries()) {
  const jsonStatus = jsonSourceMap.get(id);
  // Find in SQL directly by regex
  const rowRegex = new RegExp(`\\('${id}',[\\s\\S]*?\\)(?:,|;)`);
  const match = sql.match(rowRegex);
  let sqlStatus = 'not_found';
  if (match) {
    const statusMatch = match[0].match(/'(manufacturer_verified|partially_verified|source_unavailable|pending_verification|conflicting_sources)'/);
    if (statusMatch) sqlStatus = statusMatch[1];
  }

  if (tsStatus !== jsonStatus || tsStatus !== sqlStatus) {
    console.log(`Mismatch on ${id}: TS="${tsStatus}", JSON="${jsonStatus}", SQL="${sqlStatus}"`);
    statusMismatches++;
  }
}
console.log(`Total source status mismatches: ${statusMismatches}`);

// 4. Verification Status Distribution
console.log('\n--- 4. Verification Status Counts by Source ---');
const statusCounts = {};
for (const src of SEED_SOURCES) {
  statusCounts[src.verification_status] = (statusCounts[src.verification_status] || 0) + 1;
}
console.table(statusCounts);

// 5. Configuration Status Distribution (computed from source links)
console.log('\n--- 5. Vehicle Configuration Counts by Effective Verification Status ---');
// Map each config to its spec and source
const specToSourceMap = new Map(SEED_SPEC_SOURCE_LINKS.map(l => [l.spec_id, l.source_id]));
const configStatusCounts = {};
for (const cfg of SEED_CONFIGS) {
  // Find spec
  const spec = SEED_SPECS.find(s => s.configuration_id === cfg.id);
  if (!spec) {
    configStatusCounts['no_spec'] = (configStatusCounts['no_spec'] || 0) + 1;
    continue;
  }
  const sourceId = specToSourceMap.get(spec.id);
  const source = SEED_SOURCES.find(s => s.id === sourceId);
  const status = source ? source.verification_status : 'unlinked';
  configStatusCounts[status] = (configStatusCounts[status] || 0) + 1;
}
console.table(configStatusCounts);

// 6. Published Model Years
console.log('\n--- 6. Published Model Years & Vehicles ---');
const publishedYears = [...new Set(SEED_MODEL_YEARS.filter(my => my.is_published).map(my => my.year))].sort((a,b) => b - a);
console.log('Published Years:', publishedYears);
const publishedConfigsByYear = {};
for (const yr of publishedYears) {
  const myIds = new Set(SEED_MODEL_YEARS.filter(my => my.year === yr && my.is_published).map(my => my.id));
  const trimIds = new Set(SEED_TRIMS.filter(t => myIds.has(t.model_year_id)).map(t => t.id));
  const configs = SEED_CONFIGS.filter(c => trimIds.has(c.trim_id));
  publishedConfigsByYear[yr] = configs.length;
}
console.table(publishedConfigsByYear);
