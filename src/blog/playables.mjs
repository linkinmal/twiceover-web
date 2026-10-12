/**
 * The blog's standing pages: games and tools (blog-handoff.md section 1 and 5; ADR 1090 Decision 8). A playable
 * is code, not a post: no front matter, no punchline headline, no date of its own beyond "Updated". It wears a
 * theme like a post. The registry is the one place a page's address, title, theme and update time are written;
 * the routes, the bar link, the sitemap and the "More to play" strip all read it.
 *
 * `script` names the block script built from src/blog-tools/client/<script>.mjs to /js/blog-<script>.js, the one
 * file the page loads (BLOG_SCRIPTS in ci/content-rules.mjs lists it).
 *
 * `updatedAt` moves only on a real change to the page's content (the post rule, applied here by hand).
 */
export const PLAYABLES = Object.freeze([
  {
    slug: "guess-the-gap",
    script: "guess",
    kind: "game",
    path: "/blog/play/guess-the-gap",
    title: "Guess the gap",
    label: "Guess the gap",
    deck: "A company reports earnings. You see the move options had priced. Guess how far the stock moved the next day.",
    description: "A game: five company earnings reports, the move options had priced for each, and one guess, how far the stock moved the next day.",
    look: "ticket",
    topic: "earnings",
    updatedAt: "2026-10-12T12:00:00-04:00",
  },
  {
    slug: "implied-move-from-a-straddle",
    script: "straddle",
    kind: "tool",
    path: "/blog/tools/implied-move-from-a-straddle",
    title: "Implied move from a straddle",
    label: "Implied move from a straddle",
    deck: "A straddle's price tells you how big a move the options market is pricing. Type the two numbers and see the range.",
    description: "A tool: drag the stock price on a straddle's last day, or type your own stock price and straddle price, and see the implied move, the two breakevens and the profit or loss.",
    look: "risograph",
    topic: "earnings",
    updatedAt: "2026-10-12T12:00:00-04:00",
  },
  {
    slug: "coin",
    script: "coin",
    kind: "game",
    path: "/blog/play/coin",
    title: "The 60% coin",
    label: "The 60% coin",
    deck: "A coin lands heads 60% of the time. You start with $25 in play money and bet on heads every flip. You pick only how much to bet.",
    description: "A game: a coin that lands heads 60% of the time, $25 in play money to start, and one choice, how much to bet on each flip.",
    look: "neon",
    topic: "risk-sizing-behaviour",
    updatedAt: "2026-10-11T09:00:00-04:00",
  },
  {
    slug: "overnight-call",
    script: "call",
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
  {
    slug: "option-payoff-calculator",
    script: "payoff",
    kind: "tool",
    path: "/blog/tools/option-payoff-calculator",
    title: "The option payoff calculator",
    label: "The option payoff calculator",
    deck: "Pick an option structure. See what it is worth on its last day at every stock price, and where it breaks even. Then change its strikes and premiums.",
    description: "A tool: pick one of six option structures, type its strikes and premiums, and see its profit or loss on the last day at every stock price.",
    look: "blueprint",
    topic: "option-math",
    updatedAt: "2026-10-11T09:00:00-04:00",
  },
]);

export const playablePath = (p) => p.path;

/** The games-and-tools hub (blog-handoff.md section 5.4): where the bar's "Games and tools" link and each strip's last cell go. */
export const HUB_PATH = "/blog/play";

/** The other playables, for the "More to play" strip: two, then the strip's own last cell opens the hub. */
export const otherPlayables = (slug) => PLAYABLES.filter((p) => p.slug !== slug).slice(0, 2);

/** Every playable, newest update first; the registry's order breaks a tie (the sort is stable). */
export const playablesNewestFirst = () => [...PLAYABLES].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
