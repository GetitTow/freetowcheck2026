/**
 * TowingSpecs — Automotive Specification & Input Validation
 *
 * Enforces strict physical sanity ranges, source evidence integrity,
 * and input validation across the platform.
 */

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a vehicle lookup parameter set.
 */
export function validateVehicleLookupParams(params: {
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (params.year !== undefined && params.year !== null) {
    const y = typeof params.year === 'string' ? parseInt(params.year, 10) : params.year;
    if (isNaN(y) || y < 1980 || y > 2030) {
      errors.push(`Invalid model year ${params.year}. Supported years are between 1980 and 2030.`);
    }
  }

  if (params.make) {
    if (!/^[a-z0-9-]+$/.test(params.make)) {
      errors.push(`Invalid make slug format: "${params.make}".`);
    }
  }

  if (params.model) {
    if (!/^[a-z0-9-]+$/.test(params.model)) {
      errors.push(`Invalid model slug format: "${params.model}".`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates trailer compatibility inputs.
 */
export function validateTrailerInputs(inputs: {
  trailerLoadedWeightLbs: number;
  trailerTongueWeightLbs?: number | null;
  passengerWeightLbs: number;
  cargoWeightLbs: number;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isNaN(inputs.trailerLoadedWeightLbs) || inputs.trailerLoadedWeightLbs <= 0) {
    errors.push('Trailer loaded weight must be a positive number greater than 0 lbs.');
  } else if (inputs.trailerLoadedWeightLbs > 40000) {
    warnings.push('Trailer weight exceeds 40,000 lbs. This exceeds standard non-commercial towing ranges.');
  }

  if (inputs.trailerTongueWeightLbs !== null && inputs.trailerTongueWeightLbs !== undefined) {
    if (isNaN(inputs.trailerTongueWeightLbs) || inputs.trailerTongueWeightLbs < 0) {
      errors.push('Tongue weight cannot be negative.');
    } else if (inputs.trailerTongueWeightLbs > inputs.trailerLoadedWeightLbs) {
      errors.push('Tongue weight cannot exceed the total loaded weight of the trailer.');
    }
  }

  if (inputs.passengerWeightLbs < 0 || inputs.cargoWeightLbs < 0) {
    errors.push('Passenger and cargo weights cannot be negative.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a towing specification record for physical plausibility.
 */
export function validateTowingSpecRecord(spec: {
  max_towing_capacity_lbs?: number | null;
  max_tongue_weight_lbs?: number | null;
  max_payload_lbs?: number | null;
  gcwr_lbs?: number | null;
  gvwr_lbs?: number | null;
  curb_weight_lbs?: number | null;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const tow = spec.max_towing_capacity_lbs;
  const tongue = spec.max_tongue_weight_lbs;
  const payload = spec.max_payload_lbs;
  const gcwr = spec.gcwr_lbs;
  const gvwr = spec.gvwr_lbs;
  const curb = spec.curb_weight_lbs;

  if (tow !== null && tow !== undefined) {
    if (tow < 500 || tow > 45000) {
      errors.push(`Towing capacity ${tow} lbs is outside plausible automotive range (500 to 45,000 lbs).`);
    }
  }

  if (tongue !== null && tongue !== undefined && tow !== null && tow !== undefined) {
    if (tongue > tow) {
      errors.push(`Tongue weight (${tongue} lbs) cannot exceed towing capacity (${tow} lbs).`);
    }
    const ratio = (tongue / tow) * 100;
    if (ratio < 5 || ratio > 25) {
      warnings.push(`Tongue weight to towing capacity ratio (${ratio.toFixed(1)}%) is unusual. Normal range is 10% to 15%.`);
    }
  }

  if (gvwr !== null && gvwr !== undefined && curb !== null && curb !== undefined) {
    if (curb >= gvwr) {
      errors.push(`Curb weight (${curb} lbs) must be strictly less than GVWR (${gvwr} lbs).`);
    }
    const derivedPayload = gvwr - curb;
    if (payload !== null && payload !== undefined && Math.abs(payload - derivedPayload) > 200) {
      warnings.push(`Stated payload (${payload} lbs) differs from GVWR - Curb Weight (${derivedPayload} lbs) by more than 200 lbs.`);
    }
  }

  if (gcwr !== null && gcwr !== undefined && tow !== null && tow !== undefined && curb !== null && curb !== undefined) {
    if (gcwr < curb + tow) {
      warnings.push(`GCWR (${gcwr} lbs) is less than base curb weight + max tow (${curb + tow} lbs). Max tow can only be reached with minimal vehicle payload.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates manufacturer source evidence.
 */
export function validateSourceEvidence(source: {
  source_url?: string | null;
  document_title?: string | null;
  publisher?: string | null;
  verification_date?: string | null;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!source.source_url || source.source_url.trim() === '') {
    errors.push('Supporting source URL is required.');
  } else {
    try {
      new URL(source.source_url);
    } catch {
      errors.push(`Invalid source URL format: "${source.source_url}".`);
    }
  }

  if (!source.document_title || source.document_title.trim().length < 3) {
    errors.push('Source document title must be provided with at least 3 characters.');
  }

  if (!source.publisher || source.publisher.trim().length < 2) {
    errors.push('Source publisher/manufacturer must be provided.');
  }

  if (!source.verification_date || !/^\d{4}-\d{2}-\d{2}$/.test(source.verification_date)) {
    errors.push('Verification date must be in YYYY-MM-DD format.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
