/**
 * ml/src/noise.js
 *
 * Calibrated Laplace noise sampling for selected bounded counts.
 * Specification: docs/06-data-specification.md, docs/10-security-privacy.md, docs/15-decision-log.md (D-08)
 *
 * Safeguards:
 * - Noise is sampled ONCE per completed unit/week and persisted.
 * - Repeated page views return stored approximations (never resampled on request).
 * - Calibrated with epsilon = 0.2, sensitivity = 1.0 for 0/1 bounded counts.
 * - Approximate counts are clamped to [0, total_group_size].
 *
 * NOTE: Adding Laplace noise to bounded counts does NOT make the entire system
 * formally differentially private. It is a defense-in-depth mitigation for the demo.
 */

import crypto from 'node:crypto';

export const NOISE_PARAMETERS = {
  epsilon: 0.2, // Privacy budget parameter per count for synthetic demo
  sensitivity: 1.0, // Maximum change one individual can cause to a 0/1 bounded count
};

/**
 * Samples a random float in (0, 1) using crypto.randomBytes to avoid pseudo-random predictability.
 *
 * @returns {number} Uniform random number in (0, 1)
 */
function secureRandomUniform() {
  const buf = crypto.randomBytes(4);
  const intVal = buf.readUInt32BE(0);
  // Avoid exact 0 or 1
  return (intVal + 1) / (0xffffffff + 2);
}

/**
 * Samples a Laplace random variable Lap(scale = sensitivity / epsilon).
 *
 * @param {number} [epsilon=0.2]
 * @param {number} [sensitivity=1.0]
 * @returns {number} Sampled noise value
 */
export function sampleLaplaceNoise(epsilon = NOISE_PARAMETERS.epsilon, sensitivity = NOISE_PARAMETERS.sensitivity) {
  const scale = sensitivity / epsilon;
  const u = secureRandomUniform() - 0.5;
  const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  return noise;
}

/**
 * Applies persistent stable noise to a bounded count.
 *
 * @param {number} exactCount Raw integer count
 * @param {number} groupSize Upper bound for clamping
 * @param {number} [epsilon=0.2]
 * @returns {{ approximateCount: number, approximate: boolean, noiseApplied: boolean }}
 */
export function applyPersistentBoundedNoise(exactCount, groupSize, epsilon = NOISE_PARAMETERS.epsilon) {
  if (typeof exactCount !== 'number' || isNaN(exactCount)) {
    return { approximateCount: null, approximate: false, noiseApplied: false };
  }

  const noise = sampleLaplaceNoise(epsilon, 1.0);
  const noisyValue = Math.round(exactCount + noise);
  const clampedValue = Math.max(0, Math.min(groupSize, noisyValue));

  return {
    approximateCount: clampedValue,
    approximate: true,
    noiseApplied: true,
  };
}
