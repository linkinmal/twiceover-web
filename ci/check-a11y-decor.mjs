#!/usr/bin/env node
/**
 * Automated a11y gate over the BUILT home page (dist/index.html), per #734 /
 * site-prelaunch.md §6 "Engineer handoff" (v2.4 redeploy build note): "verify
 * these render with no interactive semantics — a screen reader or an automated
 * a11y check finding a focusable, non-functional control here is a defect."
 * Scoped to the Two-doors section's static illustrative decorations
 * (`.door__decor`), the only static-but-input-shaped markup on the page.
 *
 * Checks, per decoration wrapper:
 *   - the wrapper carries role="presentation" (screen readers skip its children
 *     as a group rather than announcing an input/button that does nothing)
 *   - no live focusable control markup inside (<button>, <a>, <select>,
 *     <textarea>, or a non-negative tabindex)
 *   - any <input> is disabled (belt-and-suspenders alongside role/aria-hidden)
 *   - no live-CTA class (`.btn-quiet`) — the actual #734/#421 defect: a decoy
 *     styled with the real accent-border/hover CTA class, not just a stray tag
 *
 * Run after `astro build` (same dependency as ci/check-content.mjs).
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

/** Outer HTML of every top-level <div> whose class attribute contains `className`,
 *  matched by counting nested <div>/</div> tags (no DOM parser dependency). */
function divsByClass(source, className) {
  const openTagRe = new RegExp(`<div\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`, "g");
  const results = [];
  let m;
  while ((m = openTagRe.exec(source))) {
    const start = m.index;
    let i = openTagRe.lastIndex;
    let depth = 1;
    while (depth > 0) {
      const nextOpen = source.indexOf("<div", i);
      const nextClose = source.indexOf("</div>", i);
      if (nextClose === -1) throw new Error("unbalanced <div> in dist/index.html");
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        i = nextClose + 6;
      }
    }
    results.push({ openTag: m[0], block: source.slice(start, i) });
  }
  return results;
}

const failures = [];
const decorations = divsByClass(html, "door__decor");

if (decorations.length !== 2) {
  failures.push(
    `[structure] expected 2 static door decorations (Two doors §2 — entry + positions), found ${decorations.length}`,
  );
}

for (const { openTag, block } of decorations) {
  if (!/\brole="presentation"/.test(openTag)) {
    failures.push(`[a11y] door decoration missing role="presentation": ${openTag}`);
  }
  if (/<(button|a|select|textarea)\b/i.test(block)) {
    failures.push(`[a11y] door decoration contains a live focusable control tag: ${block}`);
  }
  const badTabindex = block.match(/tabindex="(?!-1")[^"]*"/i);
  if (badTabindex) {
    failures.push(`[a11y] door decoration has a non-negative tabindex: ${badTabindex[0]}`);
  }
  for (const input of block.match(/<input\b[^>]*>/gi) ?? []) {
    if (!/\bdisabled\b/.test(input)) {
      failures.push(`[a11y] door decoration <input> is not disabled: ${input}`);
    }
  }
  if (/class="[^"]*\bbtn-quiet\b/.test(block)) {
    failures.push(`[a11y] door decoration carries the live .btn-quiet CTA class: ${block}`);
  }
}

if (failures.length) {
  console.error("A11Y DECORATION CHECK FAILED:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} violation(s).`);
  process.exit(1);
}
console.log(`A11y decoration check passed: ${decorations.length} static door decoration(s), no focusable controls.`);
