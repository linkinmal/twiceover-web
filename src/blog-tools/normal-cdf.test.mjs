/**
 * `normalCdf` — the standard normal cumulative distribution under the call calculator's price.
 *
 * The design's prototype used a 1.5e-7 erf approximation. That is invisible at $100 and a visible cent
 * at a $100,000 stock (the input range allows it), so the build uses a double-precision algorithm and
 * these tests pin it to published values and to an independent series.
 */
import { describe, expect, it } from "vitest";
import { normalCdf } from "./normal-cdf.mjs";

/** Independent oracle: the Maclaurin series of erf. Exact to ~1e-12 for |x| <= 3 (terms stay small). */
function seriesCdf(x) {
  const z = x / Math.SQRT2;
  let term = z;
  let sum = z;
  for (let n = 1; n < 80; n++) {
    term *= (-z * z) / n;
    sum += term / (2 * n + 1);
  }
  return 0.5 * (1 + (2 / Math.sqrt(Math.PI)) * sum);
}

describe("published values of the standard normal CDF", () => {
  it("matches the textbook table to 12 digits, in both tails and at the centre", () => {
    const table = [
      [0, 0.5],
      [1, 0.8413447460685429],
      [-1, 0.15865525393145705],
      [1.96, 0.9750021048517795],
      [-3, 0.0013498980316301035],
      [-5, 2.866515718791939e-7],
    ];
    for (const [x, want] of table) {
      expect.soft(normalCdf(x), `N(${x})`).toBeCloseTo(want, 12);
    }
    // Relative accuracy in the far tail, where an absolute tolerance would pass anything.
    expect.soft(Math.abs(normalCdf(-5) / 2.866515718791939e-7 - 1)).toBeLessThan(1e-9);
    expect.soft(Math.abs(normalCdf(-8) / 6.220960574271786e-16 - 1)).toBeLessThan(1e-6);
  });
});

describe("agreement with an independent series across the range a price can reach", () => {
  it("is within 1e-11 of the series every 0.05 from -3 to 3, and symmetric: N(x) + N(-x) = 1", () => {
    let worst = 0;
    let worstSym = 0;
    for (let i = -60; i <= 60; i++) {
      const x = i / 20;
      worst = Math.max(worst, Math.abs(normalCdf(x) - seriesCdf(x)));
      worstSym = Math.max(worstSym, Math.abs(normalCdf(x) + normalCdf(-x) - 1));
    }
    expect.soft(worst).toBeLessThan(1e-11);
    expect.soft(worstSym).toBeLessThan(1e-14);
  });
});

describe("limits and non-finite input", () => {
  it("saturates at 0 and 1 past 40 sigma, is monotone, and passes NaN through", () => {
    expect.soft(normalCdf(-40)).toBe(0);
    expect.soft(normalCdf(40)).toBe(1);
    expect.soft(normalCdf(Infinity)).toBe(1);
    expect.soft(normalCdf(-Infinity)).toBe(0);
    expect.soft(Number.isNaN(normalCdf(NaN))).toBe(true);
    let prev = -1;
    let monotone = true;
    for (let i = -400; i <= 400; i++) {
      const v = normalCdf(i / 40);
      if (v < prev) monotone = false;
      prev = v;
    }
    expect.soft(monotone).toBe(true);
  });
});
