import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMakes,
  getMakeBySlug,
  getModelsByMake,
  getModelBySlug,
  getModelYearByYear,
  getTrimsByModelYear,
  getConfigurationsByTrim,
  getTowingSpecByConfiguration,
  getSourcesForSpec,
} from '../src/lib/db.ts';

test('Database Layer: getMakes returns verified makes in fallback mode', async () => {
  const { data: makes, error } = await getMakes();
  assert.equal(error, null);
  assert.ok(Array.isArray(makes));
  assert.ok(makes.length >= 5);
  assert.ok(makes.some((m) => m.slug === 'ford'));
  assert.ok(makes.some((m) => m.slug === 'chevrolet'));
  assert.ok(makes.some((m) => m.slug === 'toyota'));
});

test('Database Layer: getMakeBySlug resolves make correctly', async () => {
  const { data: ford, error } = await getMakeBySlug('ford');
  assert.equal(error, null);
  assert.notEqual(ford, null);
  assert.equal(ford?.name, 'Ford');
});

test('Database Layer: getModelsByMake resolves models', async () => {
  const { data: ford } = await getMakeBySlug('ford');
  assert.ok(ford);
  const { data: models, error } = await getModelsByMake(ford.id);
  assert.equal(error, null);
  assert.ok(models && models.length > 0);
  assert.ok(models.some((m) => m.slug === 'f-150'));
});

test('Database Layer: hierarchy traversal from make to towing spec', async () => {
  const { data: ford } = await getMakeBySlug('ford');
  assert.ok(ford);
  const { data: f150 } = await getModelBySlug(ford.id, 'f-150');
  assert.ok(f150);
  const { data: my2025 } = await getModelYearByYear(f150.id, 2025);
  assert.ok(my2025);
  const { data: trims } = await getTrimsByModelYear(my2025.id);
  assert.ok(trims && trims.length > 0);

  const xlt = trims.find((t) => t.slug === 'xlt');
  assert.ok(xlt);

  const { data: configs } = await getConfigurationsByTrim(xlt.id);
  assert.ok(configs && configs.length > 0);

  const maxTowConfig = configs.find((c) => c.has_tow_package);
  assert.ok(maxTowConfig);

  const { data: spec } = await getTowingSpecByConfiguration(maxTowConfig.id);
  assert.ok(spec);
  assert.equal(spec.max_towing_capacity_lbs, 14000);
  assert.equal(spec.max_tongue_weight_lbs, 1400);

  const { data: sources } = await getSourcesForSpec(spec.id);
  assert.ok(sources && sources.length > 0);
  assert.equal(sources[0].verification_status, 'source_unavailable');
});

test('Database Layer: 2013 Toyota historical model lookup (SAE J2807 adoption)', async () => {
  const { data: toyota } = await getMakeBySlug('toyota');
  assert.ok(toyota, 'Toyota make must exist');

  // Verify 2013 Tacoma
  const { data: tacoma } = await getModelBySlug(toyota.id, 'tacoma');
  assert.ok(tacoma, 'Tacoma model must exist');
  const { data: my2013Tacoma } = await getModelYearByYear(tacoma.id, 2013);
  assert.ok(my2013Tacoma, '2013 Tacoma must exist');
  const { data: tacomaTrims } = await getTrimsByModelYear(my2013Tacoma.id);
  assert.ok(tacomaTrims && tacomaTrims.length >= 2, '2013 Tacoma should have multiple trims');

  // Verify 2013 Highlander
  const { data: highlander } = await getModelBySlug(toyota.id, 'highlander');
  assert.ok(highlander, 'Highlander model must exist');
  const { data: my2013Highlander } = await getModelYearByYear(highlander.id, 2013);
  assert.ok(my2013Highlander, '2013 Highlander must exist');
  const { data: hlTrims } = await getTrimsByModelYear(my2013Highlander.id);
  assert.ok(hlTrims && hlTrims.length >= 2, '2013 Highlander should have Limited and Base trims');
});

test('Database Layer: 2022 Toyota Highlander multi-configuration differentiation', async () => {
  const { data: toyota } = await getMakeBySlug('toyota');
  assert.ok(toyota, 'Toyota make must exist');

  const { data: highlander } = await getModelBySlug(toyota.id, 'highlander');
  assert.ok(highlander, 'Highlander model must exist');

  const { data: my2022 } = await getModelYearByYear(highlander.id, 2022);
  assert.ok(my2022, '2022 Highlander model year must exist');

  const { data: trims } = await getTrimsByModelYear(my2022.id);
  assert.ok(trims && trims.length === 3, '2022 Highlander must have 3 distinct trims');

  // Find the 3 trims
  const towPrepTrim = trims.find((t) => t.slug === 'limited-v6-awd');
  const hybridTrim = trims.find((t) => t.slug === 'hybrid-xle-awd');
  const standardTrim = trims.find((t) => t.slug === 'le-v6-fwd');

  assert.ok(towPrepTrim, 'Limited V6 AWD trim must exist');
  assert.ok(hybridTrim, 'Hybrid trim must exist');
  assert.ok(standardTrim, 'LE V6 FWD trim must exist');

  // Verify Limited V6 AWD Config (5,000 lbs)
  const { data: configsTowPrep } = await getConfigurationsByTrim(towPrepTrim.id);
  assert.ok(configsTowPrep && configsTowPrep.length > 0);
  assert.equal(configsTowPrep[0].has_tow_package, true);
  const { data: specTowPrep } = await getTowingSpecByConfiguration(configsTowPrep[0].id);
  assert.ok(specTowPrep);
  assert.equal(specTowPrep.max_towing_capacity_lbs, 5000);
  assert.equal(specTowPrep.max_tongue_weight_lbs, 500);
  assert.equal(specTowPrep.gcwr_lbs, 10800);

  // Verify Hybrid Config (3,500 lbs)
  const { data: configsHybrid } = await getConfigurationsByTrim(hybridTrim.id);
  assert.ok(configsHybrid && configsHybrid.length > 0);
  const { data: specHybrid } = await getTowingSpecByConfiguration(configsHybrid[0].id);
  assert.ok(specHybrid);
  assert.equal(specHybrid.max_towing_capacity_lbs, 3500);
  assert.equal(specHybrid.max_tongue_weight_lbs, 350);
  assert.equal(specHybrid.gcwr_lbs, 8900);

  // Verify LE V6 FWD Config (5,000 lbs with hitch receiver)
  const { data: configsStandard } = await getConfigurationsByTrim(standardTrim.id);
  assert.ok(configsStandard && configsStandard.length > 0);
  assert.equal(configsStandard[0].has_tow_package, false);
  const { data: specStandard } = await getTowingSpecByConfiguration(configsStandard[0].id);
  assert.ok(specStandard);
  assert.equal(specStandard.max_towing_capacity_lbs, 5000);
  assert.equal(specStandard.max_tongue_weight_lbs, 500);
  assert.equal(specStandard.gcwr_lbs, 10600);

  // Verify Manufacturer Source
  const { data: sources } = await getSourcesForSpec(specTowPrep.id);
  assert.ok(sources && sources.length > 0);
  assert.equal(sources[0].verification_status, 'partially_verified');
  assert.ok(sources[0].notes.includes('3.5L V6'));
});

test('Database Layer: Multi-brand expansion verification (Subaru, Honda, Jeep, Nissan)', async () => {
  const { data: makes } = await getMakes();
  assert.ok(makes && makes.length >= 9, 'Catalog must contain at least 9 verified makes');

  const expectedMakes = ['toyota', 'ford', 'chevrolet', 'ram', 'gmc', 'subaru', 'honda', 'jeep', 'nissan'];
  for (const slug of expectedMakes) {
    const make = makes.find((m) => m.slug === slug);
    assert.ok(make, `Make "${slug}" must exist in catalog`);
  }

  // Check Subaru Outback
  const subaru = makes.find((m) => m.slug === 'subaru');
  const { data: outback } = await getModelBySlug(subaru.id, 'outback');
  assert.ok(outback, 'Subaru Outback model must exist');

  // Check Honda Pilot
  const honda = makes.find((m) => m.slug === 'honda');
  const { data: pilot } = await getModelBySlug(honda.id, 'pilot');
  assert.ok(pilot, 'Honda Pilot model must exist');
});

test('Database Layer: Explicit zero-towing rating for non-towing vehicle (2024 Toyota Venza)', async () => {
  const { data: toyota } = await getMakeBySlug('toyota');
  const { data: venza } = await getModelBySlug(toyota.id, 'venza');
  assert.ok(venza, 'Venza model must exist');

  const { data: my2024 } = await getModelYearByYear(venza.id, 2024);
  assert.ok(my2024, '2024 Venza model year must exist');

  const { data: trims } = await getTrimsByModelYear(my2024.id);
  assert.ok(trims && trims.length > 0);

  const { data: configs } = await getConfigurationsByTrim(trims[0].id);
  assert.ok(configs && configs.length > 0);

  const { data: spec } = await getTowingSpecByConfiguration(configs[0].id);
  assert.ok(spec, 'Spec must exist');
  assert.equal(spec.max_towing_capacity_lbs, 0, 'Venza towing capacity must be explicitly 0 lbs');
  assert.equal(spec.max_tongue_weight_lbs, 0, 'Venza tongue weight must be 0 lbs');
  assert.ok(spec.equipment_notes.includes('not recommended'), 'Equipment notes must state towing is not recommended');
});

