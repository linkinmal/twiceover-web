import { describe, expect, it } from "vitest";
import { outcomes, runOdds } from "./position-size.mjs";
import { answerHtml, barsHtml, edgeText, kellyText, payoffNote, sayText, share, sliderText } from "./position-size-view.mjs";

const o = (p, can = true, all = false) => ({ p, can, all });

describe("a share of runs", () => {
  it("prints whole percents half up, with the two ends in words", () => {
    expect.soft(share(o(0.4249))).toBe("42%");
    expect.soft(share(o(0.425))).toBe("43%");
    expect.soft(share(o(0.0049))).toBe("under 1%");
    expect.soft(share(o(0.005))).toBe("1%");
    expect.soft(share(o(0.9949))).toBe("99%");
    expect.soft(share(o(0.995))).toBe("over 99%");
    expect.soft(share(o(1))).toBe("over 99%");
    expect.soft(share(o(0))).toBe("under 1%");
  });

  it("prints 0% and 100% only for an outcome that cannot happen or always does", () => {
    expect.soft(share(o(0, false))).toBe("0%");
    expect.soft(share(o(1, true, true))).toBe("100%");
  });
});

describe("the page's words", () => {
  const r = runOdds(60, 100);

  it("signs the edge with a true minus", () => {
    expect.soft(edgeText(200)).toBe("+20.0%");
    expect.soft(edgeText(-50)).toBe("−5.0%");
    expect.soft(edgeText(0)).toBe("0.0%");
    expect.soft(payoffNote(r)).toBe("Edge: +20.0% of the amount risked, on average.");
  });

  it("prints the fastest-growing size, none, or under 1%", () => {
    expect.soft(kellyText({ kind: "pct", pct: 20 })).toBe("20%");
    expect.soft(kellyText({ kind: "none" })).toBe("none");
    expect.soft(kellyText({ kind: "under" })).toBe("under 1%");
  });

  it("says the opening example in one sentence", () => {
    expect(sayText(r, 10)).toBe("Risking 10% of the account on each trade, 88% of runs end 100 trades ahead and 9% fall to half the start.");
  });

  it("adds the no-edge sentence when the edge is zero or less", () => {
    expect.soft(sayText(runOdds(50, 100), 10)).toMatch(/ With no edge, no size grows the account on average\.$/);
    expect.soft(sayText(runOdds(45, 100), 10)).toMatch(/ With no edge, no size grows the account on average\.$/);
    expect.soft(sayText(runOdds(50, 100.1), 10)).not.toMatch(/no edge/);
  });

  it("puts the same figures in the tiles as in the sentence", () => {
    const html = answerHtml(r, 20);
    const out = outcomes(r, 20);
    expect.soft(html).toContain(`<b>${share(out.ahead)}</b><span>of runs end 100 trades ahead</span>`);
    expect.soft(html).toContain(`<b>${share(out.floor)}</b><span>of runs fall to half the start</span>`);
    expect.soft(html).toContain("<b>20%</b><span>the size that grows the account fastest</span>");
  });

  it("draws one row a size, marks the slider's, and adds it when it is not a fixed row", () => {
    const rows = (h) => h.match(/class="sb[^"]*"/g).slice(1);
    expect.soft(rows(barsHtml(r, 10))).toHaveLength(8);
    expect.soft(rows(barsHtml(r, 10)).filter((c) => c.includes(" on"))).toHaveLength(1);
    expect.soft(barsHtml(r, 10)).toContain('<div class="sb on"><span>10%</span>');
    expect.soft(rows(barsHtml(r, 7))).toHaveLength(9);
    expect.soft(barsHtml(r, 7)).toContain('<div class="sb on"><span>7%</span>');
    expect.soft(barsHtml(r, 10)).toContain(`${share(outcomes(r, 20).ahead)} ahead · ${share(outcomes(r, 20).floor)} at half`);
  });

  it("gives the slider a value and a spoken value", () => {
    expect(sliderText(12)).toEqual({ value: "12", valuetext: "12% of the account on each trade" });
  });
});
