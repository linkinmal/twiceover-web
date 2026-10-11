import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import {
  parseFontFaces,
  rangeCovers,
  licenceStem,
  themeTotals,
  checkBlogFonts,
  BASE_FACES,
  THEME_FACES,
  CEILING_BYTES,
} from "./blog-fonts.mjs";

const face = (file, { family = "X", display = "swap", range = "U+0000-00FF,U+2212" } = {}) =>
  `@font-face {\n  font-family: "${family}";\n  font-display: ${display};\n  src: url("/fonts/${file}.woff2") format("woff2");\n  unicode-range: ${range};\n}\n`;

// A tiny world: one base face, two themes, one orphan-able file.
const BASE = ["base-latin-wght-normal"];
const THEMES = { one: ["aaa-latin-wght-normal"], two: ["bbb-latin-wght-normal"] };
const SIZES = { "base-latin-wght-normal": 100, "aaa-latin-wght-normal": 50, "bbb-latin-wght-normal": 70 };
const LIC = ["base", "aaa", "bbb"];
const BLOG_CSS = face("aaa-latin-wght-normal") + face("bbb-latin-wght-normal");
const SITE_CSS = face("base-latin-wght-normal");
const run = (over = {}) =>
  checkBlogFonts({ blogCss: BLOG_CSS, siteCss: SITE_CSS, sizes: SIZES, licences: LIC, ceiling: 200, base: BASE, themes: THEMES, ...over });

describe("parseFontFaces", () => {
  it("reads the file, family, display and range of each face; ignores blocks with no woff2", () => {
    const css = face("a-latin-wght-normal", { family: "A Face", display: "block", range: "U+0041" }) + "@font-face{font-family:Z;}";
    expect(parseFontFaces(css)).toEqual([{ file: "a-latin-wght-normal", family: "A Face", display: "block", range: "U+0041" }]);
  });
});

describe("rangeCovers", () => {
  it("covers single points and ranges, and nothing else", () => {
    expect.soft(rangeCovers("U+0000-00FF,U+2212", 0x2212)).toBe(true);
    expect.soft(rangeCovers("U+0000-00FF,U+2212", 0x41)).toBe(true);
    expect.soft(rangeCovers("U+0000-00FF,U+2213", 0x2212)).toBe(false);
    expect.soft(rangeCovers("U+2000-206F", 0x2212)).toBe(false);
  });
});

describe("licenceStem", () => {
  it("maps a file to its family licence", () => {
    expect.soft(licenceStem("archivo-latin-wdth-normal")).toBe("archivo");
    expect.soft(licenceStem("ibm-plex-mono-latin-400-normal")).toBe("ibm-plex-mono");
    expect.soft(licenceStem("big-shoulders-display-latin-wght-normal")).toBe("big-shoulders-display");
  });
});

describe("themeTotals", () => {
  it("adds base and theme faces, counting a face named twice once", () => {
    const t = themeTotals(SIZES, BASE, { ...THEMES, dup: ["base-latin-wght-normal", "aaa-latin-wght-normal"] });
    expect.soft(t).toEqual({ one: 150, two: 170, dup: 150 });
  });
});

describe("checkBlogFonts — scenarios", () => {
  it("passes a consistent set", () => {
    expect(run()).toEqual([]);
  });

  it("fails a theme over the ceiling and names it", () => {
    const f = run({ ceiling: 160 });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatch(/theme two: 170 bytes/);
  });

  it("fails a stylesheet naming a file that is not in public/fonts", () => {
    const f = run({ blogCss: BLOG_CSS + face("ghost-latin-wght-normal") });
    expect(f.some((m) => /ghost-latin-wght-normal\.woff2 is named by a stylesheet but missing/.test(m))).toBe(true);
  });

  it("fails an orphan file", () => {
    const f = run({ sizes: { ...SIZES, "lonely-latin-wght-normal": 9 } });
    expect(f.some((m) => /lonely-latin-wght-normal\.woff2 .*orphan/.test(m))).toBe(true);
  });

  it("fails a family with no licence", () => {
    const f = run({ licences: ["base", "aaa"] });
    expect(f).toEqual(expect.arrayContaining([expect.stringMatching(/bbb-latin-wght-normal: no licence .*bbb\.txt/)]));
  });

  it("fails a theme that names a face no stylesheet declares", () => {
    const f = run({ themes: { ...THEMES, three: ["nope-latin-wght-normal"] } });
    expect(f.some((m) => /theme three: face nope-latin-wght-normal is not declared/.test(m))).toBe(true);
  });

  it("fails a blog face that is not swap, or whose range drops the minus sign", () => {
    const f = run({ blogCss: face("aaa-latin-wght-normal", { display: "block" }) + face("bbb-latin-wght-normal", { range: "U+0000-00FF" }) });
    expect.soft(f.some((m) => /aaa-latin-wght-normal must set font-display: swap/.test(m))).toBe(true);
    expect.soft(f.some((m) => /bbb-latin-wght-normal unicode-range omits U\+2212/.test(m))).toBe(true);
  });
});

describe("the repo as committed", () => {
  const root = new URL("..", import.meta.url).pathname;
  const sizes = {};
  for (const f of readdirSync(root + "public/fonts")) {
    if (f.endsWith(".woff2")) sizes[f.replace(/\.woff2$/, "")] = statSync(root + "public/fonts/" + f).size;
  }
  const licences = readdirSync(root + "public/fonts/licenses").map((f) => f.replace(/\.txt$/, ""));
  const input = {
    blogCss: readFileSync(root + "src/styles/blog-fonts.css", "utf8"),
    siteCss: readFileSync(root + "src/styles/site.css", "utf8"),
    sizes,
    licences,
  };

  it("passes the gate", () => {
    expect(checkBlogFonts(input)).toEqual([]);
  });

  it("is a live gate: deleting a font file, or a licence, fails it (known-positive control)", () => {
    const { "besley-latin-wght-normal": _gone, ...rest } = sizes;
    expect.soft(checkBlogFonts({ ...input, sizes: rest }).length).toBeGreaterThan(0);
    expect.soft(checkBlogFonts({ ...input, licences: licences.filter((l) => l !== "besley") }).length).toBeGreaterThan(0);
    expect.soft(checkBlogFonts({ ...input, ceiling: 100_000 }).length).toBe(Object.keys(THEME_FACES).length);
  });

  it("covers every theme the design has, and every blog face is used by some theme or the base", () => {
    expect.soft(Object.keys(THEME_FACES)).toHaveLength(10);
    const used = new Set([...BASE_FACES, ...Object.values(THEME_FACES).flat()]);
    for (const f of Object.keys(sizes)) expect.soft(used.has(f) || f === "source-serif-4-latin-wght-normal", f).toBe(true);
  });

  it("keeps the ceiling at or above the measured worst theme", () => {
    expect(Math.max(...Object.values(themeTotals(sizes)))).toBeLessThanOrEqual(CEILING_BYTES);
  });
});
