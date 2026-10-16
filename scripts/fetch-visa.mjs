// Downloads the Passport Index tidy ISO-2 CSV and writes the Turkish passport
// rows to src/data/visa-tr.json (committed; builds and CI never go online).
// Usage: npm run data:visa            (default source)
//        npm run data:visa -- --repo ilyankou/passport-index-dataset
import { writeFileSync } from "node:fs";
import { buildVisaFile } from "../src/lib/visa/csv.ts";

// ilyankou/passport-index-dataset was archived on 12 January 2025; its README
// points to imorte/passport-index-data for February 2026 onwards. Same format.
const DEFAULT_REPO = "imorte/passport-index-data";
const FILE = "passport-index-tidy-iso2.csv";
const OUTPUT = new URL("../src/data/visa-tr.json", import.meta.url);

const repoArg = process.argv.indexOf("--repo");
const repo = repoArg > -1 ? process.argv[repoArg + 1] : DEFAULT_REPO;

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

const info = await getJson(`https://api.github.com/repos/${repo}`);
const [head] = await getJson(`https://api.github.com/repos/${repo}/commits?sha=${info.default_branch}&per_page=1`);
const [lastDataCommit] = await getJson(
  `https://api.github.com/repos/${repo}/commits?sha=${head.sha}&path=${FILE}&per_page=1`,
);

const url = `https://raw.githubusercontent.com/${repo}/${head.sha}/${FILE}`;
const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
if (!res.ok) throw new Error(`${url} answered ${res.status}`);
const csv = await res.text();

const file = buildVisaFile(
  csv,
  "TR",
  {
    name: "Passport Index Data",
    repository: `https://github.com/${repo}`,
    file: FILE,
    url,
    commit: head.sha,
    dataDate: lastDataCommit.commit.committer.date.slice(0, 10),
    license: info.license?.spdx_id ?? "unknown",
  },
  new Date().toISOString().slice(0, 10),
);

writeFileSync(OUTPUT, `${JSON.stringify(file, null, 2)}\n`);
console.log(
  `Wrote ${Object.keys(file.requirements).length} destinations for TR from ${repo}@${head.sha.slice(0, 7)} (data ${file.source.dataDate}).`,
);
