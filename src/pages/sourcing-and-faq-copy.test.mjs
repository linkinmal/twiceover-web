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
    expect.soft(index).toContain("Quotes, options and news data come from data vendors. Insider trades come from SEC filings, and short interest from FINRA. Every figure names its source and the time it was fetched.");
    expect.soft(explainer).toContain("We pull market data and public filings for the stock.");
    expect.soft(explainer).toContain("comes from vendor data or public filings");
  });
});

describe("the Outlook FAQ lines (#3693)", () => {
  it("adds the history and sector sentence to the homepage's 'same Outlook' answer", () => {
    expect(index).toContain("Every plan's Outlook also sees how the stock has moved before, and how it moves with its sector and the market.");
  });

  // Founder 2026-10-24 (#4498, Growth brief standing ruling item 2): no volunteered limitation on a marketing page.
  it("asks no question nobody asked: no wait or missing-data FAQ, and no time figure", () => {
    expect.soft(explainer).not.toContain("Why can an analysis take a moment?");
    expect.soft(explainer).not.toContain("What happens when data is missing?");
    expect.soft(index).not.toContain("What if some of the data isn't available?");
    expect.soft(explainer).not.toContain("under a minute");
    expect.soft(index).not.toContain("under a minute");
  });

  it("holds the cache sentence until the ADR 1044 cache is built and live (#4083; PM ship-order ruling on #3693)", () => {
    expect.soft(explainer).not.toMatch(/8-K/);
    expect.soft(explainer).not.toContain("kept for the rest of that trading day");
  });
});

// #3829 / #3693: the 10-03 explainer strings (Growth deb4fe2a, as the 10-05 re-pass left them in
// `site-copy-explainer-pages.md`; PM ruling 2026-10-06 that they ride this PR). ADR 1036 Amendment 1:
// ADR 1131 Amendment 2 (stock-analyst-platform#4380): the writer retired; the page says what the AI does, never how it is built (PM ruling 2026-10-17); the AI reaches the call.
// The falsifier step left the page on 2026-10-24 (#4498).
describe("'How the Outlook is made' names the AI, not the build (ADR 1131 Amendment 2), and sells instead of disclaiming (#4498)", () => {
  it("says it in the intro and steps 2 and 3, with no falsifier, stale-horizon or record copy", () => {
    expect.soft(explainer).toContain("It works through the sections and reaches a call for each horizon.");
    expect.soft(explainer).toContain("On every plan it also sees how the stock has actually moved over each horizon across the past five years.");
    expect.soft(explainer).toContain("Our AI thinks it through and reaches a call for each horizon.");
    for (const page of [explainer, index]) {
      for (const gone of ["what would break", "break the call", "shows no price", "Labelled as ours", "The same analysis for everyone", "What TwiceOver is"]) {
        expect.soft(page, gone).not.toContain(gone);
      }
    }
    expect.soft(explainer).not.toContain("writes the notes");
    // PM ruling 2026-10-17 (#4380): no model count, no pipeline words, no "prove", no figure-check claim.
    for (const page of [explainer, index]) {
      for (const banned of ["AI model", "same model", "model's own", "instructions", "prove", "checked against our data"]) {
        expect.soft(page, banned).not.toContain(banned);
      }
    }
    expect.soft(explainer).not.toContain("two steps");
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

describe("the explainer's News entry sells what it shows and names no newsroom (ADR 1045; #4498)", () => {
  it("names the newsrooms' kind, not an outlet, and carries no window or cap mechanics", async () => {
    const { EXPLAINER_ENTRIES } = await import("../data/explainer-sections.mjs");
    const shows = EXPLAINER_ENTRIES.news.shows;
    expect.soft(shows).toContain("Recent SEC filings and the material news from major financial newsrooms");
    expect.soft(shows).not.toMatch(/yahoo|cnbc|benzinga/i);
    expect.soft(shows).not.toContain("from the last 30 days");
    expect.soft(shows).not.toContain("up to three");
  });
});

describe("the Outlook's marker reads 'points to' wherever the explainer draws the card (consult 1148, ADR 0231 Amendment 9, #4499)", () => {
  it("says it on the three horizon cards, and nowhere says 'lands at'", () => {
    const card = read("../components/ExplainerOutlook.astro");
    expect.soft(card).toContain("Our projection points to <b>{usd(h.price)}</b>");
    expect.soft(explainer).not.toContain("lands at");
    expect.soft(card).not.toContain("lands at");
  });
});

describe("the homepage's meta description and the no-positions rule (#3842, ADR 0959 Decisions 4-5)", () => {
  it("uses Growth's meta title and description (#4506)", () => {
    expect.soft(index).toContain('title="TwiceOver: stock and options analysis and your portfolio"');
    expect.soft(index).toContain('description="Analyze any stock down to a projected price for each horizon, no account needed. Connect your broker to check your positions against your own rules."');
  });

  it("has no sentence saying the analysis runs on, or is built from, the positions you hold", () => {
    expect.soft(index).not.toMatch(/runs? on (the )?positions/i);
    expect.soft(index).not.toMatch(/(read|analysis|outlook)[^.]{0,40}(of|on|from) (the )?positions you (actually )?hold/i);
  });
});
