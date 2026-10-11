/**
 * The blog, built. Renders the fixture posts (test-fixtures/blog) through the real templates, routes, feed and
 * sitemap, then runs the real gates over the output. This is where "every template renders, and every gate
 * sees a real page" is proved, because production carries no post until the first one is written.
 *
 * The build writes to a temp folder (`--outDir`), never to dist/, and only ever reads the fixture folder.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const astro = join(root, "node_modules/astro/astro.js");

function build(env) {
  const out = mkdtempSync(join(tmpdir(), "blog-build-"));
  const tokens = spawnSync(process.execPath, ["scripts/build-tokens.mjs"], { cwd: root, encoding: "utf8" });
  if (tokens.status !== 0) throw new Error(tokens.stderr);
  const scripts = spawnSync(process.execPath, ["scripts/build-blog-scripts.mjs"], { cwd: root, encoding: "utf8" });
  if (scripts.status !== 0) throw new Error(scripts.stderr);
  const r = spawnSync(process.execPath, [astro, "build", "--outDir", out], { cwd: root, env: { ...process.env, ...env }, encoding: "utf8", timeout: 120000 });
  if (r.status !== 0) throw new Error(`astro build failed:\n${r.stdout}\n${r.stderr}`);
  return out;
}
const read = (dir, p) => readFileSync(join(dir, p), "utf8");
const dom = (dir, p) => new JSDOM(read(dir, p)).window.document;
const node = (script, ...args) => spawnSync(process.execPath, [join(root, script), ...args], { cwd: root, encoding: "utf8" });

const FIXTURE = { BLOG_CONTENT_DIR: "test-fixtures/blog", BLOG_NOW: "2026-10-10T12:00:00Z" };
let dist;
beforeAll(() => {
  dist = build(FIXTURE);
}, 150000);

describe("the routes the date gate leaves", () => {
  it("builds the index, every published post, a page per subject that has a post and the feed; the future post has none of them", () => {
    for (const p of ["blog/index.html", "blog/feed.xml", "blog/first-fixture-post/index.html", "blog/second-fixture-post/index.html", "blog/third-fixture-post/index.html", "blog/fourth-fixture-post/index.html", "blog/topic/option-math/index.html", "blog/topic/policy-geopolitics/index.html", "blog/topic/market-plumbing/index.html", "blog/topic/risk-sizing-behaviour/index.html"]) {
      expect.soft(existsSync(join(dist, p)), p).toBe(true);
    }
    expect.soft(existsSync(join(dist, "blog/future-fixture-post")), "future post page").toBe(false);
    expect.soft(existsSync(join(dist, "blog/topic/earnings")), "a subject with only a future post").toBe(false);
    expect.soft(existsSync(join(dist, "blog/page/2")), "no second page of four posts").toBe(false);
  });
  it("shows the future post nowhere: not in a page, the feed or the sitemap", () => {
    const all = ["blog/index.html", "blog/feed.xml", "sitemap-0.xml", "blog/first-fixture-post/index.html"].map((p) => read(dist, p)).join("\n");
    expect(all).not.toContain("future-fixture-post");
    expect(all).not.toContain("must not appear");
  });
});

describe("a post page", () => {
  const doc = () => dom(dist, "blog/first-fixture-post/index.html");

  it("has one h1, the headline, and real h2 sections; the nameplate is not a heading", () => {
    const d = doc();
    expect.soft([...d.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["The stock jumped 4% and this call lost 21% of its value"]);
    expect.soft(d.querySelectorAll("article h2").length).toBeGreaterThanOrEqual(2);
    expect.soft(d.querySelector(".bar h1, .bar h2")).toBeNull();
  });
  it("titles itself headline plus the site name, and carries canonical, og:locale, article type and the feed link", () => {
    const d = doc();
    expect.soft(d.title).toBe("The stock jumped 4% and this call lost 21% of its value — TwiceOver");
    expect.soft(d.querySelector('link[rel="canonical"]').href).toBe("https://twiceover.io/blog/first-fixture-post");
    expect.soft(d.querySelector('meta[property="og:locale"]').content).toBe("en_US");
    expect.soft(d.querySelector('meta[property="og:type"]').content).toBe("article");
    expect.soft(d.querySelector('link[rel="alternate"][type="application/rss+xml"]').getAttribute("href")).toBe("/blog/feed.xml");
    expect.soft(d.documentElement.lang).toBe("en-US");
  });
  it("carries one BlogPosting block whose dates are the visible dates, as the same New York instants", () => {
    const d = doc();
    const blocks = [...d.querySelectorAll('script[type="application/ld+json"]')];
    expect(blocks).toHaveLength(1);
    const ld = JSON.parse(blocks[0].textContent);
    expect.soft(ld["@type"]).toBe("BlogPosting");
    expect.soft(ld.headline).toBe(d.querySelector("h1").textContent);
    expect.soft(ld.datePublished).toBe("2026-10-09T07:00:00-04:00");
    const time = d.querySelector(".meta time");
    expect.soft(time.getAttribute("datetime")).toBe(ld.datePublished);
    expect.soft(time.textContent).toBe("Fri 9 Oct 2026 · 07:00 New York");
    expect.soft(d.querySelectorAll("script").length, "no script other than the data block").toBe(1);
  });
  it("shows Updated, and a dateModified that differs, only for the post with an updatedAt", () => {
    const edited = dom(dist, "blog/second-fixture-post/index.html");
    const ld = JSON.parse(edited.querySelector('script[type="application/ld+json"]').textContent);
    expect.soft(edited.querySelector(".meta").textContent).toContain("Updated");
    expect.soft(ld.dateModified).toBe("2026-10-08T09:30:00-04:00");
    expect.soft(ld.dateModified).not.toBe(ld.datePublished);
    expect.soft(doc().querySelector(".meta").textContent).not.toContain("Updated");
  });
  it("prints the picture as a real image with its text description, source and licence", () => {
    const d = dom(dist, "blog/second-fixture-post/index.html");
    const img = d.querySelector("figure.photo img");
    expect.soft(img.getAttribute("src")).toBe("/blog-images/fixture-photo.png");
    expect.soft(img.getAttribute("alt")).toBe("A tanker at a loading dock at dusk");
    expect.soft(d.querySelector("figure.photo figcaption").textContent).toMatch(/Source TwiceOver · Licence Own work/);
    expect.soft(doc().querySelector("figure"), "a post with no image has no figure").toBeNull();
  });
  it("ends with the pinned door: GET /go/try, ticker plus three hidden fields, the slug as campaign, and the full disclaimer once", () => {
    const d = doc();
    const form = d.querySelector("form");
    expect.soft(form.method).toBe("get");
    expect.soft(form.getAttribute("action")).toBe("/go/try");
    expect.soft([...form.querySelectorAll("input")].map((i) => i.name)).toEqual(["ticker", "utm_source", "utm_medium", "utm_campaign"]);
    expect.soft(form.querySelector('[name="utm_campaign"]').value).toBe("first-fixture-post");
    const disclaimer = readFileSync(join(root, "src/content/disclaimer.txt"), "utf8").trim().replace(/\s+/g, " ");
    expect.soft(d.body.textContent.replace(/\s+/g, " ").split(disclaimer).length - 1).toBe(1);
  });
  it("links to the post before it and to Keep reading rows with no date", () => {
    const d = doc();
    expect.soft(d.querySelector(".pnav a").getAttribute("href")).toMatch(/^\/blog\/[a-z-]+$/);
    const rel = d.querySelector(".wall.rel");
    expect.soft(rel.querySelectorAll("a.tile").length).toBeGreaterThan(0);
    expect.soft(rel.querySelector(".t-date"), "a row linking to other posts carries no date").toBeNull();
  });
  it("wears its own theme and preloads its display face", () => {
    const d = doc();
    expect.soft(d.querySelector("article").getAttribute("data-look")).toBe("blueprint");
    expect.soft(d.querySelector('link[rel="preload"][as="font"][href="/fonts/bricolage-grotesque-latin-opsz-normal.woff2"]')).not.toBeNull();
    expect.soft(dom(dist, "blog/third-fixture-post/index.html").querySelector("article").getAttribute("data-look")).toBe("newsprint");
  });
});

describe("the game page", () => {
  const game = () => dom(dist, "blog/play/coin/index.html");
  it("is built when a post is published, and carries the one reviewed block script and no inline script", () => {
    const d = game();
    expect.soft([...d.querySelectorAll("script")].map((s) => s.getAttribute("src"))).toEqual(["/js/blog-coin.js"]);
    expect.soft(d.querySelector("h1").textContent).toBe("The 60% coin");
    expect.soft(d.querySelector("article").getAttribute("data-look")).toBe("neon");
    expect.soft(d.querySelector(".meta").textContent).toContain("Updated");
    expect.soft(d.querySelector('link[rel="canonical"]').href).toBe("https://twiceover.io/blog/play/coin");
  });
  it("serves everything the script reveals: the six bars, legend, lesson, study panel and the middle-game line, as text", () => {
    const d = game();
    expect.soft(d.querySelectorAll("[data-bars] .sb[data-f]")).toHaveLength(6);
    expect.soft(d.querySelector("[data-line]").textContent).toMatch(/^Betting 20% on every flip hit the cap in \d+% of games and went bust in \d+%\. The middle game ended at \$\d+(\.\d\d)?\.$/);
    expect.soft(d.querySelectorAll(".heat tbody tr")).toHaveLength(6);
    expect.soft(d.querySelector(".teach").textContent).toContain("went bust");
    expect.soft(d.querySelector(".study").textContent).toContain("Haghani and Dewey, 2016");
    expect.soft(d.querySelector("[data-controls] p.cap").textContent).toBe("Your game: your stack after each flip.");
    expect.soft(d.querySelector("[data-all] .stamp").textContent, "the as-of date comes from the page's updatedAt").toContain("As of 11 Oct 2026");
    expect.soft(d.querySelector("[data-controls]").hasAttribute("hidden"), "controls wait for script").toBe(true);
    expect.soft(d.querySelector("[data-all]").hasAttribute("hidden"), "the bars show with script off").toBe(false);
  });
  it("is linked from the bar of every blog page and is in the sitemap", () => {
    expect.soft(dom(dist, "blog/first-fixture-post/index.html").querySelector('.nav a[href="/blog/play/coin"]')).not.toBeNull();
    expect.soft(read(dist, "sitemap-0.xml")).toContain("https://twiceover.io/blog/play/coin");
  });
});

describe("the index and a subject page", () => {
  it("makes the nameplate the h1 on the index and the filter's name the h1 on a subject page", () => {
    const idx = dom(dist, "blog/index.html");
    expect.soft([...idx.querySelectorAll("h1")].map((h) => h.textContent.replace(/\s+/g, " "))).toEqual(["TwiceOver Blog"]);
    const sub = dom(dist, "blog/topic/option-math/index.html");
    expect.soft([...sub.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Option math that surprises"]);
    expect.soft(sub.querySelector("p.nm")).not.toBeNull();
    expect.soft(sub.title).toBe("Option math that surprises — TwiceOver Blog");
  });
  it("lists published posts newest first with their dates, marks the pressed filter, and prints no form", () => {
    const idx = dom(dist, "blog/index.html");
    const hrefs = [...idx.querySelectorAll(".wall a.tile")].map((a) => a.getAttribute("href"));
    expect.soft(hrefs).toEqual(["/blog/first-fixture-post", "/blog/second-fixture-post", "/blog/third-fixture-post", "/blog/fourth-fixture-post"]);
    expect.soft(idx.querySelector(".tile .t-date").textContent).toBe("Fri 9 Oct 2026");
    expect.soft(idx.querySelector(".filt a[aria-current]").textContent).toBe("All");
    expect.soft(dom(dist, "blog/topic/option-math/index.html").querySelector(".filt a[aria-current]").textContent).toBe("Option math that surprises");
    expect.soft(idx.querySelectorAll("form").length).toBe(0);
    expect.soft(idx.querySelector(".tile.lead")).not.toBeNull();
  });
  it("numbers posts in publish order, oldest first", () => {
    const idx = dom(dist, "blog/index.html");
    expect(idx.querySelector('a[href="/blog/fourth-fixture-post"] .t-no').textContent).toBe("No. 001");
    expect(idx.querySelector('a[href="/blog/first-fixture-post"] .t-no').textContent).toBe("No. 004");
  });
});

describe("the feed and the sitemap", () => {
  it("lists the four published posts newest first, with the one description", () => {
    const feed = read(dist, "blog/feed.xml");
    const links = [...feed.matchAll(/<item><title>[^<]*<\/title><link>([^<]+)<\/link>/g)].map((m) => m[1]);
    expect.soft(links).toEqual(["first", "second", "third", "fourth"].map((n) => `https://twiceover.io/blog/${n}-fixture-post`));
    expect.soft(feed).toContain("<pubDate>Fri, 09 Oct 2026 11:00:00 GMT</pubDate>");
  });
  it("gives each post its true last-changed instant and emits no priority or changefreq", () => {
    const xml = read(dist, "sitemap-0.xml");
    const lastmod = (slug) => new RegExp(`<loc>https://twiceover.io/blog/${slug}</loc><lastmod>([^<]+)</lastmod>`).exec(xml)?.[1];
    expect.soft(Date.parse(lastmod("first-fixture-post"))).toBe(Date.parse("2026-10-09T07:00:00-04:00"));
    expect.soft(Date.parse(lastmod("second-fixture-post")), "updatedAt, not publishAt").toBe(Date.parse("2026-10-08T09:30:00-04:00"));
    expect.soft(xml).not.toMatch(/<priority>|<changefreq>/);
    expect.soft(xml).toContain("<loc>https://twiceover.io/blog/topic/option-math</loc>");
  });
});

describe("the gates over the built fixture site", () => {
  it("passes the content gate, which reads every page, the door and the markup rules", () => {
    const r = node("ci/check-content.mjs", "--dist", dist, "--content", join(root, "test-fixtures/blog"));
    expect(r.stderr + r.stdout).toMatch(/Content check passed/);
    expect(r.status).toBe(0);
  });
  it("passes the entry-box security gate, which holds blog pages to the fixed script list with no per-page row", () => {
    const r = node("ci/check-entry-box.mjs", "--dist", dist);
    expect(r.stdout + r.stderr).toMatch(/Entry box security check passed: \d+ built page/);
    expect(r.status).toBe(0);
  });
  it("passes the isolation gate, with blog pages present so its blindness controls run", () => {
    const r = node("ci/blog-isolation.mjs", "--dist", dist);
    expect(r.stdout).toMatch(/Blog isolation check passed: \d+ site page\(s\) carry no blog styles; 10 blog page\(s\)/);
    expect(r.status).toBe(0);
  });
  it("fails the isolation gate when a site page is made to load the blog's stylesheet (known positive)", () => {
    const copy = mkdtempSync(join(tmpdir(), "blog-iso-"));
    cpSync(dist, copy, { recursive: true });
    const blogCss = /href="(\/_astro\/[^"]+\.css)"/.exec(read(copy, "blog/index.html"))[1];
    const terms = read(copy, "terms/index.html").replace("</head>", `<link rel="stylesheet" href="${blogCss}"></head>`);
    writeFileSync(join(copy, "terms/index.html"), terms);
    const r = node("ci/blog-isolation.mjs", "--dist", copy);
    expect.soft(r.status).toBe(1);
    expect.soft(r.stderr).toContain("terms/index.html: a page outside /blog loads the blog's styles");
  });
  it("fails the content gate when a post page gains an inline script (known positive)", () => {
    const copy = mkdtempSync(join(tmpdir(), "blog-content-"));
    cpSync(dist, copy, { recursive: true });
    const p = "blog/first-fixture-post/index.html";
    writeFileSync(join(copy, p), read(copy, p).replace("</body>", "<script>alert(1)</script></body>"));
    const r = node("ci/check-content.mjs", "--dist", copy, "--content", join(root, "test-fixtures/blog"));
    expect.soft(r.status).toBe(1);
    expect.soft(r.stderr).toContain("inline script");
  });
});

describe("a build with no published post", () => {
  it("has no /blog, no feed and no blog address in the sitemap, and still passes both gates", () => {
    const empty = build({ BLOG_CONTENT_DIR: "test-fixtures/blog", BLOG_NOW: "2020-01-01T00:00:00Z" });
    expect.soft(existsSync(join(empty, "blog")), "blog folder").toBe(false);
    expect.soft(read(empty, "sitemap-0.xml")).not.toContain("/blog");
    expect.soft(node("ci/check-content.mjs", "--dist", empty, "--content", join(root, "test-fixtures/blog")).status).toBe(0);
    expect.soft(node("ci/blog-isolation.mjs", "--dist", empty).status).toBe(0);
  }, 150000);
});
