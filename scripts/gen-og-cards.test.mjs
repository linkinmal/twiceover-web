/**
 * The three share cards (stock-analyst-platform#2988 / #3508, ADR 0905).
 *
 * What is worth testing here is NOT that resvg draws pixels — it is the three things that can
 * silently go wrong between the site's own chart modules and the committed PNG:
 *
 *  1. **The per-member type scale** must stay solved to consult 0752's 6px-as-rendered floor. The
 *     scale is a constant the ADR carries, but the floor it satisfies depends on the base font size
 *     in `site.css` and on the plot's width on the card — change either and the constant silently
 *     stops clearing the floor.
 *  2. **The label merges** must key on (x, y), never y alone. All three of A's horizon ticks share
 *     one baseline, so a y-only key collapses them into whichever was parsed last — a defect that
 *     renders as a plausible-looking card with two horizons missing.
 *  3. **C's strip** must remove every dollar OUTCOME figure and nothing else. Both directions
 *     matter: a strip that misses one ships a track-record claim on a travelling card, and a strip
 *     that over-reaches removes the shape the card exists to show.
 *
 * Every transform asserts its own match count inside the generator and throws on a miss, so a
 * chart-module change surfaces as a failed build rather than a quietly wrong card. The tests below
 * exercise that too — a declaration with only one end wired is not coverage (ADR 0277).
 *
 * Scenario-grain: one Given/When per test, every promised facet soft-asserted together
 * (conventions.md §Testing, ADR 0062).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CARD,
  LEGIBILITY_FLOOR_PX,
  PHONE_CARD_WIDTH_PX,
  MEMBERS,
  memberByKey,
  chartStylesheet,
  plotFor,
  cardSvg,
  smallestRenderedPhonePx,
  mergeStackedPairs,
  stripElements,
  moveY,
  smallestTypeUnits,
  parseTokens,
  REQUIRED_FACES,
  DISCLAIMER,
  loadStyleSources,
} from "./gen-og-cards.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let sources;
beforeAll(() => {
  sources = loadStyleSources();
});

/** Every `font-size: Npx` in a stylesheet, as numbers. */
function fontSizes(css) {
  return [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
}
/** Every `<text …>…</text>` in a plot body, with its class, x, y and text content. */
function texts(body) {
  return [...body.matchAll(/<text\b([^>]*)>(.*?)<\/text>/g)].map(([, attrs, inner]) => ({
    cls: /class="([^"]*)"/.exec(attrs)?.[1] ?? "",
    x: Number(/\bx="([^"]*)"/.exec(attrs)?.[1]),
    y: Number(/\by="([^"]*)"/.exec(attrs)?.[1]),
    inner,
  }));
}

describe("the set is three members, one chassis (ADR 0905)", () => {
  it("holds the floor and the disclaimer as one statement each", () => {
    // The floor is an EXTERNAL commitment (consult 0752), so the number is written here as a
    // literal rather than imported from the module the floor tests measure against — otherwise
    // lowering it in one place moves the goalposts and the suite stays green.
    expect.soft(LEGIBILITY_FLOOR_PX, "consult 0752's floor, in px as rendered").toBe(6);
    expect.soft(PHONE_CARD_WIDTH_PX, "X's large-image card on a phone").toBe(350);
    // C's disclaimer is the same sentence, wrapped into a 300px column. Stated twice, joined here,
    // so the three cards cannot end up carrying different words.
    expect
      .soft(memberByKey("spread").disclaimer.lines.join(" "), "C's two lines are that one sentence")
      .toBe(DISCLAIMER);
  });

  it("names three stably-filenamed members, each with its own plot, scale and caption", () => {
    expect(MEMBERS.map((m) => m.key)).toEqual(["path", "levels", "spread"]);

    expect
      .soft(
        MEMBERS.map((m) => m.file),
        "each URL holds exactly one image for its whole life — never overwritten",
      )
      .toEqual(["og-card-path.png", "og-card-levels.png", "og-card-spread.png"]);
    expect
      .soft(
        MEMBERS.map((m) => m.scale),
        "ADR 0905 build rule 1 — solved per member from the legibility floor",
      )
      .toEqual([1.53, 1.67, 1.9]);
    expect
      .soft(
        MEMBERS.map((m) => m.plot.width),
        "the plot width each scale was solved against",
      )
      .toEqual([980, 900, 744]);
    expect.soft(MEMBERS.map((m) => m.caption)).toEqual([
      "last close $184.52 · AUG 28",
      "last 90 sessions · the levels",
      "your 2× Jul 17 175C/190C · breakeven $181.20",
    ]);
  });
});

describe("ADR 0905 build rule 1 — chart type is scaled per member, solved from the floor", () => {
  it.each(MEMBERS.map((m) => [m.key, m]))(
    "%s clears consult 0752's 6px-as-rendered floor at X's phone card width",
    (_key, member) => {
      const px = smallestRenderedPhonePx(member.key);

      expect
        .soft(px, `smallest type on ${member.key} renders at ${px}px on a ${PHONE_CARD_WIDTH_PX}px card`)
        .toBeGreaterThanOrEqual(LEGIBILITY_FLOOR_PX - 0.05);
      // Solved TO the floor, not merely over it: a scale far above 6px would mean the constant no
      // longer descends from the measurement the ADR records, and the card is giving up plot area
      // for nothing.
      expect.soft(px, "solved to the floor, not arbitrarily above it").toBeLessThan(6.5);
    },
  );

  it.each(MEMBERS.map((m) => [m.key, m]))(
    "%s scales every font-size in the site's own chart CSS and leaves every other property alone",
    (key, member) => {
      const base = chartStylesheet({ ...sources, scale: 1, chart: key });
      const scaled = chartStylesheet({ ...sources, scale: member.scale, chart: key });

      expect
        .soft(fontSizes(scaled), "every size is its site.css base × this member's scale")
        .toEqual(fontSizes(base).map((s) => Number((s * member.scale).toFixed(2))));
      expect
        .soft(new Set(fontSizes(base)), "the bases are the site's own, unrounded")
        .toEqual(new Set({ path: [10, 8.5], levels: [8.5, 9.5], spread: [10.5, 9] }[key]));
      expect
        .soft(scaled.replace(/font-size:[\d.]+px/g, ""), "no other length is touched")
        .toBe(base.replace(/font-size:[\d.]+px/g, ""));
      expect
        .soft(scaled, "text without its own family falls back to the sans face, as in the browser")
        .toMatch(/(^|\n)text\{font-family:/);
    },
  );

  it.each(MEMBERS.map((m) => [m.key, m]))("%s carries every rule the page gives what it draws", (key) => {
    // Checked structurally rather than by trusting the hand-listed selectors: for every class the
    // chart module actually emits, if `site.css` styles it then the card must too. Dropping one
    // renders an unlabelled mark or a figure in the wrong ink — §4b's forbidden state, and exactly
    // what a hand-curated list drifts into.
    //
    // The converse is deliberately NOT asserted. `.pf-tick` carries no rule anywhere — not here,
    // not in `site.css`, not in the build reference — because it is a grouping hook whose paint
    // comes from `.pf-tick--strike` / `--breakeven`. A class with no rule is only a defect when the
    // page gives it one.
    const { body } = plotFor(key);
    const used = [
      ...new Set([...body.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean)),
    ];
    const styledOnThePage = used.filter((c) =>
      new RegExp(`(?:^|[};])\\s*(?:\\.[\\w-]+ )?\\.${c}\\s*\\{`, "m").test(sources.siteCss),
    );
    const styledOnTheCard = new Set([...cardSvg(key).matchAll(/(?:^|\n)\.([\w-]+)\{/g)].map((m) => m[1]));

    expect(styledOnThePage.length, "the plot draws with classes the page styles").toBeGreaterThan(4);
    expect(
      styledOnThePage.filter((c) => !styledOnTheCard.has(c)),
      `classes ${key} draws that site.css styles but the card dropped`,
    ).toEqual([]);
  });

  it("refuses to emit a chart whose rule site.css no longer has", () => {
    // The card reads its styling out of `site.css` by selector. A renamed or deleted rule must stop
    // the build: emitting the chart without it renders a bare mark or a figure in the wrong ink,
    // which is a forbidden state rather than a cosmetic loss, and nothing downstream would catch it.
    expect(() => chartStylesheet({ ...sources, siteCss: "/* emptied */", scale: 1, chart: "path" })).toThrow(
      /no rule for '\.k-spotline'/,
    );
    expect(() =>
      chartStylesheet({ ...sources, siteCss: ".k-spotline { stroke: var(--nope); }", scale: 1, chart: "path" }),
    ).toThrow(/unknown token --nope/);
  });

  it.each(MEMBERS.map((m) => [m.key, m]))(
    "%s resolves its knockout rings to the card's own background, not the band's or the panel's",
    (key, member) => {
      // #2988's halo note, generalised: on the page these charts sit on the Outlook band
      // (accent-surface.container) or on a panel (bg.surface); on the card they sit on bg.canvas.
      // A knockout paints the surface it thinks is behind it, so an unrebound ring is a visible
      // wrong-colour halo.
      //
      // Run per member deliberately. The two tokens do not co-occur: the container is only read by
      // path's `.k-origin`/`.k-point`, and bg.surface only by spread's four payoff knockouts. A
      // single-sheet version of this test defaulted to `chart: "path"` and asserted the absence of
      // a colour that was never there — green with the bg.surface rebind deleted.
      const css = chartStylesheet({ ...sources, scale: member.scale, chart: key });
      const { tokens } = sources;
      const reads = (name) =>
        chartStylesheet({ ...sources, scale: 1, chart: key, tokens: new Map(tokens).set(name, "#DEADBE") });

      expect.soft(css, "no accent-band container colour survives").not.toContain(tokens.get("accent-surface-container"));
      expect.soft(css, "no panel surface colour survives").not.toContain(tokens.get("color-bg-surface"));
      expect.soft(css, "the card's own ground is what the rings knock out to").toContain(tokens.get("color-bg-canvas"));
      expect.soft(css, "no unresolved custom property reaches the SVG").not.toContain("var(--");
      // The absences above are only meaningful where the token is actually read. Poisoning each
      // rebind source proves this member's sheet does or does not depend on it, so neither absence
      // can be vacuously true.
      expect
        .soft(reads("accent-surface-container").includes("#DEADBE"), "container is rebound, never passed through")
        .toBe(false);
      expect
        .soft(reads("color-bg-surface").includes("#DEADBE"), "panel surface is rebound, never passed through")
        .toBe(false);
      expect
        .soft(reads("color-bg-canvas").includes("#DEADBE"), `${key} knocks out against the card's ground`)
        .toBe(true);
    },
  );

  it("stops if the tokens stop defining a surface the rebind names", () => {
    // The rebind used to be a find-and-replace over resolved hex. A renamed token made
    // `tokens.get()` undefined, `split(undefined).join()` a no-op, and — measured — vitest's
    // `expect(css).not.toContain(undefined)` PASSES. So the rebind silently stopped working and its
    // guard reported green together. Naming the token turns that same rename into this throw.
    const without = (name) => {
      const t = new Map(sources.tokens);
      t.delete(name);
      return () => chartStylesheet({ ...sources, tokens: t, scale: 1, chart: "spread" });
    };
    expect.soft(without("color-bg-surface")).toThrow(/knockout rebind names --color-bg-surface/);
    expect.soft(without("color-bg-canvas")).toThrow(/knockout rebind names --color-bg-canvas/);
    expect.soft(without("accent-surface-container")).toThrow(/knockout rebind names --accent-surface-container/);
  });

  it("reads the light theme's tokens and never the dark block's", () => {
    // Social crawlers do not run the viewer's theme, so the card is light-only by decision (#2988).
    // If this slice ever captured the dark values instead, every token would still resolve and the
    // card would render dark ink on a dark ground — nothing else would notice.
    const t = parseTokens(':root {\n  --a: #LIGHT;\n}\n[data-theme="dark"] {\n  --a: #DARK;\n  --b: #ONLYDARK;\n}\n');

    expect.soft(t.get("a"), "light wins").toBe("#LIGHT");
    expect.soft(t.has("b"), "a dark-only token is not visible at all").toBe(false);
  });
});

describe("ADR 0905 build rule 2 — stacked label pairs render on one baseline", () => {
  it("A merges each horizon tick with its own date, keyed on (x, y) not y alone", () => {
    const { body } = plotFor("path");
    const ticks = texts(body).filter((t) => t.cls === "k-tick" && t.y === 170);

    expect(ticks).toHaveLength(3);
    // THE defect this keying exists to prevent: all three ticks share y=170, so a y-only key
    // collapses them into whichever was parsed last. Three distinct x, three distinct dates.
    expect.soft(new Set(ticks.map((t) => t.x)).size, "three distinct horizon columns").toBe(3);
    expect
      .soft(
        ticks.map((t) => t.inner),
        "each keeps its OWN date, as a mono span after its name",
      )
      .toEqual([
        '2 WKS · <tspan class="k-sub">SEP 14</tspan>',
        '3 MOS · <tspan class="k-sub">NOV 30</tspan>',
        '6 MOS · <tspan class="k-sub">MAR 1</tspan>',
      ]);
    expect
      .soft(
        texts(body).filter((t) => t.cls === "k-sub" && t.y === 182),
        "no orphaned second baseline is left behind",
      )
      .toHaveLength(0);
  });

  it("A lifts the TODAY date clear of its own tick rather than merging it into the rule's label", () => {
    const { body } = plotFor("path");
    const sub = texts(body).find((t) => t.cls === "k-sub" && t.inner === "AUG 31");

    // The module emits this pair 11 units apart (y=11 / y=22), spaced for 8.5px type; at 1.53x it
    // collides like the horizon pairs do. It is NOT merged — the artifact separates it instead,
    // because TODAY labels a vertical rule and the merged form would read as one horizon tick.
    expect.soft(sub?.y, "moved down from the module's y=22").toBe(27);
    expect
      .soft(texts(body).find((t) => t.cls === "k-tick" && t.y === 11)?.inner, "the tick is untouched")
      .toBe("TODAY");
  });

  it("B merges each level's name and value onto the name's baseline", () => {
    const { body } = plotFor("levels");
    const names = texts(body).filter((t) => t.cls === "t-level-name");

    expect
      .soft(
        names.map((t) => t.inner),
        "value as a mono span after its name, one baseline each",
      )
      .toEqual([
        '50-DMA <tspan class="t-level-value">175.43</tspan>',
        '52-week high <tspan class="t-level-value">198.00</tspan>',
        '52-week low <tspan class="t-level-value">156.00</tspan>',
      ]);
    expect
      .soft(
        texts(body).filter((t) => t.cls === "t-level-value"),
        "no standalone value line survives",
      )
      .toHaveLength(0);
    // Each merged label sits on its rule's own baseline (level.y − 1), the name's original one.
    const ruleYs = [...body.matchAll(/<line class="t-level"[^>]*\by1="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect
      .soft(names.map((t) => t.y), "merged onto the name's baseline, never the value's")
      .toEqual(ruleYs.map((y) => Number((y - 1).toFixed(2))));
    // Geometry untouched: one dashed rule per merged label, still three.
    expect.soft((body.match(/class="t-level"/g) ?? []).length, "three rules, three labels").toBe(3);
  });

  it("refuses to merge when the pair it was told to expect is not there", () => {
    // One end of the declaration is the merge; the other is that a module change cannot pass
    // through it unnoticed. Breaking the input must break the build.
    expect(() =>
      mergeStackedPairs('<text class="k-tick" x="1" y="170">2 WKS</text>', {
        nameClass: "k-tick",
        valueClass: "k-sub",
        nameY: 170,
        gap: 12,
        separator: " · ",
        expected: 3,
      }),
    ).toThrow(/expected 3/i);
  });

  // Each clause of the (x, y, gap) key is tested here rather than only through the real charts,
  // because on the real input the three clauses MASK each other: mutating any one alone leaves all
  // 22 tests green, and only removing the row and gap clauses TOGETHER merges A's TODAY pair into a
  // fourth horizon tick. A guard whose failure no test can see is not a guard (ADR 0277), so each
  // near-miss below is the case one clause — and only that clause — refuses.
  const KEYED = { nameClass: "n", valueClass: "v", nameY: 170, gap: 12, separator: " · ", expected: 1 };
  const hit = '<text class="n" x="10" y="170">A</text><text class="v" x="10" y="182">B</text>';

  it("merges the pair that matches the key on all three of column, row and gap", () => {
    expect(mergeStackedPairs(hit, KEYED)).toBe('<text class="n" x="10" y="170">A · <tspan class="v">B</tspan></text>');
  });

  it.each([
    [
      "a different column — the (x, ·) half of the key",
      '<text class="n" x="10" y="170">A</text><text class="v" x="99" y="182">B</text>',
    ],
    [
      "a different row — two labels elsewhere on the chart at the same gap",
      '<text class="n" x="10" y="11">A</text><text class="v" x="10" y="23">B</text>',
    ],
    [
      "a different gap — A's TODAY pair, 11 units apart, which must stay two lines",
      '<text class="n" x="10" y="170">A</text><text class="v" x="10" y="181">B</text>',
    ],
  ])("leaves a pair alone when it misses the key on %s", (_case, body) => {
    expect(() => mergeStackedPairs(body, KEYED)).toThrow(/merged 0/);
  });
});

describe("ADR 0905 — C carries no dollar outcome figure at all", () => {
  it("strips the P&L axis, both callouts and every prose caption, keeping the shape", () => {
    const { body } = plotFor("spread");

    // Prices of a structure are not returns. Every OUTCOME figure goes; the two strikes and the
    // breakeven stay, because those are prices.
    expect.soft(body, "no max-profit callout").not.toContain("Max profit");
    expect.soft(body, "no max-loss callout").not.toContain("Max loss");
    expect.soft(body, "no P&L axis figures").not.toMatch(/[−+]\$[\d,]+/);
    expect.soft(body, "no $0 axis label").not.toContain(">$0<");
    expect.soft(body, "no prose caption").not.toContain("profit / loss at expiry");
    expect.soft(body, "no axis caption").not.toContain("share price at expiry");
    expect.soft(body, "no breakeven caption").not.toContain(">breakeven<");
    expect.soft(body, "no last-close rule or word").not.toContain("pf-spot");

    expect.soft(body, "the payoff shape stays").toContain('class="pf-line"');
    expect.soft(body, "both bounded endpoints stay").toContain('class="pf-maxprof-d"');
    expect.soft(body, "the breakeven rule stays").toContain('class="pf-berule"');
    expect.soft(body, "the lower strike price stays").toContain("$175.00");
    expect.soft(body, "the upper strike price stays").toContain("$190.00");
    expect.soft(body, "the breakeven price stays").toContain("$181.20");
    expect.soft(body, "the two zones stay worded").toContain("profit at expiry");
  });

  it("lifts the loss-zone word off the payoff line the model centres it on", () => {
    const { body } = plotFor("spread");
    const words = texts(body).filter((t) => t.cls === "pf-word");

    expect.soft(words.find((w) => w.inner === "loss at expiry")?.y, "lifted").toBe(150);
    expect
      .soft(words.find((w) => w.inner === "profit at expiry")?.y, "the profit word is not on the line")
      .toBe(200);
  });

  it("refuses to strip when the elements it was told to remove are not there", () => {
    expect(() => stripElements('<text class="pf-cap">a</text>', { cls: "pf-axis", expected: 4 })).toThrow(
      /expected 4/i,
    );
  });

  it("refuses to move a label that is not where it was expected", () => {
    // The third transform's guard. Without it, a payoff module that re-spaced its zone words would
    // leave the loss word sitting on the payoff line, silently — the exact defect the move exists
    // to fix, restored by a change nobody connected to this card.
    const at = (y) => `<text class="pf-word" x="1" y="${y}">loss at expiry</text>`;

    expect.soft(() => moveY(at(188), { cls: "pf-word", from: 200, to: 150, contains: "loss at expiry" })).toThrow(
      /expected 1 at y=200, found 0/,
    );
    // And the count, not just presence. Without it this replaced the FIRST match and left the rest
    // — a silent partial move, which is worse than either a clean skip or a throw.
    expect
      .soft(() => moveY(at(200) + at(200), { cls: "pf-word", from: 200, to: 150, contains: "loss at expiry" }))
      .toThrow(/expected 1 at y=200, found 2/);
  });

  it("refuses to merge a pair whose value carries an attribute the merged form would drop", () => {
    // A's two halves are both `text-anchor="middle"`, so the merged element anchors both — that is
    // why dropping the value's copy is safe. Anything the NAME does not also carry would vanish
    // into a still-well-formed SVG that even the drift snapshot reads as clean.
    const opts = { nameClass: "n", valueClass: "v", nameY: 170, gap: 12, separator: " ", expected: 1 };

    expect
      .soft(
        mergeStackedPairs(
          '<text class="n" text-anchor="middle" x="10" y="170">A</text>' +
            '<text class="v" text-anchor="middle" x="10" y="182">B</text>',
          opts,
        ),
        "an attribute the name repeats is safely dropped",
      )
      .toBe('<text class="n" text-anchor="middle" x="10" y="170">A <tspan class="v">B</tspan></text>');
    expect
      .soft(() =>
        mergeStackedPairs(
          '<text class="n" x="10" y="170">A</text><text class="v" opacity="0.6" x="10" y="182">B</text>',
          opts,
        ),
      )
      .toThrow(/carries opacity="0\.6", which the name does not/);
  });

  it("measures the floor against the type each card actually draws", () => {
    const spread = plotFor("spread");
    const path = plotFor("path");

    expect.soft(spread.smallestTypeUnits, "the surviving price ticks, not the stripped axis").toBe(9);
    expect.soft(path.smallestTypeUnits, "the horizon dates").toBe(8.5);
    expect
      .soft(spread.body, "the class that sets the floor is one the card actually draws")
      .toContain("pf-tickfig");
  });

  it("takes the floor from the labels the body draws, not from every rule the card carries", () => {
    // The clause under test is the `drawn` filter. On the real charts it is masked — the selector
    // list was trimmed to the same set — so mutating it away changes no card, and only a body that
    // draws LESS than the stylesheet styles can tell the two apart. A card drawing only `.k-tick`
    // has a 10px floor even though `.k-sub` at 8.5px is styled right beside it.
    const onlyTicks = '<text class="k-tick" x="1" y="170">2 WKS</text>';

    expect
      .soft(smallestTypeUnits("path", onlyTicks), "follows the pixels, not the stylesheet")
      .toBe(10);
    expect
      .soft(smallestTypeUnits("path", '<text class="k-sub" x="1" y="1">SEP 14</text>' + onlyTicks))
      .toBe(8.5);
    expect(() => smallestTypeUnits("path", '<circle class="k-point" cx="1" cy="1" r="5"/>')).toThrow(
      /no sized type/,
    );
  });
});

describe("the chassis is one composition, only the plot body changing", () => {
  it.each(MEMBERS.map((m) => [m.key, m]))("%s carries the full lockup, caption and footer rail", (_key, member) => {
    const svg = cardSvg(member.key);

    expect.soft(svg, "1200×630, the dimensions Base.astro declares").toContain(`width="${CARD.w}" height="${CARD.h}"`);
    expect.soft(svg, "wordmark, two-tone").toContain("Twice");
    expect.soft(svg, "headline line 1").toContain("A second look");
    expect.soft(svg, "headline line 2").toContain("at your own book.");
    expect.soft(svg, "the member's own caption line").toContain(member.caption);
    expect.soft(svg, "the disclaimer travels with the figures").toContain("Illustrative example");
    expect.soft(svg, "the domain").toContain("twiceover.io");
    expect.soft(svg, "the promise").toContain("Depth, never a verdict.");
    expect.soft(svg, "the plot is placed where the artifact places it").toContain(
      `translate(${member.plot.x} ${member.plot.y})`,
    );
  });

  it("carries the disclaimer at the largest of the small type, with no opacity multiplier", () => {
    // ADR 0905 build rule 1's tail: "caption 24px, disclaimer 28px and the largest of the small type
    // on every card, no opacity multiplier". Consult 0752's finding was a 5.2px disclaimer at 60%
    // opacity — the opacity was half the defect.
    for (const member of MEMBERS) {
      const svg = cardSvg(member.key);
      const disc = /<text class="disc"[^>]*>/.exec(svg)?.[0] ?? "";
      expect.soft(disc, `${member.key}: no opacity on the disclaimer`).not.toMatch(/opacity/);
      expect.soft(svg, `${member.key}: disclaimer at 28px`).toMatch(/\.disc\{[^}]*font-size:28px/);
      expect.soft(svg, `${member.key}: caption at 24px`).toMatch(/\.cap\{[^}]*font-size:24px/);
    }
  });
});

describe("the committed artwork cannot drift from what the product draws", () => {
  it.each(MEMBERS.map((m) => [m.key, m]))(
    "%s's committed SVG still matches the one the chart modules produce today",
    (key) => {
      const committed = readFileSync(join(root, "scripts/og-cards", `${key}.svg`), "utf8");
      // If this fails, a chart module, the fixture or a token moved: re-run `npm run gen:og-cards`
      // and look at the three cards before committing the new PNGs.
      expect(cardSvg(key)).toBe(committed);
    },
  );
});

describe("og:image is a pointer, and rotating is one line (ADR 0905)", () => {
  let base;
  beforeAll(() => {
    base = readFileSync(join(root, "src/layouts/Base.astro"), "utf8");
  });

  it("resolves both share-image tags through one named constant naming a real member", () => {
    const decl = /const OG_CARD = "\/([^"]+)"/.exec(base);

    expect(decl, "one constant carries the live member").not.toBeNull();
    expect
      .soft(
        MEMBERS.map((m) => m.file),
        "the constant names a member that is actually generated",
      )
      .toContain(decl?.[1]);
    expect.soft(base, "og:image reads the constant").toMatch(/og:image"\s+content=\{ogImageURL\}/);
    expect.soft(base, "twitter:image reads the same constant").toMatch(/twitter:image"\s+content=\{ogImageURL\}/);
    expect.soft(base, "the URL is built from the constant, not a literal").toContain(
      "new URL(OG_CARD, Astro.site)",
    );
    expect.soft(base, "dimensions unchanged").toContain('content="1200"');
    expect.soft(base, "dimensions unchanged").toContain('content="630"');
  });
});

describe("the member being pointed at is the one whose bytes are committed", () => {
  /** A PNG's IHDR carries its real dimensions at a fixed offset — the only statement of size that
   *  is the FILE's rather than something we asserted about it. */
  const pngSize = (path) => {
    const b = readFileSync(path);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  };

  it("has every member's PNG on disk at the size the meta tags promise", () => {
    const declared = readFileSync(join(root, "src/layouts/Base.astro"), "utf8");

    for (const member of MEMBERS) {
      const path = join(root, "public", member.file);
      expect.soft(statSync(path).size, `${member.file} is non-empty`).toBeGreaterThan(1000);
      // Read out of the file itself, not asserted against the constant that generated it: a card
      // regenerated at another size would otherwise ship while `og:image:width` went on saying 1200.
      expect.soft(pngSize(path), `${member.file} is ${CARD.w}×${CARD.h} in its own header`).toEqual({
        w: CARD.w,
        h: CARD.h,
      });
    }
    // The other end: what the page tells crawlers has to be what the bytes are.
    expect.soft(declared, "og:image:width matches the artwork").toContain(`content="${CARD.w}"`);
    expect.soft(declared, "og:image:height matches the artwork").toContain(`content="${CARD.h}"`);
  });

  it("keeps the pre-launch URL resolving, serving A's artwork", () => {
    // Meta: "Don't remove old images, as there maybe existing stories that reference the old image."
    expect(
      readFileSync(join(root, "public/og-image.png")).equals(readFileSync(join(root, "public/og-card-path.png"))),
    ).toBe(true);
  });

  it("carries exactly the four static faces the rasteriser needs", () => {
    // The quietest failure in the whole script: resvg does not error on a missing face, it falls
    // back. Measured — deleting `source-serif-4-600.ttf` re-rendered A at 45,933 bytes instead of
    // 48,390, exit code 0, wordmark and headline reflowed. Nothing downstream would have noticed.
    const onDisk = readdirSync(join(root, "scripts/og-fonts")).filter((f) => f.endsWith(".ttf"));

    expect.soft([...onDisk].sort(), "the set is named, not globbed").toEqual([...REQUIRED_FACES].sort());
    for (const face of REQUIRED_FACES) {
      expect
        .soft(statSync(join(root, "scripts/og-fonts", face)).size, `${face} is a real font, not a stub`)
        .toBeGreaterThan(10000);
    }
    // NOT covered here, and worth saying rather than implying: nothing checks that a face is
    // instanced at the WEIGHT its filename claims. Re-running `instance-faces.py` with a changed
    // weight would pass this and reflow the card. The rendered-card review is what catches that.
  });
});
