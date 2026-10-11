/**
 * The blog's standing pages: games and tools (blog-handoff.md section 1 and 5; ADR 1090 Decision 8). A playable
 * is code, not a post: no front matter, no punchline headline, no date of its own beyond "Updated". It wears a
 * theme like a post. The registry is the one place a page's address, title, theme and update time are written;
 * the routes, the bar link, the sitemap and the "More to play" strip all read it.
 *
 * `updatedAt` moves only on a real change to the page's content (the post rule, applied here by hand).
 */
export const PLAYABLES = Object.freeze([
  {
    slug: "coin",
    kind: "game",
    path: "/blog/play/coin",
    title: "The 60% coin",
    label: "The 60% coin",
    deck: "A coin lands heads 60% of the time. You start with $25 and bet on heads every flip. The odds are on your side. The only choice is how much to bet.",
    description: "A game: a coin that lands heads 60% of the time, $25 to start, and one choice, how much to bet on each flip.",
    look: "neon",
    topic: "risk-sizing-behaviour",
    updatedAt: "2026-10-11T09:00:00-04:00",
  },
  {
    slug: "overnight-call",
    kind: "tool",
    path: "/blog/tools/overnight-call",
    title: "The overnight call calculator",
    label: "The overnight call calculator",
    deck: "You hold a call overnight. The stock moves and implied volatility changes. See what the call is worth the next morning and where the change came from.",
    description: "A tool: set the stock move, the volatility and the days that pass, and see what a call is worth the next morning and where the change came from.",
    look: "exhibit",
    topic: "option-math",
    updatedAt: "2026-10-11T09:00:00-04:00",
  },
]);

export const playablePath = (p) => p.path;

/** The first playable, where the bar's "Playable" link goes. */
export const FIRST_PLAYABLE = PLAYABLES[0];

/** The other playables, for the "More to play" strip. */
export const otherPlayables = (slug) => PLAYABLES.filter((p) => p.slug !== slug);
