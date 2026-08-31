/**
 * The macro card's risk-appetite axis (#2995) — the real `.macro-risk-axis` anatomy replacing an
 * invented rounded bar with a dot at a hardcoded 55%.
 *
 * Spec: site-prelaunch.md v2.32 §2 Carousel band. Build reference:
 * ai-team/design/assets/site-charts-hero-2026-08-30.html §8 (`.mra`). Upstream anatomy:
 * twiceover-app apps/web/src/read/MacroSection.css.
 *
 * These are structure assertions, not a snapshot. The thing that would actually regress here is
 * someone "simplifying" the axis back toward a bar — which is why the forbidden states get their
 * own cases rather than being implied by the positive ones.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
/* Both scans run on a COMMENT-STRIPPED copy. A rule's own rationale names the thing it replaced —
   this file's `.mra` comment spells out "defensive / Balanced / risk-on" precisely to say the
   product does not use them — so an unstripped scan lets the explanation answer for the markup.

   The two need DIFFERENT strippers. Astro's form is `{/* … *​/}`, and a stripper written for it
   (`\{\s*\/\*[\s\S]*?\*\/\s*\}`) is actively wrong on a stylesheet: its closing `\s*\}` makes the
   lazy body run past the nearest comment end to the first one that happens to be followed by a
   brace, swallowing every rule in between. Applied to site.css it deleted the `.mra` block outright
   and left the suite asserting against nothing. */
const stripAstro = (s) => s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
const stripCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const mini = stripAstro(read("src/components/AnalysisMini.astro"));
const css = stripCss(read("src/styles/site.css"));

/** Every style rule as {selector, body}, at-rules unwrapped — a regex reads `@media (…)` as a rule. */
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
const ruleFor = (sel) => all.find((r) => r.selector === sel);

describe("AnalysisMini macr — the real risk-appetite axis (#2995, v2.32 §2)", () => {
  it("retires the invented bar-and-dot entirely — markup AND styles", () => {
    // The words are the tell: the product does not use them, so their presence anywhere means the
    // old card survived somewhere.
    expect(mini).not.toMatch(/defensive|risk-on/i);
    expect(mini).not.toMatch(/>Balanced</);
    // And the rules it hung on are gone, not merely unreferenced — a dead rule is the thing a later
    // "restore the axis" change reaches for first.
    expect(ruleFor(".band-mini .axis")).toBeUndefined();
    expect(ruleFor(".band-mini .axis i")).toBeUndefined();
    expect(ruleFor(".band-mini .axis-labels")).toBeUndefined();
  });

  it("renders the full anatomy: rail, three ticks, a marker, the net value, the bounds", () => {
    for (const cls of ["mra__num", "mra__rail", "mra__line", "mra__mark", "mra__scale"]) {
      expect(mini, `missing .${cls}`).toMatch(new RegExp(`class="[^"]*\\b${cls}\\b`));
    }
    const ticks = mini.match(/class="mra__tick[^"]*"/g) ?? [];
    expect(ticks).toHaveLength(3);
    expect(ticks.filter((t) => /mra__tick--zero/.test(t))).toHaveLength(1);
  });

  it("states the product's own bounds and words, not the card's invented ones", () => {
    // The real component's vocabulary. − is a real minus sign, not a hyphen — the app uses it
    // and a hyphen here would read as a different glyph beside tabular figures.
    expect(mini).toMatch(/−1\.00/);
    expect(mini).toMatch(/\+1\.00/);
    expect(mini).toMatch(/<b>Cautious<\/b>/);
    expect(mini).toMatch(/<b>Supportive<\/b>/);
  });

  it("keeps the marker and the net value on the SAME derived position", () => {
    // In the real component both come from one number; here they are two literals, so the thing
    // that can silently rot is them disagreeing. net = +0.35 → (0.35 + 1) / 2 = 67.5%.
    const net = Number(mini.match(/class="mra__num"[^>]*>\s*([+−-]?[\d.]+)\s*</)[1].replace("−", "-"));
    const lefts = [...mini.matchAll(/class="mra__(?:num|mark)"[^>]*left:\s*([\d.]+)%/g)].map((m) =>
      Number(m[1]),
    );
    expect(lefts, "num and mark must both carry an explicit left").toHaveLength(2);
    expect(lefts[0]).toBe(lefts[1]);
    expect(lefts[0]).toBeCloseTo(((net + 1) / 2) * 100, 5);
  });

  it("holds the anatomy's own measurements — 1px hairline, 9px ticks, a 2px marker", () => {
    expect(ruleFor(".band-mini .mra__line").body).toMatch(/height:\s*1px/);
    expect(ruleFor(".band-mini .mra__tick").body).toMatch(/width:\s*1px/);
    expect(ruleFor(".band-mini .mra__tick").body).toMatch(/height:\s*9px/);
    const mark = ruleFor(".band-mini .mra__mark").body;
    expect(mark).toMatch(/width:\s*2px/);
    // The zero tick is full-height where its neighbours are 9px — that is what "heavier" means here.
    const zero = ruleFor(".band-mini .mra__tick--zero").body;
    expect(zero).toMatch(/height:\s*15px/);
    expect(zero).toMatch(/top:\s*0/);
  });

  it("takes none of §4c's forbidden states — no arc, no gradient, no coloured zone", () => {
    const mra = all.filter((r) => /\.mra/.test(r.selector));
    expect(mra.length).toBeGreaterThan(0);
    for (const r of mra) {
      expect(r.body, `${r.selector} rounds a corner — the bar this replaced did`).not.toMatch(
        /border-radius/,
      );
      expect(r.body, `${r.selector} uses a gradient`).not.toMatch(/gradient/);
    }
    // A "coloured zone" would be a filled box spanning a REGION of the rail. Every painted element
    // here is a hairline or a tick: whatever carries a `background` must declare an explicit height
    // of at most the rail's own 15px. A zone would either grow that or drop the height entirely.
    const painted = mra.filter((r) => /background:/.test(r.body));
    expect(painted.length).toBeGreaterThan(0);
    for (const r of painted) {
      const h = r.body.match(/height:\s*(\d+(?:\.\d+)?)px/);
      expect(h, `${r.selector} paints a background with no explicit px height`).not.toBeNull();
      expect(Number(h[1]), `${r.selector} paints a region, not a line`).toBeLessThanOrEqual(15);
    }
  });
});
