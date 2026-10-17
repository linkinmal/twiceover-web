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
 *   STRIP — the home page's "From the blog" titles leave the banned-term scan, by a marker honored on index.html only
 *         and only for a title that is a post's own heading; the phrase floor still reads them (ADR 1090 Amendment 3).
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
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  IN_APP_PAGES,
  contentSlugFailures,
  crossPageFailures,
  disallowedInAppHrefs,
  markedTitleCount,
  normalize,
  pageKind,
  postHeading,
  postStrings,
  scanPage,
} from "./content-rules.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// `--dist <dir> --content <dir>` check another build and its posts (the fixture build, ci/blog-build.test.mjs).
// Arguments, not environment: the verify job passes none, so the gate on a deploy's artifact always checks dist/ and src/content/blog.
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const dist = arg("--dist") ? resolve(arg("--dist")) : join(root, "dist");
const blogContent = arg("--content") ? resolve(arg("--content")) : join(root, "src/content/blog");

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

// The home page's "From the blog" strip marks each title; the gate honors a mark only for a title that is a post's own
// heading (ADR 1090 Amendment 3). The built post's h1 is the post file's title as rendered.
const postTitles = built.filter((b) => pageKind(b.rel, postSlugs) === "post").map((b) => postHeading(b.html)).filter(Boolean);

for (const page of built) failures.push(...scanPage({ ...page, disclaimer, postSlugs, listStrings, postTitles }));

// Control: with posts to show, the built home page carries at least one marked title. If it carries none, the strip
// is gone or its marker was renamed, and the exemption above would be passing on a page it never looked at.
const homePage = built.find((b) => b.rel === "index.html");
if (homePage && postTitles.length && markedTitleCount(homePage.html) === 0) {
  failures.push("[BLOG-STRIP] control: index.html has posts to show but no data-post-title element — the exemption is blind");
}
failures.push(...crossPageFailures(built, postSlugs));

if (failures.length) {
  console.error("CONTENT CHECK FAILED:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} violation(s).`);
  process.exit(1);
}
console.log(`Content check passed: ${pages.length} built pages, disclaimer identical everywhere, no banned terms.`);
