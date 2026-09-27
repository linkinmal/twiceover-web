/**
 * ADR 0990's one-list rule, as a test: "Page 1's section names and plan placement can never disagree
 * with /pricing or the homepage band. A test enforces it, as it already does for the plan lines."
 *
 * Page 1 carries only per-section COPY; its names, its plan chips and the band's cards all read
 * src/data/sections.mjs. So the thing that can drift is the set of keys, and this pins it.
 */
import { describe, expect, it } from "vitest";
import { SECTIONS, sectionsOn } from "./sections.mjs";
import { EXPLAINER_ENTRIES, EXPLAINER_ORDER, entryAnchor } from "./explainer-sections.mjs";
import { EXMP_BAND_CARDS, sectionPlanLabel } from "../charts/exmp-fixture.mjs";
import { BAND_CARDS } from "../charts/site-fixture.mjs";

const keys = SECTIONS.map((s) => s.key).sort();

describe("one section list across the homepage, page 1 and /pricing (ADR 0990)", () => {
  it("gives page 1 an entry for every section in the list, and for nothing else", () => {
    expect(Object.keys(EXPLAINER_ENTRIES).sort()).toEqual(keys);
    expect([...EXPLAINER_ORDER].sort()).toEqual(keys);
  });

  it("puts the Outlook first on page 1, then the band's own order", () => {
    const band = SECTIONS.map((s) => s.key).filter((k) => k !== "outlook");
    expect(EXPLAINER_ORDER).toEqual(["outlook", ...band]);
  });

  it("draws a card for every section on both pages, from the same renderer's vocabulary", () => {
    expect(Object.keys(BAND_CARDS).sort()).toEqual(keys);
    expect(Object.keys(EXMP_BAND_CARDS).sort()).toEqual(keys);
  });

  it("states the counts page 1's copy states: six on Free, ten on Core, thirteen on Premium", () => {
    // Page 1's rail: "Free includes six sections, Core ten and Premium all thirteen."
    expect([sectionsOn("free").length, sectionsOn("core").length, sectionsOn("premium").length]).toEqual([6, 10, 13]);
  });

  it("labels reach from the plan, matching the build reference's chips", () => {
    const expected = {
      outlook: "Every plan", fundamentals: "Every plan", earnings: "Core and Premium",
      "earnings-history": "Premium", insiders: "Premium", technicals: "Every plan",
      options: "Core and Premium", flow: "Premium", sector: "Every plan", peers: "Every plan",
      news: "Core and Premium", voices: "Core and Premium", macro: "Every plan",
    };
    for (const k of keys) expect.soft(sectionPlanLabel(k), k).toBe(expected[k]);
  });

  it("anchors each entry from its section's own name", () => {
    expect.soft(entryAnchor("Earnings & dividends")).toBe("s-earnings-and-dividends");
    expect.soft(entryAnchor("Peers & relative position")).toBe("s-peers-and-relative-position");
  });
});
