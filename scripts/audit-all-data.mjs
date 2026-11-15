import {
  SEED_MAKES,
  SEED_MODELS,
  SEED_MODEL_YEARS,
  SEED_TRIMS,
  SEED_CONFIGS,
  SEED_SPECS,
  SEED_SOURCES,
  SEED_SPEC_SOURCE_LINKS,
} from '../src/lib/seed-data.ts';

console.log('================================================================');
console.log('       TowingSpecs — Complete Dataset Engineering Audit         ');
console.log('================================================================\n');

const issues = [];
let totalConfigs = 0;

for (const cfg of SEED_CONFIGS) {
  totalConfigs++;
  const trim = SEED_TRIMS.find((t) => t.id === cfg.trim_id);
  const my = SEED_MODEL_YEARS.find((y) => y.id === trim?.model_year_id);
  const model = SEED_MODELS.find((m) => m.id === my?.model_id);
  const make = SEED_MAKES.find((m) => m.id === model?.make_id);
  const spec = SEED_SPECS.find((s) => s.configuration_id === cfg.id);
  const specLinks = SEED_SPEC_SOURCE_LINKS.filter((l) => l.spec_id === spec?.id);
  const srcList = SEED_SOURCES.filter((s) => specLinks.some((l) => l.source_id === s.id));

  const vName = `${my?.year} ${make?.name} ${model?.name} (${trim?.name})`;

  if (!spec) {
    issues.push(`MISSING SPEC: ${vName} (${cfg.id})`);
    continue;
  }

  // Check tongue weight ratio
  if (spec.max_tongue_weight_lbs && spec.max_towing_capacity_lbs) {
    const ratio = spec.max_tongue_weight_lbs / spec.max_towing_capacity_lbs;
    if (ratio < 0.08 || ratio > 0.20) {
      issues.push(`TONGUE RATIO UNUSUAL (${(ratio * 100).toFixed(1)}%): ${vName} - Tow: ${spec.max_towing_capacity_lbs}, Tongue: ${spec.max_tongue_weight_lbs}`);
    }
  }

  // Check GCWR vs Curb + Tow
  if (spec.gcwr_lbs && spec.curb_weight_lbs && spec.max_towing_capacity_lbs) {
    if (spec.gcwr_lbs < spec.curb_weight_lbs + spec.max_towing_capacity_lbs - 500) {
      issues.push(`GCWR < CURB + TOW: ${vName} - GCWR: ${spec.gcwr_lbs}, Curb: ${spec.curb_weight_lbs}, Tow: ${spec.max_towing_capacity_lbs}`);
    }
  }

  // Check source association
  if (srcList.length === 0) {
    issues.push(`NO SOURCE: ${vName}`);
  }

  console.log(`[${my?.year}] ${make?.slug}/${model?.slug} | ${trim?.slug} | Tow: ${spec.max_towing_capacity_lbs} lbs | Tongue: ${spec.max_tongue_weight_lbs} lbs | Payload: ${spec.max_payload_lbs} lbs | GCWR: ${spec.gcwr_lbs} lbs | Status: ${srcList[0]?.verification_status}`);
}

console.log('\n================================================================');
console.log(`Audited ${totalConfigs} configurations.`);
if (issues.length === 0) {
  console.log('✓ All configurations passed physics and relationship audits.');
} else {
  console.log(`Found ${issues.length} potential issues:`);
  issues.forEach((iss) => console.log('  ⚠', iss));
}
console.log('================================================================\n');
