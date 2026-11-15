import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

function fetchPage(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:4321${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
      res.on('error', reject);
    });
  });
}

test('Monetization Gate: Public pages must not render ad slots or sponsored placements', async () => {
  const testPaths = [
    '/',
    '/vehicles/',
    '/vehicles/toyota/tacoma/2013/',
    '/vehicles/toyota/highlander/2022/',
    '/vehicles/ford/f-150/2025/',
    '/trailer-matcher/',
    '/compare/',
    '/guides/',
  ];

  const forbiddenTerms = [
    'Reserved Sponsor Placement',
    'ADVERTISEMENT — Reserved Sponsor Placement',
    'Recommended Compatible Towing Equipment',
    'Sponsored Link',
    'affiliate-card',
    'ad-slot-container',
  ];

  for (const path of testPaths) {
    const { status, body } = await fetchPage(path);
    assert.equal(status, 200, `Expected 200 for ${path}`);
    for (const term of forbiddenTerms) {
      assert.ok(
        !body.includes(term),
        `Public page ${path} must not contain forbidden monetization string: "${term}"`
      );
    }
  }
});
