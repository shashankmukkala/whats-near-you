import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Salted scrypt hash of an admin's 20-digit recovery code (first 5 + last
// 5 digits of each of their two secret numbers, concatenated — see
// scripts/set-admin-recovery.mjs, which is the only place a code is ever
// hashed and stored, and app/api/admin/reset-password, the only place one
// is ever verified). The raw digits never reach the database — only this
// hash does — and there is no inverse: a stolen hash can be checked
// against a *guessed* code, never turned back into the real one.
//
// Kept as a plain algorithm (not a library) so scripts/set-admin-recovery.mjs
// — a standalone Node script, not compiled through Next's TS pipeline —
// can reimplement the exact same few lines without a shared import across
// module systems. If you change this, change that script's copy too.
export function hashRecoveryCode(code: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(code, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyRecoveryCode(code: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(code, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
