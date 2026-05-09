import { describe, it, expect } from "vitest";
import { generateSignedToken, verifySignedToken, signRaw } from "./token-crypto";

describe("token-crypto", () => {
  it("generates tokens that verify with the same secret", () => {
    const t = generateSignedToken("secret-A");
    expect(verifySignedToken(t, "secret-A")).toBe(true);
  });

  it("rejects tokens signed with a different secret", () => {
    const t = generateSignedToken("secret-A");
    expect(verifySignedToken(t, "secret-B")).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifySignedToken("nodot", "secret")).toBe(false);
    expect(verifySignedToken("", "secret")).toBe(false);
    expect(verifySignedToken("only.", "secret")).toBe(false);
    expect(verifySignedToken(".onlymac", "secret")).toBe(false);
  });

  it("rejects tampered payloads", () => {
    const t = generateSignedToken("secret");
    const [raw, mac] = t.split(".");
    const tampered = `${raw}A.${mac}`;
    expect(verifySignedToken(tampered, "secret")).toBe(false);
  });

  it("rejects tampered macs", () => {
    const t = generateSignedToken("secret");
    const [raw, mac] = t.split(".");
    const tampered = `${raw}.${mac.slice(0, -1)}A`;
    expect(verifySignedToken(tampered, "secret")).toBe(false);
  });

  it("produces deterministic signatures for the same raw+secret", () => {
    expect(signRaw("hello", "secret")).toBe(signRaw("hello", "secret"));
  });

  it("produces different tokens on each generation", () => {
    const a = generateSignedToken("secret");
    const b = generateSignedToken("secret");
    expect(a).not.toBe(b);
  });
});
