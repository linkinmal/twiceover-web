/**
 * collection — the one place a page asks for posts. Every route (post, index, topic, feed) calls
 * `getPublished`, which applies the date gate (`isPublished`, via `publishedPosts`) and refuses a post
 * whose file name is not a valid address, so a future post is absent from every surface at once
 * (ADR 1090 Decision 2).
 */
import { getCollection } from "astro:content";
import { blogNow, isValidSlug, publishedPosts } from "./publish.mjs";

/** @returns {Promise<any[]>} published entries, newest first */
export async function getPublished(env = process.env) {
  const all = await getCollection("blog");
  for (const e of all) {
    if (!isValidSlug(e.id)) throw new Error(`src/content/blog/${e.id}.md: not a valid, unreserved post address`);
  }
  const now = blogNow(env);
  return publishedPosts(all.map((entry) => ({ entry, publishAt: entry.data.publishAt })), now).map((x) => x.entry);
}
