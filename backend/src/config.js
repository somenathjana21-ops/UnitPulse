/**
 * backend/src/config.js
 *
 * Server-only environment and configuration guards.
 * Specifications: docs/05-system-architecture.md, docs/10-security-privacy.md, .env.example
 *
 * CRITICAL SECURITY RULES:
 * 1. Server-only secrets MUST NEVER be prefixed with NEXT_PUBLIC_.
 * 2. Service-role keys, cron secrets, encryption keys, and AI keys are strictly server-only.
 * 3. Browser code must never have access to this module.
 */

export const SENSITIVE_PATTERNS = [
  'SERVICE_ROLE',
  'CRON_SECRET',
  'ENCRYPTION',
  'AI_API_KEY',
  'AI_SECRET',
];

/**
 * Checks whether an environment variable key is a prohibited client-exposed secret.
 *
 * @param {string} key
 * @returns {boolean}
 */
export function isForbiddenClientSecretKey(key) {
  if (typeof key !== 'string' || !key.startsWith('NEXT_PUBLIC_')) {
    return false;
  }
  const upper = key.toUpperCase();
  return SENSITIVE_PATTERNS.some((pattern) => upper.includes(pattern));
}

/**
 * Validates that no server-only secrets have leaked into client-visible environment variables.
 *
 * @param {Record<string, string|undefined>} env Object containing environment variables
 * @throws {Error} If a forbidden client-prefixed secret is detected
 * @returns {boolean} True if environment configuration passes all checks
 */
export function validateEnvironmentSecurity(env = process.env) {
  for (const key of Object.keys(env)) {
    if (isForbiddenClientSecretKey(key)) {
      throw new Error(
        `CRITICAL SECURITY VIOLATION: Server-only secret is exposed with client prefix '${key}'. This violates trust boundary 1 in docs/05-system-architecture.md.`
      );
    }
  }
  return true;
}

/**
 * Returns server configuration with explicit defaults and validation.
 *
 * @param {Record<string, string|undefined>} [env=process.env]
 * @returns {Object} Server configuration
 */
export function getServerConfig(env = process.env) {
  validateEnvironmentSecurity(env);

  return {
    isServer: typeof window === 'undefined',
    appDataMode: env.APP_DATA_MODE || 'synthetic',
    noLlmMode: env.NO_LLM_MODE === 'true' || !env.AI_API_KEY,
    supabase: {
      url: env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
      anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    },
    ai: {
      baseUrl: env.AI_BASE_URL || '',
      apiKey: env.AI_API_KEY || '',
      model: env.AI_MODEL || 'synthetic-default',
      jsonMode: env.AI_JSON_MODE === 'true',
      timeoutMs: parseInt(env.AI_TIMEOUT_MS || '12000', 10),
    },
    privacy: {
      epsilonPerCount: parseFloat(env.RELEASE_EPSILON_PER_COUNT || '0.2'),
    },
  };
}
