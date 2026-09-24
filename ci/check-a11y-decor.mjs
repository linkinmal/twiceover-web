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
 * The two explainer pages (stock-analyst-platform#3829, ADR 0993) are held to the same rule: their
 * product pictures (`.app`, the signed Portfolio/Position artifact's own markup) and section cards
 * (`.xp-card`) and the analysis screenshot (`.xp-shot`) render the artifact's links, sort buttons,
 * section nav and disclosure as plain text.
 *
 * Run after `astro build` (same dependency as ci/check-content.mjs).
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
      if (nextClose === -1) throw new Error("unbalanced <div> in a built page");
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

const EXPECTED = {
  // 4 hero-deck slides + the Portfolio section's two cards; 1 phone. PENDING stock-analyst-platform#3963
  // item 4: the deck's options and earnings-history slides raise the first to 8 when their data lands.
  "index.html": { dcard: 6, phone: 1 },
  // The 13 section cards and the hero's analysis screenshot.
  "how-our-analysis-works/index.html": { "xp-card": 13, "xp-shot": 1 },
  // The seven product pictures: the portfolio desk, two row close-ups, the position page, the rules,
  // scenarios and paths cards.
  "your-portfolio/index.html": { app: 7 },
};

for (const [page, classes] of Object.entries(EXPECTED)) {
  const path = join(root, "dist", page);
  let html;
  try {
    html = readFileSync(path, "utf8");
  } catch {
    console.error(`FATAL: ${path} not found — run \`npm run build\` first.`);
    process.exit(1);
  }
  for (const [className, expected] of Object.entries(classes)) {
    const found = divsByClass(html, className);
    if (found.length !== expected) {
      failures.push(`[structure] ${page}: expected ${expected} .${className} illustration(s), found ${found.length}`);
    }
    for (const { openTag, block } of found) {
      const label = `${page} ${openTag.slice(0, 80)}`;
      if (/<(button|a|input|select|textarea|details|summary)\b/i.test(block)) {
        failures.push(`[a11y] .${className} illustration contains a live focusable control tag: ${label}…`);
      }
      const badTabindex = block.match(/tabindex="(?!-1")[^"]*"/i);
      if (badTabindex) {
        failures.push(`[a11y] ${page}: .${className} illustration has a non-negative tabindex: ${badTabindex[0]}`);
      }
      if (/class="[^"]*\bbtn-(quiet|filled)\b/.test(block)) {
        failures.push(`[a11y] .${className} illustration carries a live CTA class: ${label}…`);
      }
    }
  }
}

if (failures.length) {
  console.error("A11Y DECORATION CHECK FAILED:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} violation(s).`);
  process.exit(1);
}
const total = Object.values(EXPECTED).flatMap(Object.values).reduce((a, b) => a + b, 0);
console.log(`A11y decoration check passed: ${total} illustrations across ${Object.keys(EXPECTED).length} pages, no focusable controls.`);
