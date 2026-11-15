/**
 * TowingSpecs — Automotive Towing Calculation Engine
 *
 * Evaluates conventional towing setups against vehicle manufacturer published ratings:
 * 1. Maximum Conventional Towing Capacity (GTW)
 * 2. Hitch Tongue Weight Limit (TWR)
 * 3. Vehicle Payload Capacity (GVWR margin)
 * 4. Gross Combined Weight Rating (GCWR)
 *
 * SAFETY INTEGRITY PRINCIPLES:
 * - Refusal-First: Never return a PASS ('within_all_limits') when any required constraint
 *   (towing capacity, tongue weight rating, vehicle payload, or GCWR) is unverified or missing.
 * - Non-Zero Tongue Assumption: Never silently treat an unknown tongue weight as zero.
 *   If tongue weight is omitted, payload compliance cannot be confirmed.
 * - Hardware Accounting: Support hitch hardware weight (shank, head, spring bars) in payload
 *   and gross combined weight calculations without guessing or inventing unverified numbers.
 * - Clear Constraint States: Each check explicitly reports pass, fail, or unverified.
 *
 * NOTE ON SAE J2807 STANDARDIZATION:
 * Vehicle manufacturers certify their maximum vehicle ratings under rigorous physical testing
 * defined by the SAE J2807 standard (including thermal cooling, climb performance, launch,
 * braking, and hitch durability). TowingSpecs performs mathematical verification comparing
 * user-specified trailer and load weights against those certified manufacturer limits.
 * TowingSpecs does not conduct or claim dynamic vehicle certification under SAE J2807.
 */
import type {
  TowingSpec,
  TrailerCompatibilityInput,
  CompatibilityResult,
  CompatibilityResultStatus,
  CheckStatus,
} from './types.ts';

export function calculateTrailerCompatibility(
  spec: TowingSpec,
  input: TrailerCompatibilityInput
): CompatibilityResult {
  const warnings: string[] = [];
  const missingInputsHelp: Array<{
    inputName: string;
    whyNeeded: string;
    howToFindOrMeasure: string;
  }> = [];

  const margins = {
    towingCapacityMarginLbs: null as number | null,
    payloadMarginLbs: null as number | null,
    tongueWeightMarginLbs: null as number | null,
    gcwrMarginLbs: null as number | null,
  };

  // --- Input validation: Guard against negative, zero, non-finite, or absurd values ---
  const hasValidHitchHardware =
    input.hitchHardwareWeightLbs === null ||
    input.hitchHardwareWeightLbs === undefined ||
    (Number.isFinite(input.hitchHardwareWeightLbs) && input.hitchHardwareWeightLbs >= 0);

  if (
    !Number.isFinite(input.trailerLoadedWeightLbs) ||
    input.trailerLoadedWeightLbs <= 0 ||
    !Number.isFinite(input.passengerWeightLbs) ||
    input.passengerWeightLbs < 0 ||
    !Number.isFinite(input.cargoWeightLbs) ||
    input.cargoWeightLbs < 0 ||
    !hasValidHitchHardware ||
    (input.trailerTongueWeightLbs !== null &&
      input.trailerTongueWeightLbs !== undefined &&
      (!Number.isFinite(input.trailerTongueWeightLbs) ||
        input.trailerTongueWeightLbs < 0 ||
        input.trailerTongueWeightLbs > input.trailerLoadedWeightLbs))
  ) {
    return {
      status: 'insufficient_data',
      outcomeType: 'cannot_determine',
      outcomeHeadline: 'Cannot determine — missing critical information',
      controllingConstraint: 'Input validation error',
      margins,
      breakdown: {
        towing: {
          ratingLbs: spec.max_towing_capacity_lbs,
          loadLbs: Number.isFinite(input.trailerLoadedWeightLbs) ? input.trailerLoadedWeightLbs : 0,
          marginLbs: null,
          status: 'unverified',
          detail: 'Calculation aborted due to invalid or non-finite weight input values.',
          source: 'manufacturer',
        },
        tongueWeight: {
          ratingLbs: spec.max_tongue_weight_lbs,
          loadLbs: input.trailerTongueWeightLbs ?? null,
          marginLbs: null,
          status: 'unverified',
          detail: 'Calculation aborted due to invalid or non-finite weight input values.',
          source: 'missing',
        },
        payload: {
          ratingLbs: spec.max_payload_lbs,
          usedLbs: null,
          marginLbs: null,
          status: 'unverified',
          detail: 'Calculation aborted due to invalid or non-finite weight input values.',
          source: 'missing',
          isComplete: false,
          occupantCargoLbs: 0,
          tongueWeightLbs: null,
          hitchHardwareLbs: 0,
        },
        gcwr: {
          ratingLbs: spec.gcwr_lbs,
          combinedWeightLbs: null,
          marginLbs: null,
          status: 'unverified',
          detail: 'Calculation aborted due to invalid or non-finite weight input values.',
          source: 'manufacturer',
        },
      },
      missingInputsHelp: [
        {
          inputName: 'Valid Weight Values',
          whyNeeded: 'All weights must be positive, finite numbers to perform mechanical load verification.',
          howToFindOrMeasure: 'Check your trailer weight ticket from a certified truck scale (CAT scale) or RV weigh station.',
        },
      ],
      explanation:
        'Calculation cannot proceed due to invalid input values. Weight values must be finite, non-negative numbers, trailer loaded weight must be greater than zero, and tongue weight cannot exceed total trailer weight.',
      warnings: ['Invalid input: negative, zero, non-finite, or physically impossible weight values provided.'],
      isEstimate: true,
    };
  }

  const violations: { constraint: string; message: string; status: CompatibilityResultStatus }[] = [];

  // Parse hitch hardware weight (default to 0 if not entered by user)
  const hitchHardwareLbs =
    typeof input.hitchHardwareWeightLbs === 'number' &&
    Number.isFinite(input.hitchHardwareWeightLbs) &&
    input.hitchHardwareWeightLbs > 0
      ? input.hitchHardwareWeightLbs
      : 0;

  if (hitchHardwareLbs > 0) {
    warnings.push(`Hitch hardware weight of ${hitchHardwareLbs.toLocaleString()} lbs is included in payload and gross combined weight calculations.`);
  }

  // --- 1. Towing capacity check (including zero-towing vehicles) ---
  let towingCheckStatus: CheckStatus = 'unverified';
  let towingCheckDetail = '';

  if (spec.max_towing_capacity_lbs !== null && spec.max_towing_capacity_lbs !== undefined) {
    margins.towingCapacityMarginLbs = spec.max_towing_capacity_lbs - input.trailerLoadedWeightLbs;
    if (spec.max_towing_capacity_lbs === 0) {
      towingCheckStatus = 'fail';
      towingCheckDetail = 'Trailer towing is NOT recommended by vehicle manufacturer.';
      violations.push({
        constraint: 'Manufacturer policy: Towing not recommended',
        status: 'exceeds_towing_capacity',
        message: `Trailer towing is NOT recommended by the vehicle manufacturer for this vehicle configuration. The vehicle is not engineered or approved for trailer loads.`,
      });
    } else if (margins.towingCapacityMarginLbs < 0) {
      towingCheckStatus = 'fail';
      towingCheckDetail = `Trailer loaded weight (${input.trailerLoadedWeightLbs.toLocaleString()} lbs) exceeds maximum towing capacity (${spec.max_towing_capacity_lbs.toLocaleString()} lbs) by ${Math.abs(margins.towingCapacityMarginLbs).toLocaleString()} lbs.`;
      violations.push({
        constraint: 'Maximum towing capacity',
        status: 'exceeds_towing_capacity',
        message: `The trailer's loaded weight of ${input.trailerLoadedWeightLbs.toLocaleString()} lbs exceeds the vehicle's maximum towing capacity of ${spec.max_towing_capacity_lbs.toLocaleString()} lbs by ${Math.abs(margins.towingCapacityMarginLbs).toLocaleString()} lbs.`,
      });
    } else {
      towingCheckStatus = 'pass';
      towingCheckDetail = `Trailer loaded weight is within maximum towing capacity (${margins.towingCapacityMarginLbs.toLocaleString()} lbs margin).`;
      if (margins.towingCapacityMarginLbs < 500) {
        warnings.push(
          'Trailer weight is within 500 lbs of the maximum rated towing capacity. This leaves very little margin for weight distribution errors or added cargo.'
        );
      }
    }
  } else {
    towingCheckStatus = 'unverified';
    towingCheckDetail = 'Towing capacity rating is unavailable in the manufacturer specification record.';
    warnings.push('Towing capacity data is unavailable for this configuration. Cannot confirm this setup is within limits.');
    missingInputsHelp.push({
      inputName: 'Manufacturer Towing Capacity',
      whyNeeded: 'The vehicle manufacturer maximum conventional tow rating is required to confirm physical pulling capability.',
      howToFindOrMeasure: 'Consult your vehicle owner manual under the "Driving Information — Trailer Towing" section.',
    });
  }

  // --- 2. Tongue weight check ---
  const hasTongueWeight =
    input.trailerTongueWeightLbs !== null &&
    input.trailerTongueWeightLbs !== undefined;

  let tongueCheckStatus: CheckStatus = 'unverified';
  let tongueCheckDetail = '';

  if (hasTongueWeight) {
    if (spec.max_tongue_weight_lbs !== null && spec.max_tongue_weight_lbs !== undefined) {
      margins.tongueWeightMarginLbs = spec.max_tongue_weight_lbs - input.trailerTongueWeightLbs!;
      if (margins.tongueWeightMarginLbs < 0) {
        tongueCheckStatus = 'fail';
        tongueCheckDetail = `Trailer tongue weight (${input.trailerTongueWeightLbs!.toLocaleString()} lbs) exceeds rated hitch receiver limit (${spec.max_tongue_weight_lbs.toLocaleString()} lbs) by ${Math.abs(margins.tongueWeightMarginLbs).toLocaleString()} lbs.`;
        violations.push({
          constraint: 'Maximum hitch receiver tongue weight',
          status: 'exceeds_tongue_weight',
          message: `The tongue weight of ${input.trailerTongueWeightLbs!.toLocaleString()} lbs exceeds the vehicle's rated tongue weight limit of ${spec.max_tongue_weight_lbs.toLocaleString()} lbs by ${Math.abs(margins.tongueWeightMarginLbs).toLocaleString()} lbs.`,
        });
      } else {
        tongueCheckStatus = 'pass';
        tongueCheckDetail = `Trailer tongue weight is within rated hitch receiver limit (${margins.tongueWeightMarginLbs.toLocaleString()} lbs margin).`;
      }
    } else {
      // Vehicle receiver rating is missing from specification
      tongueCheckStatus = 'unverified';
      tongueCheckDetail = 'Vehicle hitch receiver tongue weight rating is unavailable in the specification record.';
      warnings.push('Maximum hitch receiver tongue weight rating is unavailable for this vehicle configuration. Cannot confirm receiver load capacity.');
      missingInputsHelp.push({
        inputName: 'Vehicle Receiver Tongue Weight Limit',
        whyNeeded: 'The vehicle hitch receiver maximum tongue load rating is required to confirm the hitch structure is not overloaded.',
        howToFindOrMeasure: 'Check the safety certification sticker on your vehicle hitch receiver or review the owner manual under Trailer Towing specifications.',
      });
    }

    // Tongue weight ratio check (10% - 15% general conventional-trailer guidance)
    const tonguePct = (input.trailerTongueWeightLbs! / input.trailerLoadedWeightLbs) * 100;
    if (tonguePct < 10) {
      warnings.push(
        `Calculated tongue weight is only ${tonguePct.toFixed(1)}% of trailer weight. General conventional bumper-pull guidance recommends 10% to 15% to mitigate trailer sway (boat trailers, utility trailers, or gooseneck/5th-wheels follow different manufacturer guidelines).`
      );
    } else if (tonguePct > 15) {
      warnings.push(
        `Calculated tongue weight is ${tonguePct.toFixed(1)}% of trailer weight. General conventional trailer guidance targets 10% to 15%; exceeding 15% places excessive strain on the vehicle's rear axle and hitch receiver, which may overload vehicle payload or lift the front steering axle.`
      );
    }
  } else {
    tongueCheckStatus = 'unverified';
    tongueCheckDetail = 'Trailer tongue weight was not provided. Measured tongue weight is required to verify hitch receiver and vehicle payload limits.';
    warnings.push('Tongue weight was not provided. Tongue weight and payload limits are separate critical constraints that must be measured and verified.');
    missingInputsHelp.push({
      inputName: 'Trailer Tongue Weight',
      whyNeeded: 'Tongue weight (the downward force on the hitch ball) transfers directly onto your vehicle and consumes payload capacity. Without tongue weight, vehicle payload compliance cannot be verified.',
      howToFindOrMeasure: 'Use a portable trailer tongue weight scale at the trailer coupler, or weigh your vehicle at a certified CAT scale before and after hitching the trailer. Conventional travel trailers typically transfer 10%–15% of total loaded trailer weight to the tongue.',
    });
  }

  // --- 3. Payload check ---
  const occupantAndCargoWeight = input.passengerWeightLbs + input.cargoWeightLbs + hitchHardwareLbs;

  // Check if user entered their vehicle's exact driver door-jamb sticker payload
  const useCustomPayload =
    typeof input.customPayloadLbs === 'number' &&
    Number.isFinite(input.customPayloadLbs) &&
    input.customPayloadLbs > 0;

  const effectivePayloadLbs = useCustomPayload
    ? input.customPayloadLbs!
    : (spec.max_payload_lbs ?? null);

  if (!useCustomPayload) {
    missingInputsHelp.push({
      inputName: 'Driver B-Pillar Door-Jamb Payload',
      whyNeeded: 'Factory-installed options (sunroof, skid plates, audio systems, power running boards) reduce your vehicle\'s actual payload capacity below base brochure figures.',
      howToFindOrMeasure: 'Open the driver\'s door and locate the yellow and white "Tire and Loading Information" placard on the B-pillar jamb. Find the exact sentence: "The combined weight of occupants and cargo should never exceed XXXX lbs."',
    });
  }

  let payloadCheckStatus: CheckStatus = 'unverified';
  let payloadCheckDetail = '';
  let totalPayloadUsed: number | null = null;
  let isPayloadComplete = false;

  if (hasTongueWeight) {
    totalPayloadUsed = occupantAndCargoWeight + input.trailerTongueWeightLbs!;
    if (effectivePayloadLbs !== null && effectivePayloadLbs !== undefined) {
      margins.payloadMarginLbs = effectivePayloadLbs - totalPayloadUsed;
      isPayloadComplete = true;

      if (margins.payloadMarginLbs < 0) {
        payloadCheckStatus = 'fail';
        payloadCheckDetail = `Combined vehicle load (${totalPayloadUsed.toLocaleString()} lbs) exceeds payload capacity (${effectivePayloadLbs.toLocaleString()} lbs) by ${Math.abs(margins.payloadMarginLbs).toLocaleString()} lbs.`;
        violations.push({
          constraint: useCustomPayload
            ? 'Actual door-jamb payload limit'
            : 'Vehicle payload capacity',
          status: 'exceeds_payload',
          message: `The combined weight of passengers (${input.passengerWeightLbs.toLocaleString()} lbs), cargo (${input.cargoWeightLbs.toLocaleString()} lbs)${hitchHardwareLbs > 0 ? `, hitch hardware (${hitchHardwareLbs.toLocaleString()} lbs)` : ''}, and tongue weight (${input.trailerTongueWeightLbs!.toLocaleString()} lbs) totals ${totalPayloadUsed.toLocaleString()} lbs, which exceeds the ${useCustomPayload ? 'door-jamb sticker payload limit' : "vehicle's payload rating"} of ${effectivePayloadLbs.toLocaleString()} lbs by ${Math.abs(margins.payloadMarginLbs).toLocaleString()} lbs.`,
        });
      } else {
        payloadCheckStatus = 'pass';
        payloadCheckDetail = `Combined vehicle load is within payload capacity (${margins.payloadMarginLbs.toLocaleString()} lbs margin).`;
      }
    } else {
      payloadCheckStatus = 'unverified';
      payloadCheckDetail = 'Vehicle payload rating is unavailable in the specification record.';
      warnings.push('Payload capacity data is unavailable. Payload is a critical constraint independent of towing capacity.');
      missingInputsHelp.push({
        inputName: 'Vehicle Payload Rating',
        whyNeeded: 'Payload limit governs the maximum weight your vehicle\'s springs, frame, and axles can safely support.',
        howToFindOrMeasure: 'Look at the Tire and Loading Information placard on your driver-side door jamb.',
      });
    }
  } else {
    // Tongue weight is NOT provided. Never silently assume zero tongue weight!
    isPayloadComplete = false;
    totalPayloadUsed = occupantAndCargoWeight;

    // Check if passengers and cargo alone exceed the payload limit
    if (effectivePayloadLbs !== null && effectivePayloadLbs !== undefined && occupantAndCargoWeight > effectivePayloadLbs) {
      margins.payloadMarginLbs = effectivePayloadLbs - occupantAndCargoWeight;
      payloadCheckStatus = 'fail';
      payloadCheckDetail = `Passenger, cargo, and hardware weight alone (${occupantAndCargoWeight.toLocaleString()} lbs) exceeds vehicle payload capacity (${effectivePayloadLbs.toLocaleString()} lbs) before attaching a trailer.`;
      violations.push({
        constraint: 'Occupant and cargo payload limit',
        status: 'exceeds_payload',
        message: `Passenger and cargo weight alone exceeds the vehicle's payload capacity of ${effectivePayloadLbs.toLocaleString()} lbs by ${(occupantAndCargoWeight - effectivePayloadLbs).toLocaleString()} lbs (${occupantAndCargoWeight.toLocaleString()} lbs load), before even attaching trailer tongue weight.`,
      });
    } else {
      // Passengers and cargo alone do not exceed, but total payload CANNOT be confirmed without tongue weight
      margins.payloadMarginLbs = null;
      payloadCheckStatus = 'unverified';
      payloadCheckDetail = 'Payload compliance cannot be verified without trailer tongue weight. Tongue weight rests directly on the vehicle hitch and consumes payload capacity.';
      warnings.push('Vehicle payload compliance cannot be verified because trailer tongue weight was not provided. Tongue load directly consumes vehicle payload capacity.');
      if (effectivePayloadLbs === null || effectivePayloadLbs === undefined) {
        warnings.push('Payload capacity data is unavailable. Payload is a critical constraint independent of towing capacity.');
        missingInputsHelp.push({
          inputName: 'Vehicle Payload Rating',
          whyNeeded: 'Payload limit governs the maximum weight your vehicle\'s springs, frame, and axles can safely support.',
          howToFindOrMeasure: 'Look at the Tire and Loading Information placard on your driver-side door jamb.',
        });
      }
    }
  }

  // --- 4. GCWR check ---
  let combinedWeight: number | null = null;
  let gcwrCheckStatus: CheckStatus = 'unverified';
  let gcwrCheckDetail = '';

  if (
    spec.gcwr_lbs !== null &&
    spec.gcwr_lbs !== undefined &&
    spec.curb_weight_lbs !== null &&
    spec.curb_weight_lbs !== undefined
  ) {
    combinedWeight =
      spec.curb_weight_lbs + occupantAndCargoWeight + input.trailerLoadedWeightLbs;
    margins.gcwrMarginLbs = spec.gcwr_lbs - combinedWeight;
    if (margins.gcwrMarginLbs < 0) {
      gcwrCheckStatus = 'fail';
      gcwrCheckDetail = `Combined vehicle and trailer weight (${combinedWeight.toLocaleString()} lbs) exceeds GCWR (${spec.gcwr_lbs.toLocaleString()} lbs) by ${Math.abs(margins.gcwrMarginLbs).toLocaleString()} lbs.`;
      violations.push({
        constraint: 'Gross Combined Weight Rating (GCWR)',
        status: 'exceeds_gcwr',
        message: `The combined weight of ${combinedWeight.toLocaleString()} lbs exceeds the vehicle's GCWR of ${spec.gcwr_lbs.toLocaleString()} lbs by ${Math.abs(margins.gcwrMarginLbs).toLocaleString()} lbs.`,
      });
    } else {
      gcwrCheckStatus = 'pass';
      gcwrCheckDetail = `Combined vehicle and trailer weight is within GCWR (${margins.gcwrMarginLbs.toLocaleString()} lbs margin).`;
    }
  } else {
    gcwrCheckStatus = 'unverified';
    gcwrCheckDetail = 'GCWR or base vehicle curb weight is unavailable in the specification record.';
    warnings.push('GCWR (Gross Combined Weight Rating) is unavailable for this configuration.');
    missingInputsHelp.push({
      inputName: 'Manufacturer GCWR Rating',
      whyNeeded: 'Gross Combined Weight Rating governs the maximum combined weight of the fully loaded vehicle and trailer together.',
      howToFindOrMeasure: 'Consult your vehicle owner manual or manufacturer fleet towing guide under Trailer Towing specifications.',
    });
  }

  // --- Add equipment notes if applicable ---
  if (spec.equipment_notes) {
    warnings.push(`Equipment requirement: ${spec.equipment_notes}`);
  }

  // --- Tongue weight estimate disclaimer ---
  if (input.isTongueWeightEstimated) {
    warnings.push('Tongue weight is labeled as an estimate (percentage-based). Actual loaded trailer tongue weight should be verified with a certified scale.');
  }

  // --- Jurisdictional & OEM Trailer Brake Guidance ---
  let trailerBrakeRequirement: string | undefined = undefined;
  if (input.trailerLoadedWeightLbs > 1500) {
    trailerBrakeRequirement = 'Trailer Brakes Required: Most vehicle manufacturers mandate auxiliary trailer brakes for loads over 1,000–1,500 lbs. Legal thresholds also vary across US state jurisdictions (from 1,500 lbs in ID/NH to 3,000 lbs in CA/TX). Verify both vehicle manufacturer guidelines and your state DOT requirements.';
    warnings.push(trailerBrakeRequirement);
  }

  // --- Breakdown generation with explicit status and details ---
  const breakdown: CompatibilityResult['breakdown'] = {
    towing: {
      ratingLbs: spec.max_towing_capacity_lbs,
      loadLbs: input.trailerLoadedWeightLbs,
      marginLbs: margins.towingCapacityMarginLbs,
      status: towingCheckStatus,
      detail: towingCheckDetail,
      source: 'manufacturer',
    },
    tongueWeight: {
      ratingLbs: spec.max_tongue_weight_lbs,
      loadLbs: input.trailerTongueWeightLbs ?? null,
      marginLbs: margins.tongueWeightMarginLbs,
      status: tongueCheckStatus,
      detail: tongueCheckDetail,
      source: hasTongueWeight ? (input.isTongueWeightEstimated ? 'user_estimated' : 'user_measured') : 'missing',
    },
    payload: {
      ratingLbs: effectivePayloadLbs,
      usedLbs: totalPayloadUsed,
      marginLbs: margins.payloadMarginLbs,
      status: payloadCheckStatus,
      detail: payloadCheckDetail,
      source: useCustomPayload
        ? 'user_door_jamb_sticker'
        : (spec.max_payload_lbs !== null ? 'manufacturer_brochure_baseline' : 'missing'),
      isComplete: isPayloadComplete,
      occupantCargoLbs: occupantAndCargoWeight,
      tongueWeightLbs: input.trailerTongueWeightLbs ?? null,
      hitchHardwareLbs,
    },
    gcwr: {
      ratingLbs: spec.gcwr_lbs,
      combinedWeightLbs: combinedWeight,
      marginLbs: margins.gcwrMarginLbs,
      status: gcwrCheckStatus,
      detail: gcwrCheckDetail,
      source: 'manufacturer',
    },
  };

  // --- Evaluate violations ---
  if (violations.length > 1) {
    return {
      status: 'multiple_violations',
      outcomeType: 'exceeds_limits',
      outcomeHeadline: 'Exceeds specified limits (Multiple Overloads)',
      controllingConstraint: violations.map((v) => v.constraint).join(', '),
      margins,
      breakdown,
      missingInputsHelp,
      explanation: `Multiple manufacturer limits exceeded: ${violations.map((v) => v.message).join(' ')}`,
      warnings,
      isEstimate: false,
      usedCustomPayload: useCustomPayload,
      effectivePayloadLbs,
      trailerBrakeRequirement,
    };
  }

  if (violations.length === 1) {
    return {
      status: violations[0].status,
      outcomeType: 'exceeds_limits',
      outcomeHeadline: 'Exceeds a specified limit',
      controllingConstraint: violations[0].constraint,
      margins,
      breakdown,
      missingInputsHelp,
      explanation: violations[0].message,
      warnings,
      isEstimate: false,
      usedCustomPayload: useCustomPayload,
      effectivePayloadLbs,
      trailerBrakeRequirement,
    };
  }

  // --- All evaluated constraints passed without violation, but check for unverified constraints ---
  // SAFETY LAW: NEVER RETURN AN OVERALL PASS ('within_all_limits') WHEN ANY REQUIRED CONSTRAINT IS UNVERIFIED OR MISSING.
  const hasUnverifiedCheck =
    spec.max_towing_capacity_lbs === null ||
    spec.max_towing_capacity_lbs === undefined ||
    spec.max_tongue_weight_lbs === null ||
    spec.max_tongue_weight_lbs === undefined ||
    spec.max_payload_lbs === null ||
    spec.max_payload_lbs === undefined ||
    spec.gcwr_lbs === null ||
    spec.gcwr_lbs === undefined ||
    spec.curb_weight_lbs === null ||
    spec.curb_weight_lbs === undefined ||
    !hasTongueWeight;

  if (hasUnverifiedCheck) {
    warnings.push('Some critical ratings could not be evaluated due to missing data. This result is a partial assessment only and cannot guarantee safe operation.');
  }

  // Determine the most restrictive constraint margin
  let controllingConstraint = 'Towing capacity';
  let smallestMargin = margins.towingCapacityMarginLbs ?? Infinity;

  if (margins.payloadMarginLbs !== null && margins.payloadMarginLbs < smallestMargin) {
    smallestMargin = margins.payloadMarginLbs;
    controllingConstraint = 'Payload capacity';
  }
  if (margins.tongueWeightMarginLbs !== null && margins.tongueWeightMarginLbs < smallestMargin) {
    smallestMargin = margins.tongueWeightMarginLbs;
    controllingConstraint = 'Tongue weight';
  }
  if (margins.gcwrMarginLbs !== null && margins.gcwrMarginLbs < smallestMargin) {
    smallestMargin = margins.gcwrMarginLbs;
    controllingConstraint = 'GCWR';
  }

  const outcomeType = hasUnverifiedCheck ? 'cannot_determine' : 'within_limits';
  const outcomeHeadline = hasUnverifiedCheck
    ? 'Cannot determine — missing critical information'
    : 'Within the supplied limits';

  return {
    status: hasUnverifiedCheck ? 'insufficient_data' : 'within_all_limits',
    outcomeType,
    outcomeHeadline,
    controllingConstraint: smallestMargin === Infinity ? null : controllingConstraint,
    margins,
    breakdown,
    missingInputsHelp,
    explanation: hasUnverifiedCheck
      ? 'Based on available data, evaluated limits were not exceeded. However, missing constraint data (such as measured tongue weight, hitch receiver limit, or vehicle payload) prevents an unconditional safe determination. All safety limits must be verified before towing.'
      : `This setup is within all verified manufacturer limits. The controlling constraint is ${controllingConstraint.toLowerCase()}, with a margin of ${(smallestMargin === Infinity ? 0 : smallestMargin).toLocaleString()} lbs remaining.`,
    warnings,
    isEstimate: hasUnverifiedCheck,
    usedCustomPayload: useCustomPayload,
    effectivePayloadLbs,
    trailerBrakeRequirement,
  };
}
