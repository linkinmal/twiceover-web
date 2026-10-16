/**
 * The blog's standing pages: games and tools (blog-handoff.md section 1 and 5; ADR 1090 Decision 8, as amended by
 * ADR 1127 Decision 2). A playable is code, not a post: no front matter, no punchline headline, no date of its own
 * beyond "Updated". It wears a theme like a post. A playable is a directory, src/playables/<slug>/, and this loader
 * is the only place that knows the layout: `entry.mjs` is its address, title, theme and update time, `page.astro` its
 * body and `client.mjs` its one block script. The routes, the bar link, the sitemap and the "More to play" strip read
 * what comes out of here and never name a page.
 *
 * The block script is built from `client.mjs` to /js/blog-<slug>.js, the one file the page loads (BLOG_SCRIPTS in
 * ci/content-rules.mjs is derived from the same directories).
 *
 * Every importer runs under Vite (Astro, Vitest), never plain Node: `import.meta.glob` is Vite's.
 */
const entries = import.meta.glob("/src/playables/*/entry.mjs", { eager: true, import: "default" });
const bodies = import.meta.glob("/src/playables/*/page.astro");

// The hub's pinned order among pages updated at the same moment is the order the first five were written (the hub
// test pins it, blog-handoff.md section 5.4). A page not named here follows them, by slug, so a new folder needs no
// edit here; retire the list when that order is ruled on data.
const WRITTEN_FIRST = ["guess-the-gap", "implied-move-from-a-straddle", "coin", "overnight-call", "option-payoff-calculator"];
const written = (slug) => (WRITTEN_FIRST.includes(slug) ? WRITTEN_FIRST.indexOf(slug) : Infinity);
/** The order of PLAYABLES: the five written first in their order, then any other by slug. */
export const orderPlayables = (list) => [...list].sort((a, b) => (written(a.slug) === written(b.slug) ? compare(a.slug, b.slug) : written(a.slug) < written(b.slug) ? -1 : 1));
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const SECTION = { game: "play", tool: "tools" };

/** One entry, checked against the folder it was found in; `pageKeys` are the page.astro paths that exist. */
export function loadPlayable(file, entry, pageKeys) {
  const dir = file.split("/").at(-2);
  if (entry.slug !== dir) throw new Error(`${file}: slug "${entry.slug}" must equal its directory name "${dir}"`);
  if (!Object.hasOwn(SECTION, entry.kind)) throw new Error(`${file}: kind "${entry.kind}" must be "game" or "tool"`);
  if (!pageKeys.includes(`/src/playables/${dir}/page.astro`)) throw new Error(`${file}: src/playables/${dir}/page.astro is missing`);
  return Object.freeze({ ...entry, path: `/blog/${SECTION[entry.kind]}/${entry.slug}` });
}

export const PLAYABLES = Object.freeze(orderPlayables(Object.entries(entries).map(([file, entry]) => loadPlayable(file, entry, Object.keys(bodies)))));

/** A playable's page body (its page.astro component), loaded when a route renders it. */
export const pageOf = async (slug) => (await bodies[`/src/playables/${slug}/page.astro`]()).default;

export const playablePath = (p) => p.path;

/** The games-and-tools hub (blog-handoff.md section 5.4): where the bar's "Games and tools" link and each strip's last cell go. */
export const HUB_PATH = "/blog/play";

/**
 * The "More to play" strip (Designer, consult 1125 ask 5): the strip is the next thing to play, so a page on the
 * same topic comes first, then the newest update, then the slug. Two, then the strip's own last cell opens the hub.
 */
export const moreToPlay = (playables, slug) => {
  const topic = playables.find((p) => p.slug === slug)?.topic;
  const rank = (p) => (p.topic === topic ? 0 : 1);
  return playables
    .filter((p) => p.slug !== slug)
    .sort((a, b) => rank(a) - rank(b) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || compare(a.slug, b.slug))
    .slice(0, 2);
};
export const otherPlayables = (slug) => moreToPlay(PLAYABLES, slug);

/** Every playable, newest update first; the order of PLAYABLES breaks a tie (the sort is stable). */
export const playablesNewestFirst = () => [...PLAYABLES].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
