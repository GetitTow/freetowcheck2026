/**
 * TowingSpecs — extended type definitions
 * Builds on src/lib/types.ts with expanded enums and composite types.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type VerificationStatus =
  | 'manufacturer_verified'
  | 'partially_verified'
  | 'pending_verification'
  | 'conflicting_sources'
  | 'source_unavailable';

export type SourceType =
  | 'owner_manual'
  | 'towing_guide'
  | 'spec_sheet'
  | 'manufacturer_website'
  | 'brochure'
  | 'press_release';

export type MeasurementUnit = 'lbs' | 'kg';

export type Drivetrain = 'RWD' | 'FWD' | '4WD' | 'AWD' | '4x4';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Make {
  id: string;
  slug: string;
  name: string;
  country_of_origin: string | null;
  created_at: string;
  updated_at: string;
}

export interface Model {
  id: string;
  make_id: string;
  slug: string;
  name: string;
  body_style: string | null; // 'pickup', 'suv', 'van', 'minivan', 'crossover'
  created_at: string;
  updated_at: string;
}

export interface ModelYear {
  id: string;
  model_id: string;
  year: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trim {
  id: string;
  model_year_id: string;
  name: string;          // e.g. 'XLT', 'Laramie', 'Platinum'
  slug: string;
  msrp_usd: number | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleConfiguration {
  id: string;
  trim_id: string;
  engine_description: string | null;    // '3.5L EcoBoost V6'
  transmission: string | null;          // '10-speed automatic'
  drivetrain: Drivetrain | null;
  cab_style: string | null;             // 'Regular', 'SuperCab', 'SuperCrew', 'Crew'
  bed_length: string | null;            // '5.5 ft', '6.5 ft', '8 ft'
  axle_ratio: string | null;            // '3.73', '4.10'
  has_tow_package: boolean;
  configuration_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TowingSpec {
  id: string;
  configuration_id: string;
  max_towing_capacity_lbs: number | null;
  max_tongue_weight_lbs: number | null;
  max_payload_lbs: number | null;
  gcwr_lbs: number | null;   // Gross Combined Weight Rating
  gvwr_lbs: number | null;   // Gross Vehicle Weight Rating
  curb_weight_lbs: number | null;
  hitch_class: string | null;         // 'Class I', 'Class III', 'Class V'
  max_trailer_height_in: number | null;
  fifth_wheel_capacity_lbs: number | null;
  gooseneck_capacity_lbs: number | null;
  equipment_notes: string | null;
  applies_when: string | null;        // human-readable constraint description
  created_at: string;
  updated_at: string;
}

export interface DataSource {
  id: string;
  source_type: SourceType;
  source_url: string;
  document_title: string;
  publisher: string;
  publication_year: number | null;
  page_number: string | null;
  section: string | null;
  verification_status: VerificationStatus;
  verification_date: string;
  verified_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpecSourceLink {
  spec_id: string;
  source_id: string;
  covers_fields: string[];   // which spec fields this source supports
}

// ─── Trailer Entities ─────────────────────────────────────────────────────────

export interface TrailerMake {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export interface TrailerModel {
  id: string;
  trailer_make_id: string;
  slug: string;
  name: string;
  type: string; // 'travel_trailer', 'fifth_wheel', 'toy_hauler', 'utility', 'boat', 'horse'
  created_at: string;
}

export interface TrailerSpec {
  id: string;
  trailer_model_id: string;
  year: number | null;
  floorplan: string | null;
  dry_weight_lbs: number | null;
  gvwr_lbs: number | null;
  tongue_weight_lbs: number | null;
  tongue_weight_percent: number | null;   // if no absolute figure
  hitch_type: string | null;              // 'conventional', 'fifth_wheel', 'gooseneck'
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Composite / View Types ───────────────────────────────────────────────────

export interface VehicleSummary {
  make_slug: string;
  make_name: string;
  model_slug: string;
  model_name: string;
  body_style: string | null;
  year: number;
  model_year_id: string;
  max_towing_lbs: number | null;  // highest across all verified configs
  has_verified_data: boolean;
}

export interface VehiclePageData {
  make: Make;
  model: Model;
  modelYear: ModelYear;
  trims: Array<{
    trim: Trim;
    configurations: Array<{
      config: VehicleConfiguration;
      spec: TowingSpec | null;
      sources: DataSource[];
      verificationStatus: VerificationStatus;
    }>;
  }>;
}

export type CheckStatus = 'pass' | 'fail' | 'unverified';

export interface TrailerCompatibilityInput {
  vehicleConfigId: string;
  trailerLoadedWeightLbs: number;
  trailerTongueWeightLbs: number | null;
  passengerWeightLbs: number;
  cargoWeightLbs: number;
  hitchHardwareWeightLbs?: number | null; // Hitch shank, head, and spring bars weight (optional user input)
  customPayloadLbs?: number | null;
  rearAxleRatingLbs?: number | null;
  isTongueWeightEstimated?: boolean;
}

export type CompatibilityResultStatus =
  | 'within_all_limits'
  | 'exceeds_towing_capacity'
  | 'exceeds_payload'
  | 'exceeds_tongue_weight'
  | 'exceeds_gcwr'
  | 'insufficient_data'
  | 'multiple_violations';

export interface CompatibilityResult {
  status: CompatibilityResultStatus;
  outcomeType: 'within_limits' | 'exceeds_limits' | 'cannot_determine';
  outcomeHeadline: string;
  controllingConstraint: string | null;
  margins: {
    towingCapacityMarginLbs: number | null;
    payloadMarginLbs: number | null;
    tongueWeightMarginLbs: number | null;
    gcwrMarginLbs: number | null;
  };
  breakdown: {
    towing: {
      ratingLbs: number | null;
      loadLbs: number;
      marginLbs: number | null;
      status: CheckStatus;
      detail?: string;
      source: 'manufacturer' | 'missing';
    };
    tongueWeight: {
      ratingLbs: number | null;
      loadLbs: number | null;
      marginLbs: number | null;
      status: CheckStatus;
      detail?: string;
      source: 'user_measured' | 'user_estimated' | 'missing';
    };
    payload: {
      ratingLbs: number | null;
      usedLbs: number | null;
      marginLbs: number | null;
      status: CheckStatus;
      detail?: string;
      source: 'user_door_jamb_sticker' | 'manufacturer_brochure_baseline' | 'missing';
      isComplete: boolean;
      occupantCargoLbs?: number;
      tongueWeightLbs?: number | null;
      hitchHardwareLbs?: number;
    };
    gcwr: {
      ratingLbs: number | null;
      combinedWeightLbs: number | null;
      marginLbs: number | null;
      status: CheckStatus;
      detail?: string;
      source: 'manufacturer' | 'missing';
    };
  };
  missingInputsHelp: Array<{
    inputName: string;
    whyNeeded: string;
    howToFindOrMeasure: string;
  }>;
  explanation: string;
  warnings: string[];
  isEstimate: boolean;
  usedCustomPayload?: boolean;
  effectivePayloadLbs?: number | null;
  trailerBrakeRequirement?: string;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DatabaseError {
  code: string;
  message: string;
}

export type DbResult<T> = { data: T; error: null } | { data: null; error: DatabaseError };
