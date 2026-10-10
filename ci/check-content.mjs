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
 *   IN-APP — the /in-app/* legal pages the iOS app opens in its in-app browser
 *         (stock-analyst-platform#4033) link nowhere but their own anchors, mailto:
 *         and each other, and are noindex. A path from them to Pricing or Sign up
 *         is a purchase path outside Apple's IAP (ADR 1018 Decision 4).
 *   BLOG — posts under blog/<slug> leave the banned-word scan for a phrase floor; the blog index and
 *         topic pages keep it after their exact post titles are subtracted; every other page,
 *         including blog games and tools, keeps it. Blog pages also meet the markup and door-form
 *         rules (ADR 1090 Decisions 9 and 11). The rules live in content-rules.mjs, where they are
 *         mutation-tested; this file only walks dist/.
 *
 * The copy itself is clean (PM self-check in site-copy-twiceover.md); this gate
 * guards against build-time drift. Allowlist entries are reviewed exceptions —
 * negation or non-advice boilerplate only. Adding one is a content-review decision.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  IN_APP_PAGES,
  contentSlugFailures,
  crossPageFailures,
  disallowedInAppHrefs,
  normalize,
  pageKind,
  postStrings,
  scanPage,
} from "./content-rules.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const blogContent = join(root, "src/content/blog");

const EXPECTED_PAGES = [
  "index.html",
  "pricing/index.html",
  "terms/index.html",
  "privacy/index.html",
  "cookies/index.html",
  "refunds/index.html",
  "delete-account/index.html",
  "404.html",
  ...IN_APP_PAGES,
];

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

// The posts are the files in the content folder; a page under blog/ is a post only if its slug is one.
const postFiles = existsSync(blogContent) ? readdirSync(blogContent) : [];
failures.push(...contentSlugFailures(postFiles));
const postSlugs = postFiles.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));

for (const expected of EXPECTED_PAGES) {
  if (!pages.some((p) => relative(dist, p) === expected)) {
    failures.push(`[structure] missing built page: dist/${expected}`);
  }
}

// IN-APP control — the same scan, on the full-chrome /terms, must find its header's /pricing.
// If it finds nothing there, the scan is blind and its silence on the in-app pages proves nothing.
const fullTerms = pages.find((p) => relative(dist, p) === "terms/index.html");
if (fullTerms && !disallowedInAppHrefs(readFileSync(fullTerms, "utf8")).includes("/pricing")) {
  failures.push("[IN-APP] control: the link scan found no /pricing on the full /terms page — scan is blind");
}

const built = pages.map((p) => ({ rel: relative(dist, p), html: readFileSync(p, "utf8") }));

// A list page prints each post's exact heading, description and title; those strings are subtracted
// before its full scan, so a headline with "sell-off" in it is not a violation by itself.
const listStrings = built.filter((b) => pageKind(b.rel, postSlugs) === "post").flatMap((b) => postStrings(b.html));

for (const page of built) failures.push(...scanPage({ ...page, disclaimer, postSlugs, listStrings }));
failures.push(...crossPageFailures(built, postSlugs));

if (failures.length) {
  console.error("CONTENT CHECK FAILED:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} violation(s).`);
  process.exit(1);
}
console.log(`Content check passed: ${pages.length} built pages, disclaimer identical everywhere, no banned terms.`);
