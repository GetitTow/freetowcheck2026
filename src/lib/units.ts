/**
 * TowingSpecs — Automotive Unit Conversion & Formatting
 *
 * Implements rigorous, tested conversions between imperial (US customary)
 * and metric automotive units with consistent rounding rules.
 */

const LBS_PER_KG = 2.20462262185;
const INCHES_PER_CM = 0.3937007874;

/**
 * Converts US pounds (lbs) to kilograms (kg).
 */
export function lbsToKg(lbs: number, precision: number = 0): number {
  if (isNaN(lbs) || lbs === null || lbs === undefined) return 0;
  const kg = lbs / LBS_PER_KG;
  return Number(kg.toFixed(precision));
}

/**
 * Converts kilograms (kg) to US pounds (lbs).
 */
export function kgToLbs(kg: number, precision: number = 0): number {
  if (isNaN(kg) || kg === null || kg === undefined) return 0;
  const lbs = kg * LBS_PER_KG;
  return Number(lbs.toFixed(precision));
}

/**
 * Converts inches to centimeters.
 */
export function inToCm(inches: number, precision: number = 1): number {
  if (isNaN(inches) || inches === null || inches === undefined) return 0;
  return Number((inches / INCHES_PER_CM).toFixed(precision));
}

/**
 * Converts centimeters to inches.
 */
export function cmToIn(cm: number, precision: number = 1): number {
  if (isNaN(cm) || cm === null || cm === undefined) return 0;
  return Number((cm * INCHES_PER_CM).toFixed(precision));
}

/**
 * Formats weight with unit and localized thousands separators.
 */
export function formatWeight(lbs: number | null | undefined, unit: 'lbs' | 'kg' = 'lbs'): string {
  if (lbs === null || lbs === undefined || isNaN(lbs)) return 'Not available';
  if (unit === 'kg') {
    const kg = lbsToKg(lbs);
    return `${kg.toLocaleString('en-US')} kg`;
  }
  return `${lbs.toLocaleString('en-US')} lbs`;
}

/**
 * Formats a dual-unit weight display, e.g. "14,000 lbs (6,350 kg)".
 */
export function formatDualWeight(lbs: number | null | undefined): string {
  if (lbs === null || lbs === undefined || isNaN(lbs)) return 'Not available';
  const kg = lbsToKg(lbs);
  return `${lbs.toLocaleString('en-US')} lbs (${kg.toLocaleString('en-US')} kg)`;
}
