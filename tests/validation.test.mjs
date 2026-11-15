import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateVehicleLookupParams,
  validateTrailerInputs,
  validateTowingSpecRecord,
  validateSourceEvidence,
} from '../src/lib/validation.ts';

test('Validation: vehicle lookup accepts valid year and slugs', () => {
  const result = validateVehicleLookupParams({ year: 2025, make: 'ford', model: 'f-150' });
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
});

test('Validation: vehicle lookup rejects invalid year or slug characters', () => {
  const result = validateVehicleLookupParams({ year: 1950, make: 'Ford Truck!', model: 'f 150' });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('1950')));
  assert.ok(result.errors.some((e) => e.includes('Ford Truck!')));
});

test('Validation: trailer inputs require positive loaded weight', () => {
  const invalid = validateTrailerInputs({
    trailerLoadedWeightLbs: -500,
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.some((e) => e.includes('greater than 0')));

  const valid = validateTrailerInputs({
    trailerLoadedWeightLbs: 6500,
    trailerTongueWeightLbs: 780,
    passengerWeightLbs: 300,
    cargoWeightLbs: 150,
  });
  assert.equal(valid.isValid, true);
});

test('Validation: towing spec record detects tongue weight exceeding tow capacity', () => {
  const invalid = validateTowingSpecRecord({
    max_towing_capacity_lbs: 5000,
    max_tongue_weight_lbs: 6000, // tongue weight > tow capacity
  });
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.some((e) => e.includes('cannot exceed')));
});

test('Validation: source evidence requires valid URL and publisher', () => {
  const valid = validateSourceEvidence({
    source_url: 'https://media.ford.com/specs.pdf',
    document_title: '2025 Towing Guide',
    publisher: 'Ford Motor Company',
    verification_date: '2024-11-15',
  });
  assert.equal(valid.isValid, true);

  const invalid = validateSourceEvidence({
    source_url: 'not-a-valid-url',
    document_title: '',
    publisher: '',
    verification_date: 'invalid-date',
  });
  assert.equal(invalid.isValid, false);
  assert.equal(invalid.errors.length, 4);
});
