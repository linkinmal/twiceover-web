import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import { describe, expect, it } from "vitest";
import { OBJECT_KEYS, TOP_KEYS, readStrictFrontMatter } from "./frontmatter-grammar.mjs";
import { postSchema } from "./schema.mjs";

const fm = (...lines) => `---\n${lines.join("\n")}\n---\nbody\n`;
const HONEST = fm('title: "A call loses money"', 'publishAt: "2030-01-01T00:00:00Z"', 'topic: "option-math"', "figure:", '  value: "-$40"', '  note: "after the fall"');

describe("the lane's strict front-matter grammar (Security conditions on PR 108, 1 to 4)", () => {
  it("reads an honest post: top-level fields, the two nested objects, and publishAt from column 0", () => {
    const r = readStrictFrontMatter(HONEST);
    expect.soft(r.ok).toBe(true);
    expect.soft(r.publishAt).toBe("2030-01-01T00:00:00Z");
    expect.soft(r.top.title).toBe("A call loses money");
    expect.soft(r.objects.figure).toEqual({ value: "-$40", note: "after the fall" });
  });
  it("accepts a typographic value, an empty value and a post with no publishAt (the lane reports that on its own)", () => {
    expect.soft(readStrictFrontMatter(fm('title: "Why “IV crush” — in 3 lines"')).ok).toBe(true);
    expect.soft(readStrictFrontMatter(fm('hit: ""')).ok).toBe(true);
    const none = readStrictFrontMatter(fm('title: "x"'));
    expect.soft([none.ok, none.publishAt]).toEqual([true, undefined]);
  });
  it.each([
    ["the multi-line title decoy with the real key in a flow mapping", `---\n{title: "x\npublishAt: '2020-01-01T00:00:00Z'\ny", publishAt: "2030-01-01T00:00:00Z"}\n---\n`],
    ["the multi-line title decoy with the real key escaped", `---\ntitle: "x\npublishAt: '2020-01-01T00:00:00Z'\ny"\n"\\u0070ublishAt": "2030-01-01T00:00:00Z"\n---\n`],
    ["the original two-line decoy", `---\ntitle: "x\npublishAt: '2020-01-01T00:00:00Z'\ny"\npublishAt: "2030-01-01T00:00:00Z"\n---\n`],
    ["a byte-order mark", "﻿" + HONEST],
    ["a blank line before the opening ---", "\n" + HONEST],
    ["an opening --- with text after it", HONEST.replace("---\n", "--- x\n")],
    ["CRLF line ends", HONEST.replace(/\n/g, "\r\n")],
    ["no closing ---", `---\ntitle: "x"\npublishAt: "2030-01-01T00:00:00Z"\n`],
    ["a closing --- with text after it", `---\ntitle: "x"\n--- y\n`],
    ["a quoted key", fm('"title": "x"')],
    ["flow style", fm("{title: x}")],
    ["a single-quoted value", fm("title: 'x'")],
    ["an unquoted value", fm("title: x")],
    ["an anchor", fm('title: &a "x"')],
    ["a tag", fm('title: !!str "x"')],
    ["a block scalar", fm("title: |", "  x")],
    ["a comment line", fm("# note", 'title: "x"')],
    ["a trailing comment", fm('title: "x" # note')],
    ["trailing space", fm('title: "x" ')],
    ["a blank line inside", fm('title: "x"', "", 'topic: "option-math"')],
    ["a tab indent", fm("figure:", '\tvalue: "x"')],
    ["a three-space indent", fm("figure:", '   value: "x"')],
    ["an indented line under a top-level string field", fm('title: "x"', '  value: "y"')],
    ["a nested key that is not in that object", fm("figure:", '  src: "/blog-images/a.png"')],
    ["publishAt nested under image", fm("image:", '  publishAt: "2020-01-01T00:00:00Z"')],
    ["an object header with a value", fm('figure: "x"')],
    ["a top-level key outside the closed schema", fm('extra: "x"')],
    ["a repeated top-level key", fm('publishAt: "2020-01-01T00:00:00Z"', 'publishAt: "2030-01-01T00:00:00Z"')],
    ["a repeated nested key", fm("figure:", '  value: "1"', '  value: "2"')],
    ["a repeated object", fm("figure:", '  value: "1"', "figure:", '  note: "2"')],
    ["a backslash in a value", fm('title: "a\\nb"')],
    ["a double quote in a value", fm('title: "a"b"')],
    ["a DEL in a value", fm('title: "a\u007fb"')],
    ["a NEL in a value", fm('title: "a\u0085b"')],
    ["a line separator in a value", fm('title: "a\u2028b"')],
    ["a paragraph separator in a value", fm('title: "a\u2029b"')],
    ["a control character in a value", fm('title: "a\u0001b"')],
    ["a key with a dash", fm('pub-lishAt: "x"')],
  ])("rejects %s, without echoing the text back", (_n, text) => {
    const r = readStrictFrontMatter(text);
    expect.soft(r.ok, _n).toBe(false);
    expect.soft(typeof r.reason, _n).toBe("string");
    expect.soft(r.reason, "the reason never carries file text").not.toMatch(/pubIishAt|2020|decoy/);
  });
  it("lists exactly the keys the closed schema lists", () => {
    const inner = postSchema._def.schema ?? postSchema;
    expect.soft([...TOP_KEYS].sort()).toEqual(Object.keys(inner.shape).sort());
    expect.soft([...OBJECT_KEYS.figure].sort()).toEqual(Object.keys(inner.shape.figure.unwrap().shape).sort());
    expect.soft([...OBJECT_KEYS.image].sort()).toEqual(Object.keys(inner.shape.image.unwrap().shape).sort());
  });
});

// The differential: the lane reads a post's fields with this grammar, the build reads them with Astro's own
// `parseFrontmatter` (js-yaml). Whatever the grammar accepts, the two must read the same fields. Generated text
// mixes honest pieces with every adversarial piece we know, from a fixed seed so a failure reproduces.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const PIECES = ["plain", "with: colon", "a # hash", "—", "“quoted”", "x'y", "\\u0070ublishAt", "\\n", "\\\"", "a\\b", "{a: b}", "- item", "& anchor", "!!str", "|", ">", "~", "null", "true", "12", "2020-01-01", "publishAt: '2020-01-01T00:00:00Z'", "\n", "\r", "\t", "\u2028", "\u0085", '"', " "];
const KEYS = [...TOP_KEYS, "publishAt", "pub\\u006cishAt", "x y", "-k", "ke:y", "figure", "image"];
describe("the differential: whatever the grammar accepts, the build reads the same fields (Security condition 6)", () => {
  it("agrees with Astro's parseFrontmatter on 3000 generated front matters, all fields, not only publishAt", () => {
    const rand = rng(20261011);
    const pick = (a) => a[Math.floor(rand() * a.length)];
    let accepted = 0;
    for (let n = 0; n < 3000; n++) {
      const lines = [];
      const piece = () => Array.from({ length: Math.floor(rand() * 3) }, () => pick(PIECES)).join("");
      if (rand() < 0.5) {
        // in the grammar's shape, with adversarial text as the values: the accepted side, where agreement is tested
        for (const k of TOP_KEYS.filter((k) => !(k in OBJECT_KEYS) && rand() < 0.4)) lines.push(`${k}: "${piece()}"`);
        for (const [obj, keys] of Object.entries(OBJECT_KEYS)) {
          if (rand() > 0.3) continue;
          lines.push(`${obj}:`);
          for (const k of keys.filter(() => rand() < 0.6)) lines.push(`  ${k}: "${piece()}"`);
        }
      } else {
        // a free mix of keys and line shapes, most of which the grammar must refuse
        const count = 1 + Math.floor(rand() * 6);
        for (let i = 0; i < count; i++) {
          const key = pick(KEYS);
          const value = piece();
          const shape = rand();
          if (shape < 0.15) lines.push(`${key}:`);
          else if (shape < 0.4) lines.push(`  ${key}: "${value}"`);
          else if (shape < 0.5) lines.push(`${key}: ${value}`);
          else lines.push(`${key}: "${value}"`);
        }
      }
      const text = `---\n${lines.join("\n")}\n---\nbody\n`;
      const r = readStrictFrontMatter(text);
      if (!r.ok) continue;
      accepted++;
      const built = parseFrontmatter(text).frontmatter;
      const expected = { ...r.top, ...Object.fromEntries(Object.entries(r.objects).map(([k, v]) => [k, Object.keys(v).length ? v : null])) };
      expect.soft(built, JSON.stringify(text)).toEqual(expected);
      expect.soft(built.publishAt, JSON.stringify(text)).toBe(r.publishAt);
    }
    expect(accepted, "the generator must reach the accepted side often enough to mean something").toBeGreaterThan(150);
  });
});

describe("every post already in the repo conforms (Security condition 5)", () => {
  it("accepts each file in src/content/blog and test-fixtures/blog", () => {
    let seen = 0;
    for (const dir of ["src/content/blog", "test-fixtures/blog"]) {
      const abs = join(new URL("../..", import.meta.url).pathname, dir);
      if (!existsSync(abs)) continue;
      for (const name of readdirSync(abs).filter((f) => f.endsWith(".md"))) {
        seen++;
        const r = readStrictFrontMatter(readFileSync(join(abs, name), "utf8"));
        expect.soft(r.ok, `${dir}/${name}: ${r.reason}`).toBe(true);
      }
    }
    expect(seen, "the fixture posts exist").toBeGreaterThan(0);
  });
});
