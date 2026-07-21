#!/usr/bin/env node
/**
 * Security gate over the BUILT home page (dist/index.html), per #1240 / ADR 0383 /
 * site-prelaunch.md §6 v2.6 redeploy build note (g). Enforces Security consult 0384's
 * three guardrails structurally, not procedurally:
 *   (a) never interpolate the typed value
 *   (b) never capture, log, or transmit it
 *   (c) no network call
 *
 * Checks, over the entry-box form + its enhancement script:
 *   - the <form> exists, action="#demo-read" exactly (never an external or app URL)
 *   - the ticker <input> carries NO name attribute (the no-JS security guarantee —
 *     an unnamed field is excluded from form serialization by the HTML spec itself,
 *     so even a real no-JS submit sends nothing)
 *   - the submit <button> is type="submit", not disabled
 *   - the inline enhancement script contains none of fetch(/XMLHttpRequest/WebSocket/
 *     sendBeacon, and never reads `.value` off any element
 *
 * Run after `astro build` (same dependency as ci/check-content.mjs / check-a11y-decor.mjs).
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(root, "dist", "index.html");

let html;
try {
  html = readFileSync(indexPath, "utf8");
} catch {
  console.error(`FATAL: ${indexPath} not found — run \`npm run build\` first.`);
  process.exit(1);
}

const failures = [];

// ── The form ────────────────────────────────────────────────────────────────
const formMatch = html.match(/<form\b[^>]*id="demo-form"[^>]*>/);
if (!formMatch) {
  failures.push(`[structure] no <form id="demo-form"> found in dist/index.html`);
} else {
  const openTag = formMatch[0];
  const actionMatch = openTag.match(/action="([^"]*)"/);
  if (!actionMatch || actionMatch[1] !== "#demo-read") {
    failures.push(
      `[security] entry-box form action must be exactly "#demo-read" (never an external or app URL), got: ${actionMatch ? actionMatch[1] : "(missing)"}`,
    );
  }
}

// ── The ticker input ────────────────────────────────────────────────────────
// Scoped to the form block itself, not the whole document — the mock's own
// side-by-side comparison markup (never shipped, but a defensive scope anyway)
// could otherwise confuse a document-wide input scan.
const formBlockMatch = html.match(/<form\b[^>]*id="demo-form"[\s\S]*?<\/form>/);
const formBlock = formBlockMatch ? formBlockMatch[0] : "";
const tickerInputs = formBlock.match(/<input\b[^>]*>/gi) ?? [];
if (tickerInputs.length !== 1) {
  failures.push(`[structure] expected exactly 1 <input> inside the demo-form, found ${tickerInputs.length}`);
}
for (const input of tickerInputs) {
  if (/\bname="/i.test(input)) {
    failures.push(
      `[security] the ticker <input> must carry NO name attribute — an unnamed field is excluded from form serialization by the HTML spec, which is the no-JS guarantee that the typed value can never reach a URL, server log, or CDN access log. Found: ${input}`,
    );
  }
}

// ── The submit button ───────────────────────────────────────────────────────
const submitButtons = formBlock.match(/<button\b[^>]*>/gi) ?? [];
if (submitButtons.length !== 1) {
  failures.push(`[structure] expected exactly 1 <button> inside the demo-form, found ${submitButtons.length}`);
}
for (const btn of submitButtons) {
  if (!/type="submit"/i.test(btn)) {
    failures.push(`[a11y] entry-box submit must be type="submit": ${btn}`);
  }
  if (/\bdisabled\b/i.test(btn)) {
    failures.push(`[a11y] entry-box submit must not be disabled: ${btn}`);
  }
}

// ── The enhancement script — structural, not procedural ────────────────────
const scriptMatches = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
const demoScript = scriptMatches.map((m) => m[1]).find((body) => body.includes("demo-form"));

if (!demoScript) {
  failures.push(`[structure] no inline enhancement script referencing "demo-form" found in dist/index.html`);
} else {
  const forbiddenCalls = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsendBeacon\b/];
  for (const re of forbiddenCalls) {
    if (re.test(demoScript)) {
      failures.push(`[security] demo enhancement script must never call ${re.source} — the demo has nothing to send anywhere`);
    }
  }
  // `.value` read: the handler must never read the typed value off any element
  // (a variable assignment, template interpolation, or discarded expression).
  if (/\.value\b/.test(demoScript)) {
    failures.push(`[security] demo enhancement script must never read .value off any element — the guardrail is structural, not a discipline to remember`);
  }
}

if (failures.length) {
  console.error("DEMO CONTROL SECURITY CHECK FAILED:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} violation(s).`);
  process.exit(1);
}
console.log("Demo control security check passed: unnamed input, #demo-read-only action, no forbidden network/.value calls.");
