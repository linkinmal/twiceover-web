/**
 * The hero deck's cards 5–7 drawings and the fixture behind them (stock-analyst-platform#4411).
 *
 * The expected coordinates are read off the Designer's signed-off build reference
 * (`hero-deck-8-cards-4410-2026-10-18.html`), not off whatever the builders return, so a change to
 * the geometry fails here before it reaches the page. The 0.15px tolerance is the artifact's own
 * rounding: it printed from unrounded closes where this repo's fixture stores two decimals.
 */
import { describe, expect, it } from "vitest";
import { coneHalfWidthPct, coneSvg, earningsSvg, insidersSvg, outlookDeckSvg, skewSparkSvg } from "./hero-deck-svg.mjs";
import {
  EARNINGS_AVERAGES,
  EARNINGS_HISTORY,
  INSIDERS,
  INSIDER_FIGURES,
  INSIDER_ROWS,
  MACRO_CALENDAR,
  MACRO_CARD,
  OPTIONS_CARD,
  BAND_CARDS,
} from "./site-fixture.mjs";

const nums = (s) => s.match(/-?\d+(?:\.\d+)?/g).map(Number);
const attr = (svg, tag, name) => [...svg.matchAll(new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`, "g"))].map((m) => m[1]);
const near = (got, want) => expect.soft(got).toBeCloseTo(want, 1);
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

describe("both twins name the chart", () => {
  it("gives the phone twin the desktop twin's role and label, since only one renders at a time", () => {
    for (const draw of [coneSvg, earningsSvg, insidersSvg, outlookDeckSvg]) {
      const label = (svg) => svg.match(/role="img" aria-label="([^"]+)"/)?.[1];
      expect.soft(label(draw({ phone: true })), draw.name).toBeTruthy();
      expect.soft(label(draw({ phone: true })), draw.name).toBe(label(draw()));
      expect.soft(draw({ phone: true }), draw.name).not.toContain("aria-hidden");
    }
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
  // Read off hero-deck-cards-v5-4410-2026-10-18.html (v2.52 ruling 5), the build reference.
  const desk = insidersSvg();
  const phone = insidersSvg({ phone: true });
  const rects = (svg) => [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="(\d+)" height="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));

  it("hangs twelve sells below the line and stands the one buy above it, at the v2.52 size", () => {
    expect.soft(desk).toContain('viewBox="0 0 420 118"');
    const d = rects(desk);
    expect.soft(d).toHaveLength(13);
    const sells = d.filter(([, y]) => y === 31);
    expect.soft(sells).toHaveLength(12);
    closeTo(sells[0][0], 28.35);
    closeTo(sells[0][3], 23.88, 0.05);
    closeTo(Math.max(...sells.map((r) => r[3])), 54, 0.05);
    const [buy] = d.filter(([, y]) => y < 31);
    closeTo(buy[1], 23.93, 0.05);
    closeTo(buy[3], 6.07, 0.05);
    expect.soft(phone).toContain('viewBox="0 0 280 88"');
    const p = rects(phone);
    const psells = p.filter(([, y]) => y === 11);
    expect.soft(psells).toHaveLength(12);
    closeTo(psells[0][0], 17.9);
    closeTo(Math.max(...psells.map((r) => r[3])), 56, 0.05);
    closeTo(p.find(([, y]) => y < 11)[0], 155.09);
  });

  it("inks the two discretionary sells in full and mutes the ten under a plan", () => {
    expect.soft(desk.match(/fill="var\(--text\)"\/>/g)).toHaveLength(3); // 2 discretionary + the buy
    expect.soft(desk.match(/fill-opacity="\.75"/g)).toHaveLength(10);
  });

  it("labels only titles on the desktop twin, and none on the phone twin", () => {
    expect.soft(desk).toContain(">CFO −$31.7M</text>");
    expect.soft(desk).toContain(">Director +$0.4M</text>");
    expect.soft(desk).toContain("the CFO on Jul 18, was minus 31.7 million dollars");
    expect.soft(phone).not.toContain("CFO −$31.7M</text>");
    expect.soft(phone).not.toContain("Director +$0.4M</text>");
    // The artifact's phone twin is aria-hidden; this site keeps the label (Designer asked, #4422).
    expect.soft(phone).toContain('role="img"');
  });

  it("marks the six months", () => {
    expect.soft(desk.match(/>(Mar|Apr|May|Jun|Jul|Aug)<\/text>/g)).toHaveLength(6);
  });
});

describe("card 7: the By insider rows follow from the fixture", () => {
  it("sums each title's sells to the artifact's figures", () => {
    expect.soft(INSIDER_ROWS.map((r) => [r.title, r.usd, r.pct])).toEqual([
      ["CEO", 75.5, 3.8],
      ["CFO", 40.1, 18.4],
      ["COO", 39.8, 26.7],
    ]);
  });
  it("gives every sell a title and none an insider's name", () => {
    expect.soft(INSIDERS.sells.every((s) => typeof s.title === "string")).toBe(true);
    expect.soft(new Set(INSIDERS.sells.map((s) => s.title))).toEqual(new Set(["CEO", "CFO", "COO", "General Counsel", "Director"]));
    expect.soft(INSIDERS.sells.reduce((t, s) => t + s.usd, 0) - INSIDERS.buys[0].usd).toBeCloseTo(177.6, 5);
  });
});

describe("card 8: the Economic calendar", () => {
  it("lists three releases, each with its publisher", () => {
    expect.soft(MACRO_CALENDAR).toEqual([
      { date: "Sep 4", event: "Employment situation", source: "FRED" },
      { date: "Sep 11", event: "CPI", source: "FRED" },
      { date: "Sep 16", event: "FOMC decision", source: "Federal Reserve" },
    ]);
  });
});

describe("card 1: the deck's own Outlook drawing (v2.52 ruling 9)", () => {
  // Coordinates read off the build reference's two charts (440×412 and 300×322).
  const desk = outlookDeckSvg();
  const phone = outlookDeckSvg({ phone: true });
  const pts = (svg, cls) => [...svg.matchAll(new RegExp(`<circle class="${cls}" cx="([\\d.]+)" cy="([\\d.]+)"`, "g"))].map((m) => [Number(m[1]), Number(m[2])]);

  it("draws the desktop twin at 440×412 with the path on the artifact's points", () => {
    expect.soft(desk).toContain('viewBox="0 0 440 412"');
    expect.soft(desk).toContain('class="k-chart k-dk"');
    const [o] = pts(desk, "k-origin");
    closeTo(o[0], 79.81); closeTo(o[1], 217.56);
    const p = pts(desk, "k-point");
    expect.soft(p).toHaveLength(3);
    [[103.21, 264.79], [231.91, 163.38], [384, 69.21]].forEach(([x, y], i) => { closeTo(p[i][0], x); closeTo(p[i][1], y); });
    expect.soft(desk.match(/<polyline class="k-hist" points="([^"]+)"/)[1].split(" ")).toHaveLength(21);
  });

  it("draws the phone twin at 300×322", () => {
    expect.soft(phone).toContain('viewBox="0 0 300 322"');
    expect.soft(phone).toContain('class="k-chart k-dp"');
    const [o] = pts(phone, "k-origin");
    closeTo(o[0], 52.64); closeTo(o[1], 163.74);
    const p = pts(phone, "k-point");
    [[68.28, 197.12], [154.32, 125.44], [256, 58.88]].forEach(([x, y], i) => { closeTo(p[i][0], x); closeTo(p[i][1], y); });
  });

  it("puts each horizon's price in a tile directly under its own point", () => {
    for (const [svg, w] of [[desk, 104], [phone, 74]]) {
      const tiles = [...svg.matchAll(/<rect class="k-tile" x="([\d.]+)" y="[\d.]+" width="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
      const xs = pts(svg, "k-point").map(([x]) => x);
      expect.soft(tiles).toHaveLength(3);
      tiles.forEach(([x, tw], i) => { expect.soft(tw).toBe(w); closeTo(x + tw / 2, xs[i], 0.02); });
      expect.soft([...svg.matchAll(/class="k-hzv"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(["$178.00", "$192.00", "$205.00"]);
      for (const price of ["$178.00", "$192.00", "$205.00"]) expect.soft(svg).toContain(`Our projection points to ${price}`);
      expect.soft(svg).not.toContain("lands at");
      expect.soft([...svg.matchAll(/class="k-hzk"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(["NEAR", "MID", "FAR"]);
    }
  });

  it("states the shape and the three prices in its label", () => {
    expect.soft(desk).toContain("near 2 weeks $178.00. mid 3 months $192.00. far 6 months $205.00.");
  });
});
