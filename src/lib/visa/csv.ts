/**
 * Turns the Passport Index tidy ISO-2 CSV (Passport,Destination,Requirement)
 * into the committed src/data/visa-tr.json. Used by scripts/fetch-visa.mjs
 * and by tests; no network here.
 */

export type VisaSource = {
  name: string;
  repository: string;
  file: string;
  url: string;
  commit: string;
  /** Date of the last commit that changed the CSV (YYYY-MM-DD). */
  dataDate: string;
  license: string;
};

export type VisaFile = {
  passport: string;
  source: VisaSource;
  /** When the CSV was downloaded (YYYY-MM-DD). */
  downloadedAt: string;
  /** Raw requirement per destination ISO-2 code, as written in the dataset. */
  requirements: Record<string, string>;
};

const HEADER = ["passport", "destination", "requirement"];

function splitRow(line: string): string[] {
  // The dataset has no quoted fields today; still accept simple quoting.
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** Requirements for one passport, keyed by destination ISO-2 code. */
export function extractPassportRows(csv: string, passport: string): Record<string, string> {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitRow(lines[0] ?? "").map((h) => h.toLowerCase());
  if (HEADER.some((h, i) => header[i] !== h)) {
    throw new Error(`Unexpected CSV header: ${lines[0]}`);
  }

  const wanted = passport.toUpperCase();
  const rows: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const [from, to, requirement] = splitRow(line);
    if (from?.toUpperCase() !== wanted || !to || requirement === undefined) continue;
    const destination = to.toUpperCase();
    if (!/^[A-Z]{2}$/.test(destination)) throw new Error(`Unexpected destination code: ${to}`);
    if (rows[destination] !== undefined) throw new Error(`Duplicate row for ${wanted} → ${destination}`);
    rows[destination] = requirement;
  }
  if (Object.keys(rows).length === 0) throw new Error(`No rows for passport ${wanted}`);

  return Object.fromEntries(Object.entries(rows).sort(([a], [b]) => a.localeCompare(b)));
}

export function buildVisaFile(csv: string, passport: string, source: VisaSource, downloadedAt: string): VisaFile {
  return { passport: passport.toUpperCase(), source, downloadedAt, requirements: extractPassportRows(csv, passport) };
}
