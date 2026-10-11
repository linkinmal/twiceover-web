import { describe, expect, it } from "vitest";
import { blogOnlyFonts, checkIsolation, pageStyles } from "./blog-isolation.mjs";

const link = (href) => `<link rel="stylesheet" href="${href}">`;
const page = (rel, ...hrefs) => ({ rel, html: `<html><head>${hrefs.map(link).join("")}</head><body></body></html>` });
const SITE_CSS = ".site-header{display:flex} :root{--color-bg-canvas:#fff}";
const BLOG_CSS = ':where(#blog) [data-look="x"]{--fd:"Fraunces"} @font-face{font-family:"Fraunces";src:url("/fonts/fraunces-latin-opsz-normal.woff2")}';
const files = { "/_astro/site.css": SITE_CSS, "/_astro/blog.css": BLOG_CSS };
const readCss = (h) => files[h] ?? null;
const blogOnly = { files: ["fraunces-latin-opsz-normal"], families: ["Fraunces"] };
const run = (pages, over = {}) => checkIsolation({ pages, readCss, blogOnly, ...over });

describe("pageStyles", () => {
  it("reads stylesheet links in any quoting and attribute order, and inline style text; ignores other links", () => {
    const html = `<link href='/a.css' rel="stylesheet"><link rel=stylesheet href=/b.css><link rel="icon" href="/i.svg"><style>.x{}</style>`;
    expect(pageStyles(html)).toEqual({ hrefs: ["/a.css", "/b.css"], inline: [".x{}"] });
  });
});

describe("blogOnlyFonts", () => {
  it("lists the files and families blog-fonts.css declares that site.css does not", () => {
    const face = (family, file) => `@font-face{font-family:"${family}";font-display:swap;src:url("/fonts/${file}.woff2");unicode-range:U+2212}`;
    const r = blogOnlyFonts(face("Fraunces", "f-1") + face("Source Sans 3", "ss-1"), face("Source Sans 3", "ss-1"));
    expect(r).toEqual({ files: ["f-1"], families: ["Fraunces"] });
  });
});

describe("checkIsolation — scenarios", () => {
  const good = () => [page("index.html", "/_astro/site.css"), page("terms/index.html", "/_astro/site.css"), page("blog/index.html", "/_astro/blog.css"), page("blog/a/index.html", "/_astro/blog.css")];

  it("passes a site whose pages and blog pages each load their own CSS", () => {
    expect(run(good())).toEqual([]);
  });
  it("passes a site with no blog page at all (production before the first post)", () => {
    expect(run([page("index.html", "/_astro/site.css"), page("terms/index.html", "/_astro/site.css")])).toEqual([]);
  });
  it("fails a non-blog page that loads the blog stylesheet, and names the page and the mark", () => {
    const pages = good();
    pages[1] = page("terms/index.html", "/_astro/site.css", "/_astro/blog.css");
    const f = run(pages);
    expect.soft(f).toHaveLength(1);
    expect.soft(f[0]).toMatch(/terms\/index\.html: a page outside \/blog loads the blog's styles \(#blog/);
  });
  it("fails a non-blog page whose inline style names a blog-only font", () => {
    const pages = good();
    pages[0] = { rel: "index.html", html: `<html><head>${link("/_astro/site.css")}<style>h1{font-family:"Fraunces"}</style></head></html>` };
    expect(run(pages).join("\n")).toMatch(/index\.html: .*Fraunces/);
  });
  it("fails a blog page that loads the site stylesheet", () => {
    const pages = good();
    pages[2] = page("blog/index.html", "/_astro/blog.css", "/_astro/site.css");
    expect(run(pages).join("\n")).toMatch(/blog\/index\.html: a blog page loads the site's stylesheet/);
  });
  it("fails a stylesheet the build does not contain, instead of reading it as empty", () => {
    expect(run([page("index.html", "/_astro/gone.css")]).join("\n")).toMatch(/gone\.css was not found/);
  });
});

describe("checkIsolation — the scan is not blind", () => {
  it("fails when blog pages exist and none carries the blog sentinel (the scan would pass on nothing)", () => {
    const pages = [page("index.html", "/_astro/site.css"), page("blog/index.html", "/_astro/site-less.css")];
    const f = run(pages, { readCss: (h) => (h === "/_astro/site-less.css" ? ".x{}" : files[h] ?? null) });
    expect(f.join("\n")).toMatch(/control: no blog page loads CSS carrying the blog sentinel/);
  });
  it("fails when the home page carries no site sentinel", () => {
    const pages = [page("index.html", "/_astro/blog-less.css"), page("blog/index.html", "/_astro/blog.css")];
    const f = run(pages, { readCss: (h) => (h === "/_astro/blog-less.css" ? ".y{}" : files[h] ?? null) });
    expect(f.join("\n")).toMatch(/control: the home page's CSS carries no site sentinel/);
  });
});
