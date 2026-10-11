/**
 * frontmatter-grammar — the one front-matter shape the post-only lane reads (ADR 1090 Decision 11; Security's
 * conditions on twiceover-web PR 108).
 *
 * The lane judges a pull request without installing anything, so it cannot parse YAML the way the build does
 * (`parseFrontmatter` in @astrojs/markdown-remark, which is js-yaml). Reading a YAML field with a regex is how the
 * two came to disagree: a decoy `publishAt:` line inside a multi-line string, with the real key written in flow
 * style or with an escape, made the lane read one date and the build another. So the lane stops interpreting YAML.
 * It accepts only text whose every line is one of three plain forms, and fails closed on anything else. On that
 * subset the lane's reading and the build's cannot differ, and `frontmatter-grammar.test.mjs` proves it against
 * the build's own parser, on generated text, every time the suite runs.
 *
 * The block starts at the first byte with a line that is exactly `---` and ends at the next line that is exactly
 * `---`. Between them, each line is exactly one of:
 *   key: "value"            at column 0, key in TOP_KEYS (not figure or image)
 *   figure:  /  image:      at column 0, nothing after the colon
 *   ··key: "value"          exactly two spaces, directly under figure or image, key in that object's list
 * A value has no `"`, no backslash and no control character, DEL, U+0085, U+2028 or U+2029, so it is one line of
 * plain characters that YAML reads as itself. No quoted keys, flow style, anchors, tags, block scalars, comments,
 * blank lines, tabs, trailing space or carriage returns. A key may appear once.
 *
 * The result never carries file text in `reason`, so a failure message cannot echo attacker-chosen bytes.
 */

/** The closed schema's keys (src/blog/schema.mjs); a test pins these to it. */
export const TOP_KEYS = Object.freeze(["title", "description", "publishAt", "updatedAt", "topic", "lens", "build", "look", "hit", "figure", "image"]);
export const OBJECT_KEYS = Object.freeze({
  figure: Object.freeze(["value", "note"]),
  image: Object.freeze(["src", "alt", "source", "licence"]),
});

const VALUE = "[^\"\\\\\\u0000-\\u001f\\u007f\\u0085\\u2028\\u2029]*";
const TOP_LINE = new RegExp(`^([A-Za-z][A-Za-z0-9]*): "(${VALUE})"$`);
const OBJECT_LINE = /^(figure|image):$/;
const NESTED_LINE = new RegExp(`^  ([A-Za-z][A-Za-z0-9]*): "(${VALUE})"$`);

const no = (line, reason) => ({ ok: false, line, reason });

/**
 * @param {string} text a whole post file
 * @returns {{ok: true, top: Record<string, string>, objects: {figure?: Record<string, string>, image?: Record<string, string>}, publishAt: string | undefined}
 *   | {ok: false, line: number, reason: string}}
 */
export function readStrictFrontMatter(text) {
  if (typeof text !== "string") return no(0, "the file is not text");
  if (!text.startsWith("---\n")) return no(1, "front matter must open with a line that is exactly --- at the first byte");

  const lines = text.slice(4).split("\n");
  const top = {};
  const objects = {}; // only the objects the file wrote
  let inObject = null;

  for (let i = 0; i < lines.length; i++) {
    const n = i + 2;
    const line = lines[i];
    if (line === "---") return { ok: true, top, objects, publishAt: top.publishAt };

    let m;
    if ((m = OBJECT_LINE.exec(line))) {
      if (m[1] in objects) return no(n, "a key appears twice");
      objects[m[1]] = {};
      inObject = m[1];
    } else if ((m = TOP_LINE.exec(line))) {
      const key = m[1];
      if (!TOP_KEYS.includes(key) || key in OBJECT_KEYS) return no(n, "a key is not a plain field of the closed schema");
      if (key in top) return no(n, "a key appears twice");
      top[key] = m[2];
      inObject = null;
    } else if ((m = NESTED_LINE.exec(line))) {
      if (inObject === null) return no(n, "an indented line is not directly under figure or image");
      const key = m[1];
      if (!OBJECT_KEYS[inObject].includes(key)) return no(n, `a key is not one of ${inObject}'s fields`);
      if (key in objects[inObject]) return no(n, "a key appears twice");
      objects[inObject][key] = m[2];
    } else {
      return no(n, "a line is not key: \"value\", figure:, image:, or an indented key: \"value\" under one of them");
    }
  }
  return no(lines.length + 1, "front matter has no closing line that is exactly ---");
}
