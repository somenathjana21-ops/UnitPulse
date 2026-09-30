/**
 * frontend/src/app/api/briefings/[unitId]/events/route.js
 *
 * GET /api/briefings/:unitId/events?week=YYYY-MM-DD
 * Server-Sent Events (SSE) streaming of already-validated briefing sections.
 *
 * CRITICAL SAFETY REQUIREMENT:
 * "stream only validated stored sections—not unvalidated raw model tokens."
 * Raw model tokens are NEVER streamed directly to the browser.
 *
 * Access: Authorized role assigned to unit.
 * Headers: Cache-Control: no-store
 * Specifications: docs/07-ml-specification.md, docs/08-api-specification.md
 */

import { createServerSupabaseClient, isSupabaseConfigured } from '../../../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../../../lib/commander/repository.js';
import { resolveCommanderUnitAccess } from '../../../../../lib/commander/authorize.js';
import { fetchUnitReleaseWithBriefing } from '../../../../../lib/briefings/repository.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  if (!isSupabaseConfigured()) {
    return new Response(JSON.stringify({ error: 'Backend not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const { unitId } = params;
  const url = new URL(request.url);
  const weekStart = url.searchParams.get('week');

  const supabase = createServerSupabaseClient();
  const user = await fetchUserContext(supabase);

  // 1. Authorization check
  const access = resolveCommanderUnitAccess({ user, unitId });
  if (!access.allowed) {
    return new Response(
      JSON.stringify({ error: { code: access.reason, message: 'Unauthorized' } }),
      {
        status: access.httpStatus,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }
    );
  }

  // 2. Fetch validated stored briefing
  const { release, briefing } = await fetchUnitReleaseWithBriefing(supabase, unitId, weekStart);

  if (!release || !briefing) {
    return new Response(JSON.stringify({ error: 'Briefing not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  // 3. Stream validated stored sections via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function sendEvent(event, data) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      // Stream validated sections sequentially
      sendEvent('metadata', {
        unitCode: unitId,
        weekStart: release.week_start,
        band: release.band,
        indexApprox: release.index_approx,
        baselineApprox: release.baseline_approx,
        source: briefing.source,
      });

      sendEvent('summary', {
        summary: briefing.summary,
      });

      sendEvent('factors', {
        contributingFactors: briefing.contributingFactors || [],
      });

      sendEvent('actions', {
        suggestedActions: briefing.suggestedActions || [],
      });

      sendEvent('disclaimer', {
        disclaimer: briefing.disclaimer,
      });

      sendEvent('complete', {
        status: 'done',
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Connection': 'keep-alive',
    },
  });
}
