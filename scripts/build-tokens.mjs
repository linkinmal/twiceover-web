#!/usr/bin/env node
/**
 * tokens/twiceover.tokens.json (DTCG, byte-identical copy of the canonical file in
 * stock-analyst-platform /ai-team/design/tokens/) -> src/styles/tokens.css
 *
 * Per ADR 0004 / consultation 0005: dependency-free; emits SEMANTIC-ONLY custom
 * properties (aliases resolved, primitives inlined — color.warm-ink.* / color.navy.*
 * etc. are never exposed) plus named composite classes for the typography.* roles.
 * The output is generated at build time and gitignored — never hand-edited.
 *
 * v1.0.0 (ADR 0035, two-theme "Ledger" identity; consult 0067): the site-safe
 * semantic set lives under themes.light (default) / themes.dark (variant). This
 * build emits themes.light -> :root and themes.dark -> [data-theme="dark"];
 * theme-invariant groups (font.*, typography.*, space.*, radius.*) emit once into
 * :root. App-only groups (signal, health, elevation, motion, path-card) sit
 * OUTSIDE themes.* at the JSON root and are NEVER walked by this build (#34, Q5).
 *
 * v1.0.1 (#159/#417): three more site-safe groups sit outside themes.* as their
 * own top-level keys (not app-only — the site's v2.3 hero/showcase reuse them):
 * accent-surface.{light,dark}.* (reserved Paths/Outlook standout), surface.panel
 * (full-bleed parchment band), text-link (inline link/handle blue). Each emits
 * --accent-surface-*, --surface-panel, --text-link per theme.
 *
 * Two CI gates run before the CSS is written (both process.exit(1) on failure):
 *  - Contrast gate (consult 0067 Q2): WCAG 2.1 AA over every site-safe text/accent
 *    /border/focus pairing against its bg.* per theme. A theme value that fails its
 *    role cannot merge.
 *  - Containment lint (consult 0067 Q5): no app-only custom property may appear in
 *    the emitted site CSS.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ratio } from "./contrast.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(join(root, "tokens/twiceover.tokens.json"), "utf8"));

/** Look up a {dot.path} reference in the token tree and return its raw $value. */
function lookup(path) {
  let node = tokens;
  for (const key of path.split(".")) {
    node = node?.[key];
    if (node === undefined) throw new Error(`Unresolvable token reference: {${path}}`);
  }
  if (node.$value === undefined) throw new Error(`Reference {${path}} has no $value`);
  return node.$value;
}

/** Resolve aliases ("{a.b}") recursively to concrete values. */
function resolve(value) {
  if (typeof value === "string") {
    const m = value.match(/^\{(.+)\}$/);
    return m ? resolve(lookup(m[1])) : value;
  }
  if (Array.isArray(value)) return value.map(resolve);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
  }
  return value;
}

// Site-safe semantic color groups, in emit order. Primitives (color.*) are never
// emitted — they are inlined here via resolve(), same as before the re-architecture.
const COLOR_GROUPS = ["bg", "text", "border", "accent", "focus"];

/** Resolve one theme's site-safe color groups to a flat { "bg-canvas": "#…", … } map. */
function resolveThemeColors(theme) {
  const out = {};
  for (const group of COLOR_GROUPS) {
    const node = theme[group];
    if (!node) continue;
    for (const [name, def] of Object.entries(node)) {
      if (name.startsWith("$")) continue;
      out[`${group}-${name}`] = resolve(def.$value);
    }
  }
  return out;
}

const light = resolveThemeColors(tokens.themes.light);
const dark = resolveThemeColors(tokens.themes.dark);

// v1.0.1 read-surface additions (#159/#417): accent-surface.* (the reserved Paths/
// Outlook pair standout, reused on the site for the hero product-proof visual and
// showcase band), surface.panel (full-bleed parchment band), text-link (inline
// link/handle blue, distinct from accent-surface). These sit OUTSIDE themes.* at
// the JSON root (their own top-level groups), so they need their own resolve step.
function resolveNamedColors(node) {
  const out = {};
  for (const [name, def] of Object.entries(node)) {
    if (name.startsWith("$")) continue;
    out[name] = resolve(def.$value);
  }
  return out;
}
const accentSurfaceLight = resolveNamedColors(tokens["accent-surface"].light);
const accentSurfaceDark = resolveNamedColors(tokens["accent-surface"].dark);
const surfacePanelLight = resolve(tokens.surface.panel.light.$value);
const surfacePanelDark = resolve(tokens.surface.panel.dark.$value);
const textLinkLight = resolve(tokens["text-link"].light.$value);
const textLinkDark = resolve(tokens["text-link"].dark.$value);

// CSS family names need quoting only when they contain spaces (multi-word names
// like "Source Sans 3"). Single-token names — including hyphenated ones like
// -apple-system and the generic keywords sans-serif / ui-monospace — MUST stay
// unquoted, or the browser treats the generic fallback as a missing custom family.
const cssFamilyList = (families) =>
  families.map((f) => (f.includes(" ") ? `"${f}"` : f)).join(", ");

// ---------------------------------------------------------------------------
// Contrast gate (consult 0067 Q2) — WCAG 2.1 relative luminance, ratio
// (L1+0.05)/(L2+0.05). Mirrors ai-team/design/tokens/ledger-contrast-check.py.
// Arithmetic lives in ./contrast.mjs (ADR 0157 §Resulting work — the NaN
// fail-open fix; see that module for the malformed-input-throws test coverage).
// Thresholds: body/UI text >=4.5, non-text UI (border/focus) >=3.0.
// ---------------------------------------------------------------------------
const BG = ["bg-canvas", "bg-surface", "bg-raised"];
const BODY_TEXT = ["text-primary", "text-long-form", "text-secondary", "text-muted"];

/** Build the site-safe pairing list for one resolved theme map. */
function pairings(t) {
  const pairs = [];
  const vs = (fg, need) => BG.forEach((bg) => pairs.push([`${fg} / ${bg}`, t[fg], t[bg], need]));
  BODY_TEXT.forEach((tx) => vs(tx, 4.5)); // body/UI text on every surface
  vs("accent-default", 4.5); // accent as link text
  vs("accent-hover", 4.5);
  vs("border-interactive", 3.0); // non-text UI boundary (WCAG 1.4.11)
  vs("focus-ring", 3.0);
  pairs.push(["text-on-accent / accent-default", t["text-on-accent"], t["accent-default"], 4.5]);
  pairs.push(["text-on-accent / accent-active", t["text-on-accent"], t["accent-active"], 4.5]);
  return pairs;
}

const fails = [];
let checked = 0;
for (const [theme, t] of [["light", light], ["dark", dark]]) {
  for (const [label, fg, bg, need] of pairings(t)) {
    checked++;
    const r = ratio(fg, bg);
    if (r < need) {
      fails.push(`  XX [${theme}] ${label.padEnd(34)} ${fg} on ${bg}  ${r.toFixed(2)}:1  (need ${need})`);
    }
  }
  // v1.0.1 read-surface additions (#417): accent-surface text-on-container pairs
  // (the reserved Paths/Outlook standout, reused for the hero visual + showcase
  // band) and text-link against every site bg — same AA bar as the rest.
  const asSurface = theme === "light" ? accentSurfaceLight : accentSurfaceDark;
  const link = theme === "light" ? textLinkLight : textLinkDark;
  const extras = [
    ["accent-surface.on-surface / .container", asSurface["on-surface"], asSurface.container, 4.5],
    ["accent-surface.on-surface-muted / .container", asSurface["on-surface-muted"], asSurface.container, 4.5],
    ...BG.map((bg) => [`text-link / ${bg}`, link, t[bg], 4.5]),
  ];
  for (const [label, fg, bg, need] of extras) {
    checked++;
    const r = ratio(fg, bg);
    if (r < need) {
      fails.push(`  XX [${theme}] ${label.padEnd(34)} ${fg} on ${bg}  ${r.toFixed(2)}:1  (need ${need})`);
    }
  }
}
if (fails.length) {
  console.error(`\nContrast gate FAILED — ${fails.length}/${checked} site-safe pairing(s) miss WCAG 2.1 AA:`);
  console.error(fails.join("\n"));
  console.error("\nA theme value cannot merge while it fails its role. Fix the token in themes.* and re-run.\n");
  process.exit(1);
}
console.log(`contrast gate OK — ${checked}/${checked} site-safe AA pairings pass (light + dark)`);

// ---------------------------------------------------------------------------
// Emit CSS.
// ---------------------------------------------------------------------------
const css = [];
css.push("/* GENERATED by scripts/build-tokens.mjs from tokens/twiceover.tokens.json — do not edit. */");

// :root — light theme (default) + all theme-invariant tokens.
css.push(":root {");
for (const [name, value] of Object.entries(light)) css.push(`  --color-${name}: ${value};`);
for (const [name, value] of Object.entries(accentSurfaceLight)) css.push(`  --accent-surface-${name}: ${value};`);
css.push(`  --surface-panel: ${surfacePanelLight};`);
css.push(`  --text-link: ${textLinkLight};`);

for (const [name, def] of Object.entries(tokens.font.family)) {
  if (name.startsWith("$")) continue;
  css.push(`  --font-family-${name}: ${cssFamilyList(resolve(def.$value))};`);
}
for (const scale of ["weight", "size", "line-height", "letter-spacing"]) {
  for (const [name, def] of Object.entries(tokens.font[scale])) {
    if (name.startsWith("$")) continue;
    css.push(`  --font-${scale}-${name}: ${resolve(def.$value)};`);
  }
}
for (const [name, def] of Object.entries(tokens.space)) {
  if (name.startsWith("$")) continue;
  css.push(`  --space-${name}: ${resolve(def.$value)};`);
}
for (const [name, def] of Object.entries(tokens.radius)) {
  if (name.startsWith("$")) continue;
  css.push(`  --radius-${name}: ${resolve(def.$value)};`);
}
css.push("}");

// [data-theme="dark"] — variant theme color overrides only (invariants inherit :root).
css.push('[data-theme="dark"] {');
for (const [name, value] of Object.entries(dark)) css.push(`  --color-${name}: ${value};`);
for (const [name, value] of Object.entries(accentSurfaceDark)) css.push(`  --accent-surface-${name}: ${value};`);
css.push(`  --surface-panel: ${surfacePanelDark};`);
css.push(`  --text-link: ${textLinkDark};`);
css.push("}");

// Composite classes for the typography.* roles.
for (const [name, def] of Object.entries(tokens.typography)) {
  if (name.startsWith("$")) continue;
  const t = resolve(def.$value);
  css.push(`.type-${name} {`);
  css.push(`  font-family: ${cssFamilyList(t.fontFamily)};`);
  css.push(`  font-size: ${t.fontSize};`);
  css.push(`  font-weight: ${t.fontWeight};`);
  css.push(`  line-height: ${t.lineHeight};`);
  css.push(`  letter-spacing: ${t.letterSpacing};`);
  css.push(`}`);
}

const output = css.join("\n") + "\n";

// ---------------------------------------------------------------------------
// Containment lint (consult 0067 Q5) — app-only token families must never reach
// the emitted site CSS. The build only walks themes.* + named invariant groups,
// so a leak means an app-only token was moved into themes.* — fail loudly.
// ---------------------------------------------------------------------------
const FORBIDDEN = ["--color-signal-", "--color-health-", "--elevation-", "--motion-", "--path-card-"];
const leaked = FORBIDDEN.filter((prefix) => output.includes(prefix));
if (leaked.length) {
  console.error(`\nContainment lint FAILED — app-only token(s) leaked into site CSS: ${leaked.join(", ")}`);
  console.error("App-only groups (signal/health/elevation/motion/path-card) must stay OUTSIDE themes.* (#34, consult 0067 Q5).\n");
  process.exit(1);
}

const out = join(root, "src/styles/tokens.css");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, output);
console.log(`tokens.css written (${css.length} lines) from tokens v${/v(\d+\.\d+\.\d+)/.exec(tokens.$description)?.[1] ?? "?"}`);
