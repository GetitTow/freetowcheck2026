/**
 * GET /api/db-status — Database connectivity and health diagnostic endpoint
 * Returns current database operating mode: live Supabase vs fallback seed.
 * Verifies live query performance without exposing service credentials.
 */
import type { APIRoute } from 'astro';
import { checkDatabaseHealth } from '../../lib/db.ts';

export const GET: APIRoute = async () => {
  const health = await checkDatabaseHealth();
  const statusCode = health.status === 'healthy' ? 200 : 503;

  return new Response(JSON.stringify(health, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      'X-TowingSpecs-DB-Mode': health.mode,
    },
  });
};
