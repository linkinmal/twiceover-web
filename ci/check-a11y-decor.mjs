#!/usr/bin/env node
/**
 * Automated a11y gate over the BUILT home page (dist/index.html), per #734 /
 * site-prelaunch.md §6 "Engineer handoff" (v2.4 redeploy build note): "verify
 * these render with no interactive semantics — a screen reader or an automated
 * a11y check finding a focusable, non-functional control here is a defect."
 * Scoped since homepage v3.4 (stock-analyst-platform#3829) to the page's static illustrations of
 * the product: the product cards (`.dcard` — the hero deck's slides and the Portfolio section's two
 * cards) and the phone mockup (`.phone`). They replaced the retired Two-doors decorations
 * (`.door__decor`) as the page's control-shaped-but-inert markup: rows with a chevron, a "Run the …
 * analysis ›" pill, tab-bar items. None of it does anything, so none of it may be focusable.
 *
 * Checks, per illustration:
 *   - no live focusable control markup inside (<button>, <a>, <input>, <select>, <textarea>, or a
 *     non-negative tabindex) — the deck's real controls live OUTSIDE the cards, in `.deck-ctl`
 *   - no live-CTA class (`.btn-quiet` / `.btn-filled`) — the actual #734/#421 defect: a decoy
 *     styled with the real CTA class, not just a stray tag
 *   - the count is the page's own (structure), so a renamed class cannot pass by matching nothing
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

// 4 hero-deck slides + the Portfolio section's two cards; 1 phone. PENDING stock-analyst-platform#3963
// item 4: the deck's options and earnings-history slides raise the first to 8 when their data lands.
const EXPECTED = { dcard: 6, phone: 1 };

for (const [className, expected] of Object.entries(EXPECTED)) {
  const found = divsByClass(html, className);
  if (found.length !== expected) {
    failures.push(`[structure] expected ${expected} .${className} illustration(s), found ${found.length}`);
  }
  for (const { openTag, block } of found) {
    const label = openTag.slice(0, 80);
    if (/<(button|a|input|select|textarea)\b/i.test(block)) {
      failures.push(`[a11y] .${className} illustration contains a live focusable control tag: ${label}…`);
    }
    const badTabindex = block.match(/tabindex="(?!-1")[^"]*"/i);
    if (badTabindex) {
      failures.push(`[a11y] .${className} illustration has a non-negative tabindex: ${badTabindex[0]}`);
    }
    if (/class="[^"]*\bbtn-(quiet|filled)\b/.test(block)) {
      failures.push(`[a11y] .${className} illustration carries a live CTA class: ${label}…`);
    }
  }
}

if (failures.length) {
  console.error("A11Y DECORATION CHECK FAILED:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} violation(s).`);
  process.exit(1);
}
console.log(
  `A11y decoration check passed: ${EXPECTED.dcard} product card(s) and ${EXPECTED.phone} phone, no focusable controls.`,
);
