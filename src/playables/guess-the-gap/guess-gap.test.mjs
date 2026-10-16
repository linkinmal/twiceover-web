import { describe, expect, it } from "vitest";
import { HIT_TENTHS, MAX_TENTHS, STEP_TENTHS, hit, insideCount, offTenths, ratioTier, score, validateSets } from "./guess-gap.mjs";

const R = (priced, moved) => ({ company: "Sample Co.", date: "2025-07-24", pricedTenths: priced, movedTenths: moved });

describe("how a move compares with the priced move", () => {
  it("is 'times' from 1.8 up, with the ratio to one decimal, half rounding up", () => {
    expect.soft(ratioTier(R(50, 90))).toEqual({ tier: "times", ratioTenths: 18 });
    expect.soft(ratioTier(R(50, 89))).toEqual({ tier: "more", ratioTenths: 18 });
    expect.soft(ratioTier(R(90, -146))).toEqual({ tier: "more", ratioTenths: 16 });
    expect.soft(ratioTier(R(40, 146))).toEqual({ tier: "times", ratioTenths: 37 });
    expect.soft(ratioTier(R(40, -150))).toEqual({ tier: "times", ratioTenths: 38 });
  });
  it("is 'more' above 1.15, 'close' from 0.85 to 1.15, 'inside' below, on exact integer boundaries", () => {
    expect.soft(ratioTier(R(100, 115)).tier).toBe("close");
    expect.soft(ratioTier(R(100, 116)).tier).toBe("more");
    expect.soft(ratioTier(R(100, 85)).tier).toBe("close");
    expect.soft(ratioTier(R(100, 84)).tier).toBe("inside");
    expect.soft(ratioTier(R(60, 51)).tier).toBe("close");
    expect.soft(ratioTier(R(60, 50)).tier).toBe("inside");
    expect.soft(ratioTier(R(60, 0)).tier).toBe("inside");
  });
  it("ignores the direction of the move", () => {
    expect.soft(ratioTier(R(50, -112))).toEqual(ratioTier(R(50, 112)));
  });
});

describe("a guess against the move", () => {
  it("is a hit within 2 points, counted in tenths so 2.0 away is never missed by binary rounding", () => {
    // 4.1 − 2.1 is 2.0000000000000004 in floating point; in tenths it is exactly 20
    expect.soft(offTenths(R(50, 21), 41)).toBe(20);
    expect.soft(hit(R(50, 21), 41)).toBe(true);
    expect.soft(hit(R(50, 21), 42)).toBe(false);
    expect.soft(hit(R(50, -112), 90)).toBe(false);
    expect.soft(hit(R(50, -112), 92)).toBe(true);
    expect.soft(HIT_TENTHS).toBe(20);
  });
  it("compares the size of the move, not its sign", () => {
    expect.soft(offTenths(R(50, -112), 100)).toBe(12);
    expect.soft(offTenths(R(50, 112), 100)).toBe(12);
  });
});

describe("the score", () => {
  const set = [R(51, 112), R(74, -30), R(42, 11), R(90, -146), R(63, 58)];
  it("counts hits, plays and the average miss to one decimal in points, over the guesses actually made", () => {
    // offs: 112−100=12 (hit), 30−50=20 (hit), 11−80=69, 146−120=26, 58−60=2 (hit)
    expect.soft(score(set, [100, 50, 80, 120, 60])).toEqual({ played: 5, hits: 3, avgTenths: 26 });
    expect.soft(score(set, [100, null, undefined, 120])).toEqual({ played: 2, hits: 1, avgTenths: 19 });
    expect.soft(score(set, [])).toEqual({ played: 0, hits: 0, avgTenths: 0 });
  });
  it("rounds the average half up in tenths of a point", () => {
    expect.soft(score([R(50, 100), R(50, 100)], [100, 105]).avgTenths).toBe(3); // 0 and 5 average 2.5 -> 3
  });
  it("counts the reports where the stock moved less than the priced move, strictly", () => {
    expect.soft(insideCount(set)).toBe(3);
    expect.soft(insideCount([R(50, 50), R(50, -49)])).toBe(1);
  });
  it("shares one slider scale: 0 to 30 in steps of 0.5", () => {
    expect.soft([MAX_TENTHS, STEP_TENTHS]).toEqual([300, 5]);
  });
});

describe("checking a report set before it can be baked into a page", () => {
  const five = () => [R(51, 112), R(74, -30), R(42, 11), R(90, -146), R(63, 58)].map((r, i) => ({ ...r, company: `Co ${i}` }));
  it("accepts one or more sets of exactly five reports", () => {
    expect.soft(validateSets([five()])).toEqual([]);
    expect.soft(validateSets([five(), five()])).toEqual([]);
  });
  it("refuses no sets, a set that is not five, a missing field, and a figure the slider cannot show", () => {
    expect.soft(validateSets([])).not.toEqual([]);
    expect.soft(validateSets([five().slice(0, 4)])).not.toEqual([]);
    expect.soft(validateSets([[...five().slice(0, 4), { ...R(0, 5), company: "Co 9" }]]).join("\n")).toMatch(/priced move/);
    expect.soft(validateSets([[...five().slice(0, 4), { ...R(50, 301), company: "Co 9" }]]).join("\n")).toMatch(/30%/);
    expect.soft(validateSets([[...five().slice(0, 4), { ...R(50, 5.5), company: "Co 9" }]]).join("\n")).toMatch(/whole tenth/);
    expect.soft(validateSets([[...five().slice(0, 4), { ...R(50, 5), company: "" }]]).join("\n")).toMatch(/company/);
    expect.soft(validateSets([[...five().slice(0, 4), { ...R(50, 5), company: "Co 9", date: "24 Jul 2025" }]]).join("\n")).toMatch(/date/);
  });
  it("refuses the same company on the same date twice", () => {
    expect.soft(validateSets([[...five().slice(0, 4), five()[0]]]).join("\n")).toMatch(/twice/);
  });
});
