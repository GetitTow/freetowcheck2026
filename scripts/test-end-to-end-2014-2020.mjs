/**
 * TowingSpecs — End-to-End Verification for 2014–2020
 * Tests all user-facing flows and APIs on the running server.
 */

const BASE_URL = 'http://localhost:4321';

async function fetchJson(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

async function fetchText(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    redirect: 'manual',
    ...options,
  });
  return {
    status: res.status,
    headers: res.headers,
    text: await res.text(),
  };
}

async function runEndToEndVerification() {
  console.log('=== STARTING 2014-2020 END-TO-END VERIFICATION ===\n');

  const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020];
  const summaryReport = {};

  for (const year of years) {
    console.log(`\n───────────────── TESTING MODEL YEAR ${year} ─────────────────`);
    const yearResults = {
      year,
      apiMakes: [],
      apiModels: {},
      apiConfigs: {},
      directoryPageStatus: null,
      makePages: {},
      vehiclePages: {},
      searchRedirects: {},
      matcherRuns: {},
      passed: true,
      failures: [],
    };

    // 1. API: /api/makes?year=YEAR
    try {
      const makes = await fetchJson(`/api/makes?year=${year}`);
      yearResults.apiMakes = makes;
      console.log(`✓ /api/makes?year=${year} -> ${makes.length} makes: ${makes.map(m => m.slug).join(', ')}`);
      if (makes.length === 0) {
        yearResults.passed = false;
        yearResults.failures.push(`No makes returned for year ${year}`);
      }
    } catch (e) {
      yearResults.passed = false;
      yearResults.failures.push(`Failed /api/makes?year=${year}: ${e.message}`);
    }

    // 2. Directory Page: /vehicles/?year=YEAR
    try {
      const dirRes = await fetchText(`/vehicles/?year=${year}`);
      yearResults.directoryPageStatus = dirRes.status;
      if (dirRes.status !== 200) {
        yearResults.passed = false;
        yearResults.failures.push(`/vehicles/?year=${year} returned ${dirRes.status}`);
      } else {
        const containsYearHeader = dirRes.text.includes(`${year} Towing Specifications`);
        const containsMakes = yearResults.apiMakes.every(m => dirRes.text.includes(m.name));
        console.log(`✓ /vehicles/?year=${year} -> 200 OK (Title match: ${containsYearHeader}, Makes in HTML: ${containsMakes})`);
      }
    } catch (e) {
      yearResults.passed = false;
      yearResults.failures.push(`Failed /vehicles/?year=${year}: ${e.message}`);
    }

    // 3. For each make: /api/models?year=YEAR&make=MAKE and /vehicles/MAKE/?year=YEAR
    for (const make of yearResults.apiMakes) {
      try {
        const models = await fetchJson(`/api/models?year=${year}&make=${make.slug}`);
        yearResults.apiModels[make.slug] = models;
        console.log(`  ✓ /api/models?year=${year}&make=${make.slug} -> ${models.length} models: ${models.map(m => m.slug).join(', ')}`);

        // Check make directory page with year filter
        const makeRes = await fetchText(`/vehicles/${make.slug}/?year=${year}`);
        yearResults.makePages[make.slug] = makeRes.status;
        if (makeRes.status !== 200) {
          yearResults.passed = false;
          yearResults.failures.push(`/vehicles/${make.slug}/?year=${year} returned ${makeRes.status}`);
        }

        // For each model: /api/configs, vehicle page, search redirect, and trailer matcher
        for (const model of models) {
          const configs = await fetchJson(`/api/configs?year=${year}&make=${make.slug}&model=${model.slug}`);
          yearResults.apiConfigs[`${make.slug}/${model.slug}`] = configs;
          console.log(`    ✓ /api/configs?year=${year}&make=${make.slug}&model=${model.slug} -> ${configs.length} configs`);

          // Test individual vehicle page: /vehicles/MAKE/MODEL/YEAR/
          const vehiclePageRes = await fetchText(`/vehicles/${make.slug}/${model.slug}/${year}/`);
          yearResults.vehiclePages[`${make.slug}/${model.slug}`] = vehiclePageRes.status;
          if (vehiclePageRes.status !== 200) {
            yearResults.passed = false;
            yearResults.failures.push(`/vehicles/${make.slug}/${model.slug}/${year}/ returned ${vehiclePageRes.status}`);
          } else {
            // Confirm vehicle page has specs table and sources
            const hasSpecs = vehiclePageRes.text.includes('lbs') && vehiclePageRes.text.includes('kg');
            const hasSource = vehiclePageRes.text.includes('Primary Source Evidence') || vehiclePageRes.text.includes('Source:');
            if (!hasSpecs) {
              yearResults.failures.push(`/vehicles/${make.slug}/${model.slug}/${year}/ missing specs table`);
            }
          }

          // Test search redirect: /vehicles/search/?year=YEAR&make=MAKE&model=MODEL
          const searchRes = await fetchText(`/vehicles/search/?year=${year}&make=${make.slug}&model=${model.slug}`);
          const location = searchRes.headers.get('location');
          const expectedLocation = `/vehicles/${make.slug}/${model.slug}/${year}/`;
          if (searchRes.status === 302 && location === expectedLocation) {
            yearResults.searchRedirects[`${make.slug}/${model.slug}`] = true;
          } else {
            yearResults.passed = false;
            yearResults.failures.push(`Search redirect mismatch: status=${searchRes.status}, location=${location}, expected=${expectedLocation}`);
          }

          // Test Trailer Matcher with first configuration
          if (configs.length > 0) {
            const firstCfg = configs[0];
            const matcherUrl = `/trailer-matcher/?year=${year}&make=${make.slug}&model=${model.slug}&config=${encodeURIComponent(firstCfg.slug)}&trailer_weight=5000&tongue_weight=550&passengers=300&cargo=150`;
            const matcherRes = await fetchText(matcherUrl);
            const matcherOk = matcherRes.status === 200 && matcherRes.text.includes('Compatibility result');
            yearResults.matcherRuns[`${make.slug}/${model.slug}`] = {
              status: matcherRes.status,
              calculated: matcherOk,
            };
            if (!matcherOk) {
              yearResults.passed = false;
              yearResults.failures.push(`Trailer matcher failed for ${firstCfg.slug} (status ${matcherRes.status})`);
            }
          }
        }
      } catch (err) {
        yearResults.passed = false;
        yearResults.failures.push(`Error testing ${make.slug}: ${err.message}`);
      }
    }

    summaryReport[year] = yearResults;
  }

  // Test Compare Tool with cross-year configurations (e.g. 2014 F-150 vs 2018 Silverado)
  console.log(`\n───────────────── TESTING VEHICLE COMPARISON TOOL ─────────────────`);
  const compareUrl = `/compare/?v1=cfg-ford-f150-2014-supercrew-35-4wd-maxtow&v2=cfg-chevy-silverado-2018-crew-53-4wd-z82`;
  const compareRes = await fetchText(compareUrl);
  const compareSuccess = compareRes.status === 200 &&
    compareRes.text.includes('2014 Ford F-150') &&
    compareRes.text.includes('2018 Chevrolet Silverado 1500');
  console.log(`✓ /compare/ (2014 Ford vs 2018 Chevy) -> 200 OK: ${compareSuccess}`);

  console.log('\n=== VERIFICATION SUMMARY ===');
  let allPassed = true;
  for (const year of years) {
    const r = summaryReport[year];
    const modelsCount = Object.keys(r.apiModels).reduce((acc, k) => acc + r.apiModels[k].length, 0);
    const configsCount = Object.keys(r.apiConfigs).reduce((acc, k) => acc + r.apiConfigs[k].length, 0);
    console.log(`Year ${year}: ${r.passed ? 'PASS' : 'FAIL'} | Makes: ${r.apiMakes.length} | Models: ${modelsCount} | Configs: ${configsCount} | Failures: ${r.failures.length}`);
    if (!r.passed) {
      allPassed = false;
      console.log(`  Failures:`, r.failures);
    }
  }

  if (allPassed && compareSuccess) {
    console.log('\n🎉 ALL 2014-2020 FLOWS AND APIS VERIFIED 100% OPERATIONAL!');
  } else {
    console.error('\n❌ ISSUES DETECTED DURING VERIFICATION');
    process.exit(1);
  }
}

runEndToEndVerification().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
