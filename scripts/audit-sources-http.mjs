import fs from 'fs';
import { SEED_SOURCES } from '../src/lib/seed-data.ts';

async function checkUrl(source) {
  let status = 'UNKNOWN';
  let error = null;
  let finalUrl = source.source_url;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(source.source_url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml,application/pdf;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);
    status = res.status;
    finalUrl = res.url;
  } catch (err) {
    status = 'FETCH_ERROR';
    error = err.message;
  }
  return {
    id: source.id,
    url: source.source_url,
    title: source.document_title,
    publisher: source.publisher,
    recorded_status: source.verification_status,
    http_status: status,
    final_url: finalUrl,
    error
  };
}

async function run() {
  console.log(`Checking ${SEED_SOURCES.length} sources concurrently...`);
  const concurrency = 10;
  const results = [];
  
  for (let i = 0; i < SEED_SOURCES.length; i += concurrency) {
    const batch = SEED_SOURCES.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(s => checkUrl(s)));
    results.push(...batchResults);
    process.stdout.write(`Checked ${results.length}/${SEED_SOURCES.length}\r`);
  }
  console.log(`\nDone checking all sources.`);
  
  const statusSummary = {};
  results.forEach(r => {
    statusSummary[r.http_status] = (statusSummary[r.http_status] || 0) + 1;
  });
  console.log('HTTP Status Breakdown:', statusSummary);
  
  fs.writeFileSync('scripts/sources-audit.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('Wrote scripts/sources-audit.json');
}

run();
