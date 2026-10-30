import { describe, expect, it } from "vitest";
import { outcomes, runOdds } from "./position-size.mjs";
import { answerHtml, barsHtml, dollars, edgeExplain, edgeText, edgeWords, firstTradeText, kellyText, payoffNote, sayText, share, sliderText, winNote, winThenLoss } from "./position-size-view.mjs";

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
    expect.soft(payoffNote(r)).toBe("At 100%, a trade that risks $1,000 wins $1,000. Edge: +20.0%. On average a trade earns 20 cents for each $1 it risks.");
    expect.soft(edgeWords(runOdds(45, 100))).toBe("Edge: \u221210.0%. On average a trade loses 10 cents for each $1 it risks.");
    expect.soft(edgeWords(runOdds(50, 101))).toBe("Edge: +0.5%. On average a trade earns 0.5 cents for each $1 it risks.");
    expect.soft(edgeWords(runOdds(50, 100))).toBe("Edge: 0.0%. On average a trade earns nothing.");
    expect.soft(edgeWords(runOdds(50, 102))).toBe("Edge: +1.0%. On average a trade earns 1 cent for each $1 it risks.");
  });

  it("prints the fastest-growing size, none, or under 1%", () => {
    expect.soft(kellyText({ kind: "pct", pct: 20 })).toBe("20%");
    expect.soft(kellyText({ kind: "none" })).toBe("none");
    expect.soft(kellyText({ kind: "under" })).toBe("under 1%");
  });

  it("says the opening example in one sentence", () => {
    expect(sayText(r, 10)).toBe("Risking 10% on each trade, 88% of runs end above $10,000 and 9% fall to $5,000 on the way.");
  });

  it("adds the no-edge sentence when the edge is zero or less", () => {
    expect.soft(sayText(runOdds(50, 100), 10)).toMatch(/ With no positive edge, no size grows the account on average\.$/);
    expect.soft(sayText(runOdds(45, 100), 10)).toMatch(/ With no positive edge, no size grows the account on average\.$/);
    expect.soft(sayText(runOdds(50, 100.1), 10)).not.toMatch(/no positive edge/);
  });

  it("puts the same figures in the tiles as in the sentence", () => {
    const html = answerHtml(r, 20);
    const out = outcomes(r, 20);
    expect.soft(html).toContain(`<b>${share(out.ahead)}</b><span>of runs end the 100 trades above $10,000</span>`);
    expect.soft(html).toContain(`<b>${share(out.floor)}</b><span>of runs fall to $5,000 on the way, and stop</span>`);
    expect.soft(html).toContain("<b>20%</b><span>the size that grows the account fastest</span>");
  });

  it("draws one row a size, marks the slider's, and adds it when it is not a fixed row", () => {
    const rows = (h) => h.match(/class="sb[^"]*"/g).slice(1);
    expect.soft(rows(barsHtml(r, 10))).toHaveLength(8);
    expect.soft(rows(barsHtml(r, 10)).filter((c) => c.includes(" on"))).toHaveLength(1);
    expect.soft(barsHtml(r, 10)).toContain('<div class="sb on"><span>10%</span>');
    expect.soft(rows(barsHtml(r, 7))).toHaveLength(9);
    expect.soft(barsHtml(r, 7)).toContain('<div class="sb on"><span>7%</span>');
    expect.soft(barsHtml(r, 10)).toContain(`${share(outcomes(r, 20).ahead)} ahead · ${share(outcomes(r, 20).floor)} to $5,000`);
  });

  it("works the first trade from the $10,000 start, in exact cents", () => {
    expect.soft(firstTradeText(r, 10)).toBe("At 10%, the first trade risks $1,000 of the $10,000. A win adds $1,000, to $11,000. A loss takes $1,000, to $9,000. Each later trade risks 10% of what the account holds then.");
    expect.soft(firstTradeText(runOdds(40, 37.5), 3)).toBe("At 3%, the first trade risks $300 of the $10,000. A win adds $112.50, to $10,112.50. A loss takes $300, to $9,700. Each later trade risks 3% of what the account holds then.");
    expect.soft(firstTradeText(r, 100)).toContain("A loss takes $10,000, to $0.");
  });

  it("explains the edge in cents and the two notes from the odds", () => {
    expect.soft(edgeExplain(r)).toBe("Here a trade wins 60 cents and loses 40 cents for each $1 it risks, on average. The difference, +20.0%, is the edge.");
    expect.soft(edgeExplain(runOdds(55.5, 150))).toBe("Here a trade wins 83.25 cents and loses 44.5 cents for each $1 it risks, on average. The difference, +38.8%, is the edge.");
    expect.soft(winNote(r)).toBe("60% means about 60 trades in 100 win.");
    expect.soft(winNote(runOdds(55.5, 100))).toBe("55.5% means about 55.5 trades in 100 win.");
  });

  it("prints money with separators and what a win then a loss leave", () => {
    expect.soft(dollars(1000000)).toBe("$10,000");
    expect.soft(dollars(1011250)).toBe("$10,112.50");
    expect.soft(winThenLoss(10)).toBe("$9,900");
    expect.soft(winThenLoss(50)).toBe("$7,500");
  });

  it("gives the slider a value and a spoken value", () => {
    expect(sliderText(12)).toEqual({ value: "12", valuetext: "12% of the account on each trade" });
  });
});
