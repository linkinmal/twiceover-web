#!/usr/bin/env node
/**
 * Content gate over the BUILT output (dist/), per #39 AC3/AC4 — the same
 * output-contract line as product output (spec P0.8 / P0.12). Run after `astro build`.
 *
 *   AC4 — the shared disclaimer (src/content/disclaimer.txt) appears verbatim
 *         (normalized whitespace) on EVERY built page.
 *   AC3 — no banned advice/directive terms in any page's rendered text, after
 *         stripping the disclaimer and a short, documented allowlist of negation
 *         phrases that come verbatim from the PM copy / GetTerms boilerplate.
 *
 * The copy itself is clean (PM self-check in site-copy-twiceover.md); this gate
 * guards against build-time drift. Allowlist entries are reviewed exceptions —
 * negation or non-advice boilerplate only. Adding one is a content-review decision.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const EXPECTED_PAGES = [
  "index.html",
  "pricing/index.html",
  // The two explainer pages (stock-analyst-platform#3829; ADR 0990, ADR 0993).
  "how-our-analysis-works/index.html",
  "your-portfolio/index.html",
  "terms/index.html",
  "privacy/index.html",
  "cookies/index.html",
  "refunds/index.html",
  "404.html",
];

const BANNED = [
  /\bbuy\b/g,
  /\bsell\b/g,
  /\bbuy now\b/g,
  /\bsell now\b/g,
  /\bstrong buy\b/g,
  /\brecommend(?:s|ed|ation|ations)?\b/g,
  /\bsuitable\b/g,
  /\bsuitability\b/g,
  /\badvice\b/g,
  /\badvise(?:s|d)?\b/g,
  /\byou should\b/g,
];

// Documented exceptions, verbatim from the signed copy sources. Negations and
// non-trading boilerplate only — never an actual directive.
const ALLOWED = [
  // Home v3.4 (stock-analyst-platform#3829; homepage-3818-v3-2026-09-23.html, ADR 0991, copy from
  // consult 0987), "What TwiceOver is not" — negation. Replaces the v2 "no recommendations, no
  // trading signals…" entry, whose sentence the redesign retired.
  "twiceover gives no recommendations or trading signals, never scores or rates a stock, and never tells you to buy or sell",
  // Home v3.4, FAQ "What is TwiceOver, exactly?" — negation. (The v2 "What you see" entry went with
  // its section.)
  "it is not a registered investment adviser or broker-dealer, and it never tells you to buy or sell",
  // Your Portfolio explainer (stock-analyst-platform#3829; explainer-pages-3818-2026-09-24.html,
  // ADR 0993, Growth copy): the product's own disclaimer, drawn inside its picture — negation.
  "informational, not investment advice. you decide.",
  // …the position picture's open-order line: an order TYPE naming the reader's own existing
  // order, not a directive.
  "open order: gtc buy-to-close 3 oct 16 50 c",
  // …the rules example: a hypothetical about the reader's own past trade, not a directive.
  "example: say you sell an exmp covered call for",
  // ToS "Nature of the service" insert (PM, compliance-load-bearing) — negation.
  "nothing it produces is investment advice, a recommendation, a solicitation, or a suitability determination",
  "not a registered investment adviser, broker-dealer, or financial planner",
  // Privacy PM clause — negation (data sale, not trading).
  "we do not sell or rent personal data",
  // GetTerms Privacy, Security section — security caveat, not investment advice.
  "we advise that no method of electronic transmission or storage is 100% secure",
  // GetTerms boilerplate "you should" instances — browser/policy mechanics, not
  // trading directives (privacy intro, cookie policy ×2).
  "you should read their posted privacy policy information",
  "you should instruct your browser to refuse cookies",
  "you should check the date of this cookie policy",
];

const normalize = (s) => s.replace(/\s+/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();

/** Rendered text of an HTML document (script/style dropped, tags stripped, entities decoded). */
function textOf(html) {
  return normalize(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
  );
}

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (entry.endsWith(".html")) out.push(p);
  }
  return out;
}

const disclaimer = normalize(readFileSync(join(root, "src/content/disclaimer.txt"), "utf8"));
const failures = [];

let pages;
try {
  pages = htmlFiles(dist);
} catch {
  console.error("FATAL: dist/ not found — run `npm run build` first.");
  process.exit(1);
}

for (const expected of EXPECTED_PAGES) {
  if (!pages.some((p) => relative(dist, p) === expected)) {
    failures.push(`[structure] missing built page: dist/${expected}`);
  }
}

for (const page of pages) {
  const rel = relative(dist, page);
  const text = textOf(readFileSync(page, "utf8")).toLowerCase();

  // AC4 — disclaimer verbatim on every page.
  if (!text.includes(disclaimer.toLowerCase())) {
    failures.push(`[AC4] ${rel}: shared disclaimer missing or altered`);
  }

  // AC3 — banned terms outside the disclaimer + documented exceptions.
  let scrubbed = text.replaceAll(disclaimer.toLowerCase(), " ");
  for (const phrase of ALLOWED) scrubbed = scrubbed.replaceAll(normalize(phrase).toLowerCase(), " ");
  for (const re of BANNED) {
    for (const m of scrubbed.matchAll(re)) {
      const ctx = scrubbed.slice(Math.max(0, m.index - 35), m.index + m[0].length + 35).trim();
      failures.push(`[AC3] ${rel}: banned term "${m[0]}" — …${ctx}…`);
    }
  }
}

if (failures.length) {
  console.error("CONTENT CHECK FAILED:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} violation(s).`);
  process.exit(1);
}
console.log(`Content check passed: ${pages.length} built pages, disclaimer identical everywhere, no banned terms.`);
