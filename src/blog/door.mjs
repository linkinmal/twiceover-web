/**
 * The ticker door's two fixed literals (ADR 1088 Decision 7; Security consult 1089 Q1): the same on every post, so
 * "a build-time literal, the same for every reader" is a checked property (ci/content-rules.mjs). `utm_campaign` is
 * the post's own slug. The values are placeholders for Analytics (#4235) to confirm; changing one is one edit here.
 */
export const DOOR_UTM = Object.freeze({ source: "blog", medium: "post" });
