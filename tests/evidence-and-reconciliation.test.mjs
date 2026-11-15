import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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

import { CATALOG_YEARS_SCOPE, getPublishedScopeYears } from '../src/lib/catalog-years.ts';
import { calculateTrailerCompatibility } from '../src/lib/towing-calculations.ts';

const json = JSON.parse(fs.readFileSync('scripts/seed-data.json', 'utf8'));
const sql = fs.readFileSync('supabase/seed/0002_seed_data.sql', 'utf8');

// Helper to extract IDs from SQL
function parseSqlTableIds(tableName) {
  const pattern = new RegExp(`INSERT INTO\\s+${tableName}\\s*\\([^)]+\\)\\s*VALUES\\s*([\\s\\S]*?)(?:ON CONFLICT|;\\s*--)`, 'i');
  const match = sql.match(pattern);
  if (!match) return [];
  const body = match[1];
  const ids = [];
  const rowPattern = /\(\s*'([^']+)'/g;
  let m;
  while ((m = rowPattern.exec(body)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

// ─── 1. Reconcile fallback, JSON, and SQL records ──────────────────────────────
test('Dataset Reconciliation: Fallback, JSON, and SQL datasets have identical entity counts', () => {
  const sqlSources = parseSqlTableIds('data_sources');
  const sqlMakes = parseSqlTableIds('makes');
  const sqlModels = parseSqlTableIds('models');
  const sqlModelYears = parseSqlTableIds('model_years');
  const sqlTrims = parseSqlTableIds('trims');
  const sqlConfigs = parseSqlTableIds('vehicle_configurations');
  const sqlSpecs = parseSqlTableIds('towing_specs');
  const sqlLinks = parseSqlTableIds('spec_source_links');

  // Verify Fallback TS counts
  assert.equal(SEED_SOURCES.length, 83, 'TS SEED_SOURCES count');
  assert.equal(SEED_MAKES.length, 9, 'TS SEED_MAKES count');
  assert.equal(SEED_MODELS.length, 27, 'TS SEED_MODELS count');
  assert.equal(SEED_MODEL_YEARS.length, 135, 'TS SEED_MODEL_YEARS count');
  assert.equal(SEED_TRIMS.length, 211, 'TS SEED_TRIMS count');
  assert.equal(SEED_CONFIGS.length, 235, 'TS SEED_CONFIGS count');
  assert.equal(SEED_SPECS.length, 235, 'TS SEED_SPECS count');
  assert.equal(SEED_SPEC_SOURCE_LINKS.length, 235, 'TS SEED_SPEC_SOURCE_LINKS count');

  // Verify JSON counts match TS
  assert.equal(json.sources.length, SEED_SOURCES.length, 'JSON sources count');
  assert.equal(json.makes.length, SEED_MAKES.length, 'JSON makes count');
  assert.equal(json.models.length, SEED_MODELS.length, 'JSON models count');
  assert.equal(json.model_years.length, SEED_MODEL_YEARS.length, 'JSON model_years count');
  assert.equal(json.trims.length, SEED_TRIMS.length, 'JSON trims count');
  assert.equal(json.vehicle_configurations.length, SEED_CONFIGS.length, 'JSON configs count');
  assert.equal(json.towing_specs.length, SEED_SPECS.length, 'JSON specs count');
  assert.equal(json.spec_source_links.length, SEED_SPEC_SOURCE_LINKS.length, 'JSON links count');

  // Verify SQL counts match TS
  assert.equal(sqlSources.length, SEED_SOURCES.length, 'SQL sources count');
  assert.equal(sqlMakes.length, SEED_MAKES.length, 'SQL makes count');
  assert.equal(sqlModels.length, SEED_MODELS.length, 'SQL models count');
  assert.equal(sqlModelYears.length, SEED_MODEL_YEARS.length, 'SQL model_years count');
  assert.equal(sqlTrims.length, SEED_TRIMS.length, 'SQL trims count');
  assert.equal(sqlConfigs.length, SEED_CONFIGS.length, 'SQL configs count');
  assert.equal(sqlSpecs.length, SEED_SPECS.length, 'SQL specs count');
  assert.equal(sqlLinks.length, SEED_SPEC_SOURCE_LINKS.length, 'SQL links count');
});

test('Dataset Reconciliation: Verification statuses match across Fallback, JSON, and SQL', () => {
  const jsonSourceMap = new Map(json.sources.map(s => [s.id, s.verification_status]));

  for (const src of SEED_SOURCES) {
    const jsonStatus = jsonSourceMap.get(src.id);
    assert.equal(jsonStatus, src.verification_status, `JSON status match for ${src.id}`);

    // Check status in SQL
    const rowRegex = new RegExp(`\\('${src.id}',[\\s\\S]*?\\)(?:,|;)`);
    const match = sql.match(rowRegex);
    assert.ok(match, `SQL record exists for source ${src.id}`);
    const statusMatch = match[0].match(/'(manufacturer_verified|partially_verified|source_unavailable|pending_verification|conflicting_sources)'/);
    assert.ok(statusMatch, `SQL status found for source ${src.id}`);
    assert.equal(statusMatch[1], src.verification_status, `SQL status match for ${src.id}`);
  }
});

// ─── 2. Published-year counts and honesty ──────────────────────────────────────
test('Coverage Honesty: Published years match real published records exactly', () => {
  const publishedYearsFromMY = [...new Set(SEED_MODEL_YEARS.filter(my => my.is_published).map(my => my.year))].sort((a,b) => b - a);
  const publishedYearsFromScope = getPublishedScopeYears().sort((a,b) => b - a);

  assert.deepEqual(publishedYearsFromScope, [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010], 'Published years list');
  assert.deepEqual(publishedYearsFromMY, publishedYearsFromScope, 'Published model years match CATALOG_YEARS_SCOPE');

  // Verify non-published years in the 2010-2026 scope have zero configurations
  const plannedScopeYears = CATALOG_YEARS_SCOPE.filter(y => !y.hasPublishedRecords);
  assert.equal(plannedScopeYears.length, 1, '1 roadmap research year in 17-year scope (2026)');

  for (const py of plannedScopeYears) {
    assert.equal(py.hasPublishedRecords, false);
    assert.equal(py.configsCount, 0, `Unpublished year ${py.year} must have 0 configs in scope`);
    assert.equal(py.modelsCount, 0, `Unpublished year ${py.year} must have 0 models in scope`);
    // Ensure no published records exist in seed dataset for these years
    const configsForYear = SEED_MODEL_YEARS.filter(my => my.year === py.year && my.is_published);
    assert.equal(configsForYear.length, 0, `No published records allowed for planned year ${py.year}`);
  }
});

test('Coverage Honesty: Published model counts match actual unique models per year', () => {
  for (const yr of [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010]) {
    const scopeInfo = CATALOG_YEARS_SCOPE.find(y => y.year === yr);
    assert.ok(scopeInfo, `Scope info exists for year ${yr}`);

    const mys = SEED_MODEL_YEARS.filter(my => my.year === yr && my.is_published);
    const uniqueModelIds = new Set(mys.map(my => my.model_id));
    assert.equal(scopeInfo.modelsCount, uniqueModelIds.size, `Accurate model count for year ${yr}`);

    const trimIds = new Set(SEED_TRIMS.filter(t => mys.some(my => my.id === t.model_year_id)).map(t => t.id));
    const configs = SEED_CONFIGS.filter(c => trimIds.has(c.trim_id));
    assert.equal(scopeInfo.configsCount, configs.length, `Accurate config count for year ${yr}`);
  }
});

// ─── 3. Source evidence integrity ──────────────────────────────────────────────
test('Evidence Integrity: Every specification is linked to a valid primary manufacturer source', () => {
  const specIds = new Set(SEED_SPECS.map(s => s.id));
  const sourceIds = new Set(SEED_SOURCES.map(s => s.id));
  const linkSpecIds = new Set(SEED_SPEC_SOURCE_LINKS.map(l => l.spec_id));
  const linkSourceIds = new Set(SEED_SPEC_SOURCE_LINKS.map(l => l.source_id));

  for (const s of SEED_SPECS) {
    assert.ok(linkSpecIds.has(s.id), `Towing spec ${s.id} must have a spec_source_link`);
  }

  for (const l of SEED_SPEC_SOURCE_LINKS) {
    assert.ok(specIds.has(l.spec_id), `Linked spec_id ${l.spec_id} must exist in SEED_SPECS`);
    assert.ok(sourceIds.has(l.source_id), `Linked source_id ${l.source_id} must exist in SEED_SOURCES`);
  }

  for (const src of SEED_SOURCES) {
    assert.ok(src.document_title && src.document_title.length > 5, `Source ${src.id} has document title`);
    assert.ok(src.publisher && src.publisher.length > 2, `Source ${src.id} has publisher`);
    assert.ok(src.source_url && src.source_url.startsWith('https://'), `Source ${src.id} has HTTPS URL`);
    assert.ok(src.verification_status, `Source ${src.id} has verification_status`);
  }
});

test('Evidence Integrity: Questionable sources (redirects, styling releases, search URLs, portals) are never manufacturer_verified', () => {
  const sourceMap = new Map(SEED_SOURCES.map((s) => [s.id, s]));

  // 1. Ford Explorer: redirecting media PDF link
  const explorerSource = sourceMap.get('src-ford-2025-explorer');
  assert.ok(explorerSource);
  assert.notEqual(explorerSource.verification_status, 'manufacturer_verified');
  assert.equal(explorerSource.verification_status, 'source_unavailable');

  // 2. Toyota Highlander: styling package press release
  const highlanderSource = sourceMap.get('src-toyota-2022-highlander');
  assert.ok(highlanderSource);
  assert.notEqual(highlanderSource.verification_status, 'manufacturer_verified');
  assert.equal(highlanderSource.verification_status, 'partially_verified');

  // 3. Toyota Venza: generic owner resources portal
  const venzaSource = sourceMap.get('src-toyota-2024-venza');
  assert.ok(venzaSource);
  assert.notEqual(venzaSource.verification_status, 'manufacturer_verified');
  assert.equal(venzaSource.verification_status, 'partially_verified');

  // 4. Subaru Outback: dynamic search query URL
  const outbackSource = sourceMap.get('src-subaru-2024-outback');
  assert.ok(outbackSource);
  assert.notEqual(outbackSource.verification_status, 'manufacturer_verified');
  assert.equal(outbackSource.verification_status, 'partially_verified');

  // 5. Subaru Ascent: dynamic search query URL
  const ascentSource = sourceMap.get('src-subaru-2024-ascent');
  assert.ok(ascentSource);
  assert.notEqual(ascentSource.verification_status, 'manufacturer_verified');
  assert.equal(ascentSource.verification_status, 'partially_verified');
});

// ─── 4. Configuration-specific prerequisites & safety-critical figures ─────────
test('Safety Verification: Toyota Venza is explicitly marked with 0 lbs towing rating', () => {
  const venzaConfig = SEED_CONFIGS.find(c => c.id === 'cfg-venza-2024-ltd-awd');
  assert.ok(venzaConfig, 'Venza config exists');
  const venzaSpec = SEED_SPECS.find(s => s.configuration_id === venzaConfig.id);
  assert.ok(venzaSpec, 'Venza spec exists');
  assert.equal(venzaSpec.max_towing_capacity_lbs, 0, 'Venza towing capacity must be 0 lbs');
  assert.equal(venzaSpec.max_tongue_weight_lbs, 0, 'Venza tongue weight must be 0 lbs');

  // Calculator must reject any trailer for Venza
  const result = calculateTrailerCompatibility(venzaSpec, {
    vehicleConfigId: venzaConfig.id,
    trailerLoadedWeightLbs: 1000,
    trailerTongueWeightLbs: 100,
    passengerWeightLbs: 150,
    cargoWeightLbs: 50,
  });
  assert.equal(result.outcomeType, 'exceeds_limits');
  assert.ok(result.explanation.includes('NOT recommended by the vehicle manufacturer'));
});

test('Safety Verification: 2024 Subaru Ascent distinguishes Base (2,000 lbs) vs Premium with cooler (5,000 lbs)', () => {
  const baseSpec = SEED_SPECS.find(s => s.id === 'spec-subaru-ascent-2024-base');
  const premSpec = SEED_SPECS.find(s => s.id === 'spec-subaru-ascent-2024-prem');

  assert.ok(baseSpec && premSpec);
  assert.equal(baseSpec.max_towing_capacity_lbs, 2000, 'Base trim lacks transmission oil cooler: strictly 2,000 lbs');
  assert.equal(premSpec.max_towing_capacity_lbs, 5000, 'Premium trim has factory cooler: 5,000 lbs');
});

test('Safety Verification: 2024 Honda Pilot distinguishes AWD (5,000 lbs) vs 2WD (3,500 lbs)', () => {
  const awdSpec = SEED_SPECS.find(s => s.id === 'spec-honda-pilot-2024-trailsport');
  const fwdSpec = SEED_SPECS.find(s => s.id === 'spec-honda-pilot-2024-exl-2wd');

  assert.ok(awdSpec && fwdSpec);
  assert.equal(awdSpec.max_towing_capacity_lbs, 5000, 'AWD Pilot rated 5,000 lbs with ATF cooler');
  assert.equal(fwdSpec.max_towing_capacity_lbs, 3500, '2WD Pilot rated 3,500 lbs');
});

test('Safety Verification: 2024 Jeep Wrangler distinguishes Rubicon full-float axle (5,000 lbs) vs Sport semi-float (3,500 lbs)', () => {
  const rubiconSpec = SEED_SPECS.find(s => s.id === 'spec-jeep-wrangler-2024-rubicon');
  const sportSpec = SEED_SPECS.find(s => s.id === 'spec-jeep-wrangler-2024-sport');

  assert.ok(rubiconSpec && sportSpec);
  assert.equal(rubiconSpec.max_towing_capacity_lbs, 5000, 'Rubicon full-float Dana 44 HD axle rated 5,000 lbs');
  assert.equal(sportSpec.max_towing_capacity_lbs, 3500, 'Sport semi-float axle rated 3,500 lbs');
});

test('Safety Verification: 2022 Toyota Highlander distinguishes V6 standard cooling (5,000 lbs) vs Hybrid AWD (3,500 lbs)', () => {
  const v6Spec = SEED_SPECS.find(s => s.id === 'spec-highlander-2022-ltd-v6');
  const hybridSpec = SEED_SPECS.find(s => s.id === 'spec-highlander-2022-hybrid-awd');

  assert.ok(v6Spec && hybridSpec);
  assert.equal(v6Spec.max_towing_capacity_lbs, 5000, 'Highlander V6 rated 5,000 lbs with standard heavy-duty cooling');
  assert.equal(hybridSpec.max_towing_capacity_lbs, 3500, 'Highlander Hybrid strictly rated 3,500 lbs');
});

// ─── 5. Unknown critical calculator inputs workflow ────────────────────────────
test('Trailer Matcher Workflow: When critical inputs are missing, returns cannot_determine without silent assumptions', () => {
  const f150Spec = SEED_SPECS.find(s => s.id === 'spec-f150-xlt-35-maxtow');
  assert.ok(f150Spec);

  // Missing tongue weight
  const resMissingTongue = calculateTrailerCompatibility(f150Spec, {
    vehicleConfigId: f150Spec.configuration_id,
    trailerLoadedWeightLbs: 6000,
    trailerTongueWeightLbs: null,
    passengerWeightLbs: 300,
    cargoWeightLbs: 100,
  });

  assert.equal(resMissingTongue.outcomeType, 'cannot_determine');
  assert.equal(resMissingTongue.status, 'insufficient_data');
  assert.equal(resMissingTongue.outcomeHeadline, 'Cannot determine — missing critical information');
  assert.ok(resMissingTongue.missingInputsHelp.some(h => h.inputName.includes('Tongue Weight')));
  assert.ok(resMissingTongue.missingInputsHelp.some(h => h.inputName.includes('Door-Jamb Payload')));
});

test('Trailer Matcher Workflow: Distinguishes door-jamb sticker from brochure baseline and highlights controlling limit', () => {
  const f150Spec = SEED_SPECS.find(s => s.id === 'spec-f150-xlt-35-maxtow');
  assert.ok(f150Spec);

  // User enters exact door-jamb sticker payload of 1,750 lbs (lower than brochure 2,050 lbs)
  const result = calculateTrailerCompatibility(f150Spec, {
    vehicleConfigId: f150Spec.configuration_id,
    trailerLoadedWeightLbs: 7000,
    trailerTongueWeightLbs: 840,
    passengerWeightLbs: 400,
    cargoWeightLbs: 200,
    customPayloadLbs: 1750,
  });

  assert.equal(result.outcomeType, 'within_limits');
  assert.equal(result.usedCustomPayload, true);
  assert.equal(result.effectivePayloadLbs, 1750);
  assert.equal(result.breakdown.payload.source, 'user_door_jamb_sticker');
  assert.equal(result.controllingConstraint, 'Payload capacity');
  // Margin: 1,750 - (400 + 200 + 840 = 1,440) = 310 lbs
  assert.equal(result.margins.payloadMarginLbs, 310);
});

// ─── 6. 2014–2020 Year Scope & Cascading Selector Verification ─────────────────
test('2014–2020 Coverage: Each year in 2014–2020 has authentic published models, configs, and sources', async () => {
  const { getMakesForYear, getModelsByMake, getModelYears } = await import('../src/lib/db.ts');

  for (const yr of [2014, 2015, 2016, 2017, 2018, 2019, 2020]) {
    const scopeInfo = CATALOG_YEARS_SCOPE.find((y) => y.year === yr);
    assert.ok(scopeInfo, `Scope info exists for year ${yr}`);
    assert.equal(scopeInfo.status, 'verified', `Year ${yr} status must be verified`);
    assert.equal(scopeInfo.hasPublishedRecords, true, `Year ${yr} has published records`);
    assert.ok(scopeInfo.modelsCount >= 7, `Year ${yr} must have at least 7 verified models (has ${scopeInfo.modelsCount})`);
    assert.ok(scopeInfo.configsCount >= 11, `Year ${yr} must have at least 11 verified configs (has ${scopeInfo.configsCount})`);

    // Verify DB layer returns genuine makes for this year
    const makesRes = await getMakesForYear(yr);
    assert.ok(makesRes.data && makesRes.data.length >= 4, `Year ${yr} has at least 4 published makes`);

    // Ensure Ford and Chevrolet are present
    const makeSlugs = makesRes.data.map((m) => m.slug);
    assert.ok(makeSlugs.includes('ford'), `Ford present in ${yr}`);
    assert.ok(makeSlugs.includes('chevrolet'), `Chevrolet present in ${yr}`);
    assert.ok(makeSlugs.includes('toyota'), `Toyota present in ${yr}`);
    assert.ok(makeSlugs.includes('ram'), `Ram present in ${yr}`);

    // Verify models for Ford in this year
    const ford = makesRes.data.find((m) => m.slug === 'ford');
    assert.ok(ford);
    const fordModelsRes = await getModelsByMake(ford.id);
    const fordModelsForYear = [];
    for (const m of fordModelsRes.data || []) {
      const { data: myData } = await getModelYears(m.id);
      if (myData && myData.some((my) => my.year === yr && my.is_published)) {
        fordModelsForYear.push(m.slug);
      }
    }
    assert.ok(fordModelsForYear.includes('f-150'), `F-150 published for Ford in ${yr}`);
  }
});

test('Year Selector Honesty: 2026 is strictly planned with zero published configurations', async () => {
  const { getMakesForYear } = await import('../src/lib/db.ts');
  const scope2026 = CATALOG_YEARS_SCOPE.find((y) => y.year === 2026);
  assert.ok(scope2026);
  assert.equal(scope2026.status, 'planned');
  assert.equal(scope2026.hasPublishedRecords, false);
  assert.equal(scope2026.modelsCount, 0);
  assert.equal(scope2026.configsCount, 0);

  const makes2026 = await getMakesForYear(2026);
  assert.deepEqual(makes2026.data, [], '2026 must return zero makes in DB query');
});

