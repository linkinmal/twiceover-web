/**
 * The hero's Outlook band and the accent-surface retone (stock-analyst-platform#2987).
 *
 * Source-level regression, the convention this repo already uses (`faq-structure.test.mjs`): these
 * are claims about what the built page commits to, and each one is a thing a later edit could undo
 * without any chart arithmetic changing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const tokens = JSON.parse(read("tokens/twiceover.tokens.json"));

function resolve(ref) {
  let cur = tokens;
  for (const k of ref.replace(/[{}]/g, "").split(".")) cur = cur[k];
  return cur.$value;
}

describe("the accent surface is the app's bronze, not navy", () => {
  // The site's Outlook objects are supposed to BE the app's, so their colour is not a near-enough
  // match chosen here — it is the app's own ramp, value for value.
  const APP_BRONZE = {
    light: { pill: "#FDF6E3", container: "#F3E5C3", border: "#8A5A12", marker: "#8A5A12", rule: "#FDF6E3" },
    dark: { pill: "#3A2C0C", container: "#33280A", border: "#D8A93E", marker: "#E4BC5E", rule: "#3A2C0C" },
  };

  for (const [theme, expected] of Object.entries(APP_BRONZE)) {
    it(`resolves every ${theme} bronze binding to the app's own value`, () => {
      for (const [name, hex] of Object.entries(expected)) {
        expect.soft(resolve(tokens["accent-surface"][theme][name].$value), name).toBe(hex);
      }
    });
  }

  it("keeps the dark border and marker as DISTINCT steps, as the app does", () => {
    // #2987's body lists them collapsed ("border/marker #E4BC5E"); the app keeps border at
    // bronze.400 and marker at bronze.300, and "the app's bronze" is what the decision asked for.
    const dark = tokens["accent-surface"].dark;
    expect.soft(resolve(dark.border.$value)).not.toBe(resolve(dark.marker.$value));
  });

  it("routes every accent-surface binding through the bronze ramp, never navy or steel", () => {
    // The retone is only real if nothing still points at the old family.
    const refs = JSON.stringify(tokens["accent-surface"]).match(/\{color\.[a-z-]+\.\d+\}/g) ?? [];
    expect.soft(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect.soft(r).not.toMatch(/\{color\.(navy|steel)\./);
  });
});

describe("no consumer claims a colour the token does not resolve to", () => {
  // The defect this replaces: the old hero SVG wrote `var(--accent-surface-container, #F5EEDF)` —
  // a gold fallback behind a token that resolved navy, so the source read gold while the card
  // rendered navy for as long as it shipped. A fallback hex on a token that is always defined is
  // never read, and is only ever a second, silently diverging source of truth.
  function sources(dir, acc = []) {
    for (const entry of readdirSync(join(root, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(join(root, rel)).isDirectory()) sources(rel, acc);
      else if (/\.(astro|css)$/.test(entry)) acc.push(rel);
    }
    return acc;
  }

  it("names no hex fallback on any accent-surface var, anywhere in src", () => {
    // Blind to any list of files: it walks src/ rather than checking the three the issue named.
    const offenders = [];
    for (const file of sources("src")) {
      for (const m of read(file).matchAll(/var\(\s*--accent-surface-[a-z-]+\s*,[^)]*\)/g)) {
        offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the hero states the product's output instead of naming it", () => {
  const hero = read("src/components/ProductProofVisual.astro");

  it("draws the projection path chart, not the three-card composition it replaced", () => {
    expect.soft(hero).toContain("OutlookPathChart");
    // The card composition's own marks — a fixed 620x430 collage of layered rects and hand-placed
    // labels. None of it survives; the analysis rows and positions live further down the page as
    // real text.
    expect.soft(hero).not.toContain("620 430");
    expect.soft(hero).not.toContain("cardShadow");
    // The composition was ~40 hand-placed <text> elements. The hero now places none of its own —
    // every string in it is real HTML, and the chart's own labels come from the SVG builder.
    expect.soft(hero).not.toContain("<text");
  });

  it("adds no raster — the chart is inline SVG so it themes, scales and stays text", () => {
    expect.soft(hero).not.toMatch(/<img|\.png|\.jpg|\.webp/i);
  });

  it("states every figure from the page's one fixture, never a literal", () => {
    expect.soft(hero).toContain("site-fixture.mjs");
    // The three projections and the spot have each been corrected twice; a literal here is how the
    // last two corrections left stale copies standing.
    expect.soft(hero).not.toMatch(/\$?\b(178|192|205|184\.52|184|195|210)\b/);
  });

  it("keeps the illustrative-data disclosure verbatim", () => {
    expect.soft(hero).toContain(
      "Illustrative example — the same fixed AAPL/NVDA data shown throughout this page, not a live account.",
    );
  });
});

describe("the carousel's Outlook card and the hero cannot disagree", () => {
  it("draws AnalysisMini's projections from the same fixture as the chart", () => {
    const mini = read("src/components/AnalysisMini.astro");
    expect.soft(mini).toContain("site-fixture.mjs");
    // The superseded published figures, which sat here as markup while the hero was corrected.
    expect.soft(mini).not.toMatch(/proj-v">\$(184|195|210)</);
  });
});
