/**
 * Position size and risk of ruin (a tool): its entry file (ADR 1127 Decision 2), read by the loader in src/blog/playables.mjs. The folder's name is the slug and the loader checks they
 * agree; the address (/blog/tools/<slug>) and the bundle (/js/blog-<slug>.js) follow from the slug and the kind.
 * `updatedAt` moves only on a real change to the page's content (the post rule, applied here by hand). `art` is the
 * hub's picture cell: a static string, no script and no data from a reader or a post.
 */
export default {
  slug: "position-size-and-risk-of-ruin",
  kind: "tool",
  title: "Position size and risk of ruin",
  label: "Position size and risk of ruin",
  deck: "The same edge can grow an account or halve it. What decides it is how much of the account each trade risks. Set the odds, slide the size, and see how 100 trades end.",
  description: "A tool: type a win chance and a payoff, slide the share of the account risked on each trade, and see how many 100-trade runs end ahead and how many fall to half the start.",
  look: "newsprint",
  topic: "risk-sizing-behaviour",
  updatedAt: "2026-10-30T10:00:00-04:00",
  art:
    '<svg class="pa" viewBox="0 0 200 100" role="img" aria-label="Paired bars, one row per size">' +
    '<rect x="0" y="8" width="170" height="16" fill="#14684B"/><rect x="0" y="34" width="130" height="16" fill="#14684B"/>' +
    '<rect x="130" y="34" width="50" height="16" fill="#A33028"/><rect x="0" y="60" width="60" height="16" fill="#14684B"/>' +
    '<rect x="60" y="60" width="130" height="16" fill="#A33028"/></svg>',
};
