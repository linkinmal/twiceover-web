#!/usr/bin/env node
/**
 * Blog isolation gate (stock-analyst-platform#4233; ADR 1088 Decision 3; ADR 1005 Amendment 4: the ten looks
 * are for the blog only). Over the BUILT site it fails when:
 *   1. a page outside /blog loads CSS that carries the blog's stylesheet or names a font only the blog loads;
 *   2. a blog page loads CSS that carries the site's (site.css, tokens.css), whose class names would collide
 *      with the blog's.
 * Blindness control: when any blog page exists, at least one of them must load CSS carrying the blog sentinel,
 * and the site's home page must carry the site sentinel, or the scan would pass on nothing. With no blog page
 * (production before the first post) only rule 1 can fail, and it checks every page there is.
 *
 * Pure functions are exported for the tests; the CLI at the bottom reads dist/ (or `--dist <dir>`).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFontFaces } from "./blog-fonts.mjs";

/** The blog stylesheet's own marks: its wrapper, its theme attribute, its texture file. */
export const BLOG_MARKS = ["#blog", "[data-look", "/blog-textures/"];
/** The site stylesheet's own marks: a class and a custom property only site.css / tokens.css define. */
export const SITE_MARKS = [".site-header", "--color-bg-canvas"];

/** Font files and family names that only the blog loads (declared in blog-fonts.css, not in site.css). */
export function blogOnlyFonts(blogFontsCss, siteCss) {
  const site = parseFontFaces(siteCss);
  const siteFiles = new Set(site.map((f) => f.file));
  const siteFamilies = new Set(site.map((f) => f.family));
  const blog = parseFontFaces(blogFontsCss);
  return {
    files: [...new Set(blog.map((f) => f.file).filter((f) => !siteFiles.has(f)))],
    families: [...new Set(blog.map((f) => f.family).filter((f) => !siteFamilies.has(f)))],
  };
}

/** The stylesheet hrefs a page links, and its inline <style> text. */
export function pageStyles(html) {
  const hrefs = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const h = /\bhref\s*=\s*"([^"]*)"|\bhref\s*=\s*'([^']*)'|\bhref\s*=\s*([^\s>]+)/i.exec(tag);
    if (h) hrefs.push(h[1] ?? h[2] ?? h[3]);
  }
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  return { hrefs, inline };
}

const isBlogPage = (rel) => rel.startsWith("blog/");

/**
 * @param {{pages:{rel:string, html:string}[], readCss:(href:string)=>string|null, blogOnly:{files:string[], families:string[]}}} input
 * @returns {string[]}
 */
export function checkIsolation({ pages, readCss, blogOnly }) {
  const failures = [];
  const css = (page) => {
    const { hrefs, inline } = pageStyles(page.html);
    const files = hrefs.map((h) => ({ href: h, text: readCss(h) }));
    for (const f of files) if (f.text === null) failures.push(`[ISOLATION] ${page.rel}: stylesheet ${f.href} was not found in the build`);
    return [...files.map((f) => f.text ?? ""), ...inline].join("\n");
  };
  const blogHits = (text) => [
    ...BLOG_MARKS.filter((m) => text.includes(m)),
    ...blogOnly.families.filter((f) => text.includes(`"${f}"`) || text.includes(`'${f}'`) || new RegExp(`font-family:\\s*${f}\\b`).test(text)),
    ...blogOnly.files.filter((f) => text.includes(`/fonts/${f}.woff2`)),
  ];

  let blogSeen = 0;
  let blogCarriesMark = 0;
  let homeCarriesSite = null;
  for (const page of pages) {
    const text = css(page);
    if (isBlogPage(page.rel)) {
      blogSeen++;
      if (BLOG_MARKS.some((m) => text.includes(m))) blogCarriesMark++;
      const site = SITE_MARKS.filter((m) => text.includes(m));
      if (site.length) failures.push(`[ISOLATION] ${page.rel}: a blog page loads the site's stylesheet (${site.join(", ")})`);
    } else {
      const hits = blogHits(text);
      if (hits.length) failures.push(`[ISOLATION] ${page.rel}: a page outside /blog loads the blog's styles (${[...new Set(hits)].join(", ")})`);
      if (page.rel === "index.html") homeCarriesSite = SITE_MARKS.some((m) => text.includes(m));
    }
  }
  if (blogSeen > 0) {
    if (blogCarriesMark === 0) failures.push("[ISOLATION] control: no blog page loads CSS carrying the blog sentinel, so the scan is blind");
    if (homeCarriesSite === false) failures.push("[ISOLATION] control: the home page's CSS carries no site sentinel, so the scan is blind");
  }
  return failures;
}

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (entry.endsWith(".html")) out.push(p);
  }
  return out;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const i = process.argv.indexOf("--dist");
  const dist = i > -1 ? resolve(process.argv[i + 1]) : join(root, "dist");
  if (!existsSync(dist)) {
    console.error(`FATAL: ${dist} not found — run \`npm run build\` first.`);
    process.exit(1);
  }
  const pages = htmlFiles(dist).map((p) => ({ rel: relative(dist, p).split(sep).join("/"), html: readFileSync(p, "utf8") }));
  const readCss = (href) => {
    if (!href.startsWith("/") || href.startsWith("//")) return "";
    const p = join(dist, href.split("?")[0]);
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  };
  const blogOnly = blogOnlyFonts(readFileSync(join(root, "src/styles/blog-fonts.css"), "utf8"), readFileSync(join(root, "src/styles/site.css"), "utf8"));
  // A font arm that matches nothing would pass on nothing: the blog loads files and families the site does not.
  if (!blogOnly.files.length || !blogOnly.families.length) {
    console.error("FATAL: blog-fonts.css declares no blog-only font file or family, so the font scan is blind.");
    process.exit(1);
  }
  const failures = checkIsolation({ pages, readCss, blogOnly });
  if (failures.length) {
    console.error("BLOG ISOLATION CHECK FAILED:\n");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  const blog = pages.filter((p) => isBlogPage(p.rel)).length;
  console.log(`Blog isolation check passed: ${pages.length - blog} site page(s) carry no blog styles; ${blog} blog page(s) carry no site styles.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
