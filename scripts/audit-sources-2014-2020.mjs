import {
  SEED_SOURCES,
  SEED_SPEC_SOURCE_LINKS,
  SEED_SPECS,
  SEED_CONFIGS,
  SEED_TRIMS,
  SEED_MODEL_YEARS
} from '../src/lib/seed-data.ts';

const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020];
const myIds = new Set(SEED_MODEL_YEARS.filter(my => years.includes(my.year)).map(my => my.id));
const trimIds = new Set(SEED_TRIMS.filter(t => myIds.has(t.model_year_id)).map(t => t.id));
const cfgIds = new Set(SEED_CONFIGS.filter(c => trimIds.has(c.trim_id)).map(c => c.id));
const specIds = new Set(SEED_SPECS.filter(s => cfgIds.has(s.configuration_id)).map(s => s.id));
const sourceIds = new Set(SEED_SPEC_SOURCE_LINKS.filter(l => specIds.has(l.spec_id)).map(l => l.source_id));
const sources = SEED_SOURCES.filter(s => sourceIds.has(s.id));

console.log(`Total 2014-2020 sources: ${sources.length}`);

for (const s of sources) {
  console.log(`ID: ${s.id}`);
  console.log(`  Title: ${s.document_title}`);
  console.log(`  Publisher: ${s.publisher} (${s.publication_year})`);
  console.log(`  Status: ${s.verification_status}`);
  console.log(`  URL: ${s.source_url}`);
  console.log(`  Section: ${s.section || 'N/A'} (Page ${s.page_number || 'N/A'})`);
  console.log(`  Notes: ${s.notes?.slice(0, 100)}...`);
  console.log('');
}
