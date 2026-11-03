// The phones' figures are the fixture's, derived, never typed (CLAUDE.md Correctness): each is
// checked against the build reference's known-good value (Phone board).
import { describe, expect, it } from "vitest";
import { analysisScreen, positionScreen } from "./phone-screens.mjs";

describe("the position phone", () => {
  const p = positionScreen();

  it("shows the NVDA spread's P&L, its share of the debit and the facts at expiry", () => {
    expect.soft(p.title).toBe("NVDA Bull call spread");
    expect.soft(p.legs).toBe("2 contracts · 175/190 calls · Dec 18");
    expect.soft(p.pnl).toBe("+$612");
    expect.soft(p.pnlOfDebit).toBe("+49.4% of the $1,240 debit");
    expect.soft(p.facts).toBe("Breakeven $181.20 · Max loss −$1,240 · Max gain +$1,760");
  });

  it("fills the target meter by the P&L's share of the 60% target", () => {
    expect.soft(p.rule.text).toBe("Option target 60% · approaching");
    expect.soft(p.meterPct).toBe(82.3);
    expect.soft(p.meterNow).toBe("49.4%");
    expect.soft(p.meterTarget).toBe("your 60%");
  });

  it("draws the payoff flat at max loss below 175, rising to max gain at 190, with today's price on it", () => {
    const pts = p.payoff.split(" ").map((xy) => xy.split(",").map(Number));
    expect.soft(pts).toHaveLength(4);
    expect.soft(pts[0][1]).toBe(pts[1][1]);
    expect.soft(pts[2][1]).toBe(pts[3][1]);
    expect.soft(pts[0][1]).toBeGreaterThan(p.zeroY);
    expect.soft(pts[3][1]).toBeLessThan(p.zeroY);
    expect.soft(p.spot.x).toBeGreaterThan(pts[1][0]);
    expect.soft(p.spot.x).toBeLessThan(pts[2][0]);
    expect.soft(p.spot.y).toBeLessThan(p.zeroY);
  });
});

// Known-good geometry, so a scale edit that throws a point off the plot fails here rather than on screen.
const inside = (points, w, h) => points.every(([x, y]) => x >= 0 && x <= w && y >= 0 && y <= h);
const parse = (s) => s.split(" ").map((xy) => xy.split(",").map(Number));

describe("the phone plots' geometry", () => {
  it("the payoff runs at the recorded coordinates, inside its 256×86 plot", () => {
    const p = positionScreen();
    expect.soft(p.payoff).toBe("8,74.8 66,74.8 190,14.8 248,14.8");
    expect.soft(p.spot).toEqual({ x: 144.7, y: 36.7 });
    expect.soft(inside([...parse(p.payoff), [p.spot.x, p.spot.y]], 256, 86)).toBe(true);
  });

  it("the projection runs at the recorded coordinates, and every point sits inside the 256×118 plot", () => {
    const a = analysisScreen();
    expect.soft(a.projection).toBe("146,68.6 176,84.4 212,50.6 246,19.2");
    expect.soft(inside([...parse(a.history), ...parse(a.projection)], 256, 118)).toBe(true);
  });
});

describe("the analysis phone", () => {
  const a = analysisScreen();

  it("states the price and the analysis stamp", () => {
    expect.soft(a.price).toBe("$184.52");
    expect.soft(a.stamp).toBe("Analysis · Aug 31, 11:31 ET");
  });

  it("shows the three projected prices in the product's horizon order", () => {
    expect.soft(a.horizons).toEqual([
      { label: "NEAR · 2 WEEKS", price: "$178" },
      { label: "MID · 3 MONTHS", price: "$192" },
      { label: "FAR · 6 MONTHS", price: "$205" },
    ]);
  });

  it("draws the dip-then-recover projection from today: near below today, mid and far above it", () => {
    const [near, mid, far] = a.projected;
    expect.soft(near.y).toBeGreaterThan(a.today.y);
    expect.soft(mid.y).toBeLessThan(a.today.y);
    expect.soft(far.y).toBeLessThan(mid.y);
    expect.soft(a.history.split(" ").at(-1)).toBe(`${a.today.x},${a.today.y}`);
  });
});
