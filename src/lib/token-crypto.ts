import { randomBytes, createHmac } from "crypto";

export function signRaw(raw: string, secret: string): string {
  return createHmac("sha256", secret).update(raw).digest("base64url");
}

export function generateSignedToken(secret: string): string {
  const raw = randomBytes(24).toString("base64url");
  return `${raw}.${signRaw(raw, secret)}`;
}

// Constant-time signature check.
export function verifySignedToken(signed: string, secret: string): boolean {
  const [raw, mac] = signed.split(".");
  if (!raw || !mac) return false;
  const expected = signRaw(raw, secret);
  if (expected.length !== mac.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  }
  return mismatch === 0;
}
