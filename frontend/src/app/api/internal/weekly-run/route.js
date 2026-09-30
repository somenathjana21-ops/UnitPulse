/**
 * frontend/src/app/api/internal/weekly-run/route.js
 *
 * Protected Vercel Cron GET route for weekly aggregation and report triggers.
 * Specifications: docs/05-system-architecture.md, docs/08-api-specification.md.
 *
 * Rules:
 * - Server-only authorization: verify Authorization: Bearer <CRON_SECRET>.
 * - Browser sessions CANNOT invoke this route.
 * - Cache-Control: no-store.
 * - Returns: { jobId, weekStart, unitsProcessed, releasesCreated, releasesReused, reportsCreated, reportsDeduplicated, status }
 */

import { NextResponse } from 'next/server';
import { verifyCronAuthorization, runWeeklyWorker } from '@unitpulse/backend';
import { isSupabaseConfigured, createServerSupabaseClient } from '../../../../lib/supabase/server.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('x-cron-secret');

  // Verify CRON_SECRET server-side
  if (!verifyCronAuthorization(authHeader)) {
    return NextResponse.json(
      {
        error: {
          code: 'unauthorized',
          message: 'Invalid or missing cron secret authorization.',
        },
      },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  // Graceful handling when Supabase environment is unconfigured
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: 'backend_not_configured',
          message: 'Supabase environment is not configured on this host.',
        },
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get('week') || undefined;

    const supabase = createServerSupabaseClient();
    const result = await runWeeklyWorker({
      weekStart: weekParam,
      supabase,
      logger: console,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: 'worker_execution_failed',
          message: err.message || 'Completed-week worker encountered an unexpected error.',
        },
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
