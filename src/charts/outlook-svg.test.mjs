/**
 * What the projection path chart is allowed to DRAW (stock-analyst-platform#2987). The geometry is
 * proven next door in `outlook-chart.test.mjs`; these are the rules about ink and text, each of which
 * is a stated commitment the render could quietly break without any arithmetic changing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { projectionChartModel } from "./outlook-chart.mjs";
import { outlookPathSvgBody } from "./outlook-svg.mjs";
import { HERO_OUTLOOK, HORIZON_CARDS } from "./site-fixture.mjs";

const LABELS = Object.fromEntries(HORIZON_CARDS.map((c) => [c.key, c.label]));

function body(compact = false, horizons = HERO_OUTLOOK.horizons) {
  const m = projectionChartModel({ ...HERO_OUTLOOK, horizons, compact });
  return outlookPathSvgBody(m, { compact, horizons, labels: LABELS });
}

describe("the chart states no verdict", () => {
  it("carries no signal colour — the path and points take the accent surface only", () => {
    // A green or red path would read as a verdict on a page whose claim is "Depth, never a verdict".
    // The ink is bound in CSS, so this asserts the render names no colour of its own at all.
    const svg = body();
    expect.soft(svg).not.toMatch(/fill="#|stroke="#|fill="(red|green|rgb)/i);
    expect.soft(svg).not.toMatch(/signal|positive|negative/i);
  });

  it("binds every drawn element to a class, never an inline presentation attribute", () => {
    // A bare SVG presentation attribute loses to ambient page CSS, so the element renders — and
    // measures — in a font or colour nobody specified.
    const svg = body();
    expect.soft(svg).not.toMatch(/font-family=/);
    expect.soft(svg).not.toMatch(/font-size=/);
  });
});

describe("the last-close figure is not in the plot", () => {
  it("draws the reference LINE but states its price nowhere inside the SVG", () => {
    // The signed artifact's placement: the figure is a caption above the plot. On the dip shape the
    // path descends into the label's own band and the near dot lands on it — "furniture placed in
    // the data's own region", which no vertical offset solves.
    const svg = body();
    expect.soft(svg).toContain('class="k-spotline"');
    expect.soft(svg).not.toContain("last close");
    expect.soft(svg).not.toContain("184.52");
  });

  it("keeps the caption out of the compact render too, where the plot is tightest", () => {
    expect.soft(body(true)).not.toContain("last close");
  });
});

describe("no horizon price is rendered as chart text", () => {
  it("states each projection only inside a hover title, never as a drawn label", () => {
    const svg = body();
    // Every figure is stated as real text in the cards below; the tooltip is the only place the
    // chart itself names one, and it carries its attribution marker with it.
    for (const price of ["178.00", "192.00", "205.00"]) {
      expect.soft(svg).toContain(`Our projection lands at $${price}`);
    }
    const withoutTitles = svg.replace(/<title>[\s\S]*?<\/title>/g, "");
    for (const price of ["178", "192", "205"]) {
      expect.soft(withoutTitles).not.toMatch(new RegExp(`>[^<]*${price}[^<]*<`));
    }
  });

  it("labels each horizon with its window and landing date", () => {
    const svg = body();
    for (const tick of ["TODAY", "2 WKS", "3 MOS", "6 MOS"]) expect.soft(svg).toContain(`>${tick}<`);
    for (const sub of ["AUG 31", "SEP 14", "NOV 30", "MAR 1"]) expect.soft(svg).toContain(`>${sub}<`);
  });
});

describe("a degraded horizon", () => {
  it("draws a placeholder and no point, and bridges nothing", () => {
    const svg = body(false, [
      { horizon: "near", price: 178 },
      { horizon: "mid", price: null },
      { horizon: "far", price: 205 },
    ]);
    expect.soft(svg).toContain('class="k-dark"');
    expect.soft(svg.match(/class="k-seg"/g) ?? []).toHaveLength(1);
    expect.soft(svg.match(/class="k-point"/g) ?? []).toHaveLength(2);
  });
});

describe("both breakpoints are the component's own states", () => {
  it("renders the compact chart at its own geometry, not a scaled desktop one", () => {
    const desktop = body(false);
    const compact = body(true);
    expect.soft(desktop).not.toEqual(compact);
    // Point radius steps down with the state — a transform would have scaled it instead.
    expect.soft(desktop).toContain('r="5"');
    expect.soft(compact).toContain('r="4"');
  });

  it("is rendered at both states by the hero, with no transform between them", () => {
    // The one property a unit test on the builder cannot see: that the COMPONENT asks for both.
    const src = readFileSync(new URL("../components/OutlookPathChart.astro", import.meta.url), "utf8");
    expect.soft(src).toContain("compact: false");
    expect.soft(src).toContain("compact: true");
    expect.soft(src).not.toMatch(/transform:\s*scale/);
  });
});
