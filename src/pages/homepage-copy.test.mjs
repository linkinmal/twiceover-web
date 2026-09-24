/**
 * The redesigned homepage's copy, pinned (stock-analyst-platform#3829). Every string here is the build
 * reference's own — `ai-team/design/assets/homepage-3818-v3-2026-09-23.html` v3.4 (ADR 0991), which
 * carries consult 0987's copy tables with the PM's #3935 corrections folded in. Extracted from the
 * artifact programmatically, never retyped.
 *
 * Pinned literals catch an accidental edit here and nothing more: the canonical source lives in
 * stock-analyst-platform. A reword is a Growth/Designer change to the artifact first, then this file.
 * The FAQ, the plan lines and the section list have their own suites (faq-structure, pricing-strip-
 * and-closing-band, src/data/sections).
 *
 * Source-level, the convention this repo uses: the page's text is its own source plus the components
 * it renders, tags stripped and whitespace collapsed.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(p, "utf8");
const index = read(join(here, "index.astro"));
const components = readdirSync(join(here, "..", "components"))
  .filter((f) => f.endsWith(".astro"))
  .map((f) => read(join(here, "..", "components", f)));

/** Text as a reader meets it: comments, frontmatter and tags gone, entities decoded, spaces collapsed. */
function text(src) {
  return src
    .replace(/^---[\s\S]*?---/, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, " ");
}
const pageText = [index, ...components].map(text).join(" ");

const PINNED = [
    ["hero", [
      "A second look at your own book.",
      "Every position in your brokerage account, checked against the rules you set.",
      "Connect read-only →",
      "Or analyze any US-listed ticker, down to a projected price for each horizon. No account needed.",
      "Analyze",
      "Illustrative example with made-up figures and positions.",
    ]],
    ["band", [
      "Inside an analysis",
    ]],
    ["synthesis", [
      "How the sections become three projected prices.",
      "The Outlook is our AI synthesis. It weighs every section your plan shows you and projects where the price lands in about two weeks, three months and six months. Each price comes with the reason behind it and what would prove it wrong. Every reason draws on the sections your plan includes.",
      "Illustrative example with made-up figures.",
    ]],
    ["portfolio", [
      "Your book, checked against your own rules.",
      "Connect read-only and Your Portfolio lists everything you hold. Positions that have hit one of your rules come first: a profit target, a max loss or an expiry line you set. Open a position to see its breakevens and where each rule stands on current prices. For an options structure, scenarios show it at other prices. Paths show what you could do next, from making no change to rolling, each with its math.",
      "Illustrative example with made-up positions.",
    ]],
    ["broker connection", [
      "Connect with the broker login you already have.",
      "Interactive Brokers, Schwab, Fidelity, Robinhood, E*Trade, tastytrade, Webull, Vanguard and more connect read-only, and TwiceOver never touches your funds.",
      "Connections run through SnapTrade (SOC 2 Type II) and are authorized by your broker. You sign in through SnapTrade or your broker, and TwiceOver never sees your credentials.",
    ]],
    ["facts strip", [
      "4",
      "Paths for every options structure you hold: make no change, close, reduce or roll. Each comes with its math.",
      "3",
      "Horizons in every Outlook: about two weeks, three months and six months out. Each gets one projected price and the reason for it.",
      "Read-only",
      "TwiceOver can see your positions. It can never place, change or cancel an order.",
    ]],
    ["mobile", [
      "The same read, on your phone.",
      "TwiceOver is coming to iPhone and Android, with Your Portfolio, your rules and the full analysis.",
    ]],
    ["trust plate", [
      "Read-only, structurally",
      "Your brokerage connection can view your positions and is technically incapable of placing, changing or canceling an order.",
      "Licensed data only",
      "Every quote and news item comes from a licensed vendor. None of it is scraped.",
      "Your book stays yours",
      "Your positions and account data are never shown to or reused for another user.",
      "Every number stamped",
      "Every figure in a section carries its source and the time it was fetched. The Outlook's prices are labelled as our projection.",
    ]],
    ["what it's not", [
      "Not an investment adviser. TwiceOver gives no recommendations or trading signals, never scores or rates a stock, and never tells you to buy or sell. It never executes a trade or holds your money. You get the evidence and the math behind our projection, and the decision stays with you.",
    ]],
    ["closing band", [
      "See it on your own book.",
      "Connect read-only to see your own positions, or analyze any US-listed ticker.",
      "Your Portfolio comes with every plan. Free includes 10 analyses a month.",
      "Core and Premium give the Outlook more to weigh. Core adds the news, market voices, earnings and the options market. Premium adds the largest options trades, earnings history and insider activity.",
    ]],
];

describe("the homepage states the signed-off copy", () => {
  for (const [section, strings] of PINNED) {
    it(`carries the ${section} strings verbatim`, () => {
      for (const s of strings) expect.soft(pageText, s).toContain(s);
    });
  }

  it("states the section count and its per-plan line from the one section list, never typed", () => {
    // The values themselves ("13", "6 on Free, 10 on Core, all 13 on Premium") are pinned where
    // they are computed, src/data/sections.test.mjs.
    const strip = index.slice(index.indexOf('class="depth-strip"'), index.indexOf('class="pricing-strip '));
    expect.soft(strip).toContain('{sectionsOn("premium").length}');
    expect.soft(strip).toContain("{sectionCountLine()}");
    expect.soft(strip).not.toMatch(/>\s*13\s*</);
  });

  it("keeps the ticker box's placeholder and its pinned form attributes", () => {
    expect.soft(index).toContain('placeholder="Type a ticker — NVDA"');
    expect.soft(index).toMatch(/<form class="entry-box" id="entry-form" action="\/go\/try" method="get"/);
  });

  it("drops every retired string the redesign replaces", () => {
    for (const gone of [
      "Two doors",
      "How it works",
      "Same broker. Nothing new.",
      "What's in every read",
      "Get the read",
      "Depth, never a verdict.",
      // #3842's done-condition: no sentence says the analysis runs on the reader's positions.
      "runs on the positions you actually hold",
      "same read runs on the positions",
      // The trial disclosure leaves the closing band for /pricing (consult 0987 §2).
      "Core starts with a 14-day trial.",
    ]) {
      expect.soft(pageText, gone).not.toContain(gone);
    }
  });
});

describe("the homepage's section order (consult 0987 §1, kept by the founder)", () => {
  it("runs hero → band → synthesis → Portfolio → broker → facts → pricing → mobile → trust → FAQ → not → close", () => {
    const markers = [
      'class="hero"',
      "<AnalysisBand",
      'class="synth ',
      'class="pv ',
      'class="connect"',
      'class="depth-strip"',
      'class="pricing-strip ',
      "<MobileShowcase",
      'class="trust-plate"',
      'class="faq ',
      'class="not-section ',
      'class="closing-band"',
    ];
    const at = markers.map((m) => index.indexOf(m));
    for (const [i, m] of markers.entries()) expect.soft(at[i], m).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
});
