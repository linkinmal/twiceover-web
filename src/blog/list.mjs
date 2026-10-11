/**
 * list — ordering, numbering, paging and neighbours for the pages that list posts. All of them take
 * posts that already passed the date gate (`publishedPosts`), so a future post never reaches them.
 */
import { parsePublishTime } from "./publish.mjs";

/**
 * Each published post's issue number: its place in publish order, oldest first, as "001". Ties break by
 * slug so the numbers are the same on every build.
 * @template {{id:string, data:{publishAt:string}}} P
 * @param {P[]} posts
 * @returns {Map<string,string>} slug -> "001"
 */
export function issueNumbers(posts) {
  const asc = [...posts].sort((a, b) => parsePublishTime(a.data.publishAt) - parsePublishTime(b.data.publishAt) || (a.id < b.id ? -1 : 1));
  return new Map(asc.map((p, i) => [p.id, String(i + 1).padStart(3, "0")]));
}

/** Split into pages of `size`; always at least one page, so an empty filter still has its page. */
export function paginate(items, size) {
  if (!Number.isInteger(size) || size < 1) throw new Error("page size must be a positive integer");
  const pages = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages.length ? pages : [[]];
}

/**
 * The posts to suggest after `post`: same subject first, then the rest, newest first, never the post
 * itself. `posts` is newest first.
 */
export function keepReading(post, posts, n = 3) {
  const others = posts.filter((p) => p.id !== post.id);
  const same = others.filter((p) => p.data.topic === post.data.topic);
  return [...same, ...others.filter((p) => !same.includes(p))].slice(0, n);
}

/** The topics that have at least one post, in the vocabulary's order. */
export function topicsWithPosts(posts, topics) {
  return topics.filter((t) => posts.some((p) => p.data.topic === t));
}
