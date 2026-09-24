/**
 * The page-2 product pictures' charts (stock-analyst-platform#3829). The port is checked against the
 * build reference's own drawing (explainer-pages-3818-2026-09-24.html): the geometry below is copied
 * from the artifact's SVG, and the fixture has to reproduce it from the position's own figures.
 */
import { describe, expect, it } from "vitest";
import { COVERED_CALL_PAYOFF, COVERED_CALL_RULE_ROWS, payoffSvg, rulesChartSvg } from "./app-pictures.mjs";

describe("the covered call's payoff chart", () => {
  const svg = payoffSvg(COVERED_CALL_PAYOFF);

  it("draws the artifact's payoff line from the fixture's P&L function", () => {
    expect(svg).toContain('d="M 44.0 138.7 L 255.5 34.5 L 326.0 34.5"');
  });

  it("places breakeven, the cap and the last close where the artifact does", () => {
    expect.soft(svg).toContain('<circle cx="111.0" cy="105.7" r="3.4"');
    expect.soft(svg).toContain('<circle cx="255.5" cy="34.5" r="3.4" fill="var(--ink)"/>');
    expect.soft(svg).toContain('x1="225.5" y1="16" x2="225.5" y2="152" stroke="var(--accent)"');
    expect.soft(svg).toContain(">+$2,460</text>");
    expect.soft(svg).toContain(">$41.80</text>");
    expect.soft(svg).toContain(">$50.00</text>");
  });

  it("labels the gridlines from its inputs, not NVDA's hard-coded scale", () => {
    expect.soft(svg).toContain(">+$2,000</text>");
    expect.soft(svg).toContain(">−$1,000</text>");
    expect.soft(svg).not.toContain("$4,000");
    expect.soft(svg).toContain('y1="47.8"');
    expect.soft(svg).toContain('y1="134.6"');
  });

  it("names its figures in the accessible label", () => {
    expect(svg).toContain(
      'aria-label="Payoff at expiry for your covered call. Maximum profit $2,460 at $50.00 and above. Breakeven $41.80. Maximum loss $12,540 if EXMP reaches $0.00."',
    );
  });
});

describe("the covered call's rules chart", () => {
  const svg = rulesChartSvg(COVERED_CALL_RULE_ROWS, 154);

  it("states each rule's reading as the artifact does", () => {
    expect(COVERED_CALL_RULE_ROWS.map((r) => [r.rule.mk, r.rule.v])).toEqual([
      ["●", "+60%"],
      ["◐", "24 DTE"],
      ["○", "+9.3%"],
      ["○", "0%"],
    ]);
  });

  it("puts each marker at the distance its own reading gives", () => {
    // The artifact hard-codes the stock target's fraction as 0.37 (x 202.8); derived from the
    // position's +9.28% against the 25% target it is 0.371, x 203.0. The other three match exactly.
    for (const x of ["286.0", "269.5", "203.0", "154.0"]) {
      expect.soft(svg, x).toContain(`<line x1="${x}" y1=`);
    }
  });

  it("names every rule and its reading in the accessible label", () => {
    expect(svg).toContain(
      'aria-label="Distance to your rules. Option target 60% · call, reached at +60%. Expiry 21 · call, approaching at 24 DTE. Stock target 25% · sh, not met at +9.3%. Stock max loss −15% · sh, not met at 0%."',
    );
  });
});
