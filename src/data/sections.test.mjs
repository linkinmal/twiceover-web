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
import { SECTIONS, PLANS, sectionsOn, sectionCountLine } from "./sections.mjs";

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
