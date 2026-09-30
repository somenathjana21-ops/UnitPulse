/**
 * backend/src/privacy.js
 *
 * Privacy and suppression enforcement for public and commander-facing releases.
 * Specifications: docs/10-security-privacy.md, docs/05-system-architecture.md, docs/15-decision-log.md (D-07)
 *
 * Core Safeguards:
 * 1. Minimum group size: Groups smaller than 5 are completely suppressed.
 * 2. Small-cell suppression: Sensitive cells or complements under 5 are suppressed.
 * 3. Anonymization: Strips all personnel identifiers, personal notes, or unreleased exact raw metrics.
 */

export const MIN_GROUP_SIZE = 5;
export const SMALL_CELL_THRESHOLD = 5;

export const FORBIDDEN_RELEASE_FIELDS = [
  'personnel_id',
  'personnelId',
  'name',
  'personnel_name',
  'raw_metrics',
  'case_notes',
  'notes',
  'exact_location',
  'service_number',
  'phone_number',
];

/**
 * Checks if a unit or sub-group should be suppressed due to small group size.
 *
 * @param {number} groupSize Active personnel count
 * @returns {{ suppressed: boolean, reason: string|null }}
 */
export function checkGroupSuppression(groupSize) {
  if (typeof groupSize !== 'number' || isNaN(groupSize)) {
    return {
      suppressed: true,
      reason: 'invalid_group_size',
      message: 'Group size unavailable or invalid',
    };
  }

  if (groupSize < MIN_GROUP_SIZE) {
    return {
      suppressed: true,
      reason: 'k_anonymity_group_too_small',
      message: 'Insufficient group size to show this view (group < 5)',
    };
  }

  return {
    suppressed: false,
    reason: null,
    message: null,
  };
}

/**
 * Checks whether an individual breakout or cell count is revealing (<5 or complementary breakout).
 *
 * @param {number} cellCount
 * @param {number} totalGroupSize
 * @returns {{ suppressed: boolean, reason: string|null }}
 */
export function checkCellSuppression(cellCount, totalGroupSize) {
  if (cellCount > 0 && cellCount < SMALL_CELL_THRESHOLD) {
    return {
      suppressed: true,
      reason: 'small_cell_revealing',
      message: 'This detail is withheld to protect privacy (< 5)',
    };
  }

  // Complement check: e.g. group size 20, 19 in one category implies 1 in the other
  const complement = totalGroupSize - cellCount;
  if (complement > 0 && complement < SMALL_CELL_THRESHOLD) {
    return {
      suppressed: true,
      reason: 'complement_revealing',
      message: 'This detail is withheld to protect privacy (complement < 5)',
    };
  }

  return {
    suppressed: false,
    reason: null,
    message: null,
  };
}

/**
 * Sanitizes a release payload, confirming no forbidden personal fields are present.
 *
 * @param {Record<string, any>} payload
 * @returns {Record<string, any>} Sanitized payload
 * @throws {Error} If a forbidden personnel field is detected
 */
export function validatePublicReleasePayload(payload) {
  for (const forbidden of FORBIDDEN_RELEASE_FIELDS) {
    if (forbidden in payload) {
      throw new Error(`PRIVACY VIOLATION: Forbidden field '${forbidden}' detected in public release payload.`);
    }
  }
  return payload;
}
