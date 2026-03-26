/**
 * ─── Utility Helpers ─────────────────────────────────────────────────────────
 *
 * Shared utility functions used across the codebase.
 * Add your own helpers here (string formatting, date utils, file handling, etc.)
 */

/**
 * Sleep for a given number of milliseconds. Useful for retries / rate limiting.
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON — returns null instead of throwing on bad input.
 */
export function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Pick specific keys from an object.
 *
 * Usage: pick(user, ["name", "email"])
 */
export function pick(obj, keys) {
  return keys.reduce((acc, key) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}
