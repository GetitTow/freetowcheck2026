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

const years = [
  2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
  2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026
];

const sourceMap = new Map(SEED_SOURCES.map(s => [s.id, s]));
const specMap = new Map(SEED_SPECS.map(s => [s.id, s]));
const configMap = new Map(SEED_CONFIGS.map(c => [c.id, c]));
const trimMap = new Map(SEED_TRIMS.map(t => [t.id, t]));
const myMap = new Map(SEED_MODEL_YEARS.map(m => [m.id, m]));
const modelMap = new Map(SEED_MODELS.map(m => [m.id, m]));
const makeMap = new Map(SEED_MAKES.map(m => [m.id, m]));

const specToSourceMap = new Map();
SEED_SPEC_SOURCE_LINKS.forEach(l => {
  specToSourceMap.set(l.spec_id, l.source_id);
});

const report = [];

years.forEach(year => {
  // Published model years for this year
  const publishedMYs = SEED_MODEL_YEARS.filter(my => my.year === year && my.is_published);
  const myIds = new Set(publishedMYs.map(my => my.id));
  
  // Trims for this year
  const trimsForYear = SEED_TRIMS.filter(t => myIds.has(t.model_year_id));
  const trimIds = new Set(trimsForYear.map(t => t.id));
  
  // Configs for this year
  const configsForYear = SEED_CONFIGS.filter(c => trimIds.has(c.trim_id));
  const configIds = new Set(configsForYear.map(c => c.id));
  
  // Specs for this year
  const specsForYear = SEED_SPECS.filter(s => configIds.has(s.configuration_id));
  
  // Distinct Models
  const modelIds = new Set(publishedMYs.map(my => my.model_id));
  const distinctModelsCount = modelIds.size;
  
  // Distinct Makes
  const makeIds = new Set();
  modelIds.forEach(mid => {
    const m = modelMap.get(mid);
    if (m) makeIds.add(m.make_id);
  });
  const distinctMakesCount = makeIds.size;
  
  // Verification Breakdown
  let manufacturerConfirmed = 0;
  let requiresRepairOrReview = 0;
  
  configsForYear.forEach(cfg => {
    const spec = specsForYear.find(s => s.configuration_id === cfg.id);
    if (spec) {
      const srcId = specToSourceMap.get(spec.id);
      const src = sourceMap.get(srcId);
      if (src) {
        if (src.verification_status === 'manufacturer_verified') {
          manufacturerConfirmed++;
        } else {
          requiresRepairOrReview++;
        }
      } else {
        requiresRepairOrReview++;
      }
    } else {
      requiresRepairOrReview++;
    }
  });

  report.push({
    year,
    makes: distinctMakesCount,
    models: distinctModelsCount,
    configs: configsForYear.length,
    specs: specsForYear.length,
    manufacturerConfirmed,
    requiresRepairOrReview,
    status: configsForYear.length > 0 ? 'Data available' : 'Research in progress'
  });
});

console.table(report);
fs.writeFileSync('scripts/year-by-year-audit.json', JSON.stringify(report, null, 2), 'utf8');
