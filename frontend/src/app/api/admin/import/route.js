/**
 * frontend/src/app/api/admin/import/route.js
 *
 * Restricted synthetic-CSV import API route for HR Uploaders.
 * Specifications: docs/04-user-flows.md, docs/06-data-specification.md,
 *                 docs/08-api-specification.md, docs/10-security-privacy.md, docs/11-testing-plan.md
 *
 * SECURITY & PRIVACY CONTROLS:
 * 1. Role restricted: strictly hr_uploader (and system_admin). Commanders/Welfare officers denied (403).
 * 2. Size limit: max 2MB payload enforced server-side (413).
 * 3. Safe RFC-4180 parsing, formula injection detection, schema and relationship validation.
 * 4. Atomic transactional import: zero partial rows committed on any failure.
 * 5. Safe error summaries: reports row/column/message only; zero raw row logging.
 * 6. Cache-Control: no-store enforced.
 */

import { createServerSupabaseClient, isSupabaseConfigured } from '../../../../lib/supabase/server.js';
import { fetchUserContext } from '../../../../lib/commander/repository.js';
import { handleImportRequest } from '../../../../lib/admin/service.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const contentLength = request.headers.get('content-length')
    ? parseInt(request.headers.get('content-length'), 10)
    : null;

  // Resolve user session from Supabase or fallback test headers
  let user = null;
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient();
      user = await fetchUserContext(supabase);
    } catch {
      user = null;
    }
  } else {
    const testRole = request.headers.get('x-test-role');
    const testUserId = request.headers.get('x-test-user-id');
    if (testRole) {
      user = { id: testUserId || 'test-user', role: testRole };
    }
  }

  // Extract payload
  let datasetType = '';
  let csvContent = '';
  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      datasetType = (formData.get('datasetType') || '').toString().trim();
      const file = formData.get('file') || formData.get('csv');
      if (file && typeof file.text === 'function') {
        csvContent = await file.text();
      } else if (typeof file === 'string') {
        csvContent = file;
      }
    } else {
      const body = await request.json();
      datasetType = (body.datasetType || '').toString().trim();
      csvContent = (body.csvContent || '').toString();
    }
  } catch {
    return Response.json(
      {
        error: {
          code: 'invalid_request',
          message: 'Failed to parse upload payload. Provide valid form-data or JSON with datasetType and csvContent.',
        },
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const result = await handleImportRequest({
    user,
    datasetType,
    csvContent,
    contentLength,
  });

  return Response.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
