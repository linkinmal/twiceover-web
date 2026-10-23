/**
 * The blog, built. Renders the fixture posts (test-fixtures/blog) through the real templates, routes, feed and
 * sitemap, then runs the real gates over the output. This is where "every template renders, and every gate
 * sees a real page" is proved, because production carries no post until the first one is written.
 *
 * The build writes to a temp folder (`--outDir`), never to dist/, and only ever reads the fixture folder.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { DEGRADED_FAR_LINE, EXMP_OUTLOOK } from "../src/charts/exmp-fixture.mjs";

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

  it("ends with the Sources line above the end block: a plain paragraph, the names comma-separated, a link only where the post gave one, no fold and no script (#4286)", () => {
    const d = doc();
    const line = d.querySelector("p.srcs");
    expect.soft(line?.textContent?.replace(/\s+/g, " ").trim()).toBe("Sources Brady Report 1988, NYSE");
    expect.soft(line?.querySelector(".srcs-l")?.textContent).toBe("Sources");
    expect.soft([...(line?.querySelectorAll("a") ?? [])].map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("rel")])).toEqual([["Brady Report 1988", "https://archive.org/details/reportofpresiden01unit", "noopener noreferrer"]]);
    expect.soft(line?.closest("details"), "not a fold").toBeNull();
    expect.soft(line?.querySelector("script")).toBeNull();
    expect.soft(d.querySelectorAll("p.srcs").length, "one line").toBe(1);
    const end = d.querySelector("section.endblk");
    expect.soft(line && end && (line.compareDocumentPosition(end) & 4) !== 0, "the line comes before the end block").toBe(true);
    expect.soft(line?.closest("article.post"), "inside the post").not.toBeNull();
  });

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
  it("names its own share card as the page image, in og:image, twitter:image and the structured data (ADR 1088 Decision 4)", () => {
    for (const slug of ["first-fixture-post", "second-fixture-post", "third-fixture-post", "fourth-fixture-post"]) {
      const d = dom(dist, `blog/${slug}/index.html`);
      const card = `https://twiceover.io/blog-share/${slug}.png`;
      expect.soft(d.querySelector('meta[property="og:image"]').content, `${slug} og:image`).toBe(card);
      expect.soft(d.querySelector('meta[name="twitter:image"]').content, `${slug} twitter:image`).toBe(card);
      expect.soft(JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent).image, `${slug} JSON-LD`).toBe(card);
    }
    // the index and the other list pages keep the site's rotating card
    expect.soft(dom(dist, "blog/index.html").querySelector('meta[property="og:image"]').content).toBe("https://twiceover.io/og-card-path.png");
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
    expect.soft([...d.querySelectorAll("[data-bars] .sb[data-f] .n")].map((n) => /^\d+% cap · \d+% bust$/.test(n.textContent)), "each bar's figures are text").toEqual(Array(6).fill(true));
    expect.soft(d.querySelectorAll("details"), "nothing is folded").toHaveLength(0);
    expect.soft(d.querySelectorAll("table"), "the kit has no table of the bars").toHaveLength(0);
    expect.soft(d.querySelector(".teach").textContent).toContain("went bust");
    expect.soft(d.querySelector(".study").textContent).toContain("Haghani and Dewey, arXiv 1701.01427");
    expect.soft(d.querySelector("[data-controls] p.cap").textContent).toBe("Your game: your balance after each flip.");
    expect.soft(d.querySelector("[data-all] .stamp").textContent, "the as-of date comes from the page's updatedAt").toContain("As of 11 Oct 2026");
    expect.soft(d.querySelector("[data-controls]").hasAttribute("hidden"), "controls wait for script").toBe(true);
    expect.soft(d.querySelector("[data-all]").hasAttribute("hidden"), "the bars show with script off").toBe(false);
  });
  it("is in the sitemap, and the bar's Games and tools opens the hub, not this page", () => {
    expect.soft(dom(dist, "blog/first-fixture-post/index.html").querySelector('.nav a[href="/blog/play"]').textContent).toBe("Games and tools");
    expect.soft(dom(dist, "blog/first-fixture-post/index.html").querySelector('.nav a[href="/blog/play/coin"]')).toBeNull();
    expect.soft(read(dist, "sitemap-0.xml")).toContain("https://twiceover.io/blog/play/coin");
  });
});

describe("Growth's page copy (blog-site-copy.md)", () => {
  it("opens the door with Analyze a stock: bar button, end-block heading, label and button", () => {
    const d = dom(dist, "blog/first-fixture-post/index.html");
    expect.soft(d.querySelector(".bar .door").textContent).toBe("Analyze a stock \u2192");
    expect.soft(d.querySelector(".e-h").textContent).toBe("Analyze a stock you follow.");
    expect.soft(d.querySelector(".e-form label").textContent).toBe("Analyze a stock in TwiceOver");
    expect.soft(d.querySelector(".e-form button").textContent).toBe("Analyze");
    expect.soft(d.querySelector(".e-p").textContent).toContain("three projected prices");
  });
  it("names the nav Posts, Games and tools, Topics, and the index carries Growth's line", () => {
    const d = dom(dist, "blog/index.html");
    expect.soft([...d.querySelectorAll(".bar .nav a")].map((a) => a.textContent)).toEqual(["Posts", "Games and tools", "Topics"]);
    expect.soft(d.querySelector(".mast .ds").textContent).toBe("What moved in the markets, why it moved, and the math under it. Some posts are games and tools you can try.");
    expect.soft(d.querySelector('meta[name="description"]').content).toBe("What moved in the markets, why it moved, and the math under it. Some posts are games and tools you can try. Informational and educational.");
    expect.soft(d.querySelector("#topics"), "the filter row is the Topics anchor").not.toBeNull();
  });
  it("gives a topic page its own description and a feed with Growth's blurb", () => {
    const d = dom(dist, "blog/topic/option-math/index.html");
    expect.soft(d.querySelector(".mast .ds").textContent).toMatch(/^Why a call option can lose money when the stock rises\./);
    expect.soft(read(dist, "blog/feed.xml")).toContain("What moved in the markets, why it moved, and the math under it. Informational and educational.");
  });
  it("words the coin game for a reader who does not trade: balance, play money, the paper's own figures", () => {
    const d = dom(dist, "blog/play/coin/index.html");
    expect.soft(d.querySelector(".deck").textContent).toContain("$25 in play money");
    expect.soft(d.querySelector(".sim-q").textContent).toBe("How much of your balance do you bet on the next flip?");
    expect.soft(d.querySelector(".teach .big").textContent).toBe("Every bet size faces the same 60% coin. The bars show how 2,000 simulated games ended at each size.");
    expect.soft(d.querySelector(".study").textContent).toContain("28% went bust and were paid nothing");
    expect.soft(d.body.textContent).not.toMatch(/\bstack\b/);
    expect.soft(d.body.textContent, "a cold read took 'what you hold' as stock holdings").toContain("Each flip bets a share of your balance. Heads adds the bet.");
    expect.soft(d.body.textContent).not.toContain("what you hold");
  });
  it("names the post page's All posts link Back to the blog, not the front page", () => {
    const d = dom(dist, "blog/first-fixture-post/index.html");
    expect.soft(d.querySelector('.pnav a[href="/blog"] b').textContent).toBe("Back to the blog");
    expect.soft(d.querySelector(".pnav").textContent).not.toContain("front page");
  });
});

// The two tool pages (blog-handoff.md section 5, kit v3): one column of three open numbered steps. The bundle that
// ships runs against the built page in jsdom, as a browser would, with no network.
const liveTool = (page, script) => {
  const w = new JSDOM(read(dist, page), { runScripts: "outside-only", pretendToBeVisual: true }).window;
  w.Element.prototype.scrollIntoView = () => {};
  w.eval(read(dist, script));
  return w;
};
const norm = (w, sel) => w.document.querySelector(sel).textContent.replace(/\s+/g, " ").trim();
const type = (w, id, v) => {
  const el = w.document.getElementById(id);
  el.value = String(v);
  el.dispatchEvent(new w.Event("input", { bubbles: true }));
};

describe("the overnight call page", () => {
  const PAGE = "blog/tools/overnight-call/index.html";
  const live = () => liveTool(PAGE, "js/blog-overnight-call.js");

  it("is one column of three open steps with the one reviewed script, and works out the opening night in the served HTML", () => {
    const d = dom(dist, PAGE);
    expect.soft([...d.querySelectorAll("script")].map((x) => x.getAttribute("src"))).toEqual(["/js/blog-overnight-call.js"]);
    expect.soft(d.querySelector("article").getAttribute("data-look")).toBe("exhibit");
    expect.soft(d.querySelectorAll("details"), "nothing is folded").toHaveLength(0);
    expect.soft(d.querySelector(".words").textContent).toContain("quoted as a yearly percentage");
    expect.soft([...d.querySelectorAll("h2.lab")].map((h) => h.textContent)).toEqual(["Step 1 · Pick a night", "Step 2 · Change the night", "Step 3 · Change the call"]);
    expect.soft(d.querySelector("[data-head]").textContent).toBe("Stock +4%. Call \u221221%.");
    expect.soft(d.querySelector("[data-sent]").textContent).toContain("Worth $2.46 before and $1.94 the next morning");
    expect.soft(d.querySelector("[data-be]").textContent).toBe("The call is worth $2.46 again if the stock moves +5.1% from its starting price.");
    expect.soft(d.querySelector("[data-night]").textContent).toContain("Overnight the stock rises 4%, implied volatility falls from 80% to 45%, and 1 day passes.");
    expect.soft(d.querySelectorAll("[data-heat] td[role]"), "grid cells are not controls").toHaveLength(0);
    expect.soft(d.querySelectorAll("[data-heat] td[aria-current]")).toHaveLength(1);
    expect.soft(d.querySelectorAll("button.stp"), "no minus and plus buttons").toHaveLength(0);
  });
  it("hides every control until the script runs, and shows the example as a page of its own without it", () => {
    const d = dom(dist, PAGE);
    expect.soft([...d.querySelectorAll("[data-js]")].every((n) => n.hasAttribute("hidden"))).toBe(true);
    expect.soft([...d.querySelectorAll("[data-nojs]")].some((n) => n.hasAttribute("hidden"))).toBe(false);
    const w = live();
    expect.soft([...w.document.querySelectorAll("[data-js]")].some((n) => n.hasAttribute("hidden"))).toBe(false);
    expect.soft([...w.document.querySelectorAll("[data-nojs]")].every((n) => n.hasAttribute("hidden"))).toBe(true);
  });
  it("prints, on first run, exactly what the build served", () => {
    const served = dom(dist, PAGE);
    const w = live();
    for (const s of ["[data-night]", "[data-head]", "[data-sent]", "[data-be]", "[data-why]", "[data-em]", "[data-heat]", "[data-finds]"]) {
      expect.soft(norm(w, s).replace(/\s/g, ""), s).toBe(served.querySelector(s).textContent.replace(/\s/g, ""));
    }
  });
  it("recomputes from the sliders: a quiet night leaves time alone to take the call down", () => {
    const w = live();
    w.document.querySelectorAll(".chip[data-p]")[3].click();
    expect.soft(norm(w, "[data-head]")).toMatch(/^Stock flat\. Call [\u2212-]\d+%\.$/);
    expect.soft(norm(w, "[data-why]")).toContain("Nothing moved. The call still lost");
    expect.soft(norm(w, "[data-fc]")).toBe("\u00b7 2 of 3 found");
    expect.soft(norm(w, "[data-night]")).toContain("the stock does not move, implied volatility stays at 80%");
  });
  it("takes a typed box with a dot or a comma, marks anything else, and keeps the last good result", () => {
    const w = live();
    type(w, "t-k", "104,5");
    expect.soft(w.document.getElementById("t-k").getAttribute("aria-invalid")).toBe("false");
    expect.soft(norm(w, "[data-night]")).toContain("a $104.50 strike");
    const before = norm(w, "[data-sent]");
    type(w, "t-s", "0");
    expect.soft(w.document.getElementById("t-s").getAttribute("aria-invalid")).toBe("true");
    expect.soft(norm(w, "#t-s-x")).toBe("Enter a price above 0.");
    expect.soft(norm(w, "[data-bad]")).toContain("still shows the last numbers that worked");
    expect.soft(norm(w, "[data-sent]"), "the last good result stays").toBe(before);
    type(w, "t-s", "1e2");
    expect.soft(w.document.getElementById("t-s").getAttribute("aria-invalid"), "an exponent is not a plain number").toBe("true");
    type(w, "t-s", "100");
    expect.soft(norm(w, "[data-bad]")).toBe("");
  });
  it("loads a preset into the sliders and marks only the matching chip", () => {
    const w = live();
    w.document.querySelectorAll(".chip[data-p]")[1].click();
    expect.soft(w.document.getElementById("t-m").value).toBe("-6");
    expect.soft(norm(w, "[data-head]")).toMatch(/^Stock \u22126%\./);
    expect.soft([...w.document.querySelectorAll(".chip[data-p]")].map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true", "false", "false"]);
  });
});

describe("a control the script shows is hidden by the stylesheet while it has not run", () => {
  it("has a rule that lets [hidden] beat the layout's own display on every data-js element", () => {
    const css = read(".", "src/styles/blog.css");
    expect(css, "[data-js][hidden] must win over class display rules such as input.rng and .axh").toMatch(/\[data-js\]\[hidden\]\{display:none!important\}/);
  });
});

describe("the option payoff calculator page", () => {
  const PAGE = "blog/tools/option-payoff-calculator/index.html";
  const live = () => liveTool(PAGE, "js/blog-option-payoff-calculator.js");

  it("is one column of three open steps with the one reviewed script and the opening long call in the served HTML", () => {
    const d = dom(dist, PAGE);
    expect.soft([...d.querySelectorAll("script")].map((x) => x.getAttribute("src"))).toEqual(["/js/blog-option-payoff-calculator.js"]);
    expect.soft(d.querySelector("h1").textContent).toBe("The option payoff calculator");
    expect.soft(d.querySelector("article").getAttribute("data-look")).toBe("blueprint");
    expect.soft(d.querySelectorAll("details"), "nothing is folded").toHaveLength(0);
    expect.soft([...d.querySelectorAll("h2.lab")].map((h) => h.textContent)).toEqual(["Step 1 · Pick a structure", "Step 2 · Drag the price", "Step 3 · Change its numbers"]);
    expect.soft(d.querySelector("[data-head]").textContent).toBe("Stock at $110. Profit or loss +$254.");
    expect.soft(d.querySelectorAll("[data-stats] > div"), "three figures").toHaveLength(3);
    expect.soft(d.querySelector("[data-stats]").textContent).toContain("breakeven, where it neither gains nor loses");
    expect.soft(d.querySelectorAll(".six li")).toHaveLength(6);
    expect.soft(d.querySelectorAll(".six button, .six [role=button]"), "the six are for reading").toHaveLength(0);
    expect.soft(d.querySelector("[data-chart]").getAttribute("aria-label")).toContain("Most it can lose $246");
    expect.soft(d.querySelectorAll("button.stp"), "no minus and plus buttons").toHaveLength(0);
    expect.soft(d.querySelector("#po-h").getAttribute("type")).toBe("range");
  });
  it("prints, on first run, exactly what the build served", () => {
    const served = dom(dist, PAGE);
    const w = live();
    for (const s of ["[data-head]", "[data-s1]", "[data-why]", "[data-stats]", "[data-finds]", "[data-desc]"]) {
      expect.soft(norm(w, s).replace(/\s/g, ""), s).toBe(served.querySelector(s).textContent.replace(/\s/g, ""));
    }
  });
  it("picks a structure from a card; a covered call has a ceiling and a cash-secured put shows its cash", () => {
    const w = live();
    w.document.querySelector('[data-cards] [data-k="cc"]').click();
    expect.soft(norm(w, "[data-tt]")).toBe("Covered call");
    expect.soft(norm(w, "#po-sh")).toBe("100");
    expect.soft(norm(w, "[data-stats]")).not.toContain("No limit most it can make");
    w.document.querySelector('[data-cards] [data-k="csp"]').click();
    expect.soft(norm(w, "#po-cash")).toBe("$9,500");
    expect.soft(norm(w, "[data-why]")).toContain("set aside $9,500 in cash");
    expect.soft(w.document.querySelector('[data-cards] [data-k="csp"]').getAttribute("aria-pressed")).toBe("true");
  });
  it("moves the price slider, takes a comma, and marks a bad box while the last good result stays", () => {
    const w = live();
    type(w, "po-h", 90);
    expect.soft(norm(w, "[data-head]")).toContain("Stock at $90.");
    expect.soft(norm(w, "[data-fc]")).toBe("\u00b7 1 of 3 found");
    type(w, "po-P", "2,5");
    expect.soft(w.document.getElementById("po-P").getAttribute("aria-invalid")).toBe("false");
    const before = norm(w, "[data-s1]");
    type(w, "po-K", "abc");
    expect.soft(w.document.getElementById("po-K").getAttribute("aria-invalid")).toBe("true");
    expect.soft(norm(w, "[data-bad]")).toContain("still shows the last numbers that worked");
    expect.soft(norm(w, "[data-s1]")).toBe(before);
  });
  it("offers Calls and Puts for a vertical spread and the put spread changes the answer", () => {
    const w = live();
    w.document.querySelector('[data-cards] [data-k="vs"]').click();
    expect.soft(w.document.querySelector("[data-type]").hasAttribute("hidden")).toBe(false);
    const calls = norm(w, "[data-why]");
    w.document.querySelector('[data-type] [data-vt="p"]').click();
    expect.soft(norm(w, "[data-why]")).toContain("put you bought");
    expect.soft(norm(w, "[data-why]")).not.toBe(calls);
  });
  it("never puts typed text back into the page raw when a structure is picked", () => {
    const w = live();
    type(w, "po-S0", '1"><img src=x onerror=alert(1)>');
    w.document.querySelector('[data-cards] [data-k="lp"]').click();
    expect.soft(w.document.querySelector("[data-in] img"), "no element came from the typed text").toBeNull();
    expect.soft(w.document.getElementById("po-S0").value, "an unreadable box falls back to its default").toBe("100");
    type(w, "po-S0", "120");
    w.document.querySelector('[data-cards] [data-k="lc"]').click();
    expect.soft(w.document.getElementById("po-S0").value, "a readable box is kept").toBe("120");
  });
  it("starts the structure over with its example numbers", () => {
    const w = live();
    type(w, "po-P", "9");
    w.document.querySelector("[data-reset]").click();
    expect.soft(w.document.getElementById("po-P").value).toBe("2.46");
  });
});

describe("a stamp on a dark lesson block", () => {
  it("is set by a rule that outranks the shared .post p.stamp, which is 1.9:1 on the lesson's dark ground (Guess the gap, Designer gate)", () => {
    // Specificity, not order: `.post p.stamp` is (0,2,1), so `.teach .stamp` (0,2,0) lost. Observed live at computed-style level.
    const css = read(".", "src/styles/blog.css");
    expect.soft(css).toMatch(/\.post \.teach p\.stamp\{color:var\(--teachfg\)/);
    // the bold label inside it: .stamp b sets --ink, which in the ticket look is the lesson's own ground (1.00:1)
    expect.soft(css).toMatch(/\.post \.teach p\.stamp b\{color:inherit\}/);
  });
});

describe("the implied move from a straddle page", () => {
  const PAGE = "blog/tools/implied-move-from-a-straddle/index.html";
  const live = () => liveTool(PAGE, "js/blog-implied-move-from-a-straddle.js");

  it("is one column of two open steps with the one reviewed script and the opening example worked out in the served HTML", () => {
    const d = dom(dist, PAGE);
    expect.soft([...d.querySelectorAll("script")].map((x) => x.getAttribute("src"))).toEqual(["/js/blog-implied-move-from-a-straddle.js"]);
    expect.soft(d.querySelector("h1").textContent).toBe("Implied move from a straddle");
    expect.soft(d.querySelector("article").getAttribute("data-look")).toBe("riso");
    expect.soft(d.querySelectorAll("details"), "nothing is folded").toHaveLength(0);
    expect.soft([...d.querySelectorAll("h2.lab")].map((h) => h.textContent.replace(/\s+/g, " ").trim()).filter((t) => t.startsWith("Step"))).toEqual(["Step 1 · Drag the stock price", "Step 2 · Type your own numbers"]);
    expect.soft(d.querySelector("[data-say]").textContent).toBe("The straddle costs $9.00 for a $100.00 stock, so the market is pricing a move of about 9.0%. The stock has to end below $91.00 or above $109.00 for the straddle to make money.");
    expect.soft([...d.querySelectorAll("[data-ans] b")].map((b) => b.textContent)).toEqual(["9.0%", "$91.00 to $109.00", "$9.00"]);
    expect.soft(d.querySelector("[data-res]").textContent).toBe("Stock ends at $100.00: loss $9.00 a share, $900 a contract.");
    expect.soft(d.querySelector("[data-chart]").getAttribute("aria-label")).toContain("The shaded band runs from $91.00 to $109.00");
    expect.soft(d.querySelector("#sd-end").getAttribute("type")).toBe("range");
    expect.soft(d.querySelectorAll("button.stp"), "no minus and plus buttons").toHaveLength(0);
    expect.soft(d.querySelectorAll("input, button").length, "four controls: the slider, the button and two boxes").toBe(4);
    expect.soft(d.body.textContent).toContain("The page takes the strike to be the stock price.");
    expect.soft(d.body.textContent).toContain("This is a hypothetical illustration of option math. It does not predict any stock or option.");
  });
  it("hides every control until the script runs, and shows the example as a page of its own without it", () => {
    const d = dom(dist, PAGE);
    const controls = [...d.querySelectorAll("input, button")];
    expect.soft(controls.every((c) => c.closest("[data-js]")?.hasAttribute("hidden"))).toBe(true);
    expect.soft([...d.querySelectorAll("[data-nojs]")].some((n) => n.hasAttribute("hidden"))).toBe(false);
    const w = live();
    expect.soft([...w.document.querySelectorAll("[data-js]")].some((n) => n.hasAttribute("hidden"))).toBe(false);
    expect.soft([...w.document.querySelectorAll("[data-nojs]")].every((n) => n.hasAttribute("hidden"))).toBe(true);
  });
  it("prints, on first run, exactly what the build served", () => {
    const served = dom(dist, PAGE);
    const w = live();
    for (const s of ["[data-say]", "[data-ans]", "[data-res]", "[data-chart]", "#sd-strad-n"]) {
      expect.soft(norm(w, s).replace(/\s/g, ""), s).toBe(served.querySelector(s).textContent.replace(/\s/g, ""));
    }
    expect.soft(w.document.querySelector("[data-chart]").getAttribute("aria-label")).toBe(served.querySelector("[data-chart]").getAttribute("aria-label"));
  });
  it("moves the result and the handle with the slider, and nothing else", () => {
    const w = live();
    const answer = norm(w, "[data-ans]");
    type(w, "sd-end", 115);
    expect.soft(norm(w, "[data-res]")).toBe("Stock ends at $115.00: gain $6.00 a share, $600 a contract.");
    expect.soft(norm(w, "[data-ans]")).toBe(answer);
    type(w, "sd-end", 109);
    expect.soft(norm(w, "[data-res]")).toBe("Stock ends at $109.00: $0.00 (breakeven).");
  });
  it("takes a dot or a comma, marks a bad box and keeps the last good result", () => {
    const w = live();
    type(w, "sd-stock", "250");
    type(w, "sd-strad", "11,25");
    expect.soft(norm(w, "[data-ans]")).toContain("4.5%");
    expect.soft(norm(w, "[data-ans]")).toContain("$238.75 to $261.25");
    const before = norm(w, "[data-say]");
    type(w, "sd-strad", "250");
    expect.soft(w.document.getElementById("sd-strad").getAttribute("aria-invalid")).toBe("true");
    expect.soft(w.document.querySelector('[data-field="straddle"]').classList.contains("bad")).toBe(true);
    expect.soft(norm(w, "#sd-strad-n")).toBe("Type a price above zero and below the stock price. Showing the last good result.");
    expect.soft(norm(w, "[data-say]"), "the last good result stays").toBe(before);
    type(w, "sd-strad", "1e2");
    expect.soft(w.document.getElementById("sd-strad").getAttribute("aria-invalid"), "an exponent is not a plain number").toBe("true");
    type(w, "sd-stock", "0");
    expect.soft(w.document.getElementById("sd-stock").getAttribute("aria-invalid")).toBe("true");
  });
  it("deals another example from the six, and the typed boxes follow it", () => {
    const w = live();
    w.document.querySelector("[data-another]").click();
    const stock = w.document.getElementById("sd-stock").value;
    const strad = w.document.getElementById("sd-strad").value;
    expect.soft(`${stock}/${strad}`).not.toBe("100.00/9.00");
    expect.soft(["100.00/3.50", "50.00/3.00", "250.00/11.25", "40.00/4.40", "180.00/6.30"]).toContain(`${stock}/${strad}`);
    expect.soft(norm(w, "[data-say]")).toContain(`for a $${stock} stock`);
  });
});

describe("the Guess the gap page", () => {
  const PAGE = "blog/play/guess-the-gap/index.html";
  const live = () => liveTool(PAGE, "js/blog-guess-the-gap.js");

  it("carries the one reviewed script, the first question, all five answers and the lesson in the served HTML", () => {
    const d = dom(dist, PAGE);
    expect.soft([...d.querySelectorAll("script")].map((x) => x.getAttribute("src"))).toEqual(["/js/blog-guess-the-gap.js"]);
    expect.soft(d.querySelector("h1").textContent).toBe("Guess the gap");
    expect.soft(d.querySelector("article").getAttribute("data-look")).toBe("ticket");
    expect.soft(d.querySelectorAll("details"), "nothing is folded").toHaveLength(0);
    expect.soft(d.querySelector("[data-q]").textContent).toBe("How far did the stock move the next day, up or down?");
    expect.soft(d.querySelector("[data-given]").textContent).toMatch(/reported on .*Options had priced a move of \d+\.\d%\.$/);
    expect.soft(d.querySelectorAll("[data-tally] tr"), "a header and five reports").toHaveLength(6);
    expect.soft(d.querySelector("[data-eq]").textContent).toBe("All five answers");
    expect.soft(d.querySelector("[data-lbig]").textContent).toMatch(/^In \d of these 5 reports, the stock moved less than options had priced\.$/);
    expect.soft(d.querySelectorAll("button.stp"), "no minus and plus buttons").toHaveLength(0);
    expect.soft(d.querySelector("#gg-guess").getAttribute("type")).toBe("range");
    expect.soft(d.body.textContent).toContain("Your score is for this visit only. Nothing is saved.");
  });
  it("hides every control until the script runs, offers no copy button or share card, and without script shows the answers", () => {
    const d = dom(dist, PAGE);
    const controls = [...d.querySelectorAll("[data-guess] input, [data-guess] button")];
    expect.soft(controls.length, "the slider, lock, skip, next and play five more").toBe(5);
    expect.soft(controls.filter((c) => !c.closest("[data-js]") && !c.closest("[data-rev]")), "only the reveal's Next is outside a script-only wrapper").toHaveLength(0);
    expect.soft(d.querySelector("[data-rev]").hasAttribute("hidden")).toBe(true);
    expect.soft([...d.querySelectorAll("[data-nojs]")].some((n) => n.hasAttribute("hidden"))).toBe(false);
    expect.soft(d.body.textContent).not.toMatch(/copy|share card/i);
    const w = live();
    expect.soft([...w.document.querySelectorAll("[data-nojs]")].every((n) => n.hasAttribute("hidden"))).toBe(true);
    expect.soft(w.document.querySelector("[data-round]").hasAttribute("hidden")).toBe(false);
  });
  it("prints, on first run, the question the build served", () => {
    const served = dom(dist, PAGE);
    const w = live();
    for (const s of ["[data-q]", "[data-given]", "[data-rno]", "[data-rsc]"]) expect.soft(norm(w, s), s).toBe(served.querySelector(s).textContent.replace(/\s+/g, " ").trim());
  });
  it("plays a guess: the answer, the why sentence and a hit or a miss, then the score and the lesson after the fifth", () => {
    const w = live();
    const click = (sel) => w.document.querySelector(sel).click();
    for (let k = 0; k < 5; k++) {
      type(w, "gg-guess", 5);
      click("[data-lock]");
      expect.soft(norm(w, "[data-ans]")).toMatch(/^It moved (up|down) \d+\.\d%\.$/);
      expect.soft(norm(w, "[data-why]")).toMatch(/^That is (\d+\.\d times|more than|close to|inside) the \d+\.\d% options had priced\. Your guess was \d+\.\d points away(, a hit)?\.$/);
      click("[data-next]");
    }
    expect.soft(norm(w, "[data-rno]")).toBe("Game over");
    expect.soft(norm(w, "[data-eq]")).toBe("Your five guesses");
    expect.soft(w.document.querySelector("[data-end]").hasAttribute("hidden")).toBe(false);
    expect.soft(w.document.querySelector("[data-lesson]").hasAttribute("hidden")).toBe(false);
    click("[data-again]");
    expect.soft(norm(w, "[data-rno]")).toBe("Report 1 of 5");
  });
});

describe("the index and a subject page", () => {
  it("makes the nameplate the h1 on the index and the filter's name the h1 on a subject page", () => {
    const idx = dom(dist, "blog/index.html");
    expect.soft([...idx.querySelectorAll("h1")].map((h) => h.textContent.replace(/\s+/g, " "))).toEqual(["TwiceOver Blog"]);
    const sub = dom(dist, "blog/topic/option-math/index.html");
    expect.soft([...sub.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["How options are priced"]);
    expect.soft(sub.querySelector("p.nm")).not.toBeNull();
    expect.soft(sub.title).toBe("How options are priced — TwiceOver Blog");
  });
  it("lists published posts newest first with their dates, marks the pressed filter, and prints no form", () => {
    const idx = dom(dist, "blog/index.html");
    const hrefs = [...idx.querySelectorAll(".wall a.tile")].map((a) => a.getAttribute("href"));
    expect.soft(hrefs).toEqual(["/blog/first-fixture-post", "/blog/second-fixture-post", "/blog/third-fixture-post", "/blog/fourth-fixture-post"]);
    expect.soft(idx.querySelector(".tile .t-date").textContent).toBe("Fri 9 Oct 2026");
    expect.soft(idx.querySelector(".filt a[aria-current]").textContent).toBe("All");
    expect.soft(dom(dist, "blog/topic/option-math/index.html").querySelector(".filt a[aria-current]").textContent).toBe("How options are priced");
    expect.soft(idx.querySelectorAll("form").length).toBe(0);
    expect.soft(idx.querySelector(".tile.lead")).not.toBeNull();
  });
  it("numbers posts in publish order, oldest first", () => {
    const idx = dom(dist, "blog/index.html");
    expect(idx.querySelector('a[href="/blog/fourth-fixture-post"] .t-no').textContent).toBe("No. 001");
    expect(idx.querySelector('a[href="/blog/first-fixture-post"] .t-no').textContent).toBe("No. 004");
  });
});

describe("the games-and-tools hub and the link map (blog-handoff.md v1.2 section 5.4; blog-site-copy.md v1.3)", () => {
  const hub = () => dom(dist, "blog/play/index.html");
  it("is a list page: the nameplate is a paragraph, then the h1, Growth's description, and no end block, filters or dates", () => {
    const d = hub();
    expect.soft([...d.querySelectorAll("h1")].map((h) => h.textContent)).toEqual(["Games and tools"]);
    expect.soft(d.querySelector("p.nm")).not.toBeNull();
    expect.soft(d.querySelector(".mast .ds").textContent).toBe("Every game and calculator on the blog, in one place.");
    expect.soft(d.title).toBe("Games and tools — TwiceOver Blog");
    expect.soft(d.querySelector('meta[name="description"]').content).toBe("Every game and calculator on the TwiceOver Blog: position sizing, option pricing and payoff at expiration. Informational and educational.");
    expect.soft(d.querySelector(".endblk"), "no end block").toBeNull();
    expect.soft(d.querySelector(".filt"), "no filters").toBeNull();
    expect.soft(d.querySelector(".t-date"), "no dates").toBeNull();
    expect.soft(d.querySelectorAll("script"), "no script at all").toHaveLength(0);
    expect.soft(d.querySelectorAll("footer.foot .disclaimer"), "the full disclaimer, once").toHaveLength(1);
  });
  it("has one whole-row link per game or tool, newest first, each with its label, topic, title, deck and picture", () => {
    const rows = [...hub().querySelectorAll(".wall a.tile")];
    expect.soft(rows.map((a) => a.getAttribute("href"))).toEqual(["/blog/play/guess-the-gap", "/blog/tools/implied-move-from-a-straddle", "/blog/play/coin", "/blog/tools/overnight-call", "/blog/tools/option-payoff-calculator"]);
    expect.soft(rows.map((a) => a.querySelector(".t-no").textContent)).toEqual(["Game", "Tool", "Game", "Tool", "Tool"]);
    expect.soft(rows.map((a) => a.querySelector(".t-topic").textContent)).toEqual(["Earnings", "Earnings", "Risk and position sizing", "How options are priced", "How options are priced"]);
    expect.soft(rows.map((a) => a.querySelector("h2.t-title").textContent)).toEqual(["Guess the gap", "Implied move from a straddle", "The 60% coin", "The overnight call calculator", "The option payoff calculator"]);
    expect.soft(rows[2].querySelector(".t-deck").textContent).toBe("A coin lands heads 60% of the time. You start with $25 in play money and bet on heads every flip. You pick only how much to bet.");
    expect.soft(rows.map((a) => a.querySelector(".t-cell").getAttribute("data-look"))).toEqual(["ticket", "riso", "neon", "exhibit", "blueprint"]);
    for (const a of rows) expect.soft(a.querySelectorAll(".t-cell svg").length, a.getAttribute("href")).toBe(1);
  });
  it("is in the sitemap and is marked as the current page in the bar", () => {
    expect.soft(read(dist, "sitemap-0.xml")).toContain("https://twiceover.io/blog/play</loc>");
    expect.soft(hub().querySelector('.nav a[aria-current="page"]').textContent).toBe("Games and tools");
    expect.soft(dom(dist, "blog/index.html").querySelector(".nav a[aria-current]")).toBeNull();
  });
  it("keeps the full banned-word scan: the content gate classifies it as a blog page, not a post or a list", async () => {
    const { pageKind } = await import("./content-rules.mjs");
    expect.soft(pageKind("blog/play/index.html", ["first-fixture-post"])).toBe("blog");
  });
  it("ends each playable page's More to play strip with a cell that opens the hub, after two other pages: the same topic first, then the newest, then the slug", () => {
    for (const [file, others] of [
      ["blog/play/guess-the-gap/index.html", ["/blog/tools/implied-move-from-a-straddle", "/blog/play/coin"]],
      ["blog/tools/implied-move-from-a-straddle/index.html", ["/blog/play/guess-the-gap", "/blog/play/coin"]],
      ["blog/play/coin/index.html", ["/blog/play/guess-the-gap", "/blog/tools/implied-move-from-a-straddle"]],
      ["blog/tools/overnight-call/index.html", ["/blog/tools/option-payoff-calculator", "/blog/play/guess-the-gap"]],
      ["blog/tools/option-payoff-calculator/index.html", ["/blog/tools/overnight-call", "/blog/play/guess-the-gap"]],
    ]) {
      const cells = [...dom(dist, file).querySelectorAll('.pnav[aria-label="More to play"] a')];
      expect.soft(cells.map((a) => a.getAttribute("href")), file).toEqual([...others, "/blog/play"]);
      expect.soft(cells[2].firstChild.textContent, file).toBe("All");
      expect.soft(cells[2].querySelector("b").textContent, file).toBe("Games and tools");
    }
  });
  it("makes the nameplate two links, TwiceOver to the site and Blog to the blog, on the index, a topic page and the hub", () => {
    for (const [file, sel] of [["blog/index.html", "h1.nm"], ["blog/topic/option-math/index.html", "p.nm"], ["blog/play/index.html", "p.nm"]]) {
      const links = [...dom(dist, file).querySelectorAll(`${sel} a`)];
      expect.soft(links.map((a) => [a.textContent, a.getAttribute("href")]), file).toEqual([["TwiceOver", "/"], ["Blog", "/blog"]]);
    }
  });
  it("puts Follow TwiceOver, X and YouTube above the disclaimer in the footer of every kind of blog page, with no tag on the links", () => {
    for (const file of ["blog/index.html", "blog/first-fixture-post/index.html", "blog/topic/option-math/index.html", "blog/play/index.html", "blog/play/coin/index.html", "blog/tools/overnight-call/index.html"]) {
      const f = dom(dist, file).querySelector("footer.foot");
      expect.soft(f.firstElementChild.className, file).toBe("follow");
      expect.soft(f.firstElementChild.querySelector("span").textContent, file).toBe("Follow TwiceOver");
      const links = [...f.querySelectorAll(".follow a")];
      expect.soft(links.map((a) => [a.textContent, a.getAttribute("href")]), file).toEqual([["X", "https://x.com/twiceover_io"], ["YouTube", "https://www.youtube.com/@twiceover-io"]]);
      expect.soft(links.map((a) => a.getAttribute("aria-label")), file).toEqual(["TwiceOver on X (opens in a new tab)", "TwiceOver on YouTube (opens in a new tab)"]);
      expect.soft(links.map((a) => [a.getAttribute("target"), a.getAttribute("rel")]), file).toEqual([["_blank", "noopener noreferrer"], ["_blank", "noopener noreferrer"]]);
    }
  });
  it("puts no product link in a post body", () => {
    const body = dom(dist, "blog/first-fixture-post/index.html").querySelector(".body");
    expect.soft([...body.querySelectorAll("a")].filter((a) => /twiceover\.io|^\/(?!blog)/.test(a.getAttribute("href") ?? ""))).toHaveLength(0);
  });
});

describe("outbound links from the blog shell (Security ruling, stock-analyst-platform#4235)", () => {
  it("carry no query string and no fragment on any external anchor, and the two follow links are present to prove the scan sees them", () => {
    for (const page of ["blog/index.html", "blog/first-fixture-post/index.html", "blog/topic/option-math/index.html"]) {
      const external = [...dom(dist, page).querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => /^https?:\/\//.test(h) && new URL(h).host !== "twiceover.io");
      expect.soft(external.some((h) => h.startsWith("https://x.com/")), `${page} X follow link`).toBe(true);
      expect.soft(external.some((h) => h.startsWith("https://www.youtube.com/")), `${page} YouTube follow link`).toBe(true);
      for (const h of external) {
        const u = new URL(h);
        expect.soft([u.search, u.hash], `${page} ${h}`).toEqual(["", ""]);
      }
    }
  });
});

describe("the explainer's Outlook picture draws every card folded (stock-analyst-platform#4392, Designer ruling #4388, site-prelaunch.md v2.48)", () => {
  // One build per run: astro builds in this repo share a content store, so a second build file races this one.
  const page = () => read(dist, "how-our-analysis-works/index.html");
  const doc = () => dom(dist, "how-our-analysis-works/index.html");

  it("carries no condition text in any of its three placements: no note element, none of the fixture's note strings", () => {
    const d = doc();
    const html = page();
    expect.soft(d.querySelectorAll(".xp-hz__n").length, "condition elements").toBe(0);
    for (const h of EXMP_OUTLOOK.horizons) {
      expect.soft(typeof h.note === "string" && h.note.length > 0, `${h.key} fixture note exists`).toBe(true);
      expect.soft(html.includes(h.note), `${h.key} note in the page`).toBe(false);
    }
  });

  it("draws no chevron on any card, and the dark far card still reads the product's own degraded line", () => {
    const d = doc();
    const rows = [...d.querySelectorAll(".xp-hzrow")];
    expect.soft(rows.length, "placements").toBe(3);
    const healthy = rows.map((row) => row.querySelectorAll(".xp-hz:not(.xp-hz--dark)").length);
    expect.soft(healthy).toEqual([3, 3, 2]);
    expect.soft(d.querySelectorAll(".xp-hz__ch").length, "chevrons").toBe(0);
    const dark = d.querySelectorAll(".xp-hz--dark");
    expect.soft(dark.length, "dark cards").toBe(1);
    expect.soft(dark[0].querySelector(".xp-hz__deg")?.textContent?.trim()).toBe(DEGRADED_FAR_LINE);
  });

  it("draws EXMP's last month of closes into every Outlook chart on the page (three large, four in cards), up to the TODAY mark", () => {
    const d = doc();
    const charts = [...d.querySelectorAll(".k-chart--desk")];
    expect.soft(charts.length, "desktop charts").toBe(7);
    for (const c of charts) {
      expect.soft(c.getAttribute("aria-label"), "label names the history").toContain("Recent daily closes leading into today");
      expect.soft(c.textContent, "TODAY mark").toContain("TODAY");
    }
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
  it("fails the entry-box gate on a bundle the client files do not derive, and on a page that loads another page's bundle (known positives)", () => {
    const copy = mkdtempSync(join(tmpdir(), "blog-bundles-"));
    cpSync(dist, copy, { recursive: true });
    writeFileSync(join(copy, "js/blog-stray.js"), "void 0;");
    const stray = node("ci/check-entry-box.mjs", "--dist", copy);
    expect.soft(stray.status).toBe(1);
    expect.soft(stray.stderr).toContain("/js/blog-stray.js: built but not derived");
    rmSync(join(copy, "js/blog-stray.js"));
    writeFileSync(join(copy, "js/blog-stray.js.map"), "{}");
    expect.soft(node("ci/check-entry-box.mjs", "--dist", copy).stderr, "any blog-* file in dist/js is held to the list").toContain("/js/blog-stray.js.map: built but not derived");
    rmSync(join(copy, "js/blog-stray.js.map"));
    const p = "blog/play/coin/index.html";
    writeFileSync(join(copy, p), read(copy, p).replace("/js/blog-coin.js", "/js/blog-overnight-call.js"));
    const wrong = node("ci/check-entry-box.mjs", "--dist", copy);
    expect.soft(wrong.status).toBe(1);
    expect.soft(wrong.stderr).toContain("loads /js/blog-overnight-call.js, which is not this page's own bundle");
  });
  it("passes the isolation gate, with blog pages present so its blindness controls run", () => {
    const r = node("ci/blog-isolation.mjs", "--dist", dist);
    expect(r.stdout).toMatch(/Blog isolation check passed: \d+ site page\(s\) carry no blog styles; 15 blog page\(s\)/);
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
    const entry = node("ci/check-entry-box.mjs", "--dist", empty);
    expect.soft(entry.stderr + entry.stdout, "the bundles ship, no playable page does").toMatch(/Entry box security check passed/);
    expect.soft(entry.status).toBe(0);
  }, 150000);
});
