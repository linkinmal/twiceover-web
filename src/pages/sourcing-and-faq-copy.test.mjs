// #3649 (no "licensed" sourcing claims) and #3693 (the Outlook FAQ lines) on the held build, pinned
// against the page sources. Scenario-grain, facets soft-asserted together (conventions.md §Testing).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), "utf8");
const index = read("index.astro");
const explainer = read("how-our-analysis-works.astro");
const disclaimer = read("../content/disclaimer.txt");

describe("the public pages make no 'licensed' sourcing claim (#3649, ADR 0927)", () => {
  it("keeps the word out of the homepage, the explainer and the shared disclaimer", () => {
    expect.soft(index).not.toMatch(/licen[sc]ed/i);
    expect.soft(explainer).not.toMatch(/licen[sc]ed/i);
    expect.soft(disclaimer).not.toMatch(/licen[sc]ed/i);
    expect.soft(disclaimer).toContain("generated from third-party data");
  });

  it("states the sourcing lines Growth signed off", () => {
    expect.soft(index).toContain("Quotes, options and news data come from data vendors. Insider trades come from SEC filings, and short interest from FINRA. Nothing is scraped");
    expect.soft(explainer).toContain("We pull market data and public filings for the ticker.");
    expect.soft(explainer).toContain("comes from vendor data or public filings");
  });
});

describe("the Outlook FAQ lines (#3693)", () => {
  it("adds the history and sector sentence to the homepage's 'same Outlook' answer", () => {
    expect(index).toContain("Every plan's Outlook also sees how the stock has moved before, and how it moves with its sector and the market.");
  });

  it("puts 'Why can an analysis take a moment?' before the missing-data FAQ, with the time figure on this page only", () => {
    const q = explainer.indexOf("Why can an analysis take a moment?");
    expect.soft(q).toBeGreaterThan(-1);
    expect.soft(q).toBeLessThan(explainer.indexOf("What happens when data is missing?"));
    expect.soft(explainer).toContain("usually ready in under a minute");
    expect.soft(index).not.toContain("under a minute");
  });

  it("holds the cache sentence until the ADR 1044 cache is built and live (#4083; PM ship-order ruling on #3693)", () => {
    expect.soft(explainer).not.toMatch(/8-K/);
    expect.soft(explainer).not.toContain("kept for the rest of that trading day");
  });
});
