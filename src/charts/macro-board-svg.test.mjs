/**
 * The site's macro cards draw the product's Macro board tiles (twiceover-app `MacroBoard.tsx`, spine §4c
 * v3.89–v4.02, stock-analyst-platform#4432/#4438), which replaced the risk-appetite gauge and the regime
 * words (#4415, closed 2026-10-19). Founder 2026-10-24 (#4498): the macro cards show graphs.
 *
 * The thing that would regress here is the retired gauge coming back, or a tile picking up what §4c
 * forbids (a colour by direction, a computed change, a state word), so those get their own cases.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { captionsFor, formatBoardDate, formatBoardValue, LONG_CAPTIONS, macroGraphSvg, macroTile, SHORT_CAPTIONS } from "./macro-board-svg.mjs";
import { BAND_CARDS, MACRO_BOARD } from "./site-fixture.mjs";
import { EXMP_BAND_CARDS } from "./exmp-fixture.mjs";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("the macro cards draw board tiles, not the retired gauge (#4415, #4432)", () => {
  it("feeds both band cards two tiles and the deck four, two of them large", () => {
    expect.soft(BAND_CARDS.macro).toEqual([{ macroTiles: ["vix", "treasury-10y"] }]);
    expect.soft(EXMP_BAND_CARDS.macro).toEqual([{ macroTiles: ["vix", "treasury-10y"] }]);
    const deck = read("src/components/HeroDeck.astro");
    for (const row of ["vix", "sp500", "treasury-10y", "inflation"]) expect.soft(deck).toContain(`<MacroTile row="${row}"`);
  });

  it("leaves no trace of the gauge or the regime words in markup or styles", () => {
    const sources = ["src/components/AnalysisMini.astro", "src/components/HeroDeck.astro", "src/styles/site.css", "src/charts/site-fixture.mjs"].map(read).join("\n");
    for (const gone of ["mra__", "rg-track", "figs3--regime", "riskAxisLeft", "MACRO_CARD", ">Supportive<", ">Cautious<", "Risk appetite", "Soft landing", "Fed on hold"]) {
      expect.soft(sources, gone).not.toContain(gone);
    }
  });
});

describe("a tile's graph is the app's small-tile anatomy", () => {
  const svg = macroGraphSvg("vix", 177);

  it("draws the year's band, one line through four points, and the latest point marked", () => {
    expect.soft(svg.match(/class="macro-graph__band"/g)).toHaveLength(1);
    expect.soft(svg.match(/<polyline class="macro-graph__path"/g)).toHaveLength(1);
    expect.soft(svg.match(/class="macro-graph__old"/g)).toHaveLength(3);
    expect.soft(svg.match(/class="macro-graph__now"/g)).toHaveLength(1);
    for (const v of ["15.40", "18.72", "16.05", "14.38"]) expect.soft(svg).toContain(`>${v}</text>`);
    expect.soft(svg).toContain('role="img"');
    expect.soft(svg).toContain('aria-label="VIX level: 1y ago 15.40, 3m ago 18.72, 1m ago 16.05, Now 14.38"');
  });

  it("takes none of §4c's forbidden states: one ink, no arrow, no computed change", () => {
    for (const key of Object.keys(MACRO_BOARD)) {
      const s = macroGraphSvg(key, 177);
      expect.soft(s, key).not.toMatch(/fill="#|stroke="#|gradient/);
      expect.soft(s, key).not.toMatch(/[▲▼↑↓]/);
      expect.soft(s, key).not.toMatch(/[+−-]\d+(\.\d+)?%? (since|vs)/);
    }
    const css = read("src/styles/site.css");
    expect.soft(css).not.toMatch(/macro-graph__[a-z-]*--(up|down|pos|neg)/);
  });

  it("picks the caption set by width, as the app does", () => {
    expect.soft(captionsFor(177)).toEqual(SHORT_CAPTIONS);
    expect.soft(captionsFor(259)).toEqual(LONG_CAPTIONS);
  });
});

describe("a tile states values and dates the way the app prints them", () => {
  it("formats decimals, thousands, units and both date kinds", () => {
    expect.soft(formatBoardValue("6501.86", MACRO_BOARD.sp500)).toBe("6,501.86");
    expect.soft(formatBoardValue("4.21", MACRO_BOARD["treasury-10y"])).toBe("4.21%");
    expect.soft(formatBoardValue("-0.4", { decimals: 1, unit: "%" })).toBe("−0.4%");
    expect.soft(formatBoardDate("2026-08-28", MACRO_BOARD.vix, "2026")).toBe("28 Aug");
    expect.soft(formatBoardDate("2025-08-28", MACRO_BOARD.vix, "2026")).toBe("28 Aug 2025");
    expect.soft(formatBoardDate("2026-07-01", MACRO_BOARD.inflation, "2026")).toBe("Jul 2026");
  });

  it("gives each tile its latest value, date and the year's range", () => {
    expect.soft(macroTile("sp500")).toEqual({
      name: "S&P 500 index level", value: "6,501.86", iso: "2026-08-28", date: "28 Aug", low: "5,186.33", high: "6,512.40",
    });
    for (const [key, row] of Object.entries(MACRO_BOARD)) {
      expect.soft(row.points, key).toHaveLength(4);
      const values = row.points.map(([, v]) => Number(v));
      expect.soft(Math.min(...values), `${key} low`).toBeGreaterThanOrEqual(Number(row.range[0]));
      expect.soft(Math.max(...values), `${key} high`).toBeLessThanOrEqual(Number(row.range[1]));
    }
  });
});
