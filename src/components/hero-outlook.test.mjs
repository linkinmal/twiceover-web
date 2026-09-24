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
  // Since v3.4 (stock-analyst-platform#3829) the Outlook band is its own component, rendered as the
  // hero deck's first card and again in the synthesis section — so these claims move onto it.
  const band = read("src/components/OutlookBand.astro");
  const deck = read("src/components/HeroDeck.astro");

  it("draws the projection path chart, not the three-card composition it replaced", () => {
    expect.soft(band).toContain("OutlookPathChart");
    expect.soft(band).not.toContain("620 430");
    expect.soft(band).not.toContain("cardShadow");
    // Every string in it is real HTML; the chart's own labels come from the SVG builder.
    expect.soft(band).not.toContain("<text");
    // The deck opens on the Outlook: it is card 0 in the server-rendered order.
    expect.soft(deck.indexOf("<OutlookBand")).toBeLessThan(deck.indexOf("<PortfolioCard"));
    expect.soft(deck).toMatch(/class="dcard dcard--outlook" data-key="outlook" data-pos="0"/);
  });

  it("adds no raster — the charts are inline SVG so they theme, scale and stay text", () => {
    expect.soft(band).not.toMatch(/<img|\.png|\.jpg|\.webp/i);
    expect.soft(deck).not.toMatch(/<img|\.png|\.jpg|\.webp/i);
  });

  it("states every figure from the page's one fixture, never a literal", () => {
    expect.soft(band).toContain("site-fixture.mjs");
    // The three projections and the spot have each been corrected twice; a literal here is how the
    // last two corrections left stale copies standing.
    for (const src of [band, deck]) {
      expect.soft(src).not.toMatch(/\$?\b(178|192|205|184\.52|184|195|210)\b/);
    }
  });

  it("keeps the illustrative-data disclosure verbatim", () => {
    expect.soft(deck).toContain("Illustrative example with made-up figures and positions.");
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

describe("Option B — the hero's presentation treatment (#2987/#3013, v2.35 elevation + v2.38 tilt)", () => {
  // Comments carry the same selector and property names as the rules they explain, so these scans
  // run on a comment-stripped copy — otherwise a rule's own rationale answers for it.
  const css = read("src/styles/site.css").replace(/\/\*[\s\S]*?\*\//g, "");

  /**
   * Every style rule as {selector, body}, at-rules unwrapped. A regex cannot do this — a
   * `[^{}]*\{...\}` pattern reads `@media (min-width: 960px)` as a nested rule's selector.
   */
  const rules = (text) => {
    const out = [];
    const stack = [];
    let buf = "";
    for (const ch of text) {
      if (ch === "{") {
        stack.push(buf.trim());
        buf = "";
      } else if (ch === "}") {
        const sel = stack.pop();
        if (sel !== undefined && !sel.startsWith("@")) out.push({ selector: sel, body: buf });
        buf = "";
      } else buf += ch;
    }
    return out;
  };
  const all = rules(css);

  it("elevates the band with a contact shadow AND an ambient one", () => {
    const band = all.find((r) => r.selector === ".proof__band");
    // Split on TOP-LEVEL commas only — `color-mix(in srgb, …)` carries commas of its own, and a
    // lookahead-based split counts each one as another shadow layer.
    const layers = [];
    let depth = 0;
    let cur = "";
    for (const ch of band.body.match(/box-shadow:([^;]*);/s)[1]) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        layers.push(cur);
        cur = "";
      } else cur += ch;
    }
    layers.push(cur);
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatch(/\b1px\b/); // contact
    expect(layers[1]).toMatch(/\b36px\b/); // ambient
    for (const l of layers) expect(l).toMatch(/color-mix\(in srgb, var\(--color-text-primary\)/);
  });

  it("gives that shadow a dark counterpart that does not mix the light ink", () => {
    // --color-text-primary re-resolves to a near-white ink under a dark scope; mixing it there
    // turns the shadow into a glow.
    const dark = all.find((r) => r.selector === '[data-theme="dark"] .proof__band');
    expect(dark, "no dark shadow rule for .proof__band").toBeDefined();
    expect(dark.body).toMatch(/box-shadow:/);
    expect(dark.body).not.toMatch(/color-mix/);
  });

  it("takes the v2.38 tilt on the deck's front card, and on no other surface", () => {
    // An EXACT set, not a "does it look like a chart" filter. Rotation is rare and deliberate on
    // this page, so listing every one is cheap, and it fails on any new rotation anywhere. Since
    // v3.4 (#3829) the band's −1.5° is the deck's FRONT card, the other positions fan behind it,
    // and the band itself sits flat wherever it is rendered inside another surface.
    const rotated = all.filter((r) => /transform:[^;]*rotate\(/.test(r.body)).map((r) => r.selector.replace(/\s+/g, " "));
    expect(new Set(rotated)).toEqual(
      new Set([
        ".faq__list details[open] > summary .faq__chevron",
        ".proof__band",
        '.deck .dcard[data-pos="0"]',
        '.deck .dcard[data-pos="1"]',
        '.deck .dcard[data-pos="2"]',
        '.deck .dcard:not([data-pos]), .deck .dcard[data-pos="3"], .deck .dcard[data-pos="4"], .deck .dcard[data-pos="5"]',
        ".deck .dcard.leaving",
      ]),
    );
    // The ANGLE, not merely "some rotation".
    const front = all.find((r) => r.selector === '.deck .dcard[data-pos="0"]');
    expect(front.body).toMatch(/transform:\s*rotate\(-1\.5deg\)/);
    // Inside the deck and the synthesis section the band is flat: the card or section carries it.
    expect(all.find((r) => r.selector === ".synth__outlook .proof__band").body).toMatch(/transform:\s*none/);
    expect(all.find((r) => r.selector === ".dcard--outlook .proof__band").body).toMatch(/transform:\s*none/);
    expect(css).not.toMatch(/\.hero-stage|\.pm-card|\.pm-chart/);
  });

  it("lets reduced motion stop the deck; the tilt itself never moves", () => {
    const band = all.find((r) => r.selector === ".proof__band");
    expect(band.body).not.toMatch(/transition|animation/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.deck > \.dcard \{ transition: none; \} \}/);
  });

  it("leaves the band the whole card — the treatment is elevation, not a re-layout", () => {
    const band = all.find((r) => r.selector === ".proof__band");
    expect(band.body).not.toMatch(/max-width|margin-inline|width:/);
    const lg = css.slice(css.indexOf("@media (min-width: 960px)"));
    expect(lg).toMatch(/\.hero__copy \{ flex: 1 1 52%; \}/);
    expect(lg).toMatch(/\.deck-fig \{ flex: 1 1 44%; \}/);
  });
});
