/**
 * TowingSpecs — Database Access Module
 *
 * All database access is centralized here.
 * Supports Supabase with automatic, transparent fallback to verified
 * in-memory seed data when Supabase credentials are not configured or available.
 *
 * Server-side only: never import this in client-side islands without
 * ensuring the anon key is appropriate for public reads.
 */

import { createClient } from '@supabase/supabase-js';
import type {
  Make,
  Model,
  ModelYear,
  Trim,
  VehicleConfiguration,
  TowingSpec,
  DataSource,
  VehicleSummary,
  VehiclePageData,
  PaginatedResult,
  DbResult,
  DatabaseError,
  CompatibilityResult,
  TrailerCompatibilityInput,
} from './types.ts';
import {
  SEED_MAKES,
  SEED_MODELS,
  SEED_MODEL_YEARS,
  SEED_TRIMS,
  SEED_CONFIGS,
  SEED_SPECS,
  SEED_SOURCES,
  SEED_SPEC_SOURCE_LINKS,
  SEED_VEHICLE_SUMMARIES,
} from './seed-data.ts';

// ─── Client Initialization ────────────────────────────────────────────────────

function hasSupabaseConfig(): boolean {
  const url = import.meta.env?.SUPABASE_URL;
  const key = import.meta.env?.SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('your-project-ref'));
}

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!hasSupabaseConfig()) return null;
  if (!_client) {
    const url = import.meta.env.SUPABASE_URL;
    const key = import.meta.env.SUPABASE_ANON_KEY;
    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

export interface DatabaseHealthStatus {
  mode: 'live_supabase' | 'fallback_seed' | 'live_supabase_failed';
  status: 'healthy' | 'unhealthy';
  isConfigured: boolean;
  message: string;
  latencyMs?: number;
  error?: string | null;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  if (!hasSupabaseConfig()) {
    return {
      mode: 'fallback_seed',
      status: 'healthy',
      isConfigured: false,
      message: 'Running in verified local fallback dataset mode (no Supabase credentials provided).',
    };
  }

  const supabase = getClient();
  if (!supabase) {
    return {
      mode: 'fallback_seed',
      status: 'healthy',
      isConfigured: false,
      message: 'Supabase client failed to initialize.',
    };
  }

  const start = Date.now();
  try {
    const { count, error } = await supabase
      .from('makes')
      .select('*', { count: 'exact', head: true });

    const latencyMs = Date.now() - start;

    if (error) {
      console.warn(`[TowingSpecs DB Alert] Live Supabase query failed: ${error.message}. Serving fallback seed dataset.`);
      return {
        mode: 'live_supabase_failed',
        status: 'unhealthy',
        isConfigured: true,
        latencyMs,
        error: error.message,
        message: `Supabase credentials are configured but the live database query failed: "${error.message}". Application is serving fallback seed data as a safety net.`,
      };
    }

    return {
      mode: 'live_supabase',
      status: 'healthy',
      isConfigured: true,
      latencyMs,
      message: `Connected to live Supabase database (${count ?? 0} makes active).`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TowingSpecs DB Alert] Live Supabase connection error: ${msg}. Serving fallback seed dataset.`);
    return {
      mode: 'live_supabase_failed',
      status: 'unhealthy',
      isConfigured: true,
      latencyMs,
      error: msg,
      message: `Connection to live Supabase failed: "${msg}". Application is serving fallback seed data.`,
    };
  }
}

// ─── Error Helpers ────────────────────────────────────────────────────────────

function toDbError(err: unknown): DatabaseError {
  if (err && typeof err === 'object' && 'message' in err) {
    return {
      code: ('code' in err ? String((err as { code: unknown }).code) : 'UNKNOWN'),
      message: String((err as { message: unknown }).message),
    };
  }
  return { code: 'UNKNOWN', message: 'An unknown database error occurred.' };
}

// ─── Makes ────────────────────────────────────────────────────────────────────

/**
 * Returns all makes that have at least one published model year with verified data.
 */
export async function getMakes(): Promise<DbResult<Make[]>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('makes')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        return { data: data as Make[], error: null };
      }
    } catch {
      // fall through to seed data
    }
  }

  // Fallback to verified seed makes
  const sorted = [...SEED_MAKES].sort((a, b) => a.name.localeCompare(b.name));
  return { data: sorted, error: null };
}

export async function getMakeBySlug(slug: string): Promise<DbResult<Make | null>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('makes')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!error && data) return { data: data as Make, error: null };
    } catch {
      // fall through to seed data
    }
  }

  const make = SEED_MAKES.find((m) => m.slug.toLowerCase() === slug.toLowerCase()) ?? null;
  return { data: make, error: null };
}

export async function getMakeById(id: string): Promise<DbResult<Make | null>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('makes')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) return { data: data as Make, error: null };
    } catch {
      // fall through
    }
  }

  const make = SEED_MAKES.find((m) => m.id === id) ?? null;
  return { data: make, error: null };
}

// ─── Models ───────────────────────────────────────────────────────────────────

export async function getModelsByMake(makeId: string): Promise<DbResult<Model[]>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('make_id', makeId)
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) return { data: data as Model[], error: null };
    } catch {
      // fall through
    }
  }

  const models = SEED_MODELS.filter((m) => m.make_id === makeId).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return { data: models, error: null };
}

export async function getModelBySlug(makeId: string, slug: string): Promise<DbResult<Model | null>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('make_id', makeId)
        .eq('slug', slug)
        .single();

      if (!error && data) return { data: data as Model, error: null };
    } catch {
      // fall through
    }
  }

  const model =
    SEED_MODELS.find(
      (m) => m.make_id === makeId && m.slug.toLowerCase() === slug.toLowerCase()
    ) ?? null;
  return { data: model, error: null };
}

export async function getModelById(id: string): Promise<DbResult<Model | null>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) return { data: data as Model, error: null };
    } catch {
      // fall through
    }
  }

  const model = SEED_MODELS.find((m) => m.id === id) ?? null;
  return { data: model, error: null };
}

// ─── Model Years ──────────────────────────────────────────────────────────────

export async function getModelYears(modelId: string): Promise<DbResult<ModelYear[]>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('model_years')
        .select('*')
        .eq('model_id', modelId)
        .eq('is_published', true)
        .order('year', { ascending: false });

      if (!error && data && data.length > 0) return { data: data as ModelYear[], error: null };
    } catch {
      // fall through
    }
  }

  const years = SEED_MODEL_YEARS.filter((my) => my.model_id === modelId && my.is_published).sort(
    (a, b) => b.year - a.year
  );
  return { data: years, error: null };
}

export async function getModelYearByYear(
  modelId: string,
  year: number
): Promise<DbResult<ModelYear | null>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('model_years')
        .select('*')
        .eq('model_id', modelId)
        .eq('year', year)
        .eq('is_published', true)
        .single();

      if (!error && data) return { data: data as ModelYear, error: null };
    } catch {
      // fall through
    }
  }

  const my =
    SEED_MODEL_YEARS.find(
      (m) => m.model_id === modelId && m.year === year && m.is_published
    ) ?? null;
  return { data: my, error: null };
}

// ─── Trims & Configurations ───────────────────────────────────────────────────

export async function getTrimsByModelYear(modelYearId: string): Promise<DbResult<Trim[]>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('trims')
        .select('*')
        .eq('model_year_id', modelYearId)
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) return { data: data as Trim[], error: null };
    } catch {
      // fall through
    }
  }

  const trims = SEED_TRIMS.filter((t) => t.model_year_id === modelYearId).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return { data: trims, error: null };
}

export async function getTrimById(id: string): Promise<DbResult<Trim | null>> {
  const trim = SEED_TRIMS.find((t) => t.id === id) ?? null;
  return { data: trim, error: null };
}

export async function getConfigurationsByTrim(
  trimId: string
): Promise<DbResult<VehicleConfiguration[]>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicle_configurations')
        .select('*')
        .eq('trim_id', trimId)
        .order('drivetrain', { ascending: true });

      if (!error && data && data.length > 0) return { data: data as VehicleConfiguration[], error: null };
    } catch {
      // fall through
    }
  }

  const configs = SEED_CONFIGS.filter((c) => c.trim_id === trimId);
  return { data: configs, error: null };
}

export async function getConfigurationById(
  id: string
): Promise<DbResult<VehicleConfiguration | null>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicle_configurations')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) return { data: data as VehicleConfiguration, error: null };
    } catch {
      // fall through
    }
  }

  const config = SEED_CONFIGS.find((c) => c.id === id) ?? null;
  return { data: config, error: null };
}

// ─── Towing Specs ─────────────────────────────────────────────────────────────

export async function getTowingSpecByConfiguration(
  configurationId: string
): Promise<DbResult<TowingSpec | null>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('towing_specs')
        .select('*')
        .eq('configuration_id', configurationId)
        .single();

      if (!error && data) return { data: data as TowingSpec, error: null };
    } catch {
      // fall through
    }
  }

  const spec = SEED_SPECS.find((s) => s.configuration_id === configurationId) ?? null;
  return { data: spec, error: null };
}

// ─── Data Sources ─────────────────────────────────────────────────────────────

export async function getSourcesForSpec(specId: string): Promise<DbResult<DataSource[]>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('spec_source_links')
        .select('source_id, data_sources(*)')
        .eq('spec_id', specId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sources = (data ?? []).map((row: any) => row.data_sources as DataSource).filter(Boolean);
      if (!error && sources.length > 0) return { data: sources, error: null };
    } catch {
      // fall through
    }
  }

  const linkSourceIds = SEED_SPEC_SOURCE_LINKS.filter((l) => l.spec_id === specId).map(
    (l) => l.source_id
  );
  const sources = SEED_SOURCES.filter((s) => linkSourceIds.includes(s.id));
  return { data: sources, error: null };
}

// ─── Browse / Listing ─────────────────────────────────────────────────────────

export async function getVehicleSummaries(opts: {
  makeSlug?: string;
  bodyStyle?: string;
  minYear?: number;
  maxYear?: number;
  page?: number;
  pageSize?: number;
}): Promise<DbResult<PaginatedResult<VehicleSummary>>> {
  const supabase = getClient();
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 24;
  const offset = (page - 1) * pageSize;

  if (supabase) {
    try {
      let query = supabase.from('vehicle_summaries').select('*', { count: 'exact' });

      if (opts.makeSlug) query = query.eq('make_slug', opts.makeSlug);
      if (opts.bodyStyle) query = query.eq('body_style', opts.bodyStyle);
      if (opts.minYear) query = query.gte('year', opts.minYear);
      if (opts.maxYear) query = query.lte('year', opts.maxYear);

      const { data, error, count } = await query
        .order('make_name', { ascending: true })
        .order('model_name', { ascending: true })
        .order('year', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (!error && data && data.length > 0) {
        return {
          data: {
            data: data as VehicleSummary[],
            total: count ?? data.length,
            page,
            pageSize,
          },
          error: null,
        };
      }
    } catch {
      // fall through
    }
  }

  let filtered = [...SEED_VEHICLE_SUMMARIES];
  if (opts.makeSlug) {
    filtered = filtered.filter((s) => s.make_slug.toLowerCase() === opts.makeSlug?.toLowerCase());
  }
  if (opts.bodyStyle) {
    filtered = filtered.filter((s) => s.body_style?.toLowerCase() === opts.bodyStyle?.toLowerCase());
  }
  if (opts.minYear) {
    filtered = filtered.filter((s) => s.year >= (opts.minYear as number));
  }
  if (opts.maxYear) {
    filtered = filtered.filter((s) => s.year <= (opts.maxYear as number));
  }

  const paginated = filtered.slice(offset, offset + pageSize);
  return {
    data: {
      data: paginated,
      total: filtered.length,
      page,
      pageSize,
    },
    error: null,
  };
}

// ─── Vehicle Selector (cascading dropdowns) ───────────────────────────────────

import { CATALOG_YEARS_SCOPE, type YearCoverageInfo } from './catalog-years.ts';

export async function getCatalogScopeYears(): Promise<DbResult<YearCoverageInfo[]>> {
  return { data: CATALOG_YEARS_SCOPE, error: null };
}

export async function getAvailableYears(): Promise<DbResult<number[]>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('model_years')
        .select('year')
        .eq('is_published', true)
        .order('year', { ascending: false });

      if (!error && data && data.length > 0) {
        const years = [...new Set(data.map((r: { year: number }) => r.year))];
        return { data: years, error: null };
      }
    } catch {
      // fall through
    }
  }

  const years = [...new Set(SEED_MODEL_YEARS.filter((my) => my.is_published).map((my) => my.year))].sort(
    (a, b) => b - a
  );
  return { data: years, error: null };
}

export async function getMakesForYear(year: number): Promise<DbResult<Make[]>> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('makes')
        .select('id, slug, name, country_of_origin, created_at, updated_at')
        .in(
          'id',
          (
            await supabase
              .from('model_years')
              .select('models!inner(make_id)')
              .eq('year', year)
              .eq('is_published', true)
          ).data?.flatMap((r: { models: Array<{ make_id: string }> | null }) =>
            (r.models ?? []).map((m) => m.make_id)
          ) ?? []
        )
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        return { data: data as Make[], error: null };
      }
    } catch {
      // fall through
    }
  }

  // Find model years for this year
  const myForYear = SEED_MODEL_YEARS.filter((my) => my.year === year && my.is_published);
  const modelIds = myForYear.map((my) => my.model_id);
  const models = SEED_MODELS.filter((m) => modelIds.includes(m.id));
  const makeIds = [...new Set(models.map((m) => m.make_id))];
  const makes = SEED_MAKES.filter((m) => makeIds.includes(m.id)).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return { data: makes, error: null };
}

// ─── Extended Vehicle & Config Lookup for Comparison ──────────────────────────

export interface DetailedConfiguration {
  config: VehicleConfiguration;
  spec: TowingSpec | null;
  sources: DataSource[];
  trim: Trim;
  model: Model;
  make: Make;
  year: number;
}

export async function getDetailedConfigurationById(
  configId: string
): Promise<DbResult<DetailedConfiguration | null>> {
  const config = SEED_CONFIGS.find((c) => c.id === configId);
  if (!config) return { data: null, error: null };

  const trim = SEED_TRIMS.find((t) => t.id === config.trim_id);
  if (!trim) return { data: null, error: null };

  const modelYear = SEED_MODEL_YEARS.find((my) => my.id === trim.model_year_id);
  if (!modelYear) return { data: null, error: null };

  const model = SEED_MODELS.find((m) => m.id === modelYear.model_id);
  if (!model) return { data: null, error: null };

  const make = SEED_MAKES.find((m) => m.id === model.make_id);
  if (!make) return { data: null, error: null };

  const spec = SEED_SPECS.find((s) => s.configuration_id === config.id) ?? null;
  const linkSourceIds = spec
    ? SEED_SPEC_SOURCE_LINKS.filter((l) => l.spec_id === spec.id).map((l) => l.source_id)
    : [];
  const sources = SEED_SOURCES.filter((s) => linkSourceIds.includes(s.id));

  return {
    data: {
      config,
      spec,
      sources,
      trim,
      model,
      make,
      year: modelYear.year,
    },
    error: null,
  };
}

export async function getAllDetailedConfigurations(): Promise<DetailedConfiguration[]> {
  const list: DetailedConfiguration[] = [];
  for (const config of SEED_CONFIGS) {
    const res = await getDetailedConfigurationById(config.id);
    if (res.data) list.push(res.data);
  }
  return list;
}

export { calculateTrailerCompatibility } from './towing-calculations.ts';

