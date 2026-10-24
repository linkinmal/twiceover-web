/**
 * The product pictures above the fold (site-prelaunch v2.54, stock-analyst-platform#4498). What would
 * regress here: a picture disagreeing with the EXMP figures the rest of the page draws, horizon tiles that
 * touch, or the card picking up the "Outlook" name or an "AI synthesis" label (v2.54 ruling 1).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analysisCard, largeTradesSummary, largeTradesSvg, tileDate } from "./pictures-svg.mjs";
import { EXMP_BAND_CARDS, EXMP_LARGE_TRADES, EXMP_OUTLOOK, EXMP_PRICE } from "./exmp-fixture.mjs";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("the analysis card", () => {
  it("prints EXMP's spot, date and three horizons from the fixture", () => {
    const c = analysisCard(600);
    expect.soft(c.spot).toBe(`$${EXMP_PRICE.toFixed(2)}`);
    expect.soft(c.asOf).toBe("Aug 28");
    expect.soft(c.tiles.map((t) => [t.word, t.price, t.date])).toEqual(
      EXMP_OUTLOOK.horizons.map((h) => [h.key.toUpperCase(), `$${h.price.toFixed(2)}`, tileDate(h.date)]),
    );
    expect.soft(c.svg).toContain('aria-label="EXMP analysis, three projected prices: price $48.30 on Aug 28; near, Sep 14, $46.60; mid, Nov 30, $50.25; far, Mar 1, $53.65."');
  });

  it("puts the horizons on a true-to-time axis: Sep 14, Nov 30 and Mar 1 are 17, 94 and 185 days after Aug 28", () => {
    const { tiles } = analysisCard(600);
    const x = tiles.map((t) => t.x);
    const span = x[2] - 16;
    const day = span / 213; // Jul 31 → Mar 1
    expect.soft((x[0] - 16) / day).toBeCloseTo(45, 5);
    expect.soft((x[1] - 16) / day).toBeCloseTo(122, 5);
  });

  it("caps each tile's width under the tightest gap between points, at every width it draws", () => {
    for (const w of [330, 600]) {
      const c = analysisCard(w);
      const gap = Math.min(...c.tiles.slice(1).map((t, k) => t.x - c.tiles[k].x)) / w * 100;
      expect.soft(c.tileWidth, `${w}`).toBe(`min(124px, calc(${gap.toFixed(2)}% - 10px))`);
    }
  });

  it("is titled analysis and carries no Outlook name or AI synthesis label (v2.54 ruling 1)", () => {
    const card = read("src/components/pictures/PicAnalysis.astro").replace(/^\/\/.*$/gm, "");
    expect.soft(card).toContain("EXMP analysis");
    expect.soft(card).not.toMatch(/>\s*Outlook|AI synthesis/);
  });
});

describe("the Large options trades card", () => {
  it("sums its five sessions to the flow card's $38M and computes the shares from them", () => {
    const s = largeTradesSummary();
    expect.soft(s.total).toBe("$38.0M");
    expect.soft(EXMP_BAND_CARDS.flow[0].row[1]).toBe("at least $38M");
    const calls = EXMP_LARGE_TRADES.reduce((a, x) => a + x.calls, 0);
    expect.soft(s.callsPct).toBe(Math.round((calls / 38) * 100));
    expect.soft(s.callsPct + s.putsPct).toBe(100);
  });

  it("labels every bar with its figure, sizes it by the square root of its premium, and has no direction word", () => {
    const svg = largeTradesSvg(300);
    for (const x of EXMP_LARGE_TRADES) {
      expect.soft(svg).toContain(`>$${x.calls.toFixed(1)}M<`);
      expect.soft(svg).toContain(`>$${x.puts.toFixed(1)}M<`);
    }
    const heights = [...svg.matchAll(/class="pic-trades__calls"[^>]*height="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect.soft(heights[3]).toBeCloseTo(40, 1); // Aug 28, the largest
    expect.soft(heights[0] / heights[3]).toBeCloseTo(Math.sqrt(4.1 / 7.8), 2);
    expect.soft(svg).not.toMatch(/bullish|bearish|buy|sell/i);
  });

  it("keeps a bar's figure clear of its neighbour's at the narrow width", () => {
    const svg = largeTradesSvg(174);
    const xs = [...svg.matchAll(/class="pic-trades__calls" x="([\d.]+)"/g)].map((m) => Number(m[1]));
    const step = xs[1] - xs[0];
    // A "$7.8M" figure at 9.5px mono is about 28.5px wide.
    expect.soft(step).toBeGreaterThan(31);
  });
});
