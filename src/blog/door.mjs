/**
 * The ticker door's two fixed literals (ADR 1088 Decision 7; Security consult 1089 Q1): the same on every post, so
 * "a build-time literal, the same for every reader" is a checked property (ci/content-rules.mjs). `utm_campaign` is
 * the post's own slug. The values are placeholders for Analytics (#4235) to confirm; changing one is one edit here.
 */
export const DOOR_UTM = Object.freeze({ source: "blog", medium: "post" });

/**
 * The top bar's "Analyze a stock" link goes to the same `/go/try` as the post's door form, with all three UTM keys and
 * no ticker (`ci/content-rules.mjs` allows a `/go/try` link only with zero keys or exactly these three). The bar sits in
 * the shared layout, so it has no slug: `utm_medium` says it is the bar and `utm_campaign` is one literal for every page.
 */
export const BAR_UTM = Object.freeze({ source: "blog", medium: "bar", campaign: "top-bar" });
export const BAR_DOOR_HREF = `/go/try?utm_source=${BAR_UTM.source}&utm_medium=${BAR_UTM.medium}&utm_campaign=${BAR_UTM.campaign}`;
