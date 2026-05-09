import { describe, it, expect } from "vitest";
import { csvEscape, rowsToCsv } from "./csv";

describe("csvEscape", () => {
  it("returns empty string for null/undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("passes through plain values unquoted", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(true)).toBe("true");
  });

  it("quotes values with commas", () => {
    expect(csvEscape("a,b,c")).toBe('"a,b,c"');
  });

  it("quotes values with newlines", () => {
    expect(csvEscape("first\nsecond")).toBe('"first\nsecond"');
  });

  it("escapes embedded double quotes by doubling", () => {
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("formats Dates as ISO strings", () => {
    const d = new Date("2026-03-23T12:00:00Z");
    expect(csvEscape(d)).toBe("2026-03-23T12:00:00.000Z");
  });
});

describe("rowsToCsv", () => {
  it("emits header + rows joined with newlines", () => {
    const rows = [
      { name: "Tom", role: "manager" },
      { name: "Anne", role: "viewer" }
    ];
    const csv = rowsToCsv(rows, ["name", "role"]);
    expect(csv).toBe("name,role\nTom,manager\nAnne,viewer\n");
  });

  it("escapes per cell", () => {
    const rows = [{ name: 'O"Hara, T', email: "t@e" }];
    const csv = rowsToCsv(rows, ["name", "email"]);
    expect(csv).toBe('name,email\n"O""Hara, T",t@e\n');
  });
});
