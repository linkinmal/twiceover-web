/**
 * sources — the `sources` front-matter field: a post's short list of what it rests on (#4286, blog-handoff.md 4b).
 *
 * One line, because the lane's strict grammar has no list form (frontmatter-grammar.mjs): entries are separated
 * by `;`, and an entry is a short name, then ` | ` and an `https://` link when it has one.
 *   sources: "Brady Report 1988 | https://archive.org/details/x; NYSE"
 * Two to five entries. A link has no query string or fragment, so no tracking parameter can ride on it.
 * A failure's reason never carries the field's text.
 */

export const MIN_SOURCES = 2;
export const MAX_SOURCES = 5;
const NAME_MAX = 60;
const LINK = /^https:\/\/[^\s?#\\"<>|;]+$/;

const no = (reason) => ({ ok: false, reason });

/**
 * @param {unknown} text the field's value
 * @returns {{ok: true, entries: {name: string, url?: string}[]} | {ok: false, reason: string}}
 */
export function readSources(text) {
  if (typeof text !== "string") return no("sources must be a quoted line of names");
  const entries = [];
  for (const part of text.split(";")) {
    const bits = part.split("|").map((b) => b.trim());
    if (bits.length > 2) return no("an entry is a name, then | and one link");
    const [name, url] = bits;
    if (!name || name.length > NAME_MAX) return no(`each name is 1 to ${NAME_MAX} characters`);
    if (/[<>]/.test(name)) return no("no markup in a name");
    if (bits.length === 2 && !LINK.test(url)) return no("a link is https:// with no query string or fragment");
    entries.push(url === undefined ? { name } : { name, url });
  }
  if (entries.length < MIN_SOURCES || entries.length > MAX_SOURCES) return no(`${MIN_SOURCES} to ${MAX_SOURCES} entries, separated by ;`);
  return { ok: true, entries };
}

/** The page draws the line only for two to five entries (blog-handoff.md 4b); the schema already enforces it. */
export const renderable = (entries) => Array.isArray(entries) && entries.length >= MIN_SOURCES && entries.length <= MAX_SOURCES;
