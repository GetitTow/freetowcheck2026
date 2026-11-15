#!/usr/bin/env node
/**
 * TowingSpecs — NHTSA vPIC Vehicle Identification & Candidate Discovery Pipeline
 *
 * Official US Department of Transportation NHTSA vPIC API Client
 * Endpoint: https://vpic.nhtsa.dot.gov/api/
 *
 * Usage:
 *   node scripts/fetch-nhtsa-models.mjs <make> <year>
 *   node scripts/fetch-nhtsa-models.mjs toyota 2013
 *   node scripts/fetch-nhtsa-models.mjs ford 2013
 *
 * Purpose:
 *   Discovers official vehicle makes, models, and identification attributes
 *   submitted by vehicle manufacturers to the US government.
 *   Note: NHTSA vPIC provides vehicle identification, not towing limits.
 *   Towing ratings must be corroborated by official manufacturer guides.
 */

const args = process.argv.slice(2);
const makeArg = args[0] || 'toyota';
const yearArg = args[1] || '2013';

console.log(`\n============================================================`);
console.log(`TowingSpecs — NHTSA vPIC Model Discovery Pipeline`);
console.log(`Querying: Make = ${makeArg.toUpperCase()}, Year = ${yearArg}`);
console.log(`Endpoint: https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/...`);
console.log(`============================================================\n`);

async function fetchNHTSAModels(make, year) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${encodeURIComponent(year)}?format=json`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TowingSpecs-Automotive-Pipeline/1.0 (Automotive Reference Platform; contact@towingspecs.com)'
      }
    });

    if (!res.ok) {
      throw new Error(`NHTSA vPIC responded with HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    console.log(`Total Models Registered with NHTSA for ${year} ${make.toUpperCase()}: ${json.Count}\n`);

    const models = (json.Results || []).map(r => ({
      make_id: r.Make_ID,
      make_name: r.Make_Name,
      model_id: r.Model_ID,
      model_name: r.Model_Name,
      slug: r.Model_Name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    })).sort((a, b) => a.model_name.localeCompare(b.model_name));

    console.log(`Registered Models List:`);
    models.forEach((m, idx) => {
      console.log(`  ${String(idx + 1).padStart(2, ' ')}. ${m.model_name.padEnd(25, ' ')} (ID: ${m.model_id}, Slug: ${m.slug})`);
    });

    return models;
  } catch (err) {
    console.error(`Failed to fetch from NHTSA vPIC:`, err.message);
    process.exit(1);
  }
}

fetchNHTSAModels(makeArg, yearArg);
