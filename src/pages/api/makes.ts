/**
 * GET /api/makes?year=2025
 * Returns makes available for a given year (for cascading selector).
 * Returns JSON: Array<{ slug: string; name: string }>
 */
import type { APIRoute } from 'astro';
import { getMakesForYear } from '../../lib/db.ts';

export const GET: APIRoute = async ({ url }) => {
  const yearParam = url.searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : null;

  if (!year || isNaN(year) || year < 1980 || year > 2030) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  const { data, error } = await getMakesForYear(year);

  if (error || !data) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = data.map((m) => ({ slug: m.slug, name: m.name }));

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
