import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrailerCompatibility as calcDirect } from '../src/lib/towing-calculations.ts';

const testSpec = {
  id: 'spec-f150-xlt-maxtow',
  configuration_id: 'cfg-f150-xlt-35-4wd-maxtow',
  max_towing_capacity_lbs: 14000,
  max_tongue_weight_lbs: 1400,
  max_payload_lbs: 2050,
  gcwr_lbs: 19400,
  gvwr_lbs: 7100,
  curb_weight_lbs: 5050,
  hitch_class: 'Class V',
  max_trailer_height_in: null,
  fifth_wheel_capacity_lbs: null,
  gooseneck_capacity_lbs: null,
  equipment_notes: 'Requires Max Tow package',
  applies_when: null,
  created_at: '',
  updated_at: '',
};

test('Compatibility: returns within_all_limits when trailer is well within ratings', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 7000,
    trailerTongueWeightLbs: 840, // 12% tongue weight
    passengerWeightLbs: 350,
    cargoWeightLbs: 150,
  });

  assert.equal(result.status, 'within_all_limits');
  assert.equal(result.margins.towingCapacityMarginLbs, 7000);
  assert.equal(result.margins.tongueWeightMarginLbs, 560);
  // Total payload used = 350 + 150 + 840 = 1340. Margin = 2050 - 1340 = 710 lbs
  assert.equal(result.margins.payloadMarginLbs, 710);
  assert.equal(result.isEstimate, false);
});

test('Compatibility: trailer weight exactly equal to max towing capacity (boundary margin = 0)', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 14000,
    trailerTongueWeightLbs: 1400, // 10%
    passengerWeightLbs: 150,
    cargoWeightLbs: 50,
  });

  assert.equal(result.margins.towingCapacityMarginLbs, 0);
  assert.equal(result.status, 'within_all_limits');
  assert.ok(result.warnings.some((w) => w.includes('within 500 lbs')));
});

test('Compatibility: fails when trailer weight exceeds max towing capacity', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 14100, // exceeds 14,000 by 100 lbs
    trailerTongueWeightLbs: 1400,
    passengerWeightLbs: 100,
    cargoWeightLbs: 50, // Combined = 5050 + 150 + 14100 = 19300 <= 19400 (GCWR OK)
  });

  assert.equal(result.status, 'exceeds_towing_capacity');
  assert.equal(result.margins.towingCapacityMarginLbs, -100);
  assert.ok(result.explanation.includes('exceeds the vehicle\'s maximum towing capacity'));
});

test('Compatibility: fails when tongue weight exceeds rated limit', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 10000,
    trailerTongueWeightLbs: 1600, // exceeds 1400
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });

  assert.equal(result.status, 'exceeds_tongue_weight');
  assert.equal(result.margins.tongueWeightMarginLbs, -200);
  assert.ok(result.explanation.includes('exceeds the vehicle\'s rated tongue weight limit'));
});

test('Compatibility: fails when passenger + cargo + tongue weight exceeds payload', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 10000,
    trailerTongueWeightLbs: 1200,
    passengerWeightLbs: 600, // 4 adults
    cargoWeightLbs: 500,     // bed cargo: total payload = 1200 + 600 + 500 = 2300 > 2050
  });

  assert.equal(result.status, 'exceeds_payload');
  assert.equal(result.margins.payloadMarginLbs, -250);
  assert.ok(result.explanation.includes('exceeds the vehicle\'s payload rating'));
});

test('Compatibility: fails when GCWR is exceeded even if tow capacity is within limits', () => {
  // Curb weight = 5,050. GCWR = 19,400.
  // Trailer = 13,000. Passengers = 800. Cargo = 650.
  // Combined = 5,050 + 800 + 650 + 13,000 = 19,500 > 19,400 (exceeds by 100 lbs)
  // Payload used = 800 + 650 + 500 (tongue) = 1,950 <= 2,050 (payload OK)
  // Tow margin = 14,000 - 13,000 = 1,000 lbs (tow OK)
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 13000,
    trailerTongueWeightLbs: 500,
    passengerWeightLbs: 800,
    cargoWeightLbs: 650,
  });

  assert.equal(result.status, 'exceeds_gcwr');
  assert.equal(result.margins.gcwrMarginLbs, -100);
  assert.ok(result.explanation.includes('exceeds the vehicle\'s GCWR'));
});

test('Compatibility: identifies multiple_violations when both towing and payload are exceeded', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 15000, // exceeds 14,000
    trailerTongueWeightLbs: 1500,  // exceeds 1400
    passengerWeightLbs: 500,
    cargoWeightLbs: 400,           // payload used = 1500 + 500 + 400 = 2400 > 2050
  });

  assert.equal(result.status, 'multiple_violations');
  assert.ok(result.explanation.includes('Multiple manufacturer limits exceeded'));
});

test('Compatibility: warns when tongue weight percentage is below 10% (sway hazard)', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 8000,
    trailerTongueWeightLbs: 500, // 500 / 8000 = 6.25% < 10%
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });

  assert.ok(result.warnings.some((w) => w.includes('trailer sway')));
});

test('Compatibility: warns when tongue weight percentage exceeds 15% (rear axle strain)', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 6000,
    trailerTongueWeightLbs: 1050, // 1050 / 6000 = 17.5% > 15%
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });

  assert.ok(result.warnings.some((w) => w.includes('excessive strain')));
});

test('Compatibility: returns insufficient_data when tongue weight is not provided', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 7000,
    trailerTongueWeightLbs: null,
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.isEstimate, true);
  assert.ok(result.warnings.some((w) => w.includes('Tongue weight was not provided')));
});

test('Compatibility: returns insufficient_data on invalid/negative/non-finite inputs', () => {
  // Negative trailer weight
  const res1 = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: -5000,
    trailerTongueWeightLbs: 500,
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });
  assert.equal(res1.status, 'insufficient_data');

  // NaN trailer weight
  const res2 = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: NaN,
    trailerTongueWeightLbs: 500,
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });
  assert.equal(res2.status, 'insufficient_data');

  // Tongue weight > total trailer weight
  const res3 = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 3000,
    trailerTongueWeightLbs: 3500,
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });
  assert.equal(res3.status, 'insufficient_data');
});

test('Compatibility: passes equipment notes as explicit warnings', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 7000,
    trailerTongueWeightLbs: 840,
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });

  assert.ok(result.warnings.some((w) => w.includes('Requires Max Tow package')));
});

// ─── Phase 2 Safety & Calculation Reliability Tests ─────────────────────────

test('Safety Refusal: missing vehicle max_tongue_weight_lbs returns cannot_determine (never passes as within_all_limits)', () => {
  const specMissingTongueLimit = {
    ...testSpec,
    max_tongue_weight_lbs: null, // Spec missing receiver tongue limit
  };

  const result = calcDirect(specMissingTongueLimit, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 5000,
    trailerTongueWeightLbs: 600, // User provides tongue weight, but receiver limit is unknown
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });

  // Must REFUSE to pass unconditionally
  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.outcomeType, 'cannot_determine');
  assert.equal(result.isEstimate, true);
  assert.equal(result.breakdown.tongueWeight.status, 'unverified');
  assert.equal(result.margins.tongueWeightMarginLbs, null);
  assert.ok(result.warnings.some((w) => w.includes('Maximum hitch receiver tongue weight rating is unavailable')));
  assert.ok(result.missingInputsHelp.some((h) => h.inputName.includes('Receiver Tongue Weight')));
});

test('Safety Refusal: missing vehicle max_payload_lbs returns cannot_determine', () => {
  const specMissingPayload = {
    ...testSpec,
    max_payload_lbs: null,
  };

  const result = calcDirect(specMissingPayload, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 5000,
    trailerTongueWeightLbs: 500,
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.outcomeType, 'cannot_determine');
  assert.equal(result.isEstimate, true);
  assert.equal(result.breakdown.payload.status, 'unverified');
  assert.equal(result.margins.payloadMarginLbs, null);
});

test('Safety Refusal: missing vehicle gcwr_lbs returns cannot_determine', () => {
  const specMissingGcwr = {
    ...testSpec,
    gcwr_lbs: null,
  };

  const result = calcDirect(specMissingGcwr, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 5000,
    trailerTongueWeightLbs: 500,
    passengerWeightLbs: 200,
    cargoWeightLbs: 100,
  });

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.outcomeType, 'cannot_determine');
  assert.equal(result.isEstimate, true);
  assert.equal(result.breakdown.gcwr.status, 'unverified');
  assert.equal(result.margins.gcwrMarginLbs, null);
});

test('Missing Tongue Weight: does not calculate false positive payload margin and marks payload unverified', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 7000,
    trailerTongueWeightLbs: null, // Unknown tongue weight
    passengerWeightLbs: 300,
    cargoWeightLbs: 200,
  });

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.outcomeType, 'cannot_determine');
  assert.equal(result.isEstimate, true);
  // Never falsely report positive payload margin without tongue weight!
  assert.equal(result.margins.payloadMarginLbs, null);
  assert.equal(result.breakdown.payload.status, 'unverified');
  assert.equal(result.breakdown.payload.isComplete, false);
  assert.ok(result.warnings.some((w) => w.includes('Vehicle payload compliance cannot be verified because trailer tongue weight was not provided')));
});

test('Missing Tongue Weight: fails when passenger + cargo alone exceeds payload', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 7000,
    trailerTongueWeightLbs: null,
    passengerWeightLbs: 1200, // 8 passengers
    cargoWeightLbs: 1000,     // Total occupant+cargo = 2200 > max_payload 2050
  });

  assert.equal(result.status, 'exceeds_payload');
  assert.equal(result.outcomeType, 'exceeds_limits');
  assert.equal(result.breakdown.payload.status, 'fail');
  assert.equal(result.margins.payloadMarginLbs, -150);
  assert.ok(result.explanation.includes('alone exceeds'));
});

test('Hitch Hardware: accounts for user-specified hitch hardware weight in payload and GCWR', () => {
  // Spec: payload = 2050, curb = 5050, GCWR = 19400
  // Passengers = 300, Cargo = 100, Tongue = 700
  // Hitch hardware = 100 lbs (e.g., heavy duty weight-distribution head & bars)
  // Total payload used = 300 + 100 + 100 + 700 = 1200 lbs. Margin = 2050 - 1200 = 850 lbs.
  // Combined weight = 5050 + 300 + 100 + 100 + 7000 = 12550 lbs. Margin = 19400 - 12550 = 6850 lbs.
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 7000,
    trailerTongueWeightLbs: 700,
    passengerWeightLbs: 300,
    cargoWeightLbs: 100,
    hitchHardwareWeightLbs: 100,
  });

  assert.equal(result.status, 'within_all_limits');
  assert.equal(result.margins.payloadMarginLbs, 850);
  assert.equal(result.margins.gcwrMarginLbs, 6850);
  assert.equal(result.breakdown.payload.hitchHardwareLbs, 100);
  assert.ok(result.warnings.some((w) => w.includes('Hitch hardware weight of 100 lbs is included')));
});

test('Hitch Hardware: triggers payload violation when hitch hardware pushes payload over limit', () => {
  // Spec payload = 2050 lbs.
  // Passengers = 400, Cargo = 200, Tongue = 1400 (Sum = 2000 lbs, 50 lbs under limit)
  // Adding 80 lbs hitch hardware pushes total to 2080 lbs (30 lbs over limit!)
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 10000,
    trailerTongueWeightLbs: 1400,
    passengerWeightLbs: 400,
    cargoWeightLbs: 200,
    hitchHardwareWeightLbs: 80,
  });

  assert.equal(result.status, 'exceeds_payload');
  assert.equal(result.margins.payloadMarginLbs, -30);
  assert.equal(result.breakdown.payload.status, 'fail');
  assert.ok(result.explanation.includes('hitch hardware (80 lbs)'));
});

test('Check States: every constraint returns explicit pass, fail, or unverified status', () => {
  const result = calcDirect(testSpec, {
    vehicleConfigId: 'cfg-1',
    trailerLoadedWeightLbs: 8000,
    trailerTongueWeightLbs: 960,
    passengerWeightLbs: 300,
    cargoWeightLbs: 150,
  });

  assert.equal(result.breakdown.towing.status, 'pass');
  assert.equal(result.breakdown.tongueWeight.status, 'pass');
  assert.equal(result.breakdown.payload.status, 'pass');
  assert.equal(result.breakdown.gcwr.status, 'pass');
  assert.ok(result.breakdown.towing.detail.length > 0);
  assert.ok(result.breakdown.tongueWeight.detail.length > 0);
  assert.ok(result.breakdown.payload.detail.length > 0);
  assert.ok(result.breakdown.gcwr.detail.length > 0);
});
