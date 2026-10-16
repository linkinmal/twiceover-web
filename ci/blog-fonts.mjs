#!/usr/bin/env node
/**
 * Blog font gate (stock-analyst-platform#4233; ADR 1088 Decision 2; Architect ruling on #4233).
 *
 * The blog ships ten themes, each with its own faces, self-hosted from public/fonts/. A post page
 * must fetch only the faces its theme uses, within a size ceiling, so the budget is per theme: the
 * shell's faces + the theme's faces + the site-wide faces every page already loads. This gate keeps
 * four things true:
 *   1. every file a stylesheet names exists;
 *   2. no font file is orphaned (named by neither site.css nor blog-fonts.css);
 *   3. every family has its OFL licence beside the files (public/fonts/licenses/<family>.txt);
 *   4. no theme's total (worst case: every face it could request) exceeds CEILING_BYTES.
 * It also pins what the design needs of each @font-face: swap, and U+2212 (the minus sign the
 * payoff and volatility blocks print) inside the unicode-range.
 *
 * Pure functions are exported for the tests; the CLI at the bottom reads the repo.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Faces every blog page requests regardless of theme: the shell (Newsreader display, Source Sans 3 text)
 * and the mono the kit sets as the default `--fm`. Source Sans 3 and Source Code Pro are declared by
 * site.css, so a visitor who has seen any page of the site already holds them. */
export const BASE_FACES = [
  "newsreader-latin-opsz-normal",
  "newsreader-latin-opsz-italic",
  "source-sans-3-latin-wght-normal",
  "source-sans-3-latin-wght-italic",
  "source-code-pro-latin-wght-normal",
];

/** The faces each theme adds, from the kit's `[data-look]` blocks (blog-kit-2026-10-10-v2.html). */
export const THEME_FACES = {
  house: ["source-serif-4-latin-opsz-normal"],
  nightdesk: ["big-shoulders-display-latin-wght-normal"],
  marker: ["source-serif-4-latin-opsz-normal", "caveat-latin-wght-normal"],
  blueprint: ["bricolage-grotesque-latin-opsz-normal"],
  newsprint: [
    "fraunces-latin-opsz-normal",
    "source-serif-4-latin-opsz-normal",
    "source-serif-4-latin-opsz-italic",
  ],
  neon: ["fraunces-latin-opsz-italic", "bricolage-grotesque-latin-opsz-normal"],
  riso: ["bricolage-grotesque-latin-opsz-normal"],
  exhibit: ["archivo-latin-wdth-normal"],
  ticket: ["besley-latin-wght-normal"],
  printout: [
    "ibm-plex-mono-latin-400-normal",
    "ibm-plex-mono-latin-500-normal",
    "ibm-plex-mono-latin-700-normal",
  ],
};

/** Per-theme ceiling on font bytes: a regression guard, not a performance budget. Ratified at 520,000 by the
 * Architect (stock-analyst-platform#4233) over a measured worst case of 511,260 (Newsprint); a new face or a
 * wider axis must show up as a deliberate edit here. Real fetched bytes are measured on the live site. */
export const CEILING_BYTES = 520_000;

/** Every woff2 a stylesheet names, with its @font-face block. */
export function parseFontFaces(css) {
  const faces = [];
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const block = m[1];
    const url = block.match(/url\(\s*["']?\/fonts\/([^"')]+\.woff2)["']?\s*\)/);
    if (!url) continue;
    faces.push({
      file: url[1].replace(/\.woff2$/, ""),
      family: (block.match(/font-family:\s*["']?([^;"']+)["']?\s*;/) ?? [])[1] ?? "",
      display: (block.match(/font-display:\s*([a-z]+)/) ?? [])[1] ?? "",
      range: (block.match(/unicode-range:\s*([^;]+);/) ?? [])[1] ?? "",
    });
  }
  return faces;
}

/** Does a unicode-range list cover the code point? */
export function rangeCovers(range, codePoint) {
  for (const part of range.split(",")) {
    const m = part.trim().match(/^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/);
    if (!m) continue;
    const lo = parseInt(m[1], 16);
    const hi = m[2] ? parseInt(m[2], 16) : lo;
    if (codePoint >= lo && codePoint <= hi) return true;
  }
  return false;
}

/** The licence stem a font file is covered by: archivo-latin-wdth-normal -> archivo. */
export function licenceStem(file) {
  return file.replace(/-latin-.*$/, "");
}

/** Per-theme totals: the shell and site-wide faces plus the theme's, each file once. */
export function themeTotals(sizes, base = BASE_FACES, themes = THEME_FACES) {
  const totals = {};
  for (const [theme, faces] of Object.entries(themes)) {
    totals[theme] = [...new Set([...base, ...faces])].reduce((n, f) => n + (sizes[f] ?? 0), 0);
  }
  return totals;
}

/**
 * @param {{blogCss:string, siteCss:string, sizes:Record<string,number>, licences:string[],
 *          ceiling?:number, base?:string[], themes?:Record<string,string[]>}} input
 *   sizes: bytes per file stem present in public/fonts; licences: stems present in public/fonts/licenses
 * @returns {string[]} failure messages (empty when the gate passes)
 */
export function checkBlogFonts({
  blogCss,
  siteCss,
  sizes,
  licences,
  ceiling = CEILING_BYTES,
  base = BASE_FACES,
  themes = THEME_FACES,
}) {
  const failures = [];
  const blogFaces = parseFontFaces(blogCss);
  const siteFaces = parseFontFaces(siteCss);
  const named = new Set([...blogFaces, ...siteFaces].map((f) => f.file));

  for (const f of blogFaces) {
    if (f.display !== "swap") failures.push(`blog-fonts.css: ${f.file} must set font-display: swap (has "${f.display}")`);
    if (!rangeCovers(f.range, 0x2212)) failures.push(`blog-fonts.css: ${f.file} unicode-range omits U+2212 (the minus sign)`);
  }
  for (const f of named) {
    if (!(f in sizes)) failures.push(`${f}.woff2 is named by a stylesheet but missing from public/fonts/`);
  }
  for (const f of Object.keys(sizes)) {
    if (!named.has(f)) failures.push(`${f}.woff2 is in public/fonts/ but named by no stylesheet (orphan)`);
  }
  for (const f of named) {
    if (!licences.includes(licenceStem(f))) failures.push(`${f}: no licence public/fonts/licenses/${licenceStem(f)}.txt`);
  }
  for (const [theme, faces] of Object.entries(themes)) {
    for (const f of [...base, ...faces]) {
      if (!named.has(f)) failures.push(`theme ${theme}: face ${f} is not declared by any stylesheet`);
    }
  }
  const totals = themeTotals(sizes, base, themes);
  for (const [theme, bytes] of Object.entries(totals)) {
    if (bytes > ceiling) failures.push(`theme ${theme}: ${bytes} bytes of fonts exceeds the ${ceiling}-byte ceiling`);
  }
  return failures;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const fontsDir = join(root, "public", "fonts");
  const sizes = {};
  for (const f of readdirSync(fontsDir)) {
    if (f.endsWith(".woff2")) sizes[f.replace(/\.woff2$/, "")] = statSync(join(fontsDir, f)).size;
  }
  const licDir = join(fontsDir, "licenses");
  const licences = existsSync(licDir) ? readdirSync(licDir).map((f) => f.replace(/\.txt$/, "")) : [];
  const failures = checkBlogFonts({
    blogCss: readFileSync(join(root, "src", "styles", "blog-fonts.css"), "utf8"),
    siteCss: readFileSync(join(root, "src", "styles", "site.css"), "utf8"),
    sizes,
    licences,
  });
  const totals = themeTotals(sizes);
  for (const [theme, bytes] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${theme.padEnd(10)} ${String(bytes).padStart(7)} bytes`);
  }
  if (failures.length) {
    console.error(`\nBlog font gate FAILED (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`Blog font gate passed: ${Object.keys(sizes).length} files, ${Object.keys(totals).length} themes within ${CEILING_BYTES} bytes.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
