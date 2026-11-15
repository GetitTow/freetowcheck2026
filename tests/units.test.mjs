import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lbsToKg, kgToLbs, inToCm, cmToIn, formatWeight, formatDualWeight } from '../src/lib/units.ts';

test('Units: lbsToKg converts accurately', () => {
  assert.equal(lbsToKg(14000), 6350);
  assert.equal(lbsToKg(2200), 998);
  assert.equal(lbsToKg(0), 0);
});

test('Units: kgToLbs converts accurately', () => {
  assert.equal(kgToLbs(1000), 2205);
  assert.equal(kgToLbs(0), 0);
});

test('Units: inToCm converts accurately', () => {
  assert.equal(inToCm(2), 5.1);
  assert.equal(inToCm(2.5), 6.4);
});

test('Units: cmToIn converts accurately', () => {
  assert.equal(cmToIn(5.08), 2.0);
});

test('Units: formatDualWeight formats localized strings', () => {
  assert.equal(formatDualWeight(14000), '14,000 lbs (6,350 kg)');
  assert.equal(formatDualWeight(null), 'Not available');
});
