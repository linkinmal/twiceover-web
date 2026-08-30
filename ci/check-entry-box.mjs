#!/usr/bin/env node
/**
 * Security gate over the BUILT site (every dist/**\/*.html) and the Worker source,
 * per #2520 / ADR 0383 Amendment 1 / Security consults 0739 and 0811.
 *
 * Supersedes ci/check-demo-control.mjs, which enforced consult 0384's guardrails on the
 * ADR 0383 fixture-only demo. That demo is retired (site-prelaunch.md §2 v2.19): the entry
 * box now performs a real GET navigation to /go/try carrying the typed ticker. Two of
 * 0384's three guardrails inverted with it and are deliberately NOT carried forward:
 *   - the form's action was required to be exactly "#demo-read"; it is now "/go/try"
 *   - the ticker <input> was required to carry NO name; it now requires name="ticker"
 * The unnamed-field "no-JS guarantee" is explicitly retired (consult 0739): a ticker is
 * public data by construction and the destination is our own Worker, not a third party.
 *
 * What consult 0739 pins structurally — cheap to check, and the point is to convert
 * "please remember" into "the build fails otherwise":
 *   (a) name="ticker" exactly — nothing else may be serialized off this form
 *   (b) method="get" exactly — never "post", which carries a body off-URL
 *   (c) action="/go/try" exactly — never external, never another on-origin route
 *   (d) the Worker forwards the ticker via URLSearchParams, never string concatenation
 *       into the redirect URL (the CRLF header-injection seam — 0739's own addition)
 *
 * ── What consult 0811 changed, and why (stock-analyst-platform#2964, ADR 0810) ────────
 *
 * The previous script scan was `/<script\b(?![^>]*\bsrc=)[^>]*>/` — a negative lookahead
 * that EXCLUDED every <script> carrying src=. Astro compiles component scripts into
 * externally-referenced bundles, which carry src=. A typeahead built the ordinary way
 * would therefore have passed this gate green while falsifying the exact invariant the
 * gate exists to assert. Worse than no gate: it looked enforced and wasn't.
 *
 * The replacement asserts a DECLARED EXPECTATION against the built output:
 *   1. every built page must appear in EXPECTED_SCRIPTS, and every declared page must
 *      exist in dist/ — a new page cannot slip in unscanned, and a deleted one cannot
 *      leave a stale declaration standing;
 *   2. per page, the number of inline executable scripts and of external scripts must
 *      match the declaration EXACTLY — a count, never a per-build content hash, which
 *      rotates on every Vite build and goes stale on the first forgotten dependency bump
 *      (consult 0811 (a); the same one-ended-declaration shape the constitution already
 *      flags for scripts/build-tokens.mjs);
 *   3. every external src must be a root-relative same-origin path under a known build
 *      directory — never off-origin, never protocol-relative, never a traversal;
 *   4. the forbidden-call scan runs on external bundle BODIES too, read off disk, not
 *      just on inline bodies. This is the actual hole being closed: the point is to see
 *      what ships, and what ships is the bundle.
 *
 * Deliberately NOT asserted: the count of <script type="application/ld+json"> data
 * blocks. Those are non-executable (the HTML spec never runs them, and CSP's script-src
 * does not govern them), so pinning a count would churn the gate on every SEO markup
 * edit while catching nothing executable. They are still required to carry no src.
 *
 * Run after `astro build` (same dependency as ci/check-content.mjs / check-a11y-decor.mjs).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// ── The declared script expectation ─────────────────────────────────────────
// One row per built page. `inline` counts executable inline <script> blocks (data blocks
// excluded); `external` counts <script src=…> tags.
//
// index.html's two scripts are the AnalysisBand scroll-driven animation
// (public/js/analysis-band.js) and the BeforeAfterRead tab toggle
// (public/js/before-after-read.js). Both were `is:inline` blocks declared here as
// `inline: 2` while the CSP work was pending; stock-analyst-platform#2976 moved them to
// public/js/ verbatim so the site's CSP can keep `script-src 'self'` strict with no inline
// exception (consult 0811 Amendment 1, corrected condition 4(iii)). They are counted, not
// asserted away — a gate claiming "zero scripts anywhere" against a build carrying two
// would be a false invariant, which is the failure this rewrite exists to end, not repeat.
// Their bodies are now scanned off disk as external bundles (clause 4 below), which is
// strictly more coverage than the inline scan they had before.
const EXPECTED_SCRIPTS = {
  "404.html": { inline: 0, external: 0 },
  "contact/index.html": { inline: 0, external: 0 },
  "cookies/index.html": { inline: 0, external: 0 },
  "index.html": { inline: 0, external: 2 },
  "pricing/index.html": { inline: 0, external: 0 },
  "privacy/index.html": { inline: 0, external: 0 },
  "refunds/index.html": { inline: 0, external: 0 },
  "terms/index.html": { inline: 0, external: 0 },
};

// A script src we are willing to serve: root-relative, same-origin, under a known build
// directory, ending .js. Bars off-origin ("https://…"), protocol-relative ("//evil"),
// traversal (".."), and anything outside the two directories the build actually emits to.
const EXTERNAL_SRC_SHAPE = /^\/(?:_astro|js)\/[A-Za-z0-9][A-Za-z0-9._-]*\.js$/;

const DATA_SCRIPT_TYPE = /^application\/(?:ld\+json|json)$/i;

// Network reach. Barred in EVERY executable body — inline or bundled. This is the clause
// the CSP's `connect-src 'none'` backstops at the browser; the gate catches it at build.
const FORBIDDEN_CALLS = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsendBeacon\b/];

/**
 * Parse the <script> tags out of one built page.
 * Returns { data, inline, external } — external entries carry their src.
 */
function parseScripts(html) {
  const data = [];
  const inline = [];
  const external = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    const body = m[2];
    const srcMatch = attrs.match(/\bsrc\s*=\s*"([^"]*)"/i);
    const typeMatch = attrs.match(/\btype\s*=\s*"([^"]*)"/i);
    const isData = typeMatch ? DATA_SCRIPT_TYPE.test(typeMatch[1].trim()) : false;
    if (isData) {
      data.push({ tag: m[0].slice(0, 120), src: srcMatch ? srcMatch[1] : null });
    } else if (srcMatch) {
      external.push({ src: srcMatch[1], tag: m[0].slice(0, 120) });
    } else {
      inline.push({ body, tag: m[0].slice(0, 120) });
    }
  }
  return { data, inline, external };
}

/**
 * The script/handler half of the gate, as a pure function over already-read pages so it
 * can be exercised against fixtures rather than only against whatever the current build
 * happens to emit (consult 0811: "a gate whose only proof is 'the current build passes'
 * is unfalsifiable by the gate itself").
 *
 * @param pages     [{ rel, html }] — rel is the dist-relative posix path
 * @param expected  the EXPECTED_SCRIPTS-shaped declaration to assert against
 * @param readAsset (srcPath) => string | null — resolves an external src to its bundle body
 */
export function scanPages(pages, expected = EXPECTED_SCRIPTS, readAsset = () => null) {
  const failures = [];
  const seen = new Set();

  for (const { rel, html } of pages) {
    seen.add(rel);
    const declared = expected[rel];
    if (!declared) {
      failures.push(
        `[scripts] ${rel}: built page is not declared in EXPECTED_SCRIPTS — every page must be declared so a new one cannot ship unscanned`,
      );
    }
    const { data, inline, external } = parseScripts(html);

    if (declared) {
      if (inline.length !== declared.inline) {
        failures.push(
          `[scripts] ${rel}: expected ${declared.inline} inline executable <script> block(s), found ${inline.length} — update EXPECTED_SCRIPTS deliberately, with review, or remove the script`,
        );
      }
      if (external.length !== declared.external) {
        failures.push(
          `[scripts] ${rel}: expected ${declared.external} external <script src=…> tag(s), found ${external.length} — update EXPECTED_SCRIPTS deliberately, with review, or remove the script`,
        );
      }
    }

    for (const d of data) {
      if (d.src !== null) {
        failures.push(`[scripts] ${rel}: a JSON data block must be inline, never loaded from src: ${d.tag}…`);
      }
    }

    for (const e of external) {
      if (!EXTERNAL_SRC_SHAPE.test(e.src)) {
        failures.push(
          `[security] ${rel}: script src must be a root-relative same-origin path under /_astro/ or /js/ ending .js — never off-origin, never protocol-relative, never a traversal. Got: ${e.src}`,
        );
        continue;
      }
      const bundle = readAsset(e.src);
      if (bundle === null) {
        failures.push(`[structure] ${rel}: script src ${e.src} does not resolve to a built asset — the bundle body cannot be scanned`);
        continue;
      }
      for (const re of FORBIDDEN_CALLS) {
        if (re.test(bundle)) {
          failures.push(
            `[security] ${rel}: bundled script ${e.src} calls ${re.source} — this site navigates, it never transmits (consult 0811; the CSP's connect-src 'none' backstops this at the browser)`,
          );
        }
      }
    }

    for (const s of inline) {
      for (const re of FORBIDDEN_CALLS) {
        if (re.test(s.body)) {
          failures.push(`[security] ${rel}: an inline script must never call ${re.source} — this site navigates, it never transmits`);
        }
      }
      // Reading .value stays barred for INLINE scripts specifically. Consult 0811 signed
      // off on a reviewed, CSP-contained bundle reading the entry field (that is the
      // typeahead), and only on that — an inline block reading a field remains the
      // unreviewed shape this gate was built to bar.
      if (/\.value\b/.test(s.body)) {
        failures.push(
          `[security] ${rel}: an inline script must never read .value off any element — a field-reading script must ship as a reviewed bundle under /_astro/ or /js/, declared in EXPECTED_SCRIPTS`,
        );
      }
    }

    // No inline event-handler attributes anywhere in the document. An inline on*="…"
    // handler has no legitimate use here and is how a script-scoped scan gets bypassed
    // (Architect review, PR #23) — barred outright. Widened from index.html to every
    // built page (consult 0811: the CSP applies site-wide, so this must too).
    for (const m of html.match(/<[a-z][^>]*\son[a-z]+\s*=\s*["']/gi) ?? []) {
      failures.push(`[security] ${rel}: inline event-handler attribute found — no page here carries scripted markup: ${m}…`);
    }
  }

  for (const rel of Object.keys(expected)) {
    if (!seen.has(rel)) {
      failures.push(`[scripts] ${rel}: declared in EXPECTED_SCRIPTS but not present in the build — remove the stale declaration`);
    }
  }

  return failures;
}

/**
 * The entry form's structure, on the one page that carries it. Pure over the page's HTML.
 */
export function scanEntryForm(html) {
  const failures = [];

  const formMatch = html.match(/<form\b[^>]*id="entry-form"[^>]*>/);
  if (!formMatch) {
    failures.push(`[structure] no <form id="entry-form"> found in dist/index.html`);
    return failures;
  }
  const openTag = formMatch[0];

  const actionMatch = openTag.match(/action="([^"]*)"/);
  if (!actionMatch || actionMatch[1] !== "/go/try") {
    failures.push(
      `[security] entry-box form action must be exactly "/go/try" (never external, never another on-origin route), got: ${actionMatch ? actionMatch[1] : "(missing)"}`,
    );
  }

  const methodMatch = openTag.match(/method="([^"]*)"/);
  if (!methodMatch || methodMatch[1].toLowerCase() !== "get") {
    failures.push(
      `[security] entry-box form method must be exactly "get" — "post" would carry the value off-URL in a request body, outside the auditable redirect this design depends on. Got: ${methodMatch ? methodMatch[1] : "(missing)"}`,
    );
  }

  // Scoped to the form block, not the document, so unrelated inputs elsewhere on the
  // page can never satisfy or break this check.
  const formBlockMatch = html.match(/<form\b[^>]*id="entry-form"[\s\S]*?<\/form>/);
  const formBlock = formBlockMatch ? formBlockMatch[0] : "";
  const tickerInputs = formBlock.match(/<input\b[^>]*>/gi) ?? [];
  if (tickerInputs.length !== 1) {
    failures.push(`[structure] expected exactly 1 <input> inside the entry-form, found ${tickerInputs.length}`);
  }
  for (const input of tickerInputs) {
    const nameMatch = input.match(/\bname="([^"]*)"/i);
    if (!nameMatch) {
      failures.push(
        `[security] the ticker <input> must carry name="ticker" — without a name the HTML spec excludes it from serialization and the handoff silently sends nothing. Found: ${input}`,
      );
    } else if (nameMatch[1] !== "ticker") {
      failures.push(
        `[security] the ticker <input>'s name must be exactly "ticker" (consult 0739 pins the one key this form may serialize), got: ${nameMatch[1]}`,
      );
    }
  }

  const submitButtons = formBlock.match(/<button\b[^>]*>/gi) ?? [];
  if (submitButtons.length !== 1) {
    failures.push(`[structure] expected exactly 1 <button> inside the entry-form, found ${submitButtons.length}`);
  }
  for (const btn of submitButtons) {
    if (!/type="submit"/i.test(btn)) {
      failures.push(`[a11y] entry-box submit must be type="submit": ${btn}`);
    }
    if (/\bdisabled\b/i.test(btn)) {
      failures.push(`[a11y] entry-box submit must not be disabled: ${btn}`);
    }
  }

  return failures;
}

/**
 * The Worker's forwarding guarantees. Consult 0739's own addition, gated structurally
 * rather than reviewed at PR time: this is the one place a coding slip turns a safe
 * design into a header-injection bug.
 */
export function scanWorkerSource(workerSource) {
  const failures = [];

  if (!/dest\.searchParams\.set\("ticker",\s*ticker\)/.test(workerSource)) {
    failures.push(
      `[security] worker/index.js must forward the ticker via dest.searchParams.set("ticker", ticker) — the WHATWG URL API encodes the value, where concatenating it into the redirect URL would let a CRLF payload split the Location header`,
    );
  }
  if (!/const TICKER_PATTERN = \/\^\[A-Z\]\{1,6\}\$\//.test(workerSource)) {
    failures.push(
      `[security] worker/index.js must bound the forwarded ticker with /^[A-Z]{1,6}$/ before it leaves this origin (consult 0739 trip-wire: "the forwarded value is ever anything other than the bounded ticker pattern")`,
    );
  }
  // Per-route destinations must stay a CLOSED LITERAL MAP built from the hardcoded app URL.
  // Consult 0739's trip-wire: "/go/try's destination host ever becomes anything other than the
  // hardcoded APP_TRY_URL (i.e. ever dynamic or attacker-influenceable)". A `next=`/`redirect_to=`
  // style param feeding the redirect is the classic open-redirect shape this bars structurally.
  const destMap = workerSource.match(/const GO_DESTINATIONS = \{[\s\S]*?\n\};/)?.[0] ?? "";
  if (!destMap) {
    failures.push(`[security] worker/index.js must declare a literal GO_DESTINATIONS map — the /go/* destinations may not be computed`);
  } else {
    if (/searchParams|request\.|url\.search|headers\.get/.test(destMap)) {
      failures.push(
        `[security] GO_DESTINATIONS must be built only from hardcoded literals — it references request input, which makes a /go/* destination attacker-influenceable (consult 0739 trip-wire)`,
      );
    }
    for (const [, value] of destMap.matchAll(/"\/go\/[a-z]+":\s*([^,\n]+)/g)) {
      if (!/^(APP_TRY_URL|`\$\{APP_TRY_URL\}[^`]*`)$/.test(value.trim())) {
        failures.push(
          `[security] every GO_DESTINATIONS value must derive from the hardcoded APP_TRY_URL, got: ${value.trim()}`,
        );
      }
    }
  }
  if (/\bsearchParams\.get\(\s*["'`](next|redirect_to|redirect|returnTo|return_to|url|dest)["'`]/.test(workerSource)) {
    failures.push(
      `[security] worker/index.js must never read a caller-supplied redirect target from the query string — the /go/* destinations are a closed literal map`,
    );
  }

  // The typed value must never reach analytics — consult 0163's guardrail, restated as
  // 0739's trip-wire ("the ticker value starts being captured into twiceover-web's own
  // analytics/metrics"). readUtm is the only thing that feeds writeSiteMetric's blobs.
  const readUtmBody = workerSource.match(/export function readUtm\([\s\S]*?\n}/)?.[0] ?? "";
  if (/ticker/i.test(readUtmBody)) {
    failures.push(
      `[security] readUtm() must never read the ticker — its return value feeds writeSiteMetric's blobs, and the typed value may not enter analytics (consult 0163 / 0739 trip-wire)`,
    );
  }

  return failures;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function collectHtml(dir, root, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectHtml(full, root, out);
    else if (entry.endsWith(".html")) out.push({ rel: relative(root, full).split(sep).join("/"), html: readFileSync(full, "utf8") });
  }
  return out;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const distDir = join(root, "dist");
  const workerPath = join(root, "worker", "index.js");

  let pages;
  try {
    pages = collectHtml(distDir, distDir).sort((a, b) => a.rel.localeCompare(b.rel));
  } catch {
    console.error(`FATAL: ${distDir} not readable — run \`npm run build\` first.`);
    process.exit(1);
  }
  if (!pages.length) {
    console.error(`FATAL: no built pages found under ${distDir} — run \`npm run build\` first.`);
    process.exit(1);
  }

  const readAsset = (srcPath) => {
    try {
      return readFileSync(join(distDir, srcPath.replace(/^\//, "")), "utf8");
    } catch {
      return null;
    }
  };

  const failures = [...scanPages(pages, EXPECTED_SCRIPTS, readAsset)];

  const indexPage = pages.find((p) => p.rel === "index.html");
  if (!indexPage) failures.push(`[structure] dist/index.html not found — the entry-form check cannot run`);
  else failures.push(...scanEntryForm(indexPage.html));

  let workerSource;
  try {
    workerSource = readFileSync(workerPath, "utf8");
  } catch {
    failures.push(`[structure] ${workerPath} not found — the ticker-forwarding check cannot run`);
  }
  if (workerSource) failures.push(...scanWorkerSource(workerSource));

  if (failures.length) {
    console.error("ENTRY BOX SECURITY CHECK FAILED:\n");
    for (const f of failures) console.error("  - " + f);
    console.error(`\n${failures.length} violation(s).`);
    process.exit(1);
  }
  console.log(
    `Entry box security check passed: ${pages.length} built page(s) against the declared script expectation (no undeclared script, inline or bundled; every src root-relative same-origin; no fetch/XHR/WebSocket/sendBeacon in any inline or bundled body; no inline handlers), name="ticker", method="get", action="/go/try", URLSearchParams-encoded + pattern-bounded forwarding.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
