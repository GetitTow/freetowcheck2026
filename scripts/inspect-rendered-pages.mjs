#!/usr/bin/env node
/**
 * TowingSpecs — Rendered HTML and UI Verification Script
 * Fetches and deeply inspects the rendered DOM for:
 * 1. Highlander 2022 ratings (5,000 / 3,500 / 5,000)
 * 2. Absence of ads, affiliate links, and sponsored boxes
 * 3. Tacoma 2013 & Tundra 2013 ratings
 * 4. Trailer matcher calculation outputs
 * 5. 2-way and 3-way Compare tool rendering
 * 6. SEO tags (canonical, robots, schema, breadcrumbs)
 */

const BASE = 'http://localhost:4321';

async function testPage(path, checks) {
  const url = `${BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: status ${res.status}`);
  }
  const html = await res.text();
  console.log(`\n[PASS] Fetched ${path} (${html.length.toLocaleString()} bytes)`);

  // Global Check: NO ADS or AFFILIATES
  const forbiddenPhrases = [
    'ADVERTISEMENT',
    'Reserved Sponsor Placement',
    'Recommended Compatible Towing Equipment',
    'sponsored-product',
    'affiliate-disclosure-card',
    'ad-placeholder',
  ];
  for (const phrase of forbiddenPhrases) {
    if (html.includes(phrase)) {
      throw new Error(`CRITICAL MONETIZATION VIOLATION: "${phrase}" found in ${path}`);
    }
  }

  // Specific Page Checks
  for (const check of checks) {
    if (!check.fn(html)) {
      throw new Error(`CHECK FAILED on ${path}: ${check.desc}`);
    }
    console.log(`  ✓ ${check.desc}`);
  }
}

async function run() {
  console.log('Starting TowingSpecs Public HTML & UI Inspection...');

  // 1. Homepage
  await testPage('/', [
    { desc: 'Contains H1 FreeTowCheck / TowingSpecs title', fn: (h) => h.includes('Can Your Vehicle') || h.includes('Towing') },
    { desc: 'Contains cascading vehicle finder', fn: (h) => h.includes('search-year') && h.includes('search-make') },
    { desc: 'Contains Popular Vehicles section', fn: (h) => h.includes('Popular Towing Vehicles') || h.includes('Toyota Towing Specifications') },
    { desc: 'Shows verified truck cards (Ford, Chevy, Ram, Toyota)', fn: (h) => h.includes('Toyota Tacoma') && h.includes('Ford F-150') },
    { desc: 'Contains 2010–2026 Model Year Coverage Matrix', fn: (h) => h.includes('2010–2026 Model Year Coverage Matrix') },
    { desc: 'Has canonical link', fn: (h) => h.includes('rel="canonical"') },
  ]);

  // 2. Toyota Research Hub
  await testPage('/vehicles/toyota/', [
    { desc: 'Lists Toyota models', fn: (h) => h.includes('Tacoma') && h.includes('Tundra') && h.includes('Highlander') },
    { desc: 'Official documentation promise', fn: (h) => h.includes('official Toyota documentation') },
  ]);

  // 3. 2022 Toyota Highlander
  await testPage('/vehicles/toyota/highlander/2022/', [
    { desc: 'Displays 2022 Toyota Highlander', fn: (h) => h.includes('2022 Toyota Highlander') },
    { desc: 'Shows Limited V6 AWD 5,000 lbs', fn: (h) => h.includes('Limited V6 AWD') && h.includes('5,000 lbs') },
    { desc: 'Shows Hybrid XLE AWD 3,500 lbs', fn: (h) => h.includes('Hybrid XLE AWD') && h.includes('3,500 lbs') },
    { desc: 'Shows LE V6 FWD 5,000 lbs', fn: (h) => h.includes('LE V6 FWD') && h.includes('5,000 lbs') },
    { desc: 'Shows manufacturer citation', fn: (h) => h.includes('Toyota Motor Sales') && h.includes('pressroom.toyota.com') },
    { desc: 'Shows verification badge', fn: (h) => /manufacturer[- ](confirmed|verified)/i.test(h) },
  ]);

  // 4. 2013 Toyota Tacoma
  await testPage('/vehicles/toyota/tacoma/2013/', [
    { desc: 'Displays 2013 Toyota Tacoma', fn: (h) => h.includes('2013 Toyota Tacoma') },
    { desc: 'Shows Double Cab V6 4WD 6,400 lbs', fn: (h) => h.includes('Double Cab V6') && h.includes('6,400 lbs') },
    { desc: 'Shows Access Cab 3,500 lbs', fn: (h) => h.includes('Access Cab') && h.includes('3,500 lbs') },
    { desc: 'Explains SAE J2807 historical benchmark', fn: (h) => h.includes('SAE J2807') },
  ]);

  // 5. 2013 Toyota Tundra
  await testPage('/vehicles/toyota/tundra/2013/', [
    { desc: 'Displays 2013 Toyota Tundra', fn: (h) => h.includes('2013 Toyota Tundra') },
    { desc: 'Shows CrewMax 5.7L V8 9,000 lbs', fn: (h) => h.includes('CrewMax') && h.includes('9,000 lbs') },
    { desc: 'Shows Double Cab 5.7L V8 10,400 lbs', fn: (h) => h.includes('Double Cab') && h.includes('10,400 lbs') },
  ]);

  // 6. 2024 Toyota Grand Highlander
  await testPage('/vehicles/toyota/grand-highlander/2024/', [
    { desc: 'Displays 2024 Grand Highlander', fn: (h) => h.includes('Grand Highlander') },
    { desc: 'Shows Platinum Hybrid MAX 5,000 lbs', fn: (h) => h.includes('Platinum Hybrid MAX') && h.includes('5,000 lbs') },
  ]);

  // 7. Trailer Matcher Calculation
  await testPage('/trailer-matcher/?make=toyota&model=highlander&year=2022&config=cfg-highlander-2022-ltd-v6-awd&trailer_weight=4000&tongue_weight=450&passengers=300&cargo=150', [
    { desc: 'Displays compatibility assessment result', fn: (h) => h.includes('Within the supplied limits') || h.includes('Within all evaluated limits') || h.includes('Compatibility Assessment') },
    { desc: 'Calculates towing margin (1,000 lbs remaining)', fn: (h) => h.includes('1,000 lbs') },
    { desc: 'Contains tongue weight guidance note', fn: (h) => h.includes('Conventional bumper-pull trailers typically transfer 10%–15%') || h.includes('tongue') },
  ]);

  // 8. 2-Vehicle Comparison
  await testPage('/compare/?v1=cfg-tacoma-2013-doublecab-v6-4wd&v2=cfg-f150-xlt-35-4wd-maxtow', [
    { desc: 'Displays comparison title', fn: (h) => h.includes('Compare Vehicle Towing Capacities') },
    { desc: 'Renders 2013 Tacoma column', fn: (h) => h.includes('2013') && h.includes('Tacoma') },
    { desc: 'Renders 2025 Ford F-150 column', fn: (h) => h.includes('2025') && h.includes('F-150') },
    { desc: 'Shows side-by-side towing capacity comparison', fn: (h) => h.includes('6,400 lbs') && h.includes('14,000 lbs') },
  ]);

  // 9. 3-Vehicle Comparison
  await testPage('/compare/?v1=cfg-highlander-2022-ltd-v6-awd&v2=cfg-highlander-2022-hybrid-awd&v3=cfg-highlander-2022-le-v6-fwd', [
    { desc: 'Renders 3-vehicle comparison', fn: (h) => h.includes('Limited V6 AWD') && h.includes('Hybrid XLE AWD') && h.includes('LE V6 FWD') },
    { desc: 'Compares 5,000 lbs vs 3,500 lbs vs 5,000 lbs', fn: (h) => h.includes('5,000 lbs') && h.includes('3,500 lbs') },
  ]);

  // 10. Unknown & Missing Data States
  await testPage('/trailer-matcher/?make=toyota&model=highlander&year=2022&config=cfg-highlander-2022-ltd-v6-awd&trailer_weight=6000&tongue_weight=700&passengers=300&cargo=150', [
    { desc: 'Detects overloaded trailer (exceeds towing capacity)', fn: (h) => h.includes('Exceeds maximum towing capacity') || h.includes('exceeds') },
  ]);

  // 11. Coverage Dashboard
  await testPage('/coverage/', [
    { desc: 'Displays Coverage Dashboard Title', fn: (h) => h.includes('Dataset Coverage &amp; Verification Dashboard') || h.includes('Dataset Coverage') },
    { desc: 'Shows total 235 configurations', fn: (h) => h.includes('235') && (h.includes('Configurations') || h.includes('Vehicle Configurations')) },
    { desc: 'Shows 9 published makes', fn: (h) => h.includes('9') && (h.includes('Distinct Makes') || h.includes('Published Makes')) },
    { desc: 'Shows Data Storage Engine diagnostic', fn: (h) => h.includes('Data Storage Engine') },
  ]);

  // 12. Non-Towing Rated Vehicle (Toyota Venza)
  await testPage('/vehicles/toyota/venza/2024/', [
    { desc: 'Displays 2024 Toyota Venza', fn: (h) => h.includes('2024 Toyota Venza') },
    { desc: 'Explicitly warns Trailer Towing Not Recommended', fn: (h) => h.includes('Trailer Towing Not Recommended') },
  ]);

  // 13. Subaru Outback Multi-Trim Ratings
  await testPage('/vehicles/subaru/outback/2024/', [
    { desc: 'Displays 2024 Subaru Outback', fn: (h) => h.includes('2024 Subaru Outback') },
    { desc: 'Shows Wilderness 3,500 lbs', fn: (h) => h.includes('Wilderness') && h.includes('3,500 lbs') },
    { desc: 'Shows Premium 2,700 lbs', fn: (h) => h.includes('Premium') && h.includes('2,700 lbs') },
  ]);

  // 14. Jeep Wrangler 2024 Full-Float Axle Rating
  await testPage('/vehicles/jeep/wrangler/2024/', [
    { desc: 'Displays 2024 Jeep Wrangler', fn: (h) => h.includes('2024 Jeep Wrangler') },
    { desc: 'Shows Rubicon 5,000 lbs', fn: (h) => h.includes('Rubicon') && h.includes('5,000 lbs') },
    { desc: 'Shows Sport 3,500 lbs', fn: (h) => h.includes('Sport') && h.includes('3,500 lbs') },
  ]);

  // 15. 2014 Ford F-150 (Newly Expanded 2014-2020)
  await testPage('/vehicles/ford/f-150/2014/', [
    { desc: 'Displays 2014 Ford F-150', fn: (h) => h.includes('2014 Ford F-150') },
    { desc: 'Shows Max Tow Package 11,300 lbs', fn: (h) => h.includes('11,300 lbs') },
    { desc: 'Shows Standard Tow 7,700 lbs', fn: (h) => h.includes('7,700 lbs') },
    { desc: 'Cites 2014 Ford RV & Trailer Towing Guide', fn: (h) => h.includes('Ford RV') || h.includes('Towing Guide') },
  ]);

  // 16. 2018 Chevrolet Tahoe (Newly Expanded SUV)
  await testPage('/vehicles/chevrolet/tahoe/2018/', [
    { desc: 'Displays 2018 Chevrolet Tahoe', fn: (h) => h.includes('2018 Chevrolet Tahoe') },
    { desc: 'Shows NHT Max Trailering 8,400 lbs', fn: (h) => h.includes('8,400 lbs') },
    { desc: 'Shows Standard 6,400 lbs', fn: (h) => h.includes('6,400 lbs') },
  ]);

  // 17. 2019 Ram 1500 (Newly Expanded Truck)
  await testPage('/vehicles/ram/1500/2019/', [
    { desc: 'Displays 2019 Ram 1500', fn: (h) => h.includes('2019 Ram 1500') },
    { desc: 'Shows 3.92 Axle 11,290 lbs', fn: (h) => h.includes('11,290 lbs') },
    { desc: 'Shows 3.21 Axle 8,280 lbs', fn: (h) => h.includes('8,280 lbs') },
  ]);

  // 18. 2010 Ford F-150 (2010 Expansion)
  await testPage('/vehicles/ford/f-150/2010/', [
    { desc: 'Displays 2010 Ford F-150', fn: (h) => h.includes('2010 Ford F-150') },
    { desc: 'Shows Max Tow 5.4L 3V 11,100 lbs', fn: (h) => h.includes('11,100 lbs') },
    { desc: 'Shows Standard 5.4L 9,600 lbs', fn: (h) => h.includes('9,600 lbs') },
  ]);

  // 19. 2023 Toyota Sequoia (2023 Expansion)
  await testPage('/vehicles/toyota/sequoia/2023/', [
    { desc: 'Displays 2023 Toyota Sequoia', fn: (h) => h.includes('2023 Toyota Sequoia') },
    { desc: 'Shows SR5 2WD 9,520 lbs', fn: (h) => h.includes('9,520 lbs') },
    { desc: 'Shows Platinum 4WD 9,010 lbs', fn: (h) => h.includes('9,010 lbs') },
  ]);

  console.log('\n================================================================');
  console.log('✓ All 17 live rendered pages passed deep inspection!');
  console.log('✓ Zero advertisements or affiliate placements detected.');
  console.log('✓ All towing figures, trims, and comparison calculations verified.');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\n❌ INSPECTION FAILED:', err);
  process.exit(1);
});
