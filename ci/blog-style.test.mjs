import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  blockAfter,
  topDeclarations,
  leaves,
  lookValues,
  mixHex,
  checkBlogStyle,
  THEMES,
  END_BLOCK_PINS,
  CONTRAST_EXCEPTIONS,
} from "./blog-style.mjs";
import { LOOKS } from "../src/blog/vocabulary.mjs";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(root + p, "utf8");
const real = {
  css: read("src/styles/blog.css"),
  blog: JSON.parse(read("tokens/blog-themes.tokens.json")),
  marketing: JSON.parse(read("tokens/marketing-looks.tokens.json")),
  site: JSON.parse(read("tokens/twiceover.tokens.json")),
  blogFontsCss: read("src/styles/blog-fonts.css"),
  siteCss: read("src/styles/site.css"),
};

/** Run the gate on the real inputs with the CSS (and optionally the tokens) changed; the change must bite. */
function mutated(from, to, tokens) {
  const css = real.css.replace(from, to);
  expect(css, `mutation target not found: ${from}`).not.toBe(real.css);
  return checkBlogStyle({ ...real, css, ...(tokens ?? {}) });
}

describe("blockAfter and topDeclarations", () => {
  const css = `a{x:1} :where(#b){ [data-look="t"]{--g:#fff;--fd:"A B",serif;color-scheme:dark;
    .hit{color:var(--a)}
    &.skin{background:rgba(0,0,0,.2)}
    --cw:2.6
  } }`;
  it("finds a block by its opener, depth-counted", () => {
    expect(blockAfter(css, `[data-look="t"]{`)).toContain("--cw:2.6");
    expect(blockAfter(css, "[data-look=\"missing\"]{")).toBeNull();
  });
  it("reads only the declarations directly in the block, including a last one with no semicolon", () => {
    const d = topDeclarations(blockAfter(css, `[data-look="t"]{`));
    expect([...d.keys()]).toEqual(["--g", "--fd", "color-scheme", "--cw"]);
    expect(d.get("--fd")).toBe('"A B",serif');
  });
});

describe("token helpers", () => {
  it("leaves flattens dotted paths and skips $-keys", () => {
    expect(leaves({ $d: "x", a: { b: { $value: 1 }, c: { d: { $value: "z" } } } })).toEqual({ "a.b": 1, "a.c.d": "z" });
  });
  it("lookValues applies the blog override, resolves {font.*} and falls back to blog-chart-line", () => {
    const bp = lookValues(real.blog, real.marketing, "blueprint");
    expect.soft(bp.plate).toBe("#0B2A50");
    expect.soft(bp.text[0]).toBe("Source Sans 3");
    expect.soft(bp.display[0]).toBe("Bricolage Grotesque");
    expect.soft(bp["chart-line"]).toBe(2.4);
    expect.soft(lookValues(real.blog, real.marketing, "house").ground).toBe("#F4F0E8");
    expect.soft(lookValues(real.blog, real.marketing, "exhibit")["chart-line"]).toBe(5);
    expect(() => lookValues(real.blog, real.marketing, "nope")).toThrow(/no look/);
  });
  it("mixHex matches a hand-computed reference (62% black over white is 38% of 255 = 97 = 0x61)", () => {
    expect.soft(mixHex("#000000", "#FFFFFF", 62)).toBe("#616161");
    expect.soft(mixHex("#FFFFFF", "#000000", 100)).toBe("#ffffff");
  });
});

describe("the style gate's theme table and the post vocabulary", () => {
  it("name the same ten themes with the same kit ids, so a post's `look` always lands on a checked block", () => {
    expect.soft(THEMES.map((t) => t.token)).toEqual(Object.keys(LOOKS));
    expect.soft(THEMES.map((t) => t.kit)).toEqual(Object.values(LOOKS).map((l) => l.kit));
  });
});

describe("the committed token copies", () => {
  // The canonical files live in stock-analyst-platform/ai-team/design/tokens/ and cannot be read from this repo's CI,
  // so a copy that changes here must change this digest on purpose (the Designer's file is the source).
  const sha = (p) => createHash("sha256").update(readFileSync(root + p)).digest("hex");
  it("are the files the design signed off", () => {
    expect.soft(sha("tokens/blog-themes.tokens.json")).toBe("fd1e3514524be0f54ca4ee19b0cfa96c700c2e60ae46178018f81e1ec8f8bbe9");
    expect.soft(sha("tokens/marketing-looks.tokens.json")).toBe("a84dc5de526d10aed02d88602bd6a8b073b2a9616aced3c83baa11e09cded1bd");
  });
});

describe("blog.css against the tokens — the committed port", () => {
  it("passes the gate", () => {
    expect(checkBlogStyle(real)).toEqual([]);
  });

  it("has a block for every theme and every end-block pin resolves", () => {
    for (const t of THEMES) expect.soft(blockAfter(real.css, `[data-look="${t.kit}"]{`), t.token).not.toBeNull();
    expect(END_BLOCK_PINS.length).toBeGreaterThan(0);
  });
});

describe("blog.css against the tokens — mutations the gate must catch", () => {
  it("a drifted ground, plate, ink or accent is named with its theme", () => {
    expect.soft(mutated('[data-look="house"]{--g:#F4F0E8', '[data-look="house"]{--g:#F4F0E9').join("\n")).toMatch(/house: --g is #F4F0E9 .* #F4F0E8/);
    expect.soft(mutated("--plate:#242019", "--plate:#242018").join("\n")).toMatch(/night-desk: --plate/);
    expect.soft(mutated("--ink:#17131F", "--ink:#17131E").join("\n")).toMatch(/ticket: --ink/);
    expect.soft(mutated("--a:#1F3BFF", "--a:#1F3BFE").join("\n")).toMatch(/exhibit: --a /);
  });

  it("a drifted second accent, muted ink or grid is caught", () => {
    expect.soft(mutated("--a2:#4DB5FF", "--a2:#4DB5FE").join("\n")).toMatch(/neon: --a2/);
    expect.soft(mutated("--ink2:#A79E8B", "--ink2:#A79E8A").join("\n")).toMatch(/night-desk: --ink2/);
    expect.soft(mutated("--gridc:#E3E3DF", "--gridc:#E3E3DE").join("\n")).toMatch(/exhibit: --gridc/);
  });

  it("a drifted display face, text face, weight or chart line is caught", () => {
    expect.soft(mutated('--fd:"Besley"', '--fd:"Fraunces"').join("\n")).toMatch(/ticket: --fd/);
    expect.soft(mutated('--ft:"Archivo"', '--ft:"Besley"').join("\n")).toMatch(/exhibit: --ft/);
    expect.soft(mutated("--fdw:900", "--fdw:800").join("\n")).toMatch(/ticket: --fdw/);
    expect.soft(mutated("--cw:1.8", "--cw:2").join("\n")).toMatch(/printout: --cw/);
  });

  it("the Source Serif 4 Opsz family is the token's Source Serif 4, not a drift", () => {
    expect(real.css).toContain('--fd:"Source Serif 4 Opsz"');
    expect(checkBlogStyle(real)).toEqual([]);
  });

  it("an unbalanced brace is reported, and braces inside a string or comment are not counted", () => {
    expect.soft(checkBlogStyle({ ...real, css: real.css + "\n.x{" }).join("\n")).toMatch(/unbalanced braces \((\d+) open, \1 close\)|unbalanced braces/);
    expect.soft(checkBlogStyle({ ...real, css: real.css + '\n/* { */ .y::after{content:"}"}' })).toEqual([]);
  });

  it("a theme block removed is reported", () => {
    expect(mutated('[data-look="riso"]{', '[data-look="riso-x"]{').join("\n")).toMatch(/risograph: no \[data-look="riso"\] block/);
  });

  it("a drifted shell value or face is caught", () => {
    expect.soft(mutated("--sline:#DADAD5", "--sline:#DADAD6").join("\n")).toMatch(/shell: --sline/);
    expect.soft(mutated("--sbg:#FFFFFF", "--sbg:#FEFEFE").join("\n")).toMatch(/shell: --sbg/);
    expect.soft(mutated('--sfd:"Newsreader"', '--sfd:"Fraunces"').join("\n")).toMatch(/shell: --sfd/);
  });

  it("an end-block literal that is not the product's token is caught", () => {
    expect.soft(mutated(".endblk{background:#F4F0E8", ".endblk{background:#F4F0E9").join("\n")).toMatch(/end block: \.endblk background is #F4F0E9/);
    expect.soft(mutated(".e-a{display:inline-block;background:#23436F", ".e-a{display:inline-block;background:#23436E").join("\n")).toMatch(/end block: \.e-a background/);
  });

  it("an app-only custom property, a data URI, an import or a remote URL fails containment", () => {
    expect.soft(mutated("#blog{--sbg", "#blog{--elevation-2:0;--sbg").join("\n")).toMatch(/app-only custom property/);
    expect.soft(mutated('url("/blog-textures/paper-grain.svg")', 'url("data:image/svg+xml,x")').join("\n")).toMatch(/data: URI/);
    expect.soft(checkBlogStyle({ ...real, css: "@import url(x.css);\n" + real.css }).join("\n")).toMatch(/@import/);
    expect.soft(mutated('url("/blog-textures/paper-grain.svg")', 'url("https://x.example/a.svg")').join("\n")).toMatch(/remote URL/);
  });

  it("a face the theme's font table does not load is caught", () => {
    // Ticket loads Besley and Source Sans 3; Caveat is not in its table.
    expect(mutated('--ft:"Source Sans 3",system-ui,sans-serif;--cw:3', '--ft:"Caveat",system-ui,sans-serif;--cw:3').join("\n")).toMatch(/ticket: --ft/);
  });

  it("a contrast failure the design did not sign off fails, in the theme and in the shell", () => {
    // Light ink on a light ground, tokens kept in step so only the contrast rule can object.
    const blog = structuredClone(real.blog);
    blog.look.exhibit.ink.$value = "#C0C0C0";
    const f = mutated("--ink:#0B0B0C", "--ink:#C0C0C0", { blog }).join("\n");
    expect(f).toMatch(/exhibit: ink #C0C0C0 on ground #FFFFFF is [\d.]+:1, under WCAG AA/);
    const blogShell = structuredClone(real.blog);
    blogShell.shell.muted.$value = "#BBBBBB";
    expect(mutated("--smut:#6A6D75", "--smut:#BBBBBB", { blog: blogShell }).join("\n")).toMatch(/shell: muted #BBBBBB/);
  });

  it("the exception mechanism still pins a measured floor and goes stale loudly", () => {
    expect(CONTRAST_EXCEPTIONS).toEqual({});
    // Paper Marker's muted ink is now the token's #656059; an old 62% mix (#6D6860) in the port is a drift and a contrast failure.
    const f = mutated("--ink2:#656059;", "--ink2:#6D6860;").join("\n");
    expect.soft(f).toMatch(/paper-marker: --ink2 is #6D6860 .* #656059/);
    expect.soft(f).toMatch(/paper-marker: muted #6D6860 on ground #E8E3D8 is 4\.32:1, under WCAG AA/);
  });
});
