/**
 * TowingSpecs — Catalog Model Year Scope & Coverage Definitions
 *
 * Defines the complete 17-year catalog scope (2010 through 2026 inclusive)
 * for US-market trucks, SUVs, and tow-capable passenger vehicles.
 *
 * Distinguishes:
 * - 'verified': Published records backed by verified manufacturer documentation ("Data available")
 * - 'partially_verified': Published records with documented archival specifications ("Partial coverage")
 * - 'planned': Within the 2010–2026 catalog scope; records in active research queue ("Research in progress")
 */

export interface YearCoverageInfo {
  year: number;
  status: 'verified' | 'partially_verified' | 'planned';
  statusLabel: string;
  badgeClass: string;
  hasPublishedRecords: boolean;
  modelsCount: number;
  configsCount: number;
  featuredVehicles: string[];
  notes: string;
}

/**
 * Format count with proper English singular / plural agreement.
 */
export function formatModelCount(count: number): string {
  return count === 1 ? '1 model' : `${count} models`;
}

export function formatConfigCount(count: number): string {
  return count === 1 ? '1 configuration' : `${count} configurations`;
}

/**
 * Authoritative 2010–2026 model year catalog matrix.
 * Updated synchronously with seed dataset updates.
 */
export const CATALOG_YEARS_SCOPE: YearCoverageInfo[] = [
  {
    year: 2026,
    status: 'planned',
    statusLabel: 'Research in progress',
    badgeClass: 'badge--planned',
    hasPublishedRecords: false,
    modelsCount: 0,
    configsCount: 0,
    featuredVehicles: ['Ford F-150', 'Chevrolet Silverado 1500', 'Toyota Tacoma', 'Ram 1500'],
    notes: 'Manufacturer fleet towing guides and owner manuals are currently being published by OEMs for 2026 model-year vehicles.',
  },
  {
    year: 2025,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 11,
    configsCount: 23,
    featuredVehicles: ['Ford F-150', 'Ford F-250', 'Ford Explorer', 'Chevy Silverado 1500', 'Chevy Tahoe', 'Ram 1500', 'Toyota Tundra', 'Toyota Tacoma', 'Toyota Crown Signia', 'GMC Sierra 1500'],
    notes: 'Primary manufacturer towing guides and technical spec sheets published for Ford, Chevrolet, GMC, Ram, and Toyota.',
  },
  {
    year: 2024,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 18,
    configsCount: 25,
    featuredVehicles: ['Toyota Tacoma (4th Gen)', 'Toyota Tundra', 'Toyota 4Runner', 'Toyota Highlander', 'Toyota Grand Highlander', 'Toyota Sequoia', 'Toyota Land Cruiser 250', 'Toyota RAV4', 'Subaru Outback', 'Subaru Ascent', 'Honda Pilot', 'Honda Ridgeline', 'Jeep Wrangler', 'Jeep Grand Cherokee', 'Nissan Frontier', 'Nissan Pathfinder'],
    notes: 'Comprehensive multi-brand US-market coverage across 8 major manufacturers with SAE J2807 certification.',
  },
  {
    year: 2023,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 12,
    configsCount: 22,
    featuredVehicles: ['Ford F-150', 'Ford Explorer', 'Chevy Silverado 1500', 'Chevy Tahoe', 'GMC Sierra 1500', 'Ram 1500', 'Toyota Tundra (i-FORCE)', 'Toyota Tacoma', 'Toyota Sequoia', 'Toyota 4Runner', 'Honda Pilot (4th Gen)', 'Nissan Frontier'],
    notes: 'Verified specifications from 2023 OEM towing guides and manufacturer eBrochures covering all major US truck and full-size SUV platforms.',
  },
  {
    year: 2022,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 1,
    configsCount: 3,
    featuredVehicles: ['Toyota Highlander V6 (5,000 lbs)', 'Toyota Highlander Hybrid (3,500 lbs)'],
    notes: '4th-generation Toyota Highlander benchmark ratings verified from official Toyota press release and eBrochure.',
  },
  {
    year: 2021,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 2,
    configsCount: 3,
    featuredVehicles: ['Toyota Tacoma TRD Off-Road V6', 'Toyota Tacoma Access Cab 2.7L', 'Toyota Tundra 5.7L V8'],
    notes: '3rd-generation Tacoma and 2nd-generation Tundra 5.7L V8 benchmark ratings verified from manufacturer specifications.',
  },
  {
    year: 2020,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 9,
    configsCount: 16,
    featuredVehicles: ['Ford F-150', 'Ford Explorer ST', 'Chevy Silverado 1500', 'Chevy Tahoe', 'Ram 1500', 'Toyota Tacoma', 'Toyota Tundra', 'Toyota 4Runner', 'Toyota Highlander'],
    notes: 'Official towing specifications verified from Ford, GM, Ram, and Toyota OEM fleet guides and SAE J2807 tables.',
  },
  {
    year: 2019,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 8,
    configsCount: 16,
    featuredVehicles: ['Ford F-150', 'Chevy Silverado 1500 (T1XX)', 'GMC Sierra 1500', 'Ram 1500 (DT)', 'Toyota Tacoma', 'Toyota Tundra', 'Honda Pilot', 'Nissan Frontier'],
    notes: 'Next-generation pickup launches verified: Silverado T1XX, Sierra T1XX, and Ram 1500 DT eTorque from official manufacturer guides.',
  },
  {
    year: 2018,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 8,
    configsCount: 14,
    featuredVehicles: ['Ford F-150 (Facelift 10-Spd)', 'Chevy Silverado 1500', 'Chevy Tahoe', 'Ram 1500', 'Toyota Tacoma', 'Toyota Tundra', 'Toyota 4Runner', 'Toyota Highlander'],
    notes: 'F-150 10-speed expansion, Silverado K2XX final year, Tahoe Max Trailering, and Toyota SAE J2807 verified ratings.',
  },
  {
    year: 2017,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 7,
    configsCount: 11,
    featuredVehicles: ['Ford F-150 (Gen 2 3.5L EcoBoost)', 'Chevy Silverado 1500', 'GMC Sierra Denali', 'Ford Explorer', 'Ram 1500', 'Toyota Tacoma', 'Toyota Tundra'],
    notes: 'Introduction of Ford 10R80 transmission and GM 6.2L 8-speed max trailering configurations verified from OEM fleet documentation.',
  },
  {
    year: 2016,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 9,
    configsCount: 16,
    featuredVehicles: ['Ford F-150', 'Chevy Silverado 1500', 'Ram 1500', 'Toyota Tacoma (3rd Gen Launch)', 'Toyota Tundra', 'Toyota 4Runner', 'Toyota Highlander', 'Honda Pilot (3rd Gen)', 'Nissan Frontier'],
    notes: 'Major generational launches: 3rd Gen Toyota Tacoma 3.5L Atkinson V6 and 3rd Gen Honda Pilot AWD verified under SAE J2807.',
  },
  {
    year: 2015,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 8,
    configsCount: 13,
    featuredVehicles: ['Ford F-150 (All-New Aluminum Body)', 'Chevy Silverado 1500', 'GMC Sierra 1500', 'Chevy Tahoe (K2XX Launch)', 'Ford Explorer Sport', 'Ram 1500', 'Toyota Tacoma', 'Toyota Tundra'],
    notes: '13th Gen Ford F-150 aluminum body launch, GM K2XX full-size SUV generation launch, and Ram EcoDiesel ratings verified.',
  },
  {
    year: 2014,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 7,
    configsCount: 15,
    featuredVehicles: ['Ford F-150', 'Chevy Silverado 1500 (K2XX Launch)', 'Ram 1500 (EcoDiesel Launch)', 'Toyota Tacoma', 'Toyota Tundra', 'Toyota 4Runner', 'Toyota Highlander (3rd Gen)'],
    notes: 'GM K2XX truck launch, Ram 1500 EcoDiesel debut, and Toyota SAE J2807 compliance ratings verified from official guides.',
  },
  {
    year: 2013,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 12,
    configsCount: 17,
    featuredVehicles: ['Toyota Tacoma (V6 & I4)', 'Toyota Tundra (5.7L V8)', 'Toyota 4Runner', 'Toyota Highlander', 'Toyota Sequoia', 'Toyota Land Cruiser', 'Toyota FJ Cruiser', 'Toyota Sienna', 'Ford F-150 FX4', 'Chevy Silverado 1500 LTZ', 'Ram 1500 Laramie'],
    notes: 'Crucial historical benchmark year: universal adoption of the SAE J2807 standard by Toyota, Ford, and GM.',
  },
  {
    year: 2012,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 8,
    configsCount: 14,
    featuredVehicles: ['Ford F-150 (EcoBoost & 5.0L)', 'Chevy Silverado 1500', 'Chevy Tahoe', 'Ram 1500', 'Toyota Tacoma', 'Toyota Tundra', 'Toyota 4Runner', 'Toyota Highlander'],
    notes: 'Verified ratings from official 2012 Ford RV & Trailer Towing Guide, GM Trailering Guide, Ram Towing Chart, and Toyota SAE J2807 compliance tables.',
  },
  {
    year: 2011,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 8,
    configsCount: 14,
    featuredVehicles: ['Ford F-150 (3.5L EcoBoost Launch)', 'Ford Explorer (Unibody Launch)', 'Chevy Silverado 1500', 'Chevy Tahoe', 'Ram 1500', 'Toyota Tacoma', 'Toyota Tundra (SAE J2807)', 'Toyota 4Runner'],
    notes: 'Verified launch specifications: 1st Gen 3.5L EcoBoost & Coyote 5.0L in F-150, 5th Gen Explorer unibody, and early Toyota SAE J2807 ratings.',
  },
  {
    year: 2010,
    status: 'verified',
    statusLabel: 'Data available',
    badgeClass: 'badge--verified',
    hasPublishedRecords: true,
    modelsCount: 7,
    configsCount: 13,
    featuredVehicles: ['Ford F-150 (5.4L 3V & 4.6L)', 'Chevy Silverado 1500 (Vortec V8)', 'Chevy Tahoe', 'Ram 1500 (5.7L HEMI)', 'Toyota Tacoma', 'Toyota Tundra', 'Toyota 4Runner (5th Gen Launch)'],
    notes: 'Benchmark historical records: Ford 5.4L 3V Max Tow, GM GMT900 Vortec Max, Ram 4th Gen HEMI, and 5th Gen 4Runner launch ratings.',
  },
];

/**
 * Returns the coverage info for a specific year in the 2010–2026 scope.
 */
export function getYearScopeInfo(year: number): YearCoverageInfo | undefined {
  return CATALOG_YEARS_SCOPE.find((y) => y.year === year);
}

/**
 * Returns all published years that currently have verified configurations.
 */
export function getPublishedScopeYears(): number[] {
  return CATALOG_YEARS_SCOPE.filter((y) => y.hasPublishedRecords).map((y) => y.year);
}

/**
 * Returns the nearest verified model years for any given year.
 */
export function getNearestVerifiedYears(year: number): YearCoverageInfo[] {
  const verified = CATALOG_YEARS_SCOPE.filter((y) => y.hasPublishedRecords);
  return [...verified].sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year)).slice(0, 3);
}
