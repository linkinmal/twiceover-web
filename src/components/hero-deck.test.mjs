/**
 * The hero deck's eight cards (stock-analyst-platform#4411; site-prelaunch.md v2.51 §2 "Hero deck").
 *
 * Source-level, like `hero-outlook.test.mjs`. The dot list (`CARDS`) and the `.dcard` children are two
 * hand-kept lists that nothing else ties together; `hero-deck.js` is count-agnostic, so a card added
 * to one and not the other would ship a dot that opens nothing (or a card no dot reaches).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const deck = read("src/components/HeroDeck.astro");
const unescape = (s) => s.replace(/&amp;/g, "&");

// The slides, in server-rendered order: literal slide divs plus the two components that emit their own.
const COMPONENT_LABELS = { PortfolioCard: "Your Portfolio", PositionCard: "Your position" };
function renderedSlides() {
  const body = deck.slice(deck.indexOf("<figure"));
  const found = [];
  const re = /<div role="group" aria-roledescription="slide" aria-label="([^"]+)"|<(PortfolioCard|PositionCard) variant="deck"/g;
  for (let m; (m = re.exec(body)); ) found.push(m[1] ? unescape(m[1]) : COMPONENT_LABELS[m[2]]);
  return found;
}
const dotNames = () => JSON.parse(deck.match(/const CARDS = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]"));

describe("the dots and the cards are one list", () => {
  it("has a dot for every card, in the same order, and eight of each", () => {
    const slides = renderedSlides();
    expect.soft(slides).toHaveLength(8);
    expect.soft(dotNames()).toEqual(slides);
    expect.soft(slides).toEqual([
      "Outlook", "Your Portfolio", "Your position", "Technicals & levels",
      "Options & short interest", "Earnings history", "Insiders", "Macro & regime",
    ]);
  });

  it("the component-backed slides still carry the labels this test assumes", () => {
    for (const [file, label] of [["PortfolioCard", "Your Portfolio"], ["PositionCard", "Your position"]]) {
      expect.soft(read(`src/components/${file}.astro`)).toContain(`"aria-label": "${label}"`);
    }
  });
});

describe("no plan or tier word in any card", () => {
  it("each note is `section · <data kind>`, and none names a plan", () => {
    const notes = [...deck.matchAll(/<span class="dcard__note">([^<]*)<\/span>/g)].map((m) => m[1]);
    expect.soft(notes).toEqual([
      "section · price data", "section · options data", "section · earnings data",
      "section · insider filings", "section · macro data",
    ]);
    // The deck's own source, and the notes the two components print.
    const sources = [deck, read("src/components/PortfolioCard.astro"), read("src/components/PositionCard.astro")];
    // "10b5-1 plan" is the insider-trading term (Insiders card), not a subscription plan.
    const ownWords = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/10b5-1 plan|sw--plan|underPlan/g, "");
    for (const src of sources) {
      expect.soft(ownWords(src)).not.toMatch(/every plan|\bCore\b|\bPremium\b|\bFree\b|\bplan\b(?! \()|\btier\b/i);
    }
  });
});

// #4415 closed 2026-10-19: the product's Macro board shows the VIX and the S&P 500 (#4432/#4438).
describe("card 8 draws the Macro board's tiles", () => {
  it("leads with the VIX and the S&P 500, then two small tiles that drop on a phone", () => {
    const macro = deck.slice(deck.indexOf('data-key="macro"'));
    expect.soft(macro).toContain('<MacroTile row="vix" width={177} phoneWidth={259} />');
    expect.soft(macro).toContain('<MacroTile row="sp500" width={177} phoneWidth={259} />');
    expect.soft(macro).toContain('<MacroTile row="treasury-10y" width={177} class="dk-only" />');
    expect.soft(macro).not.toContain("Economic calendar");
  });
});

describe("every fixture figure the deck reads exists", () => {
  // Astro prints `undefined` as nothing, so a misspelt or misplaced property builds green and drops
  // the figure from the card (Designer gate on #147: "sellers · buyer" lost its counts).
  it("resolves each FIXTURE.property in the template to a defined value", async () => {
    const fixture = await import("../charts/site-fixture.mjs");
    const body = deck.slice(deck.indexOf("---", 3));
    const refs = [...new Set([...body.matchAll(/\b([A-Z][A-Z_]+)\.([A-Za-z]+)\b/g)].map((m) => `${m[1]}.${m[2]}`))];
    expect.soft(refs.length).toBeGreaterThan(10);
    for (const ref of refs) {
      const [obj, prop] = ref.split(".");
      if (!(obj in fixture)) continue;
      expect.soft(fixture[obj][prop], ref).not.toBeUndefined();
    }
  });

  it("states the Insiders closing counts in words", () => {
    expect.soft(deck).toContain("{INSIDERS.sellers} sellers · {INSIDERS.buyers} buyer");
  });
});

describe("the v2.52 cards (stock-analyst-platform#4410, #4422)", () => {
  const band = read("src/components/OutlookBand.astro");

  it("the deck's Outlook is the deck drawing, and the synthesis Outlook keeps its row", () => {
    expect.soft(deck).toContain("<OutlookBand deck />");
    expect.soft(band).toContain("outlookDeckSvg()");
    expect.soft(band).toContain("proof__hzrow"); // still rendered for the page's other Outlook
    expect.soft(read("src/styles/site.css")).not.toContain(".dcard--outlook .proof__hzrow");
  });

  it("Insiders states each seller's title, amount and share", () => {
    expect.soft(deck).toContain("INSIDER_ROWS.map");
    expect.soft(deck).toContain('class="dk-only"><span>Latest trade</span>');
  });

  it("ships no review-only .v5 class in the stylesheet", () => {
    expect.soft(read("src/styles/site.css")).not.toMatch(/\.v5\.dcard/);
  });
});
