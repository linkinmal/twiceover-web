/**
 * sitemap — the true last-changed date of each post, for `<lastmod>` (ADR 1090 Decision 7; Growth's rule
 * that a sitemap date is used only when accurate). The date is `updatedAt` when the author set one, else
 * `publishAt`, in New York time like every other date the page shows. `priority` and `changefreq` are never
 * emitted: Google ignores them, and a made-up value is a made-up claim.
 *
 * astro.config.mjs runs before the content collection exists, so the two times are read from each post's
 * front matter directly. The schema guarantees they are quoted ISO strings; a post that breaks the schema
 * fails the build in the collection regardless of what is read here.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { toNewYorkIso } from "./format.mjs";
import { isValidSlug } from "./publish.mjs";

/** @returns {{publishAt?: string, updatedAt?: string}} the two quoted times in a post's front matter */
export function frontMatterTimes(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!m) return out;
  for (const key of ["publishAt", "updatedAt"]) {
    const v = new RegExp(`^${key}:\\s*(?:"([^"\\n]+)"|'([^'\\n]+)')\\s*$`, "m").exec(m[1]);
    if (v) out[key] = v[1] ?? v[2];
  }
  return out;
}

/** @returns {Map<string, {publishAt?: string, updatedAt?: string}>} slug -> times, for every `<slug>.md` in `dir` */
export function readPostTimes(dir, { list = readdirSync, read = (p) => readFileSync(p, "utf8") } = {}) {
  const times = new Map();
  let names = [];
  try {
    names = list(dir);
  } catch {
    return times;
  }
  for (const name of names) {
    const slug = name.endsWith(".md") ? name.slice(0, -3) : null;
    if (slug && isValidSlug(slug)) times.set(slug, frontMatterTimes(read(join(dir, name))));
  }
  return times;
}

/** The `serialize` function for @astrojs/sitemap: a post's address gets its `lastmod`; nothing else is added. */
export function sitemapSerialize(times) {
  return (item) => {
    const m = /^https:\/\/twiceover\.io\/blog\/([a-z0-9-]+)\/?$/.exec(item.url);
    const t = m && times.get(m[1]);
    const at = t && (t.updatedAt ?? t.publishAt);
    if (at) item.lastmod = toNewYorkIso(at);
    return item;
  };
}
