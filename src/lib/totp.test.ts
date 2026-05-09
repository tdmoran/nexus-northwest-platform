import { describe, it, expect } from "vitest";
import {
  base32Encode,
  base32Decode,
  generateSecret,
  generateTOTP,
  verifyTOTP,
  buildOtpauthUrl
} from "./totp";

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const cases = ["hello", "", "Nexus Northwest", "\x00\x01\x02\x7f\xff"];
    for (const s of cases) {
      const buf = Buffer.from(s, "binary");
      expect(base32Decode(base32Encode(buf)).toString("binary")).toBe(s);
    }
  });

  it("rejects invalid base32 characters", () => {
    expect(() => base32Decode("8901")).toThrow();
  });
});

describe("generateSecret", () => {
  it("produces 32-character base32 strings", () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("produces different secrets each call", () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });
});

describe("TOTP RFC 6238 known vectors (SHA1, 8 digits in spec, we truncate to 6)", () => {
  // The RFC 6238 appendix uses an ASCII secret "12345678901234567890". In base32
  // that is "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ".
  const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("matches the 1970-01-01 00:00:59 vector last 6 digits", () => {
    const code = generateTOTP(SECRET, new Date(59 * 1000));
    expect(code).toBe("287082");
  });

  it("matches the 2005-03-18 vector last 6 digits", () => {
    const code = generateTOTP(SECRET, new Date(1111111109 * 1000));
    expect(code).toBe("081804");
  });
});

describe("verifyTOTP", () => {
  const secret = "JBSWY3DPEHPK3PXP";

  it("accepts a freshly generated code", () => {
    const code = generateTOTP(secret);
    expect(verifyTOTP(secret, code)).toBe(true);
  });

  it("accepts a code from one step in the past (clock skew)", () => {
    const past = new Date(Date.now() - 30_000);
    const code = generateTOTP(secret, past);
    expect(verifyTOTP(secret, code)).toBe(true);
  });

  it("rejects a code from too far in the past", () => {
    const past = new Date(Date.now() - 5 * 60_000);
    const code = generateTOTP(secret, past);
    expect(verifyTOTP(secret, code)).toBe(false);
  });

  it("rejects malformed codes", () => {
    expect(verifyTOTP(secret, "123")).toBe(false);
    expect(verifyTOTP(secret, "abcdef")).toBe(false);
    expect(verifyTOTP(secret, "12345A")).toBe(false);
  });
});

describe("buildOtpauthUrl", () => {
  it("encodes issuer and account into a label", () => {
    const url = buildOtpauthUrl({
      secretBase32: "JBSWY3DPEHPK3PXP",
      accountName: "tom@example.com",
      issuer: "Nexus Northwest"
    });
    expect(url).toContain("otpauth://totp/Nexus%20Northwest%3Atom%40example.com?");
    expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(url).toContain("issuer=Nexus+Northwest");
  });
});
