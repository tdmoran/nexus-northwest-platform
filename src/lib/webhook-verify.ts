// Provider-specific webhook signature verification.
//
// SendGrid: Ed25519 over `timestamp + payload`. Public key is base64-encoded
// DER (32 bytes raw). Signature header is base64.
// Resend (Svix): HMAC-SHA256 over `id.timestamp.payload`. Multiple signatures
// may appear in svix-signature, space-separated, each prefixed `v1,`.

import { createHmac, createPublicKey, verify, timingSafeEqual } from "crypto";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function verifySendgridSignature(opts: {
  publicKeyBase64: string;
  timestamp: string;
  signatureBase64: string;
  rawBody: string;
}): boolean {
  if (!opts.publicKeyBase64 || !opts.timestamp || !opts.signatureBase64) return false;

  // Reject events older than 5 minutes (replay protection).
  const tsMs = Number(opts.timestamp) * 1000;
  if (!Number.isFinite(tsMs)) return false;
  if (Math.abs(Date.now() - tsMs) > FIVE_MINUTES_MS) return false;

  const payload = Buffer.from(opts.timestamp + opts.rawBody, "utf8");
  const signature = Buffer.from(opts.signatureBase64, "base64");

  // SendGrid publishes the verification key as a base64 DER SubjectPublicKeyInfo.
  let publicKey;
  try {
    publicKey = createPublicKey({
      key: Buffer.from(opts.publicKeyBase64, "base64"),
      format: "der",
      type: "spki"
    });
  } catch {
    return false;
  }

  try {
    return verify(null, payload, publicKey, signature);
  } catch {
    return false;
  }
}

export function verifySvixSignature(opts: {
  signingSecret: string; // "whsec_..." base64 after the prefix
  msgId: string;
  timestamp: string;
  signatureHeader: string;
  rawBody: string;
}): boolean {
  if (!opts.signingSecret || !opts.msgId || !opts.timestamp || !opts.signatureHeader) {
    return false;
  }

  const tsMs = Number(opts.timestamp) * 1000;
  if (!Number.isFinite(tsMs)) return false;
  if (Math.abs(Date.now() - tsMs) > FIVE_MINUTES_MS) return false;

  const secretRaw = opts.signingSecret.startsWith("whsec_")
    ? opts.signingSecret.slice("whsec_".length)
    : opts.signingSecret;
  let secretBuf: Buffer;
  try {
    secretBuf = Buffer.from(secretRaw, "base64");
  } catch {
    return false;
  }

  const signedContent = `${opts.msgId}.${opts.timestamp}.${opts.rawBody}`;
  const expected = createHmac("sha256", secretBuf).update(signedContent).digest("base64");

  // The header may contain multiple `v1,base64sig` entries separated by spaces.
  const parts = opts.signatureHeader.split(" ");
  for (const p of parts) {
    const [scheme, sig] = p.split(",");
    if (scheme !== "v1" || !sig) continue;
    if (sig.length !== expected.length) continue;
    const sigBuf = Buffer.from(sig, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    try {
      if (timingSafeEqual(sigBuf, expBuf)) return true;
    } catch {
      // length mismatch handled above; ignore.
    }
  }
  return false;
}
