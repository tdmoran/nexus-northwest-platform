import { describe, it, expect } from "vitest";
import { parseCsv, extractMemberRows } from "./csv-parse";

describe("parseCsv", () => {
  it("parses a simple file", () => {
    const r = parseCsv("name,email\nTom,tom@example.com\nAnne,anne@example.com\n");
    expect(r.headers).toEqual(["name", "email"]);
    expect(r.rows).toEqual([
      ["Tom", "tom@example.com"],
      ["Anne", "anne@example.com"]
    ]);
  });

  it("handles quoted fields with commas and quotes", () => {
    const r = parseCsv(`name,email\n"O\"\"Hara, T",tom@example.com\n`);
    expect(r.rows[0]).toEqual([`O"Hara, T`, "tom@example.com"]);
  });

  it("handles CRLF line endings", () => {
    const r = parseCsv("name,email\r\nTom,tom@example.com\r\n");
    expect(r.rows[0]).toEqual(["Tom", "tom@example.com"]);
  });

  it("strips a BOM", () => {
    const r = parseCsv("﻿name,email\nTom,tom@example.com\n");
    expect(r.headers).toEqual(["name", "email"]);
  });

  it("throws on an unterminated quote", () => {
    expect(() => parseCsv('name,email\n"Tom,tom@example.com\n')).toThrow();
  });
});

describe("extractMemberRows", () => {
  it("requires the email and name columns", () => {
    const out = extractMemberRows(parseCsv("only_one\nfoo\n"));
    expect(out.rows).toHaveLength(0);
    expect(out.errors[0]?.reason).toMatch(/email/);
  });

  it("rejects rows with invalid emails or empty fields", () => {
    const csv = "name,email\nTom,not-an-email\n,blank-name@example.com\nAnne,anne@example.com\n";
    const out = extractMemberRows(parseCsv(csv));
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]!.email).toBe("anne@example.com");
    expect(out.errors).toHaveLength(2);
  });

  it("captures optional utm_source and ref columns", () => {
    const csv = "name,email,utm_source,ref\nTom,tom@example.com,linkedin,ABC123\n";
    const out = extractMemberRows(parseCsv(csv));
    expect(out.rows[0]).toMatchObject({
      email: "tom@example.com",
      name: "Tom",
      utmSource: "linkedin",
      referralCode: "ABC123"
    });
  });
});
