import http from 'http';

const routes = [
  '/',
  '/vehicles/',
  '/vehicles/toyota/',
  '/vehicles/toyota/tacoma/',
  '/vehicles/toyota/tacoma/2013/',
  '/vehicles/toyota/tundra/2013/',
  '/vehicles/toyota/4runner/2013/',
  '/vehicles/toyota/highlander/2013/',
  '/vehicles/toyota/highlander/2022/',
  '/vehicles/toyota/grand-highlander/2024/',
  '/vehicles/toyota/land-cruiser/2024/',
  '/vehicles/ford/',
  '/vehicles/ford/f-150/',
  '/vehicles/ford/f-150/2013/',
  '/vehicles/ford/f-150/2025/',
  '/vehicles/ford/f-150/2025/xlt/',
  '/trailer-matcher/',
  '/trailer-matcher/?make=toyota&model=tacoma&year=2013&config=cfg-tacoma-2013-doublecab-v6-4wd&trailer_weight=5000&tongue_weight=500&passengers=300&cargo=150',
  '/trailer-matcher/?make=ford&model=f-150&year=2025&config=cfg-f150-xlt-35-4wd-maxtow&trailer_weight=8000&tongue_weight=960&passengers=300&cargo=200',
  '/compare/',
  '/compare/?v1=cfg-tacoma-2013-doublecab-v6-4wd&v2=cfg-f150-xlt-35-4wd-maxtow',
  '/compare/?v1=cfg-tundra-2013-crewmax-57-4wd&v2=cfg-silv-2013-ltz-53-4wd&v3=cfg-ram-2013-laramie-57-4wd',
  '/coverage/',
  '/api/db-status',
  '/vehicles/toyota/venza/2024/',
  '/vehicles/toyota/crown-signia/2025/',
  '/vehicles/subaru/outback/2024/',
  '/vehicles/honda/pilot/2024/',
  '/vehicles/jeep/wrangler/2024/',
  '/vehicles/nissan/frontier/2024/',
  // 2014-2020 Newly Expanded Routes
  '/vehicles/ford/f-150/2014/',
  '/vehicles/chevrolet/silverado-1500/2015/',
  '/vehicles/gmc/sierra-1500/2015/',
  '/vehicles/ram/1500/2016/',
  '/vehicles/toyota/tacoma/2017/',
  '/vehicles/toyota/tundra/2018/',
  '/vehicles/chevrolet/tahoe/2018/',
  '/vehicles/ford/explorer/2017/',
  '/vehicles/toyota/4runner/2016/',
  '/vehicles/toyota/highlander/2018/',
  '/vehicles/honda/pilot/2016/',
  '/vehicles/nissan/frontier/2016/',
  '/vehicles/ram/1500/2019/',
  '/vehicles/ford/f-150/2020/',
  '/vehicles/toyota/4runner/2020/',
  // 2010, 2011, 2012, 2023 Expansion Routes
  '/vehicles/ford/f-150/2010/',
  '/vehicles/chevrolet/silverado-1500/2010/',
  '/vehicles/toyota/tacoma/2011/',
  '/vehicles/chevrolet/tahoe/2011/',
  '/vehicles/ford/f-150/2012/',
  '/vehicles/toyota/tundra/2012/',
  '/vehicles/toyota/sequoia/2023/',
  '/vehicles/ford/f-150/2023/',
  '/vehicles/honda/pilot/2023/',
  '/vehicles/ram/1500/2023/',
  '/guides/',
  '/guides/towing-capacity-explained/',
  '/guides/payload-capacity/',
  '/guides/tongue-weight/',
  '/guides/gcwr/',
  '/guides/factory-tow-package/',
  '/guides/hitch-classes/',
  '/methodology/',
  '/about/',
  '/contact/',
  '/privacy/',
  '/terms/',
  '/affiliate-disclosure/',
  '/api/makes?year=2013',
  '/api/models?year=2013&make=toyota',
  '/api/configs?year=2013&make=toyota&model=tacoma',
  '/sitemap.xml',
  '/robots.txt',
  '/vehicles/nonexistent-make/'
];

async function checkRoute(path) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:4321${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          contentLength: data.length,
          hasH1: /<h1[^>]*>/i.test(data),
          hasCanonical: /rel="canonical"/i.test(data) || /<link[^>]+rel=['"]canonical['"]/i.test(data),
          hasJsonLd: /type="application\/ld\+json"/i.test(data)
        });
      });
    });
    req.on('error', (err) => {
      resolve({ path, statusCode: 'ERROR', error: err.message });
    });
  });
}

console.log('Testing TowingSpecs Routes against http://localhost:4321...');
const results = [];
for (const route of routes) {
  const r = await checkRoute(route);
  results.push(r);
  console.log(`[${r.statusCode}] ${r.path} (${r.contentLength ?? 0} bytes)`);
}

const errors = results.filter(r => r.statusCode !== 200 && r.statusCode !== 404);
console.log(`\nVerified ${results.length} routes. Unhandled errors: ${errors.length}`);
if (errors.length > 0) {
  console.error('Failing routes:', errors);
  process.exit(1);
}
