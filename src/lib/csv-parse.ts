// Minimal RFC 4180 CSV parser. Handles quoted fields, doubled quotes, and
// CR/LF line endings. Sufficient for member-import use; a malformed input
// yields a parse error with the offending line number.

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
}

export function parseCsv(input: string): CsvParseResult {
  const text = input.replace(/^﻿/, ""); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  let line = 1;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (c === "\n") line++;
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      // ignore — handled by \n
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      line++;
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // flush last cell/row if file didn't end with newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (inQuotes) {
    throw new Error(`Unterminated quoted field starting before line ${line}`);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0]!.map((h) => h.trim().toLowerCase());
  return { headers, rows: rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")) };
}

export interface MemberCsvRow {
  email: string;
  name: string;
  utmSource?: string;
  referralCode?: string;
  rowIndex: number;
}

export function extractMemberRows(parsed: CsvParseResult): {
  rows: MemberCsvRow[];
  errors: Array<{ rowIndex: number; reason: string }>;
} {
  const idx = (key: string) => parsed.headers.indexOf(key);
  const emailIdx = idx("email");
  const nameIdx = idx("name");
  if (emailIdx < 0) {
    return {
      rows: [],
      errors: [{ rowIndex: 0, reason: "Missing required `email` header" }]
    };
  }
  if (nameIdx < 0) {
    return {
      rows: [],
      errors: [{ rowIndex: 0, reason: "Missing required `name` header" }]
    };
  }

  const sourceIdx = idx("utm_source");
  const refIdx = idx("ref");

  const rows: MemberCsvRow[] = [];
  const errors: Array<{ rowIndex: number; reason: string }> = [];

  for (let r = 0; r < parsed.rows.length; r++) {
    const row = parsed.rows[r]!;
    const rowIndex = r + 2; // +1 for header, +1 for 1-based
    const email = (row[emailIdx] ?? "").trim().toLowerCase();
    const name = (row[nameIdx] ?? "").trim();

    if (!email) {
      errors.push({ rowIndex, reason: "Empty email" });
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ rowIndex, reason: `Invalid email "${email}"` });
      continue;
    }
    if (!name) {
      errors.push({ rowIndex, reason: "Empty name" });
      continue;
    }

    rows.push({
      email,
      name,
      utmSource: sourceIdx >= 0 ? (row[sourceIdx] ?? "").trim() || undefined : undefined,
      referralCode: refIdx >= 0 ? (row[refIdx] ?? "").trim() || undefined : undefined,
      rowIndex
    });
  }

  return { rows, errors };
}
