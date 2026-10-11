#!/usr/bin/env node
/**
 * Blog style gate (stock-analyst-platform#4233; ADR 1088 Decision 3; ai-team/design/blog-handoff.md §3).
 *
 * src/styles/blog.css is the design kit's CSS, hand-ported as it stands. The two token files beside the
 * site's own (tokens/blog-themes.tokens.json, tokens/marketing-looks.tokens.json) are what the design
 * signed off for colour, face and chart-line width, so this gate fails the build when the port drifts:
 *   1. per theme, the ported ground, plate, ink, muted, accent, second accent, display and text faces,
 *      display weight, chart-line width and grid match the tokens (with `blog-overrides` applied, the
 *      four values the blog wears that the marketing looks do not);
 *   2. the shell block (ground, ink, muted, rule, display and text face) matches the `shell` tokens;
 *   3. the end block's literals are the product's own tokens (tokens/twiceover.tokens.json);
 *   4. contrast: ink and muted read on ground and plate at WCAG AA, per theme and in the shell;
 *   5. containment: no app-only custom property, no data URI, no import, no remote URL;
 *   6. every face a theme or the shell names is one the theme's font table loads (ci/blog-fonts.mjs).
 * It replaces a second generated stylesheet: one source (the port), one check, nothing to keep in step.
 *
 * Pure functions are exported for the tests; the CLI at the bottom reads the repo.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ratio } from "../scripts/contrast.mjs";
import { BASE_FACES, THEME_FACES, parseFontFaces } from "./blog-fonts.mjs";

/** Theme ids: the token name, the kit's shorthand, and the token key each kit variable comes from. */
export const THEMES = [
  { token: "house", kit: "house", accent: "accent" },
  { token: "night-desk", kit: "nightdesk", accent: "accent", a2: "muted", ink2: "muted" },
  { token: "paper-marker", kit: "marker", accent: "marker", a2: "highlighter" },
  { token: "blueprint", kit: "blueprint", accent: "callout", a2: "line", ink2: "line" },
  { token: "newsprint", kit: "newsprint", accent: "spot", a2: "spot" },
  { token: "neon", kit: "neon", accent: "tube-a", a2: "tube-b" },
  { token: "risograph", kit: "riso", accent: "ink-a", a2: "ink-b" },
  { token: "exhibit", kit: "exhibit", accent: "accent", a2: "accent", ink2: "muted", grid: "grid" },
  { token: "ticket", kit: "ticket", accent: "accent", a2: "ink", ink2: "muted" },
  { token: "printout", kit: "printout", accent: "accent", a2: "accent", ink2: "muted" },
];

/** End-block literals in the port and the product token each is: the handoff says take them from the
 * product's own tokens, never a new one. [selector, property, token path in twiceover.tokens.json]. */
export const END_BLOCK_PINS = [
  [".endblk", "background", "color.warm-ink.100"],
  [".endblk", "color", "color.warm-ink.900"],
  [".e-mark", "color", "color.navy.600"],
  [".e-p", "color", "color.warm-ink.700"],
  [".e-a", "background", "color.navy.600"],
  [".e-d", "color", "themes.light.text.muted"],
];

/** Contrast the design as signed off does not meet, pinned at the value measured so it cannot get worse and
 * so the entry is removed the day the design fixes it (the gate fails on a stale entry). Each is the
 * Designer's to resolve (stock-analyst-platform#4233). Key: "<theme>:<ink|muted>:<ground|plate>". */
export const CONTRAST_EXCEPTIONS = {
  "paper-marker:muted:ground": 4.3,
};

const FORBIDDEN_VARS = /--(?:color-signal|color-health|elevation|motion|path-card)-/;

/** The text between the braces that open at `opener` in `css` (depth-counted), or null. */
export function blockAfter(css, opener) {
  const at = css.indexOf(opener);
  if (at < 0) return null;
  let depth = 0;
  for (let i = at + opener.length - 1; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(at + opener.length, i);
  }
  return null;
}

/** The declarations sitting directly in a block (not in a nested rule), as a Map name -> raw value. */
export function topDeclarations(block) {
  const out = new Map();
  let depth = 0;
  let chunk = "";
  const take = () => {
    const m = chunk.match(/^\s*(--[\w-]+|[a-z-]+)\s*:\s*([\s\S]*?)\s*$/);
    if (m && !chunk.includes("{")) out.set(m[1], m[2]);
    chunk = "";
  };
  for (const ch of block) {
    if (ch === "{") {
      depth++;
      chunk = "";
    } else if (ch === "}") {
      depth--;
      chunk = "";
    } else if (depth === 0) {
      if (ch === ";") take();
      else chunk += ch;
    }
  }
  take();
  return out;
}

/** Flatten a token tree's leaves to { dotted.path: $value }. */
export function leaves(tree, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(tree)) {
    if (k.startsWith("$") || typeof v !== "object" || v === null) continue;
    if ("$value" in v) out[prefix + k] = v.$value;
    else Object.assign(out, leaves(v, `${prefix}${k}.`));
  }
  return out;
}

/** A theme's token values as the blog wears them: the look, with `blog-overrides` and chart line applied.
 * `font.*` references ({font.grotesk}) resolve against the marketing file. */
export function lookValues(blog, marketing, name) {
  const base = blog.look?.[name] ?? marketing.look?.[name];
  if (!base) throw new Error(`no look "${name}" in the token files`);
  const flat = {};
  for (const [k, v] of Object.entries(base)) if (!k.startsWith("$")) flat[k] = v.$value;
  for (const [k, v] of Object.entries(blog["blog-overrides"]?.[name] ?? {})) flat[k] = v.$value;
  if (!("chart-line" in flat) && blog["blog-chart-line"]?.[name]) flat["chart-line"] = blog["blog-chart-line"][name].$value;
  for (const [k, v] of Object.entries(flat)) {
    const ref = typeof v === "string" && v.match(/^\{(.+)\}$/);
    if (ref) {
      const target = ref[1].split(".").reduce((n, key) => n?.[key], marketing);
      if (!target || !("$value" in target)) throw new Error(`${name}.${k}: unresolvable ${v}`);
      flat[k] = target.$value;
    }
  }
  return flat;
}

const norm = (v) => String(v).trim().toLowerCase();
const firstFamily = (v) => (String(v).split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "").replace(/ Opsz$/, "");
const hex6 = (v) => /^#[0-9a-f]{6}$/i.test(String(v));

/** sRGB mix of `ink` over `ground` at `pct` percent ink — the kit's derived --ink2 (color-mix 62%). */
export function mixHex(ink, ground, pct) {
  const c = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const ch = (i) => Math.round((c(ink, i) * pct) / 100 + (c(ground, i) * (100 - pct)) / 100);
  return "#" + [0, 1, 2].map((i) => ch(i).toString(16).padStart(2, "0")).join("");
}

/**
 * @param {{css:string, blog:object, marketing:object, site:object, blogFontsCss:string, siteCss:string}} input
 * @returns {string[]} failure messages (empty when the gate passes)
 */
export function checkBlogStyle({ css, blog, marketing, site, blogFontsCss, siteCss }) {
  const failures = [];
  const siteLeaves = leaves(site);
  const fileOf = new Map();
  const families = new Map();
  for (const f of [...parseFontFaces(blogFontsCss), ...parseFontFaces(siteCss)]) {
    fileOf.set(f.file, f.family);
    families.set(f.family, true);
  }

  for (const t of THEMES) {
    const block = blockAfter(css, `[data-look="${t.kit}"]{`);
    if (!block) {
      failures.push(`${t.token}: no [data-look="${t.kit}"] block in blog.css`);
      continue;
    }
    const d = topDeclarations(block);
    let tok;
    try {
      tok = lookValues(blog, marketing, t.token);
    } catch (e) {
      failures.push(String(e.message));
      continue;
    }
    const want = (what, kitVar, expected, cmp = norm) => {
      if (expected === undefined) return;
      const got = d.get(kitVar);
      if (got === undefined) failures.push(`${t.token}: ${kitVar} (${what}) is missing from blog.css`);
      else if (cmp(got) !== cmp(expected)) failures.push(`${t.token}: ${kitVar} is ${got} in blog.css but ${expected} in the tokens (${what})`);
    };
    const wantFamily = (what, kitVar, list) => {
      const got = d.get(kitVar);
      if (got === undefined) failures.push(`${t.token}: ${kitVar} (${what}) is missing from blog.css`);
      else if (!list?.map(norm).includes(norm(firstFamily(got)))) failures.push(`${t.token}: ${kitVar} is ${got} in blog.css but the tokens list ${list?.join(", ")} (${what})`);
    };
    want("ground", "--g", tok.ground);
    want("plate", "--plate", tok.plate);
    want("ink", "--ink", tok.ink);
    want("accent", "--a", tok[t.accent]);
    if (t.a2) want("second accent", "--a2", tok[t.a2]);
    if (t.ink2) want("muted", "--ink2", tok[t.ink2]);
    if (t.grid) want("grid", "--gridc", tok[t.grid]);
    wantFamily("display face", "--fd", tok.display);
    wantFamily("text face", "--ft", tok.text);
    want("display weight", "--fdw", tok["display-weight"], Number);
    want("chart line", "--cw", tok["chart-line"], Number);
    if (!("chart-line" in tok)) failures.push(`${t.token}: no chart-line width in the tokens`);

    // contrast: ink, and the muted ink, on ground and plate
    const g = d.get("--g");
    const plate = d.get("--plate");
    const ink = d.get("--ink");
    const ink2 = d.get("--ink2") ?? (hex6(ink) && hex6(g) ? mixHex(ink, g, 62) : undefined);
    for (const [name, fg] of [["ink", ink], ["muted", ink2]]) {
      for (const [bgName, bg] of [["ground", g], ["plate", plate]]) {
        if (!hex6(fg) || !hex6(bg)) continue;
        const r = ratio(fg, bg);
        const key = `${t.token}:${name}:${bgName}`;
        const floor = CONTRAST_EXCEPTIONS[key] ?? 4.5;
        if (r < floor) failures.push(`${t.token}: ${name} ${fg} on ${bgName} ${bg} is ${r.toFixed(2)}:1, under ${key in CONTRAST_EXCEPTIONS ? `its pinned ${floor}:1 exception` : "WCAG AA 4.5:1"}`);
        else if (key in CONTRAST_EXCEPTIONS && r >= 4.5) failures.push(`${t.token}: ${name} on ${bgName} now meets 4.5:1 (${r.toFixed(2)}); remove the CONTRAST_EXCEPTIONS entry ${key}`);
      }
    }

    // every face the theme names is one its font table loads
    const loaded = new Set([...BASE_FACES, ...(THEME_FACES[t.token === "night-desk" ? "nightdesk" : t.token === "paper-marker" ? "marker" : t.token === "risograph" ? "riso" : t.token] ?? [])].map((f) => fileOf.get(f)));
    for (const v of ["--fd", "--ft", "--fl", "--fm"]) {
      const fam = d.get(v) && firstFamily(d.get(v));
      if (fam && !loaded.has(fam) && !loaded.has(`${fam} Opsz`)) failures.push(`${t.token}: ${v} names "${fam}", which the theme's font table does not load`);
    }
  }

  // shell
  const shell = Object.fromEntries(Object.entries(blog.shell ?? {}).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, v.$value]));
  const root = topDeclarations(blockAfter(css, "#blog{") ?? "");
  const sw = (kitVar, expected, cmp = norm) => {
    const got = root.get(kitVar);
    if (got === undefined) failures.push(`shell: ${kitVar} is missing from blog.css`);
    else if (cmp(got) !== cmp(expected)) failures.push(`shell: ${kitVar} is ${got} in blog.css but ${expected} in the tokens`);
  };
  sw("--sbg", shell.ground);
  sw("--sink", shell.ink);
  sw("--srule", shell.ink);
  sw("--smut", shell.muted);
  sw("--sline", shell.rule);
  sw("--sfd", shell.display?.[0], firstFamily);
  sw("--sfu", shell.text?.[0], firstFamily);
  for (const [name, fg] of [["ink", shell.ink], ["muted", shell.muted]]) {
    const r = ratio(fg, shell.ground);
    if (r < 4.5) failures.push(`shell: ${name} ${fg} on ground ${shell.ground} is ${r.toFixed(2)}:1, under WCAG AA 4.5:1`);
  }
  const shellLoaded = new Set(BASE_FACES.map((f) => fileOf.get(f)));
  for (const v of ["--sfd", "--sfu"]) {
    const fam = root.get(v) && firstFamily(root.get(v));
    if (fam && !shellLoaded.has(fam)) failures.push(`shell: ${v} names "${fam}", which the shell's font table does not load`);
  }

  // end block = product tokens
  for (const [sel, prop, path] of END_BLOCK_PINS) {
    const expected = siteLeaves[path];
    const block = blockAfter(css, `${sel}{`);
    if (!expected) failures.push(`end block: no product token ${path}`);
    else if (!block) failures.push(`end block: no ${sel} rule in blog.css`);
    else {
      const got = topDeclarations(block).get(prop);
      if (got === undefined || norm(got) !== norm(expected)) failures.push(`end block: ${sel} ${prop} is ${got ?? "absent"} but ${path} is ${expected}`);
    }
  }

  // a nested port that loses a brace silently swallows every rule after it
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*"/g, '""');
  const opens = (stripped.match(/\{/g) ?? []).length;
  const closes = (stripped.match(/\}/g) ?? []).length;
  if (opens !== closes) failures.push(`blog.css has unbalanced braces (${opens} open, ${closes} close)`);

  // containment
  if (FORBIDDEN_VARS.test(css)) failures.push("blog.css names an app-only custom property (signal, health, elevation, motion, path-card)");
  if (/url\(\s*["']?data:/i.test(css)) failures.push("blog.css has a data: URI (the CSP is img-src 'self'); ship the file under public/");
  if (/@import\b/.test(css)) failures.push("blog.css has an @import");
  if (/url\(\s*["']?(?:https?:)?\/\//i.test(css)) failures.push("blog.css names a remote URL");
  return failures;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const read = (p) => readFileSync(join(root, p), "utf8");
  const failures = checkBlogStyle({
    css: read("src/styles/blog.css"),
    blog: JSON.parse(read("tokens/blog-themes.tokens.json")),
    marketing: JSON.parse(read("tokens/marketing-looks.tokens.json")),
    site: JSON.parse(read("tokens/twiceover.tokens.json")),
    blogFontsCss: read("src/styles/blog-fonts.css"),
    siteCss: read("src/styles/site.css"),
  });
  if (failures.length) {
    console.error(`Blog style gate FAILED (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`Blog style gate passed: ${THEMES.length} themes and the shell match the tokens, contrast and containment hold.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
