/**
 * GET /api/configs?year=2025&make=ford&model=f-150
 * Returns vehicle configurations for a given year/make/model combination.
 * Used by the trailer matcher cascading selector.
 */
import type { APIRoute } from 'astro';
import {
  getMakeBySlug,
  getModelBySlug,
  getModelYearByYear,
  getTrimsByModelYear,
  getConfigurationsByTrim,
} from '../../lib/db.ts';

export const GET: APIRoute = async ({ url }) => {
  const yearParam = url.searchParams.get('year');
  const makeSlug = url.searchParams.get('make');
  const modelSlug = url.searchParams.get('model');
  const year = yearParam ? parseInt(yearParam, 10) : null;

  if (!year || !makeSlug || !modelSlug) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: make } = await getMakeBySlug(makeSlug);
  if (!make) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const { data: model } = await getModelBySlug(make.id, modelSlug);
  if (!model) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const { data: modelYear } = await getModelYearByYear(model.id, year);
  if (!modelYear) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const { data: trims } = await getTrimsByModelYear(modelYear.id);
  const safeTrims = trims ?? [];

  const configs: { slug: string; name: string }[] = [];
  for (const trim of safeTrims) {
    const { data: configList } = await getConfigurationsByTrim(trim.id);
    for (const config of configList ?? []) {
      const parts = [trim.name];
      if (config.engine_description) parts.push(config.engine_description);
      if (config.drivetrain) parts.push(config.drivetrain);
      if (config.cab_style) parts.push(config.cab_style);
      if (config.has_tow_package) parts.push('w/ Tow Pkg');

      configs.push({
        slug: config.id,
        name: parts.join(' · '),
      });
    }
  }

  return new Response(JSON.stringify(configs), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
