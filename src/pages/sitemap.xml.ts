/**
 * GET /sitemap.xml — Dynamic XML sitemap
 */
import type { APIRoute } from 'astro';
import { getMakes, getModelsByMake, getModelYears, getTrimsByModelYear } from '../lib/db.ts';

const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://towingspecs.com';

const staticPages = [
  { url: '/', priority: '1.0', changefreq: 'weekly' },
  { url: '/vehicles/', priority: '0.9', changefreq: 'daily' },
  { url: '/trailer-matcher/', priority: '0.8', changefreq: 'monthly' },
  { url: '/compare/', priority: '0.8', changefreq: 'monthly' },
  { url: '/coverage/', priority: '0.8', changefreq: 'weekly' },
  { url: '/guides/', priority: '0.8', changefreq: 'weekly' },
  { url: '/guides/towing-capacity-explained/', priority: '0.7', changefreq: 'monthly' },
  { url: '/guides/tongue-weight/', priority: '0.7', changefreq: 'monthly' },
  { url: '/guides/payload-capacity/', priority: '0.7', changefreq: 'monthly' },
  { url: '/guides/gcwr/', priority: '0.7', changefreq: 'monthly' },
  { url: '/guides/factory-tow-package/', priority: '0.6', changefreq: 'monthly' },
  { url: '/guides/hitch-classes/', priority: '0.6', changefreq: 'monthly' },
  { url: '/methodology/', priority: '0.5', changefreq: 'monthly' },
  { url: '/about/', priority: '0.4', changefreq: 'monthly' },
  { url: '/contact/', priority: '0.4', changefreq: 'monthly' },
  { url: '/privacy/', priority: '0.3', changefreq: 'monthly' },
  { url: '/terms/', priority: '0.3', changefreq: 'monthly' },
];

export const GET: APIRoute = async () => {
  // Dynamic vehicle pages
  const vehiclePages: { url: string; priority: string; changefreq: string }[] = [];

  try {
    const { data: makes } = await getMakes();
    for (const make of makes ?? []) {
      vehiclePages.push({ url: `/vehicles/${make.slug}/`, priority: '0.8', changefreq: 'weekly' });
      const { data: models } = await getModelsByMake(make.id);
      for (const model of models ?? []) {
        vehiclePages.push({ url: `/vehicles/${make.slug}/${model.slug}/`, priority: '0.7', changefreq: 'weekly' });
        const { data: years } = await getModelYears(model.id);
        for (const my of years ?? []) {
          vehiclePages.push({
            url: `/vehicles/${make.slug}/${model.slug}/${my.year}/`,
            priority: '0.9',
            changefreq: 'monthly',
          });
          const { data: trims } = await getTrimsByModelYear(my.id);
          for (const trim of trims ?? []) {
            vehiclePages.push({
              url: `/vehicles/${make.slug}/${model.slug}/${my.year}/${trim.slug}/`,
              priority: '0.8',
              changefreq: 'monthly',
            });
          }
        }
      }
    }
  } catch {
    // If DB error occurs, static pages will still be returned
  }

  const allPages = [...staticPages, ...vehiclePages];
  const lastmod = new Date().toISOString().split('T')[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (p) => `  <url>
    <loc>${siteUrl}${p.url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
