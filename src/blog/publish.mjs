/**
 * publish — the blog's date gate (ADR 1090 Decisions 2, 4 and 11).
 *
 * `isPublished(post, now)` is the ONLY place a post's `publishAt` is compared with the clock. The
 * index, topic pages, feed and sitemap all call it, so a future post is absent from every surface at
 * once. Pull requests build with `BLOG_NOW` set far ahead, so every post — future ones included — is
 * built and checked there, and a broken post fails its own pull request, not the 07:00 run.
 *
 * A time it cannot read throws: comparing against NaN would quietly say "not yet" for a post that was
 * meant to be live, and a build that hides a post without a word is the failure this exists to avoid.
 */

/** Names a slug may not take: they are routes under `/blog/` (Security, consult 1091). */
export const RESERVED_SLUGS = Object.freeze(["tools", "topic", "page", "feed.xml", "play"]);

const SLUG = /^[a-z0-9-]{1,64}$/;
const TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Whether `s` is a usable post address: 1 to 64 of a-z, 0-9 and hyphen, and not a reserved route. */
export function isValidSlug(s) {
  return typeof s === "string" && SLUG.test(s) && s !== "-" && !RESERVED_SLUGS.includes(s);
}

/**
 * Read an ISO time that carries an offset (or Z). Returns epoch milliseconds, or null when the text is
 * not such a time or names a day or hour that does not exist (a 30th of February).
 * @param {unknown} s
 * @returns {number | null}
 */
export function parsePublishTime(s) {
  if (typeof s !== "string") return null;
  const m = TIME.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi, sec] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number);
  const day = new Date(Date.UTC(y, mo - 1, d));
  // A day past the month's end rolls into the next month, so the month check catches it.
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1) return null;
  if (h > 23 || mi > 59 || sec > 59) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/**
 * The only comparison of a post's time with the clock.
 * @param {{publishAt: string}} post
 * @param {Date | number} now
 */
export function isPublished(post, now) {
  const at = parsePublishTime(post.publishAt);
  if (at === null) throw new Error(`publishAt is not an ISO time with an offset: ${JSON.stringify(post.publishAt)}`);
  const clock = typeof now === "number" ? now : now.getTime();
  if (Number.isNaN(clock)) throw new Error("the build clock is not a valid time");
  return at <= clock;
}

/**
 * The posts every surface lists: published ones, newest first. Does not change its input.
 * @template {{publishAt: string}} P
 * @param {P[]} posts
 * @param {Date | number} now
 * @returns {P[]}
 */
export function publishedPosts(posts, now) {
  return posts
    .filter((p) => isPublished(p, now))
    .sort((a, b) => parsePublishTime(b.publishAt) - parsePublishTime(a.publishAt));
}

/**
 * The build's clock: the real time, or `BLOG_NOW` when set (pull requests set it far ahead).
 * @param {Record<string, string | undefined>} env
 */
export function blogNow(env) {
  const raw = env.BLOG_NOW;
  if (raw === undefined || raw === "") return new Date();
  const t = Date.parse(raw);
  if (Number.isNaN(t)) throw new Error(`BLOG_NOW is not a valid time: ${JSON.stringify(raw)}`);
  return new Date(t);
}
