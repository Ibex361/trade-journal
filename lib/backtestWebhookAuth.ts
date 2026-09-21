// lib/backtestWebhookAuth.ts
//
// SERVER-ONLY. Split out of backtestValidation.ts because it needs
// node:crypto, and backtestValidation.ts is imported by a client
// component (the New Backtest form) whose bundle can't include Node
// built-ins.

import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time bearer-token check for the completion webhook. A plain
 * `===` on secrets leaks, via response timing, how many leading
 * characters matched; timingSafeEqual doesn't. It throws on unequal-length
 * buffers, so lengths are compared first — leaking only the secret's
 * length, which is not sensitive for a long random value.
 */
export function bearerMatches(authorizationHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authorizationHeader) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const given = Buffer.from(authorizationHeader, "utf8");
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
