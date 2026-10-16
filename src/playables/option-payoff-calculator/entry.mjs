/**
 * The option payoff calculator (a tool): the registry entry (ADR 1127 Decision 2). The folder's name is the slug and the loader checks they
 * agree; the address (/blog/tools/<slug>) and the bundle (/js/blog-<slug>.js) follow from the slug and the kind.
 * `updatedAt` moves only on a real change to the page's content (the post rule, applied here by hand). `art` is the
 * hub's picture cell: a static string, no script and no data from a reader or a post.
 */
export default {
  slug: "option-payoff-calculator",
  kind: "tool",
  title: "The option payoff calculator",
  label: "The option payoff calculator",
  deck: "Pick an option structure. See what it is worth on its last day at every stock price, and where it breaks even. Then change its strikes and premiums.",
  description: "A tool: pick one of six option structures, type its strikes and premiums, and see its profit or loss on the last day at every stock price.",
  look: "blueprint",
  topic: "option-math",
  updatedAt: "2026-10-11T09:00:00-04:00",
  art:
    '<svg class="pa" viewBox="0 0 200 100" role="img" aria-label="A payoff line: flat, then rising">' +
    '<line x1="0" y1="60" x2="200" y2="60" stroke="#7FA3D1" stroke-width="1" stroke-dasharray="3 4"/>' +
    '<polyline points="0,82 104,82 196,10" fill="none" stroke="#FFB347" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="132" cy="60" r="5" fill="#0F3563" stroke="#F4F7FB" stroke-width="2"/></svg>',
};
