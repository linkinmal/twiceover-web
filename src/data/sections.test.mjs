/**
 * The site's ONE list of analysis sections (stock-analyst-platform#3829; homepage build reference
 * `ai-team/design/assets/homepage-3818-v3-2026-09-23.html`, ADR 0991; plan placement ADR 0929 and its
 * Amendment 3, which struck Options structures to make thirteen).
 *
 * ADR 0990: "One section list. The analysis page's section names and plan placement must never
 * disagree with /pricing or the homepage band." Every surface that names a section or counts them
 * reads this module, so these tests pin the list itself; the pages' own tests assert that they read it.
 */
import { describe, expect, it } from "vitest";
import { SECTIONS, PLANS, sectionsOn, sectionCountLine, sectionGroups } from "./sections.mjs";

describe("the thirteen sections", () => {
  it("lists them in the band's order, each with its plan", () => {
    expect(SECTIONS.map((s) => [s.name, s.plan])).toEqual([
      ["Fundamentals", "free"],
      ["Earnings & dividends", "core"],
      ["Earnings history", "premium"],
      ["Insiders", "premium"],
      ["Technicals & levels", "free"],
      ["Options & short interest", "core"],
      ["Large options trades", "premium"],
      ["Sector regime", "free"],
      ["Peers & relative position", "free"],
      ["News & catalysts", "core"],
      ["Voices", "core"],
      ["Macro & regime", "free"],
      ["Outlook", "free"],
    ]);
  });

  it("never lists Options structures (ADR 0929 Amendment 3)", () => {
    expect(SECTIONS.map((s) => s.name.toLowerCase())).not.toContain("options structures");
  });

  it("gives every section a unique key, a tagline, and a short name for the synthesis chips", () => {
    expect.soft(new Set(SECTIONS.map((s) => s.key)).size).toBe(SECTIONS.length);
    for (const s of SECTIONS) {
      expect.soft(s.tagline, s.name).toMatch(/\.$/);
      expect.soft(s.short, s.name).toBeTruthy();
    }
    // The one chip that shortens: the synthesis block has twelve pills to fit.
    expect.soft(SECTIONS.find((s) => s.key === "peers").short).toBe("Peers");
  });

  it("carries Growth's five corrected captions", () => {
    // #3693 second pass (stock-analyst-platform commit 91727c5b), in both build references
    // (homepage-3818-v3-2026-09-23.html and pricing-page-c4-three-plans-2026-09-24.html).
    const tagline = (key) => SECTIONS.find((s) => s.key === key).tagline;
    expect.soft(tagline("technicals")).toBe("Moving averages, momentum, and the 52-week range.");
    expect.soft(tagline("sector")).toBe("The sector's own strength and valuation trend.");
    expect.soft(tagline("peers")).toBe("P/E and 3-month return against the stock's closest peers.");
    expect.soft(tagline("options")).toBe(
      "The options market's expected move and skew, and how heavily the stock is shorted.",
    );
    expect.soft(tagline("macro")).toBe("The backdrop: rates, risk appetite, volatility.");
  });
});

describe("plan placement", () => {
  it("counts 6 on Free, 10 on Core and all 13 on Premium — each plan includes the ones below it", () => {
    expect.soft(PLANS).toEqual(["free", "core", "premium"]);
    expect.soft(sectionsOn("free")).toHaveLength(6);
    expect.soft(sectionsOn("core")).toHaveLength(10);
    expect.soft(sectionsOn("premium")).toHaveLength(13);
    for (const s of sectionsOn("free")) expect.soft(sectionsOn("core")).toContain(s);
  });

  it("states the facts-strip line from those counts, never as typed numbers", () => {
    expect(sectionCountLine()).toBe("Sections in our analysis: 6 on Free, 10 on Core, all 13 on Premium.");
  });
});

describe("the /pricing table's groups (ADR 0912 Amendment 1 ruling 2)", () => {
  it("groups each section under the plan that adds it, Outlook leading the every-plan group", () => {
    // The table lists each section once, under the lowest plan that includes it; the build
    // reference puts the Outlook first because it is what the other sections feed.
    expect(sectionGroups().map((g) => [g.label, g.sections.map((s) => s.name)])).toEqual([
      ["On every plan", ["Outlook", "Fundamentals", "Technicals & levels", "Sector regime", "Peers & relative position", "Macro & regime"]],
      ["Added on Core", ["Earnings & dividends", "Options & short interest", "News & catalysts", "Voices"]],
      ["Added on Premium", ["Earnings history", "Insiders", "Large options trades"]],
    ]);
  });

  it("covers every section exactly once, so the table's totals are the plans' own counts", () => {
    const listed = sectionGroups().flatMap((g) => g.sections);
    expect.soft(listed).toHaveLength(SECTIONS.length);
    expect.soft(new Set(listed.map((s) => s.key)).size).toBe(SECTIONS.length);
    expect.soft(sectionGroups().map((g) => g.plan)).toEqual(PLANS);
  });
});
