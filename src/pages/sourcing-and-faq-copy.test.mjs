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

// #3829 / #3693: the 10-03 explainer strings (Growth deb4fe2a, as the 10-05 re-pass left them in
// `site-copy-explainer-pages.md`; PM ruling 2026-10-06 that they ride this PR). ADR 1036 Amendment 1:
// one model reaches the call, a second writes the notes; the page may name the split, the product may not.
describe("'How the Outlook is made' describes one reasoner and one writer (ADR 1036 A1, 1037, 1047)", () => {
  it("says it in the intro, steps 2 to 5 and the record row", () => {
    expect.soft(explainer).toContain("Two separate AI models make it: one thinks through the sections and reaches a call for each horizon, and the other writes the notes.");
    expect.soft(explainer).toContain("On every plan it also sees how the stock has actually moved over each horizon across the past five years.");
    expect.soft(explainer).toContain("One AI model thinks it through and reaches a call for each horizon.");
    expect.soft(explainer).toContain("A second, separate AI model writes each note.");
    expect.soft(explainer).toContain("It works from the first model's call and cannot change a price. The note gives the reason the Outlook states for that price");
    expect.soft(explainer).toContain("and the Outlook's note for that horizon is one click away, as on any other.");
    expect.soft(explainer).toContain("for each of the Outlook's two steps, the version of the model and of the instructions used");
    expect.soft(explainer).toContain("for each of the two steps, the model version and the instructions version");
  });

  it("no longer says one pass projects the price, or that the note names the main driver", () => {
    expect.soft(explainer).not.toContain("It projects one price for each horizon");
    expect.soft(explainer).not.toContain("names the main thing driving it");
    expect.soft(explainer).not.toContain("the version of the model and instructions that produced it");
  });

  it("names no model and counts no reads", () => {
    expect.soft(explainer).not.toMatch(/opus|sonnet|claude|committee|several (AI )?reads/i);
  });
});

describe("the explainer's News entry says what the headline filter does, without naming newsrooms (ADR 1045)", () => {
  it("carries the filter sentences and names no outlet", async () => {
    const { EXPLAINER_ENTRIES } = await import("../data/explainer-sections.mjs");
    const shows = EXPLAINER_ENTRIES.news.shows;
    expect.soft(shows).toContain("Headlines come from major financial newsrooms and are kept only when they name the company. Commentary is dropped.");
    expect.soft(shows).not.toMatch(/yahoo|cnbc|benzinga/i);
  });
});

describe("the homepage's meta description and the no-positions rule (#3842, ADR 0959 Decisions 4-5)", () => {
  it("uses Growth's meta description", () => {
    expect(index).toContain('description="See your positions against your own rules, read-only from your broker. Run an analysis on any US-listed ticker, no account needed. Depth, never a verdict."');
  });

  it("has no sentence saying the analysis runs on, or is built from, the positions you hold", () => {
    expect.soft(index).not.toMatch(/runs? on (the )?positions/i);
    expect.soft(index).not.toMatch(/(read|analysis|outlook)[^.]{0,40}(of|on|from) (the )?positions you (actually )?hold/i);
  });
});
