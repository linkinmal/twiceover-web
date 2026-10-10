/**
 * Raw HTML in a post's Markdown is refused, not sanitized (Security consult 1091; ADR 1090 Decision 11).
 * A post is Markdown and nothing else: with raw HTML on, a writer could put a script, a handler or an
 * iframe in a post and the page gate would be the only thing standing between it and the site. So the
 * build fails on the first HTML node, and the writer sees why.
 */
import { readFileSync } from "node:fs";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { describe, expect, it } from "vitest";
import { remarkNoHtml } from "./remark-no-html.mjs";

const render = async (md) => (await createMarkdownProcessor({ remarkPlugins: [remarkNoHtml] })).render(md);

describe("raw HTML in Markdown", () => {
  it("fails the build for a block, an inline tag, a comment, a handler and an iframe, wherever it sits", async () => {
    const bad = [
      "<script>alert(1)</script>",
      "Words with <b>bold</b> inside.",
      "<!-- a comment can hide text from a reviewer -->",
      '<img src="/blog-images/a.png" onerror="x()">',
      '<iframe src="https://evil.test"></iframe>',
      "- a list\n- with <span hidden>buy</span> now\n",
      "> a quote\n>\n> <div>block</div>\n",
      "| a | b |\n|---|---|\n| <i>x</i> | y |\n",
    ];
    for (const md of bad) {
      await expect.soft(render(md), md).rejects.toThrow(/raw HTML/);
    }
  });

  it("says where it is, so the writer can fix it", async () => {
    await expect.soft(render("one\n\ntwo <b>x</b>\n")).rejects.toThrow(/line 3/);
  });

  it("renders ordinary Markdown, and HTML shown as code is code, not HTML", async () => {
    const out = await render("# Title\n\nSome *emphasis*, a [link](/blog/x) and `<script>` in code.\n\n```html\n<script>1</script>\n```\n\n![alt text](/blog-images/a.png)\n");
    expect.soft(out.code).toContain("<em>emphasis</em>");
    expect.soft(out.code).toContain('<a href="/blog/x">link</a>');
    expect.soft(out.code).toContain("&#x3C;script>");
    expect.soft(out.code).not.toMatch(/<script/);
    expect.soft(out.code).toContain('alt="alt text"');
  });
});

describe("wiring", () => {
  it("is registered as a Markdown plugin in astro.config.mjs, so a post cannot reach the renderer without it", () => {
    const config = readFileSync(new URL("../../astro.config.mjs", import.meta.url), "utf8");
    expect.soft(config).toContain('import { remarkNoHtml } from "./src/blog/remark-no-html.mjs";');
    expect.soft(config).toMatch(/markdown:\s*\{\s*remarkPlugins:\s*\[remarkNoHtml\]\s*\}/);
  });
});
