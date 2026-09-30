/**
 * frontend/src/lib/supabase/server.js
 *
 * Server-only Supabase client factory for Next.js Server Components and
 * Route Handlers. Specification: docs/05-system-architecture.md.
 *
 * CRITICAL: this ALWAYS uses the public anon key plus the caller's own
 * session cookie, never the elevated server-only database credential (see
 * AGENTS.md's non-negotiable rules -- that secret name must never appear
 * anywhere under frontend/src, not even in a comment). RLS is what enforces
 * unit and role scope here -- the browser session's JWT is what PostgREST
 * checks. Commander/welfare pages must never construct an elevated client.
 */

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Whether the two client-safe Supabase env vars are present. Callers should
 * check this before createServerSupabaseClient() and show a clear
 * "not configured" state instead of letting the page crash -- this is an
 * environment-configuration check, not an auth bypass.
 */
export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createServerSupabaseClient() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to create a Supabase client.'
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      // Server Components cannot set cookies; session refresh happens in
      // middleware/route handlers only. No-op here is intentional.
      set() {},
      remove() {},
    },
  });
}
