#!/usr/bin/env node
/**
 * Regenerate `src/data/symbol-index.json` — the typeahead's entire data source
 * (read-components.md §6 R5, ADR 0810 build order item 6, stock-analyst-platform#2965).
 *
 *     npm run symbol-index:generate
 *
 * Ported from twiceover-app's `tooling/symbol-index` (`build-index.ts` + `generate.ts`), merged
 * into one dependency-free `.mjs` because twiceover-web has no workspace packages and no TypeScript
 * build for `scripts/` — the same shape as `scripts/build-tokens.mjs` and `scripts/gen-favicons.mjs`
 * beside it. The projection itself (upper-case, drop unsubmittable, first-row-wins, sort by symbol)
 * is carried over unchanged; `scripts/gen-symbol-index.test.mjs` pins it.
 *
 * **Run by hand — deliberately NOT wired into CI or into `astro build`.** Same posture, and the
 * same reasoning, as twiceover-app's `tooling/symbol-index` and `tooling/sic-cohort-table`: wiring
 * a sec.gov fetch into the build makes every CI run and every local `npm run build` fail on a SEC
 * outage, and makes no two builds of one commit reproducible — to re-derive a file whose contents
 * change a few rows a week. What CI checks is the committed ARTIFACT, never the network.
 *
 * **Staleness is a coverage question, never a correctness one.** R4 separates the two gates: this
 * index decides what may be *suggested*; the Worker's `TICKER_PATTERN` (`/^[A-Z]{1,6}$/`) decides
 * what may be *submitted*, and the app's server-side symbol table remains the sole admission
 * authority. A symbol listed since the last regeneration is fully readable the day it lists — it is
 * simply not offered. Nothing degrades but a convenience.
 *
 * **Two copies, by decision.** twiceover-app ships its own index from its own generator; ADR 0810
 * accepted the duplication ("two committed symbol-index copies to keep from drifting") rather than
 * couple the repos' builds. Unlike the matcher next to it, this artifact carries no byte-identity
 * test — the two are regenerated on different days by design, and pinning them equal would fail on
 * the first independent run rather than on a real defect.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * The Worker's `TICKER_PATTERN`, mirrored from `worker/index.js`.
 *
 * Deliberately re-declared rather than imported: this generator is a hand-run script with no
 * dependency on the Worker, and reaching across that boundary for one regex would be the only such
 * edge here. `gen-symbol-index.test.mjs` pins the source string against `worker/index.js`, so the
 * copy cannot drift silently — if the pattern ever moves, that test goes red rather than the index
 * quietly diverging from what the box will accept.
 */
export const SUBMITTABLE_SYMBOL = /^[A-Z]{1,6}$/;

/** EDGAR requires a declared User-Agent identifying the requester (ADR 0162); an undeclared UA 403s. */
const USER_AGENT = process.env.EDGAR_USER_AGENT ?? "Twiceover Research support@twiceover.io";
const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";

const OUTPUT = fileURLToPath(new URL("../src/data/symbol-index.json", import.meta.url));

/**
 * Project SEC's `company_tickers.json` rows down to the shipped `symbol⇥name` pairs.
 *
 * Pure over its input — no network, no clock, no filesystem — so the projection is testable without
 * reaching sec.gov, which is the whole reason the fetch lives in `main()` and not in here.
 */
export function buildIndex({ rows, generatedAt }) {
  const bySymbol = new Map();
  let droppedCount = 0;

  for (const row of rows) {
    const symbol = String(row?.ticker ?? "").trim().toUpperCase();
    const name = String(row?.title ?? "").trim();
    if (symbol === "" || name === "") continue;
    if (!SUBMITTABLE_SYMBOL.test(symbol)) {
      droppedCount += 1;
      continue;
    }
    // First row wins. SEC publishes a handful of symbols twice with differing title casing; which
    // one ships is arbitrary but must be STABLE, or every regeneration diffs rows nothing changed.
    if (!bySymbol.has(symbol)) bySymbol.set(symbol, name);
  }

  // Sorted lexically by symbol ONCE, here. R5 demands a deterministic, reproducible order and the
  // client sorts nothing at runtime — it filters this array and preserves its order, so the shipped
  // bytes ARE the ordering guarantee.
  const symbols = [...bySymbol.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return { symbols, symbolCount: symbols.length, droppedCount, generatedAt };
}

/**
 * Serialize one pair per line. Emitted single-line this is one changed line of ~340 KB, and an
 * unreviewable diff is an unreviewed one; at `JSON.stringify(_, null, 2)` it triples in size for no
 * extra review value. So: the envelope pretty-printed, the rows hand-joined one per line.
 */
export function serializeIndex(index) {
  return [
    "{",
    `  "generatedAt": ${JSON.stringify(index.generatedAt)},`,
    `  "symbolCount": ${index.symbolCount},`,
    '  "symbols": [',
    index.symbols.map((entry) => JSON.stringify(entry)).join(",\n"),
    "  ]",
    "}",
    "",
  ].join("\n");
}

async function main() {
  const response = await fetch(TICKERS_URL, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${TICKERS_URL}`);
  }

  const payload = await response.json();
  const rows = Object.values(payload);
  console.log(`company_tickers.json: ${rows.length} rows`);

  const index = buildIndex({ rows, generatedAt: new Date().toISOString() });
  writeFileSync(OUTPUT, serializeIndex(index));

  const bytes = readFileSync(OUTPUT).byteLength;
  console.log(
    `wrote ${OUTPUT}\n  ${index.symbolCount} symbols, ${index.droppedCount} dropped as unsubmittable, ${bytes} bytes`,
  );
}

// Import-safe: the test imports `buildIndex`/`serializeIndex` without reaching sec.gov.
// `pathToFileURL`, not a `file://` template — the latter breaks on a path with spaces or
// non-ASCII characters, silently turning this into a module that never runs its own main().
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
