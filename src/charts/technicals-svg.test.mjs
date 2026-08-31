/**
 * `technicalsPriceSvgBody` — the crowding rule the model deliberately does NOT carry
 * (stock-analyst-platform#3019). `technicals-chart.test.mjs`'s own "KNOWN, MEASURED" test documents
 * that the model still admits both the 50-DMA and 200-DMA on the site's fixture, with their rules
 * 17–18.5px apart — narrower than either level's own two-line label block. This file is where that
 * stops being a defect: the render layer withholds the crowded pair as a unit before it ever reaches
 * markup.
 */
import { describe, expect, it } from "vitest";
import { priceLineChartModel } from "./technicals-chart.mjs";
import { technicalsPriceSvgBody } from "./technicals-svg.mjs";
import { TECHNICALS, TECHNICALS_SERIES } from "./site-fixture.mjs";

function svgOf(compact) {
  const m = priceLineChartModel({ series: TECHNICALS_SERIES, technicals: TECHNICALS, compact });
  return { m, svg: technicalsPriceSvgBody(m, { compact }) };
}

describe("a crowded level is withheld as a pair, never just the label (#3019)", () => {
  it.each([
    ["desktop", false],
    ["compact", true],
  ])("drops the FARTHER candidate's rule AND both label lines together (%s)", (_label, compact) => {
    const { m, svg } = svgOf(compact);
    // The model still computes all four — this asserts the render, not the model.
    expect(m.levels.map((l) => l.name)).toContain("200-DMA");

    // 50-DMA (175.43) is nearer the site's own last close (184.52, distance 9.09) than 200-DMA
    // (168.90, distance 15.62) — the higher-priority candidate survives.
    expect.soft(svg).toContain("50-DMA");
    expect.soft(svg).toContain("175.43");
    // The farther one is gone entirely: no rule, no name, no value — never a bare rule (§4b).
    expect.soft(svg).not.toContain("200-DMA");
    expect.soft(svg).not.toContain("168.90");
  });

  it("still draws every level once the crowding is resolved by wider spacing", () => {
    // Negative case: candidates spread widely enough across the y-axis (68/14/114.5, gaps of 46+)
    // that nothing should be withheld. Regression guard against a threshold set too generously.
    const closes = Array.from({ length: 90 }, (_unused, i) => 100 + (i * 100) / 89); // 100..200
    const series = closes.map((c, i) => ({ date: TECHNICALS_SERIES[i].date, close: c.toFixed(2) }));
    const technicals = { ma50: "180.00", ma200: "120.00", range52w: { high: "250.00", low: "10.00" } };
    const m = priceLineChartModel({ series, technicals, compact: false });
    expect(m.levels).toHaveLength(3); // the 52-week low breaches the floor and is skipped by the model
    const svg = technicalsPriceSvgBody(m, { compact: false });
    for (const level of m.levels) {
      expect.soft(svg).toContain(level.name);
      expect.soft(svg).toContain(level.value);
    }
  });
});
