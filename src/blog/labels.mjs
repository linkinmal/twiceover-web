/**
 * labels — the words a reader sees for the closed vocabularies (vocabulary.mjs). Subject names are
 * Growth's, from `ai-team/growth/blog-site-copy.md` section 5 (the earlier working names are the internal map in
 * `blog-subjects.md`); the lens names are the kit's pills. Build names are internal: no page prints them.
 */
import { BUILDS, LENSES, TOPICS } from "./vocabulary.mjs";

export const TOPIC_LABELS = Object.freeze({
  "option-math": "How options are priced",
  "expiration-assignment": "Option expiration and assignment",
  "earnings": "Earnings",
  "company-events": "Mergers, acquisitions and spin-offs",
  "reading-the-document": "Reading SEC filings",
  "market-plumbing": "How markets work",
  "macro-fed": "The economy and the Fed",
  "policy-geopolitics": "Politics, policy and geopolitics",
  "other-markets": "Other markets that move stocks",
  "sectors-industry": "Sectors and industry data",
  "risk-sizing-behaviour": "Risk and position sizing",
  "levels-patterns": "Chart patterns, tested",
  "positioning-flow": "Who owns what",
  "number-in-the-headline": "Market stats, fact-checked",
  "how-to-read": "Reading charts and indicators",
});

/** One line under a topic page's heading; it is also its meta description. Growth's, `ai-team/growth/blog-site-copy.md` section 5. */
export const TOPIC_DESCRIPTIONS = Object.freeze({
  "option-math": 'Why a call option can lose money when the stock rises. One cause is a fall in implied volatility, which traders call IV crush.',
  "expiration-assignment": "What happens to an option on its last day. Assignment is when the option's seller has to deliver on the contract.",
  "earnings": "How big a move the options market expected before a company's earnings report, and what the stock did after.",
  "company-events": 'Mergers, tender offers and spin-offs, and what the stock prices say about them.',
  "reading-the-document": 'How to read an 8-K, a 10-K and a merger agreement, the documents companies file with the SEC.',
  "market-plumbing": 'How a trade settles, how short selling works, and what happens when an index changes its members.',
  "macro-fed": 'Fed meetings, inflation reports and rate forecasts, with what the market expected and how prices moved after.',
  "policy-geopolitics": 'Tariffs, wars and speeches, and what they did to company earnings and stock prices.',
  "other-markets": 'Oil, gold, bonds, the dollar and bitcoin, and how each one moves stocks.',
  "sectors-industry": 'Weekly oil inventories, bank results and the chip cycle. The industry numbers behind a move in one sector.',
  "risk-sizing-behaviour": 'Position sizing is how much of an account goes into one trade. The math, the studies and how traders behave.',
  "levels-patterns": 'Support and resistance, gap fills and round numbers, checked against price history.',
  "positioning-flow": "Short interest, big funds' quarterly holdings (the 13F) and options flow. Who holds a stock and who is betting against it.",
  "number-in-the-headline": 'Market statistics from the news, recomputed from the original data.',
  "how-to-read": 'How to read a payoff diagram, the VIX and other charts traders use.',
});

/** The line under the index nameplate, and its blurb for page 2 on and the feed (`blog-site-copy.md` section 3). */
export const INDEX_BLURB = "What moved in the markets, why it moved, and the math under it.";
export const INDEX_DESCRIPTION = `${INDEX_BLURB} Some posts are games and tools you can try.`;

export const LENS_LABELS = Object.freeze({ concept: "Concept", actuality: "Actuality", history: "History" });

export const BUILD_LABELS = Object.freeze({
  playable: "Playable",
  "chart-led": "Chart-led",
  "picture-led": "Picture-led",
  "text-led": "Text-led",
});

/** Every closed value has a label and no label is for a value that does not exist. */
export function labelGaps() {
  const out = [];
  for (const [vocab, labels, name] of [[TOPICS, TOPIC_LABELS, "topic"], [TOPICS, TOPIC_DESCRIPTIONS, "topic description"], [LENSES, LENS_LABELS, "lens"], [BUILDS, BUILD_LABELS, "build"]]) {
    for (const v of vocab) if (!(v in labels)) out.push(`${name} "${v}" has no label`);
    for (const k of Object.keys(labels)) if (!vocab.includes(k)) out.push(`${name} label "${k}" is not a value`);
  }
  return out;
}
