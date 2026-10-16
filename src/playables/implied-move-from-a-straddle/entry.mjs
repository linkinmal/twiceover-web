/**
 * Implied move from a straddle (a tool): the registry entry (ADR 1127 Decision 2). The folder's name is the slug and the loader checks they
 * agree; the address (/blog/tools/<slug>) and the bundle (/js/blog-<slug>.js) follow from the slug and the kind.
 * `updatedAt` moves only on a real change to the page's content (the post rule, applied here by hand). `art` is the
 * hub's picture cell: a static string, no script and no data from a reader or a post.
 */
export default {
  slug: "implied-move-from-a-straddle",
  kind: "tool",
  title: "Implied move from a straddle",
  label: "Implied move from a straddle",
  deck: "A straddle's price tells you how big a move the options market is pricing. Type the two numbers and see the range.",
  description: "A tool: drag the stock price on a straddle's last day, or type your own stock price and straddle price, and see the implied move, the two breakevens and the profit or loss.",
  look: "risograph",
  topic: "earnings",
  updatedAt: "2026-10-12T12:00:00-04:00",
  art:
    '<svg class="pa" viewBox="0 0 200 100" role="img" aria-label="A V-shaped payoff line inside a shaded band">' +
    '<rect x="48" y="0" width="104" height="100" fill="#FFB511" opacity=".45"/>' +
    '<line x1="0" y1="50" x2="200" y2="50" stroke="#1A1814" stroke-width="1" stroke-dasharray="3 4"/>' +
    '<polyline points="0,8 100,92 200,8" fill="none" stroke="#0078BF" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
};
