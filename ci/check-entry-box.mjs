#!/usr/bin/env node
/**
 * Security gate over the BUILT home page (dist/index.html) and the Worker source,
 * per #2520 / ADR 0383 Amendment 1 / Security consult 0739.
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
 * What consult 0739 pins structurally instead — cheap to check, and the point is to convert
 * "please remember" into "the build fails otherwise":
 *   (a) name="ticker" exactly — nothing else may be serialized off this form
 *   (b) method="get" exactly — never "post", which carries a body off-URL
 *   (c) action="/go/try" exactly — never external, never another on-origin route
 *   (d) the Worker forwards the ticker via URLSearchParams, never string concatenation
 *       into the redirect URL (the CRLF header-injection seam — 0739's own addition)
 *   (e) unchanged from 0384: no inline script may read `.value` or call fetch/XHR/
 *       WebSocket/sendBeacon, and no inline on*= handler may appear anywhere
 *
 * (e) is carried forward verbatim because it targets script-driven exfiltration that
 * bypasses the visible form — a different threat from the plain-GET shape this build uses,
 * and one this page still has no legitimate need for.
 *
 * Run after `astro build` (same dependency as ci/check-content.mjs / check-a11y-decor.mjs).
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(root, "dist", "index.html");
const workerPath = join(root, "worker", "index.js");

let html;
try {
  html = readFileSync(indexPath, "utf8");
} catch {
  console.error(`FATAL: ${indexPath} not found — run \`npm run build\` first.`);
  process.exit(1);
}

const failures = [];

// ── The form: all three attributes pinned exactly ───────────────────────────
const formMatch = html.match(/<form\b[^>]*id="entry-form"[^>]*>/);
if (!formMatch) {
  failures.push(`[structure] no <form id="entry-form"> found in dist/index.html`);
} else {
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
}

// ── The ticker input: exactly one, named exactly "ticker" ───────────────────
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

// ── The submit button ───────────────────────────────────────────────────────
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

// ── Every inline script in the document — structural, not procedural ───────
// Scans ALL inline <script> blocks rather than one identified by its contents: a second,
// unrelated script is exactly the bypass a narrower scan misses (Architect review, PR #23).
// The enhancement script this gate used to REQUIRE is gone with the reveal panel it drove;
// the page is now plain HTML, so nothing here is expected to match at all.
const scriptMatches = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
const executableBodies = scriptMatches
  .filter((m) => !/type="application\/(ld\+json|json)"/i.test(m[0]))
  .map((m) => m[1]);

const forbiddenCalls = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsendBeacon\b/];
for (const body of executableBodies) {
  for (const re of forbiddenCalls) {
    if (re.test(body)) {
      failures.push(`[security] an inline script must never call ${re.source} — this page navigates, it never transmits`);
    }
  }
  if (/\.value\b/.test(body)) {
    failures.push(`[security] an inline script must never read .value off any element — the guardrail is structural, not a discipline to remember`);
  }
}

// ── No inline event-handler attributes anywhere in the document ────────────
// An inline on*="..." handler (onclick, onblur, oninput, …) has no legitimate use on this
// page and is how a script-scoped scan gets bypassed (Architect review, PR #23) — barred
// outright rather than pattern-matched. Matched only inside a tag's attribute list.
const inlineHandlerMatches = html.match(/<[a-z][^>]*\son[a-z]+\s*=\s*["']/gi) ?? [];
for (const m of inlineHandlerMatches) {
  failures.push(`[security] inline event-handler attribute found — this page runs no JavaScript at all: ${m}…`);
}

// ── The Worker's forwarding must use URLSearchParams, never concatenation ───
// Consult 0739's own addition, gated structurally rather than reviewed at PR time: this is
// the one place a coding slip turns a safe design into a header-injection bug.
let workerSource;
try {
  workerSource = readFileSync(workerPath, "utf8");
} catch {
  failures.push(`[structure] ${workerPath} not found — the ticker-forwarding check cannot run`);
}
if (workerSource) {
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
  // The typed value must never reach analytics — consult 0163's guardrail, restated as
  // 0739's trip-wire ("the ticker value starts being captured into twiceover-web's own
  // analytics/metrics"). readUtm is the only thing that feeds writeSiteMetric's blobs.
  const readUtmBody = workerSource.match(/export function readUtm\([\s\S]*?\n}/)?.[0] ?? "";
  if (/ticker/i.test(readUtmBody)) {
    failures.push(
      `[security] readUtm() must never read the ticker — its return value feeds writeSiteMetric's blobs, and the typed value may not enter analytics (consult 0163 / 0739 trip-wire)`,
    );
  }
}

if (failures.length) {
  console.error("ENTRY BOX SECURITY CHECK FAILED:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} violation(s).`);
  process.exit(1);
}
console.log(
  'Entry box security check passed: name="ticker", method="get", action="/go/try", URLSearchParams-encoded + pattern-bounded forwarding, no script/.value/network, no inline handlers.',
);
