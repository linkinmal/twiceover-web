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
 * Since stock-analyst-platform#3268, (d) is no longer written out per param: FORWARDED_PARAMS
 * declares each forwarded key once with its reader and its bound, and one rule asserts the
 * mechanism, the bound AND the value's provenance over every row — plus that no key reaches
 * the redirect without a row. See the standing limitation stated there on what a regex over
 * source can and cannot prove about wiring.
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
 *   5. that scan follows each bundle's OWN import specifiers, transitively. Added for
 *      stock-analyst-platform#2965: the typeahead lazy-loads its 342 KB symbol index as
 *      `import("./symbol-index.<hash>.js")`, a chunk referenced from inside the bundle and
 *      from no HTML at all — so clause 4 alone would have read the 4 KB entry bundle and
 *      never the 342 KB one it pulls in. That is clause 4's own hole one level down, and
 *      the same shape as the `src=`-exclusion this rewrite exists to close: the scan would
 *      have looked complete while never opening the larger half of what ships. Every
 *      resolved specifier must ALSO satisfy the same-origin path shape, so a chunk cannot
 *      reach off-origin where a <script src> could not — and an import whose specifier is NOT
 *      a string literal fails the scan outright, since a chunk that cannot be resolved cannot
 *      be read, and silently walking past it is the very hole this clause closes.
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
//
// The THIRD external script (external: 2 -> 3, stock-analyst-platform#2965, ADR 0810 build
// order item 6) is the ticker typeahead: an ordinary Astro <script> in index.astro, which
// Astro compiles to /_astro/index.astro_astro_type_script_index_0_lang.<hash>.js. It is the
// first script on this site that reads the entry field's .value, signed off as a carve-out
// (ADR 0810) and Security-reviewed (consult 0811). It is deliberately NOT `is:inline` — an
// inline script reading a field stays barred below, and the Worker's `script-src 'self'`
// admits no inline exception.
const EXPECTED_SCRIPTS = {
  "404.html": { inline: 0, external: 0 },
  "contact/index.html": { inline: 0, external: 0 },
  "cookies/index.html": { inline: 0, external: 0 },
  "index.html": { inline: 0, external: 3 },
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
 * The import specifiers a built bundle carries — both static (`from"./x.js"`) and dynamic
 * (`import("./x.js")`). Rollup emits chunk references in exactly these two shapes.
 *
 * Returns `{ specifiers, unresolved }`. **`unresolved` is the point:** an `import(` or `from`
 * whose specifier is NOT a literal — held in a variable, or concatenated — matches no literal
 * pattern, and a scanner that simply found nothing there would report a clean tree while never
 * opening the chunk. That is the exact failure shape clause 5 exists to end ("the scan would have
 * looked complete"), one level further down, so an unextractable specifier FAILS CLOSED rather
 * than passing silently. Rollup does not emit computed specifiers today; this is about what the
 * gate can honestly assert, not about what today's bundler happens to do.
 */
function importSpecifiers(body) {
  const specifiers = [];
  for (const m of body.matchAll(/(?:\bimport\s*\(|\bfrom\s*|\bimport\s*)["']([^"']+)["']/g)) {
    specifiers.push(m[1]);
  }
  // Every `import(` / `from` occurrence, literal or not. A count mismatch means at least one
  // specifier is computed and therefore unreadable by this scan.
  const occurrences = [...body.matchAll(/\bimport\s*\(|\bfrom\s*["']|\bimport\s*["']/g)].length;
  return { specifiers, unresolved: Math.max(0, occurrences - specifiers.length) };
}

/** Resolve one specifier against the root-relative path of the bundle that imports it. */
function resolveSpecifier(importerSrc, specifier) {
  if (!specifier.startsWith(".")) return null; // bare or absolute — not a relative chunk
  const dir = importerSrc.slice(0, importerSrc.lastIndexOf("/"));
  const parts = `${dir}/${specifier}`.split("/");
  const out = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return `/${out.join("/")}`;
}

/**
 * Scan one bundle and everything it imports, transitively (clause 5).
 *
 * `seen` is shared across a page's scripts so a chunk two bundles share is read once, and so a
 * cyclic import graph terminates.
 */
function scanBundleTree(src, readAsset, rel, seen, failures) {
  if (seen.has(src)) return;
  seen.add(src);

  const body = readAsset(src);
  if (body === null) {
    failures.push(`[structure] ${rel}: script src ${src} does not resolve to a built asset — the bundle body cannot be scanned`);
    return;
  }

  for (const re of FORBIDDEN_CALLS) {
    if (re.test(body)) {
      failures.push(
        `[security] ${rel}: bundled script ${src} calls ${re.source} — this site navigates, it never transmits (consult 0811; the CSP's connect-src 'none' backstops this at the browser)`,
      );
    }
  }

  const { specifiers, unresolved } = importSpecifiers(body);
  if (unresolved > 0) {
    failures.push(
      `[security] ${rel}: bundled script ${src} carries ${unresolved} import(s) whose specifier is not a string literal — a computed specifier cannot be resolved, so the chunk it pulls in cannot be scanned. The scan fails closed rather than reporting a tree it could not walk.`,
    );
  }

  for (const specifier of specifiers) {
    const resolved = resolveSpecifier(src, specifier);
    if (resolved === null) {
      // A non-relative specifier in a BUILT bundle is either an unbundled dependency (which
      // would fail at runtime with no import map) or an off-origin module URL — the exact reach
      // the <script src> shape check bars, arriving one level down instead.
      failures.push(
        `[security] ${rel}: bundled script ${src} imports a non-relative specifier "${specifier}" — every chunk must be a relative same-origin sibling, never a bare or off-origin module`,
      );
      continue;
    }
    if (!EXTERNAL_SRC_SHAPE.test(resolved)) {
      failures.push(
        `[security] ${rel}: bundled script ${src} imports ${resolved}, which is outside /_astro/ or /js/ — a chunk may not escape the build directories`,
      );
      continue;
    }
    scanBundleTree(resolved, readAsset, rel, seen, failures);
  }
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

    const seenBundles = new Set();
    for (const e of external) {
      if (!EXTERNAL_SRC_SHAPE.test(e.src)) {
        failures.push(
          `[security] ${rel}: script src must be a root-relative same-origin path under /_astro/ or /js/ ending .js — never off-origin, never protocol-relative, never a traversal. Got: ${e.src}`,
        );
        continue;
      }
      // Clause 5: the bundle AND every chunk it imports, transitively.
      scanBundleTree(e.src, readAsset, rel, seenBundles, failures);
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

/** Regex-escape a literal source fragment so it can be matched verbatim. */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** The three UTM keys, which the Worker writes through a VARIABLE key in a loop rather than
 *  as literals — declared here only so unrolling that loop cannot trip the completeness scan. */
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"];

/* THE FORWARDED QUERY PARAMS, and the three things that must hold for each.
   ────────────────────────────────────────────────────────────────────────────────────────
   Every key buildAppRedirect() re-serializes onto the redirect is declared once here, with
   the reader that bounds it and the exact source text of that bound. The loop in
   scanWorkerSource() turns each row into the three assertions that used to be written out
   by hand, per param:

     MECHANISM   the value reaches the redirect through URLSearchParams.set(), never string
                 concatenation into `Location` — consult 0739's added guardrail, and the one
                 place a coding slip turns a safe design into CRLF header injection
     BOUND       the bound is still declared at exactly its agreed width, so widening,
                 narrowing or reordering it goes red
     PROVENANCE  the value handed to .set() is the one the reader PRODUCED

   Written out three times, this drifted: #3237 added the second and third param with the
   mechanism and bound halves, the provenance half arrived for those two in PR #77, and the
   ticker — the param the gate was built for — never had one at all, so a raw
   `const ticker = searchParams.get("ticker")` bypassed TICKER_PATTERN with the gate green
   (stock-analyst-platform#3268). Expressing it once is what stops the fourth param arriving
   with two of three.

   ── Standing limitation, stated once rather than re-derived per param ───────────────────
   None of this is a wiring assertion. A regex over raw source has no notion of scope,
   reachability, or code-vs-comment-vs-string-literal context. What the PROVENANCE rule buys
   is an approximation, and it buys it by piggybacking on a JS language guarantee — one
   `const <key>` binding per scope — so that pinning `const key = reader(searchParams)`
   alongside `set("key", key)` means, for as long as there is one `key` binding in play, that
   the value reaching .set() came from the reader. That closes the specific bypass class this
   gate was blind to (read the param raw off the query, leave the bounded reader beside it as
   dead code, keep the .set() call text byte-identical) and nothing wider. It does NOT catch a
   value reassigned between the two lines, a shadowing inner scope, or a .set() whose key is a
   variable rather than a literal. The completeness scan below inherits the same limits, and
   states its own reach where it sits. If this table grows well past three rows, or the forwarding gains real
   branching, the honest replacement is an AST pass over worker/index.js that follows the
   binding; that is not worth a parser dependency for three params on a straight-line function
   today (Security's ruling, twiceover-web PR #77). */
const FORWARDED_PARAMS = [
  {
    key: "ticker",
    reader: "readTicker",
    bound: "const TICKER_PATTERN = /^[A-Z]{1,6}$/;",
    mechanismWhy: "consult 0739's mechanism ruling, the guardrail this whole gate was built around",
    boundWhy: `consult 0739's trip-wire: "the forwarded value is ever anything other than the bounded ticker pattern"`,
  },
  {
    key: "category",
    reader: "readSupportCategory",
    bound: 'const SUPPORT_CATEGORIES = new Set(["billing", "broker", "read", "feedback", "other"]);',
    mechanismWhy: "consult 0739's mechanism ruling, ADR 0859 Resulting work",
    boundWhy:
      "the forwarded category is bounded to the closed five-member set support-request-form.md §6 names (billing, broker, read, feedback, other); an out-of-set value is dropped, never passed through",
  },
  {
    key: "ref",
    reader: "readSupportRef",
    bound: "const SUPPORT_REF_PATTERN = /^[0-9a-f]{8}$/;",
    mechanismWhy: "the same CRLF seam as the category above — support-request-form.md §6, AC-S2.2",
    boundWhy:
      "the forwarded Read reference is bounded to /^[0-9a-f]{8}$/ before it leaves this origin (support-request-form.md §6) — a looser shape lets an unvalidated value reach the form",
  },
];

/**
 * The Worker's forwarding guarantees. Consult 0739's own addition, gated structurally
 * rather than reviewed at PR time: this is the one place a coding slip turns a safe
 * design into a header-injection bug.
 */
export function scanWorkerSource(workerSource) {
  const failures = [];

  for (const { key, reader, bound, mechanismWhy, boundWhy } of FORWARDED_PARAMS) {
    // MECHANISM
    if (!new RegExp(`dest\\.searchParams\\.set\\("${key}",\\s*${key}\\)`).test(workerSource)) {
      failures.push(
        `[security] worker/index.js must forward the ${key} via dest.searchParams.set("${key}", ${key}) — the WHATWG URL API encodes the value, where concatenating it into the redirect URL would let a CRLF payload split the Location header (${mechanismWhy})`,
      );
    }
    // BOUND
    if (!new RegExp(escapeRe(bound)).test(workerSource)) {
      failures.push(`[security] worker/index.js must declare \`${bound}\` — ${boundWhy}`);
    }
    // PROVENANCE
    if (!new RegExp(`const ${key} = ${reader}\\(searchParams\\)`).test(workerSource)) {
      failures.push(
        `[security] worker/index.js's forwarded ${key} must be produced by ${reader}(searchParams) — a raw searchParams.get("${key}") skips the bound while leaving every other assertion in this gate satisfied`,
      );
    }
  }

  // COMPLETENESS. The table above is still a list someone maintains by hand, so on its own it
  // only covers the params somebody remembered to declare — the same one-ended shape one level
  // up, and exactly how three hand-written pairs became two-and-a-half without anything going
  // red. So close it: a key written onto the redirect with no row fails, which is what makes
  // FORWARDED_PARAMS a closed declaration rather than a record of where someone already
  // thought to look.
  //
  // Scoped to buildAppRedirect()'s body, the way the readUtm and GO_DESTINATIONS scans below
  // already scope theirs, and for the same two reasons: forwarding happens there and nowhere
  // else, and a whole-file scan fails a legitimate Worker that merely NAMES a key in a comment
  // or a string. Fails closed when the function cannot be found — a scan that silently read
  // nothing would be this gate's own one-ended shape a third time.
  //
  // What it sees, exactly: a `set(…)`/`append(…)` on `dest.searchParams`, whose key is a
  // quoted literal (single, double or backtick). What it does NOT see, and does not claim to:
  // a computed or variable key, or the same call reached through an alias
  // (`const sp = dest.searchParams; sp.set(…)`). Those are the same limits the standing note
  // above gives the other three rules — a regex has no notion of what an identifier is bound
  // to — and none of them was covered before this check existed either.
  const forwardBody = workerSource.match(/export function buildAppRedirect\([\s\S]*?\n}/)?.[0] ?? "";
  if (!forwardBody) {
    failures.push(
      `[security] worker/index.js must declare \`export function buildAppRedirect(\` as a top-level function — the forwarded-key completeness scan has no body to read, and a scan that read nothing would pass every undeclared param`,
    );
  }
  const declaredKeys = new Set([...FORWARDED_PARAMS.map((p) => p.key), ...UTM_KEYS]);
  for (const [, key] of forwardBody.matchAll(/dest\.searchParams\.(?:set|append)\(\s*["'`]([^"'`]*)["'`]/g)) {
    if (!declaredKeys.has(key)) {
      failures.push(
        `[security] worker/index.js forwards "${key}" onto the redirect but declares it in no FORWARDED_PARAMS row — every forwarded key needs its mechanism, bound and reader pinned here before it may leave this origin (consult 0739)`,
      );
    }
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
  // Same guard, same sink, for the /contact deep-link params (#3237). A Read reference is not
  // personal data, but it identifies one user's analysis — writeSiteMetric's six-field blob
  // contract is cookieless, aggregate site measurement (ADR 0136) and neither key belongs in it.
  if (/\b(category|ref)\b/i.test(readUtmBody)) {
    failures.push(
      `[security] readUtm() must never read the support category or the Read reference — its return value feeds writeSiteMetric's blobs, which are cookieless aggregate site measurement (ADR 0136 / consult 0163)`,
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
    `Entry box security check passed: ${pages.length} built page(s) against the declared script expectation (no undeclared script, inline or bundled; every src root-relative same-origin; no fetch/XHR/WebSocket/sendBeacon in any inline body, bundle, or transitively imported chunk; no inline handlers), name="ticker", method="get", action="/go/try", URLSearchParams-encoded + pattern-bounded forwarding.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
