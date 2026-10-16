/**
 * The overnight call calculator (a tool): its entry file (ADR 1127 Decision 2), read by the loader in src/blog/playables.mjs. The folder's name is the slug and the loader checks they
 * agree; the address (/blog/tools/<slug>) and the bundle (/js/blog-<slug>.js) follow from the slug and the kind.
 * `updatedAt` moves only on a real change to the page's content (the post rule, applied here by hand). `art` is the
 * hub's picture cell: a static string, no script and no data from a reader or a post.
 */
export default {
  slug: "overnight-call",
  kind: "tool",
  title: "The overnight call calculator",
  label: "The overnight call calculator",
  deck: "You hold a call overnight. The stock moves and implied volatility changes. See what the call is worth the next morning and where the change came from.",
  description: "A tool: set the stock move, the volatility and the days that pass, and see what a call is worth the next morning and where the change came from.",
  look: "exhibit",
  topic: "option-math",
  updatedAt: "2026-10-11T09:00:00-04:00",
  art:
    '<svg class="pa" viewBox="0 0 200 100" preserveAspectRatio="none" role="img" aria-label="A grid of cases, some shaded">' +
    '<g fill="#CFCFC9"><rect x="0" y="0" width="36" height="22"/><rect x="41" y="0" width="36" height="22"/><rect x="0" y="26" width="36" height="22"/>' +
    '<rect x="164" y="78" width="36" height="22"/><rect x="123" y="78" width="36" height="22"/><rect x="164" y="52" width="36" height="22"/></g>' +
    '<g fill="#1F3BFF"><rect x="82" y="0" width="36" height="22" opacity=".35"/><rect x="123" y="0" width="36" height="22" opacity=".7"/>' +
    '<rect x="164" y="0" width="36" height="22"/><rect x="41" y="26" width="36" height="22" opacity=".2"/><rect x="82" y="26" width="36" height="22" opacity=".45"/>' +
    '<rect x="123" y="26" width="36" height="22" opacity=".7"/><rect x="164" y="26" width="36" height="22" opacity=".85"/>' +
    '<rect x="0" y="52" width="36" height="22" opacity=".12"/><rect x="41" y="52" width="36" height="22" opacity=".2"/>' +
    '<rect x="82" y="52" width="36" height="22" opacity=".35"/><rect x="123" y="52" width="36" height="22" opacity=".5"/>' +
    '<rect x="0" y="78" width="36" height="22" opacity=".08"/><rect x="41" y="78" width="36" height="22" opacity=".12"/>' +
    '<rect x="82" y="78" width="36" height="22" opacity=".2"/></g></svg>',
};
