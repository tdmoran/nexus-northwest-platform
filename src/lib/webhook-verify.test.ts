import { describe, it, expect } from "vitest";
import { createHmac, randomBytes } from "crypto";
import { verifySvixSignature, verifySendgridSignature } from "./webhook-verify";

function svixSign(secretRaw: string, msgId: string, timestamp: string, body: string): string {
  const secret = Buffer.from(secretRaw, "base64");
  const sig = createHmac("sha256", secret).update(`${msgId}.${timestamp}.${body}`).digest("base64");
  return `v1,${sig}`;
}

describe("verifySvixSignature", () => {
  const secretRaw = randomBytes(32).toString("base64");
  const signingSecret = `whsec_${secretRaw}`;
  const ts = Math.floor(Date.now() / 1000).toString();
  const id = "msg_test_123";
  const body = JSON.stringify({ type: "email.bounced", data: { to: "x@example.com" } });

  it("accepts a valid signature", () => {
    const header = svixSign(secretRaw, id, ts, body);
    expect(
      verifySvixSignature({ signingSecret, msgId: id, timestamp: ts, signatureHeader: header, rawBody: body })
    ).toBe(true);
  });

  it("rejects when body is tampered", () => {
    const header = svixSign(secretRaw, id, ts, body);
    expect(
      verifySvixSignature({
        signingSecret,
        msgId: id,
        timestamp: ts,
        signatureHeader: header,
        rawBody: body + "x"
      })
    ).toBe(false);
  });

  it("rejects when signed with the wrong secret", () => {
    const otherSecret = randomBytes(32).toString("base64");
    const header = svixSign(otherSecret, id, ts, body);
    expect(
      verifySvixSignature({ signingSecret, msgId: id, timestamp: ts, signatureHeader: header, rawBody: body })
    ).toBe(false);
  });

  it("rejects stale timestamps (>5 minutes old)", () => {
    const stale = (Math.floor(Date.now() / 1000) - 600).toString();
    const header = svixSign(secretRaw, id, stale, body);
    expect(
      verifySvixSignature({
        signingSecret,
        msgId: id,
        timestamp: stale,
        signatureHeader: header,
        rawBody: body
      })
    ).toBe(false);
  });

  it("accepts when the header has multiple signatures and one matches", () => {
    const correct = svixSign(secretRaw, id, ts, body);
    const wrong = "v1,deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbe==";
    const header = `${wrong} ${correct}`;
    expect(
      verifySvixSignature({ signingSecret, msgId: id, timestamp: ts, signatureHeader: header, rawBody: body })
    ).toBe(true);
  });

  it("returns false when the signing secret is missing", () => {
    expect(
      verifySvixSignature({
        signingSecret: "",
        msgId: id,
        timestamp: ts,
        signatureHeader: svixSign(secretRaw, id, ts, body),
        rawBody: body
      })
    ).toBe(false);
  });
});

describe("verifySendgridSignature", () => {
  it("returns false when the public key is missing", () => {
    expect(
      verifySendgridSignature({
        publicKeyBase64: "",
        timestamp: Math.floor(Date.now() / 1000).toString(),
        signatureBase64: "abc",
        rawBody: "{}"
      })
    ).toBe(false);
  });

  it("returns false on garbage public key input", () => {
    expect(
      verifySendgridSignature({
        publicKeyBase64: "not-real-base64-but-passes-decoding====",
        timestamp: Math.floor(Date.now() / 1000).toString(),
        signatureBase64: "AAAA",
        rawBody: "{}"
      })
    ).toBe(false);
  });
});
