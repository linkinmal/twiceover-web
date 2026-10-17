/**
 * The 60% coin (a game): its entry file (ADR 1127 Decision 2), read by the loader in src/blog/playables.mjs. The folder's name is the slug and the loader checks they
 * agree; the address (/blog/play/<slug>) and the bundle (/js/blog-<slug>.js) follow from the slug and the kind.
 * `updatedAt` moves only on a real change to the page's content (the post rule, applied here by hand). `art` is the
 * hub's picture cell: a static string, no script and no data from a reader or a post.
 */
export default {
  slug: "coin",
  kind: "game",
  title: "The 60% coin",
  label: "The 60% coin",
  deck: "A coin lands heads 60% of the time. You start with $25 in play money and bet on heads every flip. You pick only how much to bet.",
  description: "A game: a coin that lands heads 60% of the time, $25 in play money to start, and one choice, how much to bet on each flip.",
  look: "neon",
  topic: "risk-sizing-behaviour",
  updatedAt: "2026-10-11T09:00:00-04:00",
  art:
    '<svg class="pa" viewBox="0 0 200 100" preserveAspectRatio="none" role="img" aria-label="Bars, one per bet size">' +
    '<rect x="8" y="58" width="26" height="42" fill="#4DB5FF"/><rect x="47" y="30" width="26" height="70" fill="#4DB5FF"/>' +
    '<rect x="86" y="8" width="26" height="92" fill="#FF3FD2"/><rect x="125" y="44" width="26" height="56" fill="#4DB5FF"/>' +
    '<rect x="164" y="82" width="26" height="18" fill="#4DB5FF"/></svg>',
};
