import { describe, expect, it } from "vitest";
import { EXAMPLES, runStraddle, sliderBounds } from "./straddle.mjs";
import { answerHtml, chartLabel, chartSvg, money, percent, resultHtml, sayText, sliderText, straddleNote } from "./straddle-view.mjs";

const opening = runStraddle(100, 9);

describe("the straddle page's words", () => {
  it("formats cents as dollars and tenths as a percent", () => {
    expect.soft(money(9100)).toBe("$91.00");
    expect.soft(money(1)).toBe("$0.01");
    expect.soft(money(12345678)).toBe("$123456.78");
    expect.soft(percent(90)).toBe("9.0%");
    expect.soft(percent(46)).toBe("4.6%");
    expect.soft(percent(2)).toBe("0.2%");
  });

  it("prints the three answers for the opening example", () => {
    expect(answerHtml(opening)).toBe(
      "<div><b>9.0%</b><span>implied move, up or down</span></div>" +
        "<div><b>$91.00 to $109.00</b><span>the range it draws</span></div>" +
        "<div><b>$9.00</b><span>what the straddle costs per share</span></div>",
    );
  });

  it("says the move and the two breakevens in one plain sentence", () => {
    expect(sayText(opening)).toBe(
      "The straddle costs $9.00 for a $100.00 stock, so the market is pricing a move of about 9.0%. The stock has to end below $91.00 or above $109.00 for the straddle to make money.",
    );
  });

  it("says what the straddle costs for one contract under the straddle box", () => {
    expect.soft(straddleNote(opening)).toBe("The call's price plus the put's price. A $9.00 straddle costs $900 for one contract.");
    expect.soft(straddleNote(runStraddle(40, 4.4))).toBe("The call's price plus the put's price. A $4.40 straddle costs $440 for one contract.");
  });

  it("says the result at the slider's price: a gain, a loss or an exact breakeven, in words as well as colour", () => {
    expect.soft(resultHtml(opening, 10000)).toBe('Stock ends at $100.00: <span class="neg">loss $9.00 a share, $900 a contract</span>.');
    expect.soft(resultHtml(opening, 11500)).toBe('Stock ends at $115.00: <span class="pos">gain $6.00 a share, $600 a contract</span>.');
    expect.soft(resultHtml(opening, 9100)).toBe('Stock ends at $91.00: <span>$0.00 (breakeven)</span>.');
  });

  it("gives the slider's reading and its attributes in dollars", () => {
    const b = sliderBounds(opening);
    expect.soft(sliderText(opening, 10000)).toEqual({ min: "82.00", max: "118.00", step: "0.5", value: "100.00", valuetext: "$100.00" });
    expect.soft(b.stepC).toBe(50);
    expect.soft(sliderText(runStraddle(40, 4.4), 4000).step).toBe("0.25");
  });
});

describe("the straddle chart", () => {
  const num = (svg, re) => svg.match(re).slice(1).map(Number);
  const svg = chartSvg(opening, 10000);

  it("shades the implied-move band between the breakevens and draws the zero line, the V and the two dashed breakevens", () => {
    expect.soft(svg).toContain('class="sd-band"');
    expect.soft(svg).toContain('class="sd-zero"');
    expect.soft(svg).toMatch(/<polyline class="l2"[^>]* points="[\d. ,-]+"/);
    expect.soft(svg.match(/class="gd"/g)).toHaveLength(2);
  });

  it("labels the two breakevens, the strike and the most the straddle can lose", () => {
    expect.soft(svg).toContain(">$91.00<");
    expect.soft(svg).toContain(">$109.00<");
    expect.soft(svg).toContain(">strike $100.00<");
    expect.soft(svg).toContain(">most you can lose: $9.00 a share<");
  });

  it("puts the handle at the ending price, on the V", () => {
    // the strike is the bottom of the V: the handle sits on the loss line (y = 20 + 180 = 200)
    const [cx, cy] = num(svg, /<circle class="sd-hd" cx="([\d.]+)" cy="([\d.]+)"/);
    expect.soft(cx).toBe(330);
    expect.soft(cy).toBe(200);
    // at a breakeven the handle sits on the zero line
    const atLow = chartSvg(opening, opening.lowC);
    const [, cyLow] = num(atLow, /<circle class="sd-hd" cx="([\d.]+)" cy="([\d.]+)"/);
    const [, y0] = num(atLow, /<line class="sd-zero" x1="50" x2="610" y1="([\d.]+)" y2="([\d.]+)"/);
    expect.soft(cyLow).toBe(y0);
  });

  it("keeps every drawn x inside the plot for every example at both ends of the slider", () => {
    for (const e of EXAMPLES) {
      const r = runStraddle(e.stock, e.straddle);
      const b = sliderBounds(r);
      for (const end of [b.minC, r.stockC, b.maxC]) {
        const s = chartSvg(r, end);
        const xs = [...s.matchAll(/(?:cx|x1|x2)="([\d.-]+)"/g)].map((m) => Number(m[1]));
        for (const x of xs) {
          expect.soft(x, `${JSON.stringify(e)} at ${end}`).toBeGreaterThanOrEqual(50);
          expect.soft(x, `${JSON.stringify(e)} at ${end}`).toBeLessThanOrEqual(610);
        }
      }
    }
  });

  it("describes the chart for a screen reader with the band's two prices", () => {
    expect(chartLabel(opening)).toBe(
      "Profit or loss of the straddle on its last day at each stock price. The shaded band runs from $91.00 to $109.00, the implied move.",
    );
  });
});
