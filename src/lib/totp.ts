// RFC 4648 base32 + RFC 6238 TOTP implementation.
//
// Kept dependency-free so this stays auditable. Default config matches what
// every authenticator app expects: SHA-1, 6 digits, 30-second step.

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(s: string): Buffer {
  const cleaned = s.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx < 0) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateSecret(): string {
  // 20 bytes = 160 bits — RFC 4226 recommended for HMAC-SHA1.
  return base32Encode(randomBytes(20));
}

function counterBytes(counter: number): Buffer {
  const buf = Buffer.alloc(8);
  // Counter is 64-bit big-endian; safe for any reasonable Date.now()/30.
  buf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  buf.writeUInt32BE(counter & 0xffff_ffff, 4);
  return buf;
}

export function generateTOTP(secretBase32: string, when: Date = new Date()): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(when.getTime() / 1000 / STEP_SECONDS);
  const hmac = createHmac("sha1", key).update(counterBytes(counter)).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

// Verify within a +/- window to allow for clock skew.
export function verifyTOTP(
  secretBase32: string,
  code: string,
  opts: { window?: number; when?: Date } = {}
): boolean {
  const window = opts.window ?? 1;
  const when = opts.when ?? new Date();
  const candidate = String(code).trim();
  if (!/^\d{6}$/.test(candidate)) return false;

  const candidateBuf = Buffer.from(candidate, "utf8");
  for (let i = -window; i <= window; i++) {
    const t = new Date(when.getTime() + i * STEP_SECONDS * 1000);
    const expected = generateTOTP(secretBase32, t);
    const expectedBuf = Buffer.from(expected, "utf8");
    if (expectedBuf.length === candidateBuf.length && timingSafeEqual(expectedBuf, candidateBuf)) {
      return true;
    }
  }
  return false;
}

export function buildOtpauthUrl(opts: {
  secretBase32: string;
  accountName: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.accountName}`);
  const params = new URLSearchParams({
    secret: opts.secretBase32,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS)
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
