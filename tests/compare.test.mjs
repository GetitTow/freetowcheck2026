/**
 * TowingSpecs — Vehicle Comparison Automated Test Suite
 * Validates that side-by-side comparison is driven dynamically by the database layer,
 * handles 2 and 3 vehicle sets, preserves null/missing fields faithfully without converting to zero,
 * and produces valid query parameter links for the trailer matcher tool.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDetailedConfigurationById,
  getAllDetailedConfigurations,
} from '../src/lib/db.ts';

test('Vehicle Comparison: retrieves valid detailed configuration records from DB', async () => {
  const result = await getDetailedConfigurationById('cfg-tacoma-2013-doublecab-v6-4wd');
  assert.equal(result.error, null);
  assert.ok(result.data, 'Detailed configuration must be found');

  const { config, spec, trim, model, make, year, sources } = result.data;
  assert.equal(year, 2013);
  assert.equal(make.name, 'Toyota');
  assert.equal(model.name, 'Tacoma');
  assert.equal(trim.name, 'Double Cab V6');
  assert.equal(config.drivetrain, '4WD');
  assert.equal(config.has_tow_package, true);

  assert.ok(spec, 'Specification must be attached to verified configuration');
  assert.equal(spec.max_towing_capacity_lbs, 6400);
  assert.equal(spec.max_tongue_weight_lbs, 640);
  assert.equal(spec.max_payload_lbs, 1375);
  assert.equal(spec.gcwr_lbs, 11100);
  assert.equal(spec.hitch_class, 'Class IV');

  assert.ok(sources.length > 0, 'Sources must be linked to verified configuration');
  assert.equal(sources[0].publisher, 'Toyota Motor Sales, U.S.A., Inc.');
});

test('Vehicle Comparison: returns null for invalid or non-existent configuration IDs', async () => {
  const result = await getDetailedConfigurationById('cfg-invalid-id-does-not-exist');
  assert.equal(result.error, null);
  assert.equal(result.data, null);
});

test('Vehicle Comparison: getAllDetailedConfigurations loads all active catalog configs', async () => {
  const allConfigs = await getAllDetailedConfigurations();
  assert.ok(allConfigs.length >= 35, `Catalog must have comprehensive configurations (found ${allConfigs.length})`);
  
  // Verify representation across years
  const years = new Set(allConfigs.map((c) => c.year));
  assert.ok(years.has(2013), 'Must include 2013 configurations');
  assert.ok(years.has(2024), 'Must include 2024 configurations');
  assert.ok(years.has(2025), 'Must include 2025 configurations');

  // Verify Toyota representation
  const toyotaConfigs = allConfigs.filter((c) => c.make.slug === 'toyota');
  assert.ok(toyotaConfigs.length >= 15, `Must have rich Toyota catalog (found ${toyotaConfigs.length})`);
});

test('Vehicle Comparison: 3-vehicle comparison evaluates correct comparative values', async () => {
  const v1 = (await getDetailedConfigurationById('cfg-f150-xlt-35-4wd-maxtow')).data;
  const v2 = (await getDetailedConfigurationById('cfg-tacoma-2013-doublecab-v6-4wd')).data;
  const v3 = (await getDetailedConfigurationById('cfg-ram-2013-laramie-57-4wd')).data;

  assert.ok(v1 && v2 && v3, 'All 3 compared vehicles must resolve from DB');

  // Verify towing capacity ordering
  assert.equal(v1.spec?.max_towing_capacity_lbs, 14000);
  assert.equal(v2.spec?.max_towing_capacity_lbs, 6400);
  assert.equal(v3.spec?.max_towing_capacity_lbs, 10250);

  // Maximum towing capacity in set
  const maxTow = Math.max(
    v1.spec?.max_towing_capacity_lbs || 0,
    v2.spec?.max_towing_capacity_lbs || 0,
    v3.spec?.max_towing_capacity_lbs || 0
  );
  assert.equal(maxTow, 14000);

  // Transfer URL creation matches expected pattern
  const matcherUrl1 = `/trailer-matcher/?make=${v1.make.slug}&model=${v1.model.slug}&year=${v1.year}&config=${v1.config.id}`;
  const matcherUrl2 = `/trailer-matcher/?make=${v2.make.slug}&model=${v2.model.slug}&year=${v2.year}&config=${v2.config.id}`;

  assert.equal(matcherUrl1, '/trailer-matcher/?make=ford&model=f-150&year=2025&config=cfg-f150-xlt-35-4wd-maxtow');
  assert.equal(matcherUrl2, '/trailer-matcher/?make=toyota&model=tacoma&year=2013&config=cfg-tacoma-2013-doublecab-v6-4wd');
});

test('Vehicle Comparison: maintains null transparency without coercing missing fields to zero', async () => {
  const v = (await getDetailedConfigurationById('cfg-explorer-active-23-rwd')).data;
  assert.ok(v);
  // Explorer does not have fifth-wheel capacity
  assert.equal(v.spec?.fifth_wheel_capacity_lbs, null);
  assert.notEqual(v.spec?.fifth_wheel_capacity_lbs, 0, 'Missing fifth-wheel capacity must remain null, never zero');
});
