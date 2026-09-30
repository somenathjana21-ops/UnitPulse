/**
 * frontend/src/middleware.js
 *
 * Enforces Cache-Control: no-store on every role-specific route, per
 * docs/05-system-architecture.md ("Do not use public CDN/ISR caching for
 * role-specific pages") and docs/10-security-privacy.md safeguard 9.
 * Extend the matcher here when Phase 4 adds /welfare/*.
 */

import { NextResponse } from 'next/server';

export function middleware() {
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: ['/commander/:path*', '/api/commander/:path*'],
};
