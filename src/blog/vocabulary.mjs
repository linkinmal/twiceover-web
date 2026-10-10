/**
 * The blog's closed vocabularies (ADR 1090 Decision 11: `topic` is a closed enum, so a post cannot
 * invent an address-shaping value). Values are Growth's, from `ai-team/growth/blog-subjects.md` §2–3
 * (v0.3 draft) and the design kit's build filters; adding one is a reviewed code change, by design.
 * Area 16, "Taxes and account rules", is parked in that doc and is left out until it is not.
 */

/** The subject areas, one slug each, in the subject map's order. */
export const TOPICS = Object.freeze([
  "option-math",
  "expiration-assignment",
  "earnings",
  "company-events",
  "reading-the-document",
  "market-plumbing",
  "macro-fed",
  "policy-geopolitics",
  "other-markets",
  "sectors-industry",
  "risk-sizing-behaviour",
  "levels-patterns",
  "positioning-flow",
  "number-in-the-headline",
  "how-to-read",
]);

/** The three lenses a post is written through. */
export const LENSES = Object.freeze(["concept", "actuality", "history"]);

/** How a post is built: the design's four shapes. */
export const BUILDS = Object.freeze(["playable", "chart-led", "picture-led", "text-led"]);
