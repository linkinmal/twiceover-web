import { describe, expect, it } from "vitest";
import { outcomes, runOdds } from "../position-size-and-risk-of-ruin/position-size.mjs";
import { FLIPS, RUNS, TRADES, VIEWS, axisLabels, chartLabel, chartSvg, classify, drawRuns, tally } from "./runs-chart.mjs";

const odds = runOdds(60, 100);
const counts = (size, r = odds) => tally(drawRuns(r, size));

describe("the fixed sample flips", () => {
  it("are thirty sequences of 100 numbers in [0, 1), the same on every import", () => {
    expect.soft(FLIPS).toHaveLength(RUNS);
    expect.soft(FLIPS.every((u) => u.length === TRADES && u.every((x) => x >= 0 && x < 1))).toBe(true);
    // The first and last numbers of the signed-off drawing's generator (seed 7).
    expect.soft(FLIPS[0][0]).toBeCloseTo(0.011704753153026104, 15);
    expect.soft(FLIPS[0][2]).toBeCloseTo(0.97690763277933, 14);
    expect.soft(FLIPS[29][99]).toBeCloseTo(0.5067324535921216, 15);
  });

  it("move the same dice at every size: a run's win-and-loss order does not change with the size", () => {
    const at = (s) => drawRuns(odds, s)[0];
    const wins = (run, f) => run.pts.slice(1).map((p, i) => p[1] > run.pts[i][1] === true);
    expect.soft(wins(at(5)).slice(0, 20)).toEqual(wins(at(8)).slice(0, 20));
    // Run 0's first trade is a win at 60%: the number is 0.0117 < 0.6, so the account steps up by f × b.
    expect.soft(at(10).pts[1][1]).toBeCloseTo(1.1, 12);
    expect.soft(at(25).pts[1][1]).toBeCloseTo(1.25, 12);
  });

  it("show the same paths on every call", () => {
    expect(drawRuns(odds, 17)).toEqual(drawRuns(odds, 17));
    expect(chartSvg(drawRuns(odds, 10), VIEWS.wide)).toBe(chartSvg(drawRuns(odds, 10), VIEWS.wide));
  });
});

describe("a run that falls to half", () => {
  const runs = drawRuns(odds, 30);
  const ruined = runs.filter((r) => r.kind === "half");

  it("stops on the half line: its last point is exactly one half, and no earlier point is at or below it", () => {
    expect.soft(ruined.length).toBeGreaterThan(0);
    for (const r of ruined) {
      expect.soft(r.pts.at(-1)[1]).toBe(0.5);
      expect.soft(r.pts.slice(0, -1).every((p) => p[1] > 0.5)).toBe(true);
      expect.soft(r.pts.at(-1)[0]).toBeLessThan(TRADES + 1);
    }
  });

  it("takes no further trades after it stops", () => {
    for (const r of ruined) expect.soft(r.pts.length).toBeLessThanOrEqual(TRADES + 1);
    expect.soft(ruined.some((r) => r.pts.length < TRADES + 1)).toBe(true);
  });

  it("draws one dot at its stop, and no dot for a run that did not fall", () => {
    const svg = chartSvg(runs, VIEWS.wide);
    expect.soft(svg.match(/<circle /g)).toHaveLength(ruined.length);
    const none = drawRuns(odds, 1);
    expect.soft(chartSvg(none, VIEWS.wide)).not.toContain("<circle");
  });

  it("never goes below the half line, whatever the size", () => {
    for (const s of [1, 10, 30, 60, 100]) {
      for (const r of drawRuns(odds, s)) expect.soft(Math.min(...r.pts.map((p) => p[1]))).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe("the tally counts only the drawn runs", () => {
  it("adds up to thirty at every size, and matches the kinds drawn", () => {
    for (const s of [1, 7, 10, 20, 33, 45, 60]) {
      const runs = drawRuns(odds, s);
      const t = tally(runs);
      expect.soft(t.ahead + t.half + t.neither).toBe(RUNS);
      expect.soft(t.ahead).toBe(runs.filter((r) => r.kind === "ahead").length);
      expect.soft(t.half).toBe(runs.filter((r) => r.kind === "half").length);
    }
  });

  it("matches the signed-off drawing at 60% and even money", () => {
    expect.soft(counts(1)).toEqual({ ahead: 30, neither: 0, half: 0 });
    expect.soft(counts(5)).toEqual({ ahead: 30, neither: 0, half: 0 });
    expect.soft(counts(10)).toEqual({ ahead: 25, neither: 0, half: 5 });
    expect.soft(counts(20)).toEqual({ ahead: 18, neither: 0, half: 12 });
    expect.soft(counts(30)).toEqual({ ahead: 11, neither: 1, half: 18 });
    expect.soft(counts(60)).toEqual({ ahead: 0, neither: 0, half: 30 });
  });

  it("is a count of thirty draws, not the exact odds: the two figures can differ", () => {
    const exact = outcomes(odds, 20);
    expect.soft(counts(20).half / RUNS).not.toBe(exact.floor.p);
  });

  it("classifies a log level: at or below half is half, strictly above the start is ahead, anything else is neither", () => {
    const up = Math.log1p(0.5 * 2);
    const down = Math.log1p(-0.5);
    expect.soft(classify(up + down)).toBe("neither"); // a 50% size at 200%: one win, one loss, exactly the start
    expect.soft(classify(0)).toBe("neither");
    expect.soft(classify(down)).toBe("half"); // a 50% size, one loss: exactly half is at half
    expect.soft(classify(down + 1e-12)).toBe("half"); // within the odds' tolerance
    expect.soft(classify(down + 1e-6)).toBe("neither");
    expect.soft(classify(1e-6)).toBe("ahead");
    expect.soft(classify(-Infinity)).toBe("half");
  });
});

describe("the drawing", () => {
  const runs = drawRuns(odds, 10);

  it("labels the account in dollars from the $10,000 start, from $2,500 to $80,000", () => {
    expect.soft(axisLabels(10000).map((a) => a.text)).toEqual(["$2,500", "$5,000", "$10,000", "$20,000", "$40,000", "$80,000"]);
    const svg = chartSvg(runs, VIEWS.wide);
    for (const t of ["$2,500", "$5,000", "$10,000", "$20,000", "$40,000", "$80,000", "100 trades", "half"]) expect.soft(svg).toContain(`>${t}<`);
  });

  it("draws lines at half, the start, 2×, 4× and 8× only, the half line dashed", () => {
    const svg = chartSvg(runs, VIEWS.wide);
    expect.soft(svg.match(/<line /g)).toHaveLength(5);
    expect.soft(svg.match(/class="rc-half"/g)).toHaveLength(1);
    expect.soft(svg).toContain('class="rc-start"');
  });

  it("draws red under green, one path per run, with the artifact's widths and no colour of its own", () => {
    const svg = chartSvg(runs, VIEWS.wide);
    expect.soft(svg.match(/<path /g)).toHaveLength(RUNS);
    expect.soft(svg.indexOf('class="rc-l"')).toBeLessThan(svg.indexOf('class="rc-g"'));
    expect.soft(svg).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect.soft(svg).not.toMatch(/<style|style=/);
  });

  it("says 'off the chart' when a path passes 8×, and not when none does", () => {
    expect.soft(chartSvg(drawRuns(odds, 20), VIEWS.wide)).toContain("off the chart ↑");
    expect.soft(chartSvg(drawRuns(odds, 1), VIEWS.wide)).not.toContain("off the chart");
  });

  it("prints 0, 25, 50, 75 and 100 trades at 1280, and only 0, 50 and 100 trades at 390 so the labels do not touch", () => {
    const labels = (svg) => [...svg.matchAll(/class="rc-ax" x="[\d.]+" y="(?:292|222)" text-anchor="\w+">([^<]+)</g)].map((m) => m[1]);
    expect.soft(labels(chartSvg(runs, VIEWS.wide))).toEqual(["0", "25", "50", "75", "100 trades"]);
    expect.soft(labels(chartSvg(runs, VIEWS.narrow))).toEqual(["0", "50", "100 trades"]);
  });

  it("gives 'off the chart' its own class, so the kit can set it clear of the paths", () => {
    expect.soft(chartSvg(drawRuns(odds, 20), VIEWS.wide)).toContain('class="rc-ax rc-off"');
  });

  it("holds both views to the artifact's sizes", () => {
    expect.soft(VIEWS.wide).toMatchObject({ w: 752, h: 300 });
    expect.soft(VIEWS.narrow).toMatchObject({ w: 358, h: 230 });
    // The markup is the inside of the <svg>: its right edge and bottom row follow the view it was given.
    expect.soft(chartSvg(runs, VIEWS.narrow)).toContain('x="346.0" y="222" text-anchor="end">100 trades<');
    expect.soft(chartSvg(runs, VIEWS.wide)).toContain('x="740.0" y="292" text-anchor="end">100 trades<');
  });

  it("stays inside its box: every coordinate is within the view", () => {
    for (const v of [VIEWS.wide, VIEWS.narrow]) {
      const nums = [...chartSvg(drawRuns(odds, 40), v).matchAll(/[ML]([\d.]+),([\d.]+)/g)];
      for (const [, x, y] of nums) {
        expect.soft(Number(x)).toBeLessThanOrEqual(v.w);
        expect.soft(Number(y)).toBeLessThanOrEqual(v.h);
      }
    }
  });

  it("writes a text alternative from the sentence and the tally it is given", () => {
    expect(chartLabel(10, "THE SENTENCE", "THE TALLY")).toBe("Thirty account paths over 100 trades at a 10% size. THE SENTENCE THE TALLY");
  });
});
