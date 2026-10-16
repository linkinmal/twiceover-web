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

const SECTION = { game: "play", tool: "tools" };

// The hub and the strip have so far followed this order (the newest updates first, then the order the pages were
// written); the directories list alphabetically, so it is spelled out until the order is ruled by data.
const LEGACY_ORDER = ["guess-the-gap", "implied-move-from-a-straddle", "coin", "overnight-call", "option-payoff-calculator"];

function load([file, entry]) {
  const dir = file.split("/").at(-2);
  if (entry.slug !== dir) throw new Error(`${file}: slug "${entry.slug}" must equal its directory name "${dir}"`);
  if (!(entry.kind in SECTION)) throw new Error(`${file}: kind "${entry.kind}" must be "game" or "tool"`);
  if (!(`/src/playables/${dir}/page.astro` in bodies)) throw new Error(`${file}: src/playables/${dir}/page.astro is missing`);
  const rank = LEGACY_ORDER.indexOf(dir);
  if (rank < 0) throw new Error(`${file}: add "${dir}" to LEGACY_ORDER in src/blog/playables.mjs`);
  return Object.freeze({ ...entry, path: `/blog/${SECTION[entry.kind]}/${entry.slug}`, rank });
}

export const PLAYABLES = Object.freeze(Object.entries(entries).map(load).sort((a, b) => a.rank - b.rank));

/** A playable's page body (its page.astro component), loaded when a route renders it. */
export const pageOf = async (slug) => (await bodies[`/src/playables/${slug}/page.astro`]()).default;

export const playablePath = (p) => p.path;

/** The games-and-tools hub (blog-handoff.md section 5.4): where the bar's "Games and tools" link and each strip's last cell go. */
export const HUB_PATH = "/blog/play";

/** The other playables, for the "More to play" strip: two, then the strip's own last cell opens the hub. */
export const otherPlayables = (slug) => PLAYABLES.filter((p) => p.slug !== slug).slice(0, 2);

/** Every playable, newest update first; the registry's order breaks a tie (the sort is stable). */
export const playablesNewestFirst = () => [...PLAYABLES].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
