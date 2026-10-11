/**
 * labels — the words a reader sees for the closed vocabularies (vocabulary.mjs). Subject names are
 * Growth's, from `ai-team/growth/blog-subjects.md` section 3; lens and build names are the kit's pills.
 * Filter-page headings and one-line descriptions are placeholders in the kit and Growth's to set, so the
 * description here says only what the page is.
 */
import { BUILDS, LENSES, TOPICS } from "./vocabulary.mjs";

export const TOPIC_LABELS = Object.freeze({
  "option-math": "Option math that surprises",
  "expiration-assignment": "Expiration and assignment",
  earnings: "Earnings",
  "company-events": "Company events",
  "reading-the-document": "Reading the document",
  "market-plumbing": "Market plumbing",
  "macro-fed": "Macro and the Fed",
  "policy-geopolitics": "Politics, policy and geopolitics",
  "other-markets": "Other markets that move stocks",
  "sectors-industry": "Sectors and industry data",
  "risk-sizing-behaviour": "Risk, sizing and trader behaviour",
  "levels-patterns": "Levels and patterns, tested",
  "positioning-flow": "Positioning and flow",
  "number-in-the-headline": "The number in the headline",
  "how-to-read": "How to read a…",
});

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
  for (const [vocab, labels, name] of [[TOPICS, TOPIC_LABELS, "topic"], [LENSES, LENS_LABELS, "lens"], [BUILDS, BUILD_LABELS, "build"]]) {
    for (const v of vocab) if (!(v in labels)) out.push(`${name} "${v}" has no label`);
    for (const k of Object.keys(labels)) if (!vocab.includes(k)) out.push(`${name} label "${k}" is not a value`);
  }
  return out;
}
