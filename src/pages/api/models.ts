/**
 * GET /api/models?year=2025&make=ford
 * Returns models for a given year and make (for cascading selector).
 * Returns JSON: Array<{ slug: string; name: string }>
 */
import type { APIRoute } from 'astro';
import { getMakeBySlug, getModelsByMake, getModelYears } from '../../lib/db.ts';

export const GET: APIRoute = async ({ url }) => {
  const yearParam = url.searchParams.get('year');
  const makeSlug = url.searchParams.get('make');
  const year = yearParam ? parseInt(yearParam, 10) : null;

  if (!year || isNaN(year) || !makeSlug) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: make } = await getMakeBySlug(makeSlug);
  if (!make) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: models } = await getModelsByMake(make.id);
  if (!models || models.length === 0) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Filter to models that have a published year entry for the requested year
  const modelsWithYear: { slug: string; name: string }[] = [];
  for (const model of models) {
    const { data: years } = await getModelYears(model.id);
    if (years && years.some((my) => my.year === year)) {
      modelsWithYear.push({ slug: model.slug, name: model.name });
    }
  }

  return new Response(JSON.stringify(modelsWithYear), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
