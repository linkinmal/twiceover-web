/**
 * Guess the gap (a game): its entry file (ADR 1127 Decision 2), read by the loader in src/blog/playables.mjs. The folder's name is the slug and the loader checks they
 * agree; the address (/blog/play/<slug>) and the bundle (/js/blog-<slug>.js) follow from the slug and the kind.
 * `updatedAt` moves only on a real change to the page's content (the post rule, applied here by hand). `art` is the
 * hub's picture cell: a static string, no script and no data from a reader or a post.
 */
export default {
  slug: "guess-the-gap",
  kind: "game",
  title: "Guess the gap",
  label: "Guess the gap",
  deck: "A company reports earnings. You see the move options had priced. Guess how far the stock moved the next day.",
  description: "A game: five company earnings reports, the move options had priced for each, and one guess, how far the stock moved the next day.",
  look: "ticket",
  topic: "earnings",
  updatedAt: "2026-10-12T12:00:00-04:00",
  art:
    '<svg class="pa" viewBox="0 0 200 100" role="img" aria-label="A scale with a shaded priced band and a marker beyond it">' +
    '<line x1="8" y1="50" x2="192" y2="50" stroke="#17131F" stroke-width="2"/>' +
    '<rect x="8" y="36" width="52" height="28" fill="#4B1FD1" opacity=".3"/><line x1="60" y1="36" x2="60" y2="64" stroke="#4B1FD1" stroke-width="2" stroke-dasharray="4 3"/>' +
    '<rect x="128" y="22" width="4" height="56" fill="#17131F"/></svg>',
};
