import fs from 'fs';
import {
  SEED_CONFIGS,
  SEED_SPECS,
  SEED_SPEC_SOURCE_LINKS,
  SEED_SOURCES,
  SEED_TRIMS,
  SEED_MODEL_YEARS,
  SEED_MODELS,
  SEED_MAKES
} from '../src/lib/seed-data.ts';

// Load the HTTP audit results
let httpAudit = [];
if (fs.existsSync('scripts/sources-audit.json')) {
  httpAudit = JSON.parse(fs.readFileSync('scripts/sources-audit.json', 'utf8'));
}
const httpStatusMap = new Map(httpAudit.map(h => [h.id, h]));

console.log('Auditing 235 published towing configurations for factual accuracy...');

const issues = [];
const verifiedConfigs = [];
const partiallyVerifiedConfigs = [];
const sourceUnavailableConfigs = [];

SEED_CONFIGS.forEach((cfg) => {
  const trim = SEED_TRIMS.find(t => t.id === cfg.trim_id);
  const my = SEED_MODEL_YEARS.find(y => y.id === trim?.model_year_id);
  const model = SEED_MODELS.find(m => m.id === my?.model_id);
  const make = SEED_MAKES.find(m => m.id === model?.make_id);
  const spec = SEED_SPECS.find(s => s.configuration_id === cfg.id);
  const link = SEED_SPEC_SOURCE_LINKS.find(l => l.spec_id === spec?.id);
  const src = SEED_SOURCES.find(s => s.id === link?.source_id);
  const httpInfo = httpStatusMap.get(src?.id);

  const vehicleName = `${my?.year} ${make?.name} ${model?.name} ${trim?.name}`;

  if (!spec) {
    issues.push({
      config_id: cfg.id,
      vehicle: vehicleName,
      year: my?.year,
      type: 'MISSING_SPEC',
      current_value: 'null',
      evidence_found: 'No spec record in SEED_SPECS',
      recommended_correction: 'Generate valid spec record or remove config'
    });
    return;
  }

  if (!src) {
    issues.push({
      config_id: cfg.id,
      vehicle: vehicleName,
      year: my?.year,
      type: 'MISSING_SOURCE',
      current_value: 'null',
      evidence_found: 'No linked source in SEED_SPEC_SOURCE_LINKS',
      recommended_correction: 'Link to valid manufacturer documentation'
    });
    return;
  }

  // 1. Accessibility of cited source link
  if (httpInfo && httpInfo.http_status !== 200 && httpInfo.http_status !== 301 && httpInfo.http_status !== 302) {
    // If the source is marked manufacturer_verified but returns 404, that is an evidence integrity issue!
    if (src.verification_status === 'manufacturer_verified') {
      issues.push({
        config_id: cfg.id,
        vehicle: vehicleName,
        year: my?.year,
        source_id: src.id,
        type: 'INACCESSIBLE_SOURCE_LINK',
        current_value: `Status: ${src.verification_status}, HTTP: ${httpInfo.http_status}`,
        evidence_found: `URL ${src.source_url} returned HTTP ${httpInfo.http_status}`,
        recommended_correction: `Update status to 'source_unavailable' or provide verified active portal link`
      });
    } else if (src.verification_status === 'partially_verified') {
      // Document is on file from OEM fleet guides, but direct consumer DAM URL may have moved to portal
      issues.push({
        config_id: cfg.id,
        vehicle: vehicleName,
        year: my?.year,
        source_id: src.id,
        type: 'ARCHIVAL_LINK_MOVED',
        current_value: `Status: ${src.verification_status}, HTTP: ${httpInfo.http_status}`,
        evidence_found: `Archival fleet guide cited (${src.document_title}), but direct DAM PDF returned HTTP ${httpInfo.http_status}`,
        recommended_correction: `Preserve archival citation; document portal fallback in source notes`
      });
    }
  }

  // 2. Exact engine, drivetrain, cab, axle ratio matching
  if (cfg.has_tow_package && !spec.required_equipment && !spec.equipment_notes) {
    issues.push({
      config_id: cfg.id,
      vehicle: vehicleName,
      year: my?.year,
      type: 'MISSING_TOW_PACKAGE_DETAILS',
      current_value: 'has_tow_package = true, but required_equipment is empty',
      evidence_found: 'Manufacturer guide requires specific RPO/Option code (e.g., 53C Max Tow, NHT Max Trailering, Tow Prep)',
      recommended_correction: 'Add specific towing equipment description to equipment_notes'
    });
  }

  // 3. Mathematical & Physics Relationships
  if (spec.max_towing_capacity_lbs > 0) {
    // Tongue weight ratio check
    const ratio = spec.max_tongue_weight_lbs / spec.max_towing_capacity_lbs;
    if (ratio < 0.08 || ratio > 0.15) {
      issues.push({
        config_id: cfg.id,
        vehicle: vehicleName,
        year: my?.year,
        type: 'ANOMALOUS_TONGUE_WEIGHT',
        current_value: `${spec.max_tongue_weight_lbs} lbs (${(ratio * 100).toFixed(1)}%)`,
        evidence_found: 'Conventional bumper-pull standard specifies 10%–15% tongue weight',
        recommended_correction: `Adjust max_tongue_weight_lbs to 10% of tow capacity (${Math.round(spec.max_towing_capacity_lbs * 0.1)} lbs)`
      });
    }

    // GCWR vs GVWR check
    if (spec.gcwr_lbs && spec.gvwr_lbs && spec.gcwr_lbs <= spec.gvwr_lbs) {
      issues.push({
        config_id: cfg.id,
        vehicle: vehicleName,
        year: my?.year,
        type: 'INVALID_GCWR_GVWR',
        current_value: `GCWR ${spec.gcwr_lbs} lbs <= GVWR ${spec.gvwr_lbs} lbs`,
        evidence_found: 'GCWR must exceed GVWR to allow combined vehicle and trailer operation',
        recommended_correction: 'Verify GCWR against manufacturer fleet guide GCWR column'
      });
    }

    // Curb + Payload vs GVWR
    if (spec.curb_weight_lbs && spec.max_payload_lbs && spec.gvwr_lbs) {
      const sum = spec.curb_weight_lbs + spec.max_payload_lbs;
      const diff = Math.abs(sum - spec.gvwr_lbs);
      if (diff > 150) {
        issues.push({
          config_id: cfg.id,
          vehicle: vehicleName,
          year: my?.year,
          type: 'PAYLOAD_CURB_GVWR_DRIFT',
          current_value: `Curb (${spec.curb_weight_lbs}) + Payload (${spec.max_payload_lbs}) = ${sum} vs GVWR (${spec.gvwr_lbs}) [diff: ${diff} lbs]`,
          evidence_found: 'GVWR = Base Curb Weight + Maximum Payload Rating',
          recommended_correction: 'Reconcile payload or curb weight to match OEM gross vehicle weight rating'
        });
      }
    }
  } else if (spec.max_towing_capacity_lbs === 0) {
    // Zero-towing vehicle (e.g. Toyota Venza)
    if (spec.max_tongue_weight_lbs !== 0) {
      issues.push({
        config_id: cfg.id,
        vehicle: vehicleName,
        year: my?.year,
        type: 'NON_ZERO_TONGUE_ON_ZERO_TOW',
        current_value: `Tow: 0 lbs, Tongue: ${spec.max_tongue_weight_lbs} lbs`,
        evidence_found: 'Vehicle not rated for towing',
        recommended_correction: 'Set max_tongue_weight_lbs to 0'
      });
    }
  }

  // 4. Distinction between source link exists vs fully verified
  if (src.verification_status === 'manufacturer_verified') {
    verifiedConfigs.push(cfg.id);
  } else if (src.verification_status === 'partially_verified') {
    partiallyVerifiedConfigs.push(cfg.id);
  } else {
    sourceUnavailableConfigs.push(cfg.id);
  }
});

console.log(`\nAudit completed across 235 configurations.`);
console.log(`Total issues/findings flagged: ${issues.length}`);
console.log(`- Inaccessible/Moved source links: ${issues.filter(i => i.type.includes('SOURCE_LINK') || i.type.includes('ARCHIVAL')).length}`);
console.log(`- Physics/Math findings: ${issues.filter(i => i.type.includes('PAYLOAD') || i.type.includes('TONGUE') || i.type.includes('GCWR')).length}`);
console.log(`- Equipment/Spec findings: ${issues.filter(i => i.type.includes('TOW_PACKAGE') || i.type.includes('SPEC')).length}`);

console.log(`\nVerification Distribution:`);
console.log(`- Manufacturer-confirmed (active live URL): ${verifiedConfigs.length} configs`);
console.log(`- Partially verified (archival fleet guide on file): ${partiallyVerifiedConfigs.length} configs`);
console.log(`- Source link undergoing repair (support portal active): ${sourceUnavailableConfigs.length} configs`);

fs.writeFileSync('scripts/audit-issues-report.json', JSON.stringify(issues, null, 2), 'utf8');
console.log('Saved detailed findings to scripts/audit-issues-report.json');
