/**
 * The hero deck's cards 5–7 drawings and the fixture behind them (stock-analyst-platform#4411).
 *
 * The expected coordinates are read off the Designer's signed-off build reference
 * (`hero-deck-8-cards-4410-2026-10-18.html`), not off whatever the builders return, so a change to
 * the geometry fails here before it reaches the page. The 0.15px tolerance is the artifact's own
 * rounding: it printed from unrounded closes where this repo's fixture stores two decimals.
 */
import { describe, expect, it } from "vitest";
import { coneHalfWidthPct, coneSvg, earningsSvg, insidersSvg, skewSparkSvg } from "./hero-deck-svg.mjs";
import {
  EARNINGS_AVERAGES,
  EARNINGS_HISTORY,
  INSIDERS,
  INSIDER_FIGURES,
  MACRO_CARD,
  OPTIONS_CARD,
  BAND_CARDS,
} from "./site-fixture.mjs";

const nums = (s) => s.match(/-?\d+(?:\.\d+)?/g).map(Number);
const attr = (svg, tag, name) => [...svg.matchAll(new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`, "g"))].map((m) => m[1]);
const near = (got, want) => expect.soft(got).toBeCloseTo(want, 0);
const closeTo = (got, want, tol = 0.15) => expect.soft(Math.abs(got - want)).toBeLessThanOrEqual(tol);

describe("the fixture's derived figures", () => {
  it("states averages and counts that follow from the eight reports", () => {
    expect.soft(EARNINGS_HISTORY).toHaveLength(8);
    expect.soft(EARNINGS_AVERAGES).toEqual({ beat: "7 of 8", move: "±3.5%", implied: "±6.9%", movedMore: 2 });
  });

  it("nets the insider trades to the figure the page already states", () => {
    expect.soft(INSIDERS.sells).toHaveLength(12);
    expect.soft(INSIDER_FIGURES.net).toBe("−$177.6M");
    expect.soft(INSIDER_FIGURES.underPlan).toBe("10 of 12 sells");
    expect.soft(INSIDER_FIGURES.largest).toMatchObject({ usd: 31.7, title: "CFO" });
    expect.soft(INSIDER_FIGURES.largestDate).toBe("Jul 18");
    // The Insiders band card further down the page says the same two things in words.
    expect.soft(JSON.stringify(BAND_CARDS.insiders)).toContain(INSIDER_FIGURES.net);
    expect.soft(JSON.stringify(BAND_CARDS.insiders)).toContain(INSIDER_FIGURES.underPlan);
  });

  it("carries the card 8 words and no VIX level or SPY change", () => {
    expect.soft(MACRO_CARD).toMatchObject({ net: 0.35, lean: "supportive" });
    expect.soft(JSON.stringify(MACRO_CARD)).not.toMatch(/\d%|\bVIX\s*\d/);
    expect.soft(BAND_CARDS.macro.find((b) => b.mra).mra).toBe(MACRO_CARD.net);
  });

  it("keeps the three horizons the Outlook states, with the report inside Mid", () => {
    expect.soft(OPTIONS_CARD.horizons.map((h) => h.pct)).toEqual([7.2, 22.0, 31.8]);
    const { report, horizons } = OPTIONS_CARD;
    expect.soft(report.date > horizons[0].landing && report.date < horizons[1].landing).toBe(true);
  });
});

describe("the cone's √t curve", () => {
  const h = OPTIONS_CARD.horizons.map((x, i) => ({ ...x, days: [17, 94, 185][i] }));
  it("passes through each horizon's figure and widens with the square root of time before the first", () => {
    for (const x of h) near(coneHalfWidthPct(h, x.days), x.pct);
    expect.soft(coneHalfWidthPct(h, 0)).toBe(0);
    near(coneHalfWidthPct(h, 17 / 4), 7.2 / 2); // √(1/4) = 1/2
  });
});

describe("card 5: the cone drawing", () => {
  const desk = coneSvg();
  const phone = coneSvg({ phone: true });

  it("draws the desktop twin on the artifact's geometry", () => {
    expect.soft(desk).toContain('viewBox="0 0 440 226"');
    const lines = attr(desk, "line", "x1").map(Number);
    // The three whiskers sit at the horizons' days (17, 94, 185 from the close) on a 1.643 px/day scale.
    for (const want of [131.9, 258.5, 408.0]) expect.soft(lines.some((x) => Math.abs(x - want) < 0.15)).toBe(true);
    // The first cone vertex: 3 days out, 7.2% × √(3/17) × 2.3 px/% above the close line.
    const [, x, y] = desk.match(/<polygon points="[\d.]+,[\d.]+ ([\d.]+),([\d.]+)/);
    closeTo(Number(x), 108.9);
    closeTo(Number(y), 97.0);
  });

  it("labels each horizon and the report, and tags today's price", () => {
    for (const t of ["±7.2%", "±22.0%", "±31.8%", "2 WKS", "3 MOS", "6 MOS", "SEP 14", "NOV 30", "MAR 1", "TODAY", "AUG 28", "JUL 31", "report Nov 20", "$184.52"]) {
      expect.soft(desk, t).toContain(`>${t}</text>`);
    }
    expect.soft(desk).toContain('aria-label="Price over the last month into today at $184.52');
    expect.soft(desk).toContain("The Nov 20 report falls inside the Mid range.");
  });

  it("draws the phone twin at its own size, aria-hidden, without the desktop's axis captions", () => {
    expect.soft(phone).toContain('viewBox="0 0 300 164"');
    expect.soft(phone).toContain('aria-hidden="true"');
    expect.soft(phone).not.toContain("role=");
    expect.soft(phone).not.toContain(">TODAY<");
    expect.soft(attr(phone, "text", "font-size").map(Number).sort((a, b) => a - b)[0]).toBeGreaterThanOrEqual(10);
    expect.soft(attr(desk, "svg", "class")).toEqual(["hc hc--desk"]);
    expect.soft(attr(phone, "svg", "class")).toEqual(["hc hc--phone"]);
  });

  it("plots a month of the fixture's own closes into the close", () => {
    const pts = desk.match(/<polyline points="([^"]+)"/)[1].split(" ");
    expect.soft(pts).toHaveLength(21);
    expect.soft(pts[0]).toMatch(/^16\.0,104\.\d/);
    expect.soft(pts[20]).toBe("104.0,104.0");
  });

  it("draws the five-session skew line ending on its last value", () => {
    const spark = skewSparkSvg();
    expect.soft(spark).toContain('points="2.0,12.5 16.0,8.0 30.0,11.0 44.0,3.5 58.0,6.5"');
    expect.soft(spark).toContain('<circle cx="58.0" cy="6.5"');
  });
});

describe("card 6: the earnings-history drawing", () => {
  it("draws eight implied-move bars and eight moved dots on the artifact's scale", () => {
    const svg = earningsSvg();
    expect.soft(svg).toContain('viewBox="0 0 440 220"');
    expect.soft(attr(svg, "rect", "height")).toHaveLength(8);
    // 9.2 px per percentage point: Nov ’24 implied ±8.2 → a 150.88 tall bar, moved +0.5 → cy 99.4.
    expect.soft(attr(svg, "rect", "height")[0]).toBe("150.88");
    expect.soft(svg).toContain('cy="99.4"');
    // Only the two reports that moved more than implied carry a ring.
    expect.soft(svg.match(/r="8" fill="none"/g)).toHaveLength(EARNINGS_AVERAGES.movedMore);
    expect.soft(svg).toContain(">Nov ’24</text>");
    expect.soft(svg).toContain("It moved more than implied twice.");
  });

  it("splits month and year at phone size, and shows the year only where it turns over", () => {
    const svg = earningsSvg({ phone: true });
    expect.soft(svg).toContain('viewBox="0 0 300 176"');
    expect.soft(svg.match(/>’2[456]<\/text>/g)).toHaveLength(3);
  });
});

describe("card 7: the insider timeline", () => {
  const desk = insidersSvg();
  const phone = insidersSvg({ phone: true });

  it("hangs twelve sells below the line and stands the one buy above it", () => {
    const rects = [...desk.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="8" height="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
    expect.soft(rects).toHaveLength(13);
    const sells = rects.filter(([, y]) => y === 34);
    expect.soft(sells).toHaveLength(12);
    // Height is √dollars, the largest sell 60px: the Jul 18 CFO sale, then Mar 7 at $6.2M → 26.5.
    closeTo(Math.max(...sells.map((r) => r[2])), 60.0, 0.05);
    closeTo(sells[0][2], 26.5, 0.1);
    closeTo(sells[0][0], 27.8, 0.15);
    const [buy] = rects.filter(([, y]) => y < 34);
    closeTo(buy[2], 6.7, 0.1);
  });

  it("inks the two discretionary sells in full and mutes the ten under a plan", () => {
    expect.soft(desk.match(/fill="var\(--text\)"\/>/g)).toHaveLength(3); // 2 discretionary + the buy
    expect.soft(desk.match(/fill-opacity="\.75"/g)).toHaveLength(10);
  });

  it("labels only titles — the largest sell and the one buy — and names no insider", () => {
    expect.soft(desk).toContain(">CFO −$31.7M</text>");
    expect.soft(desk).toContain(">Director +$0.4M</text>");
    expect.soft(desk).toContain("the CFO on Jul 18, was minus 31.7 million dollars");
    expect.soft(phone).toContain('viewBox="0 0 300 178"');
    expect.soft(phone).toContain(">CFO −$31.7M</text>");
  });

  it("marks the six months", () => {
    expect.soft(desk.match(/>(Mar|Apr|May|Jun|Jul|Aug)<\/text>/g)).toHaveLength(6);
  });
});
