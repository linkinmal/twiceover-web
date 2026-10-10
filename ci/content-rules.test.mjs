/**
 * The content gate's own mutation tests (ADR 1090 Decisions 9 and 11; Security consults 1089, 1091).
 * Every negative case is a build the gate must refuse, and every positive case beside it proves the
 * refusal is not simply "everything fails": a gate whose only proof is "the current build passes" is
 * unfalsifiable by the gate itself (consult 0811).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PHRASE_FLOOR,
  contentSlugFailures,
  crossPageFailures,
  pageKind,
  postStrings,
  removedAddresses,
  scanPage,
  sitemapLocs,
} from "./content-rules.mjs";

const disclaimer = readFileSync(new URL("../src/content/disclaimer.txt", import.meta.url), "utf8").trim();
const SLUGS = ["why-a-call-loses"];

const door = (slug, { source = "blog", medium = "post", extra = "", action = "/go/try", method = "get", button = '<button type="submit">Read a ticker</button>' } = {}) =>
  `<form method="${method}" action="${action}"><input type="text" name="ticker" maxlength="8" autocomplete="off">` +
  `<input type="hidden" name="utm_source" value="${source}"><input type="hidden" name="utm_medium" value="${medium}">` +
  `<input type="hidden" name="utm_campaign" value="${slug}">${extra}${button}</form>`;

const html = (body, { head = "", disc = disclaimer } = {}) =>
  `<!DOCTYPE html><html lang="en-US"><head><title>t</title>${head}</head><body><main>${body}</main><footer><p>${disc}</p></footer></body></html>`;

const post = (body = "<p>Plain words about options.</p>", slug = "why-a-call-loses", opts = {}) => ({
  rel: `blog/${slug}/index.html`,
  html: html(`<h1>A headline</h1>${body}${opts.noDoor ? "" : door(slug)}`, opts),
});
const scan = (page, extra = {}) => scanPage({ ...page, disclaimer, postSlugs: SLUGS, ...extra });

describe("a clean post, and the pages around it", () => {
  it("passes a post with the pinned door; an ordinary page with no banned word passes too", () => {
    expect.soft(scan(post())).toEqual([]);
    expect.soft(scan({ rel: "pricing/index.html", html: html("<p>Plans.</p>") })).toEqual([]);
  });
});

describe("the banned-term scan leaves a post body and stays everywhere else (Decision 9)", () => {
  it("a bare 'buy' in the privacy page fails; the same word in a post does not", () => {
    const privacy = scan({ rel: "privacy/index.html", html: html("<p>We would buy data.</p>") });
    expect.soft(privacy.some((f) => f.includes("[AC3]") && f.includes('"buy"'))).toBe(true);
    expect.soft(scan(post("<p>Traders often buy the dip and sell the rally; a sell-off is a fall.</p>"))).toEqual([]);
  });

  it("every other ordinary page keeps the full scan: pricing, terms, the home page and the in-app pages", () => {
    for (const rel of ["index.html", "pricing/index.html", "terms/index.html", "refunds/index.html", "404.html", "in-app/terms/index.html"]) {
      const f = scan({ rel, html: html("<p>You should sell now.</p>") });
      expect.soft(f.some((x) => x.includes("[AC3]")), rel).toBe(true);
    }
  });

  it("a game or tool page, and a page under blog/ that is not a post file, keep the full scan", () => {
    for (const rel of ["blog/play/the-60-coin/index.html", "blog/tools/the-overnight-call-calculator/index.html", "blog/not-a-file/index.html"]) {
      const f = scan({ rel, html: html("<h1>x</h1><p>A sell-off.</p>") });
      expect.soft(f.some((x) => x.includes("[AC3]")), rel).toBe(true);
    }
  });

  it("a tool page named like a post route is not a post: only a slug that is a file in the content folder is exempt", () => {
    const f = scan({ rel: "blog/overnight-calc/index.html", html: html("<h1>x</h1><p>buy</p>") }, { postSlugs: ["why-a-call-loses"] });
    expect.soft(f.some((x) => x.includes("[AC3]"))).toBe(true);
    const g = scan({ rel: "blog/overnight-calc/index.html", html: html("<h1>x</h1><p>buy</p>") }, { postSlugs: ["overnight-calc"] });
    expect.soft(g.some((x) => x.includes("[AC3]"))).toBe(false);
  });

  it("the disclaimer check stays on a post: a missing or altered disclaimer fails", () => {
    expect.soft(scan(post("<p>ok</p>", "why-a-call-loses", { disc: "Not the disclaimer." })).some((f) => f.includes("[AC4]"))).toBe(true);
    expect.soft(scan(post("<p>ok</p>", "why-a-call-loses", { disc: disclaimer.replace("Trading involves risk of loss.", "") })).some((f) => f.includes("[AC4]"))).toBe(true);
  });
});

describe("the phrase floor on a post (Decision 9a, 11)", () => {
  it("flags each of the thirteen phrases, in any case", () => {
    expect.soft([...PHRASE_FLOOR]).toEqual([
      "buy now", "sell now", "strong buy", "close your calls", "you should", "we recommend", "you must",
      "you need to", "i recommend", "we advise", "our pick", "go long", "go short",
    ]);
    for (const p of PHRASE_FLOOR) {
      for (const text of [p, p.toUpperCase(), p[0].toUpperCase() + p.slice(1)]) {
        const f = scan(post(`<p>Then ${text} today.</p>`));
        expect.soft(f.some((x) => x.includes("[BLOG-PHRASE]")), text).toBe(true);
      }
    }
  });

  it("sees through the disguises: a non-breaking space, a zero-width character, an entity, a soft hyphen, a tag in the middle, and attribute text", () => {
    const disguised = [
      "<p>buy&nbsp;now</p>",
      "<p>bu\u200By now</p>",
      "<p>buy&#32;now</p>",
      "<p>buy&#x20;now</p>",
      "<p>bu\u00ADy now</p>",
      "<p>buy <b>now</b></p>",
      "<p>we\u00A0recommend</p>",
      "<p>BUY\n\t NOW</p>",
      '<img src="/blog-images/a.png" alt="strong buy">',
      '<p aria-label="sell now">x</p>',
      '<p title="you should">x</p>',
    ];
    for (const body of disguised) {
      expect.soft(scan(post(body)).some((x) => x.includes("[BLOG-PHRASE]")), body).toBe(true);
    }
  });

  it("does not flag the words on their own, and does not read the disclaimer as part of the post", () => {
    expect.soft(scan(post("<p>The buy side, a sell-off, a nowhere, you can see it.</p>"))).toEqual([]);
  });

  it("reads the disclaimer from visible text only: one that sits only in a meta description or alt text does not count", () => {
    const hidden = `<meta name="description" content="${disclaimer}">`;
    const f = scan({ rel: "blog/why-a-call-loses/index.html", html: html("<h1>x</h1>", { head: hidden, disc: "x" }) });
    expect.soft(f.some((x) => x.includes("[AC4]"))).toBe(true);
    const g = scan({ rel: "blog/why-a-call-loses/index.html", html: html(`<h1>x</h1><img src="/blog-images/a.png" alt="${disclaimer}">`, { disc: "x" }) });
    expect.soft(g.some((x) => x.includes("[AC4]"))).toBe(true);
  });

  it("flags the meta description, which a search result shows", () => {
    const f = scan(post("<p>x</p>", "why-a-call-loses", { head: '<meta name="description" content="Close your calls early.">' }));
    expect.soft(f.some((x) => x.includes("[BLOG-PHRASE]"))).toBe(true);
  });
});

describe("the blog index and topic pages: exemption B (Decision 9b, 11)", () => {
  const list = (rel, body) => ({ rel, html: html(`<h1>Posts</h1>${body}`) });

  it("a headline with 'sell-off' passes once its exact title is subtracted; the same word anywhere else on the page fails", () => {
    const strings = ["Why the sell-off was not a surprise"];
    const ok = list("blog/index.html", "<ul><li><a href=\"/blog/why-a-call-loses\">Why the sell-off was not a surprise</a></li></ul>");
    expect.soft(scan(ok, { listStrings: strings })).toEqual([]);
    const stray = list("blog/index.html", "<p>A sell-off.</p>");
    expect.soft(scan(stray, { listStrings: strings }).some((f) => f.includes("[AC3]"))).toBe(true);
    // A title that is not in the list of posts is not exempt.
    expect.soft(scan(ok, { listStrings: [] }).some((f) => f.includes("[AC3]"))).toBe(true);
  });

  it("does not subtract a string short enough to be a single banned word, so one such title cannot excuse the word across the page", () => {
    const f = scan(list("blog/index.html", "<p>Sell</p><p>Sell the dip.</p>"), { listStrings: ["Sell"] });
    expect.soft(f.filter((x) => x.includes("[AC3]")).length).toBeGreaterThan(0);
  });

  it("applies to the index, topic pages and pagination by exact route only", () => {
    const strings = ["A sell-off and what it priced in"];
    const body = "<p>A sell-off and what it priced in</p>";
    for (const rel of ["blog/index.html", "blog/topic/earnings/index.html", "blog/page/2/index.html", "blog/topic/earnings/page/2/index.html"]) {
      expect.soft(scan(list(rel, body), { listStrings: strings }), rel).toEqual([]);
    }
    for (const rel of ["blog/topicality/index.html", "blog/topic/index.html", "blog/page/x/index.html", "blog/play/index.html"]) {
      expect.soft(scan(list(rel, body), { listStrings: strings }).some((f) => f.includes("[AC3]")), rel).toBe(true);
    }
  });

  it("runs the phrase floor on the index too, and still requires the disclaimer", () => {
    const f = scan(list("blog/index.html", "<p>Close your calls.</p>"));
    expect.soft(f.some((x) => x.includes("[BLOG-PHRASE]"))).toBe(true);
    const g = scan({ rel: "blog/index.html", html: html("<h1>Posts</h1>", { disc: "x" }) });
    expect.soft(g.some((x) => x.includes("[AC4]"))).toBe(true);
  });
});

describe("pageKind", () => {
  it("names each route's kind", () => {
    const k = (rel) => pageKind(rel, SLUGS);
    expect.soft(k("blog/why-a-call-loses/index.html")).toBe("post");
    expect.soft(k("blog/index.html")).toBe("list");
    expect.soft(k("blog/topic/earnings/index.html")).toBe("list");
    expect.soft(k("blog/play/x/index.html")).toBe("blog");
    expect.soft(k("blog/tools/x/index.html")).toBe("blog");
    expect.soft(k("blog/unknown/index.html")).toBe("blog");
    expect.soft(k("pricing/index.html")).toBe("other");
    expect.soft(k("blogging/index.html")).toBe("other");
    expect.soft(k("index.html")).toBe("other");
  });
});

describe("markup rules on every blog page (Decision 11)", () => {
  const fails = (page, tag) => scan(page).some((f) => f.includes(`[BLOG-MARKUP]`) && (tag ? f.includes(tag) : true));
  const withBody = (b, kind = "post") =>
    kind === "post"
      ? post(b)
      : { rel: "blog/tools/x/index.html", html: html(`<h1>x</h1>${b}`) };

  it("refuses an inline script, a handler, and the tags that load or redirect: iframe, object, embed, base, meta refresh", () => {
    for (const b of ["<script>1</script>", '<p onclick="x()">a</p>', '<a href="/blog" onmouseover="x">a</a>', '<iframe src="/x"></iframe>', '<object data="/x"></object>', '<embed src="/x">', '<base href="/x">']) {
      expect.soft(fails(withBody(b), ""), b).toBe(true);
      expect.soft(fails(withBody(b, "tool"), ""), `tool: ${b}`).toBe(true);
    }
    expect.soft(fails({ rel: "blog/why-a-call-loses/index.html", html: html("<p>x</p>" + door("why-a-call-loses"), { head: '<meta http-equiv="refresh" content="0;url=/x">' }) })).toBe(true);
  });

  it("allows JSON-LD that is real JSON, and refuses JSON-LD that is not", () => {
    expect.soft(fails(withBody('<script type="application/ld+json">{"@type":"BlogPosting"}</script>'))).toBe(false);
    expect.soft(fails(withBody('<script type="application/ld+json">{oops</script>'))).toBe(true);
    expect.soft(fails(withBody('<script type="text/plain">x</script>'))).toBe(true);
  });

  it("allows a script only from the fixed list, root-relative and same-origin", () => {
    const pageWith = (src) => scanPage({ ...withBody(`<script src="${src}" defer></script>`), disclaimer, postSlugs: SLUGS, allowedScripts: ["/js/blog-guess.js"] });
    expect.soft(pageWith("/js/blog-guess.js")).toEqual([]);
    for (const src of ["/js/other.js", "https://evil.test/a.js", "//evil.test/a.js", "/js/blog-guess.js?x=1", "js/blog-guess.js"]) {
      expect.soft(pageWith(src).some((f) => f.includes("[BLOG-MARKUP]")), src).toBe(true);
    }
    // With the real, empty list, any script is off it.
    expect.soft(fails(withBody('<script src="/js/blog-guess.js"></script>'))).toBe(true);
  });

  it("requires every image source to be root-relative", () => {
    expect.soft(fails(withBody('<img src="/blog-images/a.png" alt="a">'))).toBe(false);
    for (const s of ["https://x.test/a.png", "//x.test/a.png", "data:image/png;base64,AAAA", "a.png", "http://x.test/a.png"]) {
      expect.soft(fails(withBody(`<img src="${s}" alt="a">`)), s).toBe(true);
    }
  });

  it("requires every link to be https, root-relative or a fragment, and an external link to carry noopener noreferrer", () => {
    for (const h of ["/blog/x", "#section", "https://example.org/x"]) {
      expect.soft(fails(withBody(`<a href="${h}" ${h.startsWith("https") ? 'rel="noopener noreferrer"' : ""}>a</a>`)), h).toBe(false);
    }
    for (const h of ["http://example.org/x", "javascript:alert(1)", "//example.org/x", "mailto:a@b.test", "data:text/html,x", "x/y", "JavaScript:alert(1)", " javascript:alert(1)"]) {
      expect.soft(fails(withBody(`<a href="${h}">a</a>`)), h).toBe(true);
    }
    expect.soft(fails(withBody('<a href="https://example.org/x">a</a>'))).toBe(true);
    expect.soft(fails(withBody('<a href="https://example.org/x" rel="noopener">a</a>'))).toBe(true);
    expect.soft(fails(withBody('<a href="https://example.org/x" rel="noreferrer noopener nofollow">a</a>'))).toBe(false);
  });

  it("refuses a backslash after the first slash: browsers read /\\host as //host, an off-site address", () => {
    for (const v of ["/\\evil.test/a.png", "/\\/evil.test/a.png", "/a\\b", "\\evil.test", "/\\\\evil.test/x"]) {
      expect.soft(fails(withBody(`<img src="${v}" alt="a">`)), `img ${v}`).toBe(true);
      expect.soft(fails(withBody(`<img src="/blog-images/a.png" srcset="${v} 2x" alt="a">`)), `srcset ${v}`).toBe(true);
      expect.soft(fails(withBody(`<a href="${v}">a</a>`)), `a ${v}`).toBe(true);
    }
    // A tab or newline inside the URL is stripped by browsers, so "/<tab>/host" is "//host" too.
    for (const v of ["/\t/evil.test/x", "/\n/evil.test/x"]) expect.soft(fails(withBody(`<a href="${v}">a</a>`)), JSON.stringify(v)).toBe(true);
  });

  it("holds <link> to root-relative or this site's own address", () => {
    const head = (h) => ({ rel: "blog/why-a-call-loses/index.html", html: html("<h1>x</h1>" + door("why-a-call-loses"), { head: `<link rel="x" href="${h}">` }) });
    for (const h of ["/blog/feed.xml", "https://twiceover.io/blog/why-a-call-loses"]) expect.soft(fails(head(h)), h).toBe(false);
    for (const h of ["https://cdn.example.org/a.css", "https://twiceover.io.evil.test/x", "http://twiceover.io/x"]) expect.soft(fails(head(h)), h).toBe(true);
  });

  it("lets a /go/try link carry only the three pinned keys, and no ticker", () => {
    expect.soft(fails(withBody('<a href="/go/try">a</a>'))).toBe(false);
    expect.soft(fails(withBody('<a href="/go/try?utm_source=blog&amp;utm_medium=post&amp;utm_campaign=why-a-call-loses">a</a>'))).toBe(false);
    for (const href of ["/go/try/?ticker=AAPL", "/go/try//?ticker=AAPL", "/go/try/?x=1"]) expect.soft(fails(withBody(`<a href="${href}">a</a>`)), href).toBe(true);
    expect.soft(fails(withBody('<a href="/go/try/">a</a>'))).toBe(false);
    for (const q of ["?ticker=AAPL", "?utm_source=blog&utm_medium=post&utm_campaign=x&ref=1", "?utm_source=BLOG", "?utm_source=blog&utm_source=blog", "?x=1"]) {
      expect.soft(fails(withBody(`<a href="/go/try${q}">a</a>`)), q).toBe(true);
    }
  });
});

describe("the door form (Decision 11; consult 1089 condition 1)", () => {
  const fails = (page) => scan(page).some((f) => f.includes("[BLOG-DOOR]"));
  const slug = "why-a-call-loses";
  const withForm = (form) => ({ rel: `blog/${slug}/index.html`, html: html(`<h1>x</h1>${form}`) });

  it("passes the exact form: method get, action /go/try, ticker plus three hidden literals, one plain submit button", () => {
    expect.soft(fails(withForm(door(slug)))).toBe(false);
    expect.soft(fails(post("<p>x</p>", slug, { noDoor: true }))).toBe(false); // a post need not carry the door
  });

  it("refuses any change to it: method, action, a fifth input, a missing input, a wrong campaign, bad literals, formaction, a named button", () => {
    const cases = {
      "method post": door(slug, { method: "post" }),
      "method missing": door(slug).replace(' method="get"', ""),
      "action elsewhere": door(slug, { action: "/go/other" }),
      "action absolute": door(slug, { action: "https://x.test/go/try" }),
      "fifth input": door(slug, { extra: '<input type="hidden" name="ref" value="x">' }),
      "textarea": door(slug, { extra: "<textarea name=\"q\"></textarea>" }),
      "select": door(slug, { extra: "<select name=\"q\"></select>" }),
      "wrong campaign": door("another-slug"),
      "source with capitals": door(slug, { source: "Blog" }),
      "source too long": door(slug, { source: "x".repeat(33) }),
      "medium with space": door(slug, { medium: "a b" }),
      "formaction": door(slug, { button: '<button type="submit" formaction="/elsewhere">Go</button>' }),
      "formmethod": door(slug, { button: '<button type="submit" formmethod="post">Go</button>' }),
      "named button": door(slug, { button: '<button type="submit" name="go" value="1">Go</button>' }),
      "submit input": door(slug, { button: '<input type="submit" name="go" value="Go">' }),
      "two forms": door(slug) + door(slug),
      "ticker not text": door(slug).replace('type="text" name="ticker"', 'type="hidden" name="ticker"'),
      "utm not hidden": door(slug).replace('type="hidden" name="utm_source"', 'type="text" name="utm_source"'),
      "duplicate name": door(slug, { extra: '<input type="hidden" name="utm_source" value="blog">' }),
    };
    for (const [name, form] of Object.entries(cases)) expect.soft(fails(withForm(form)), name).toBe(true);
  });

  it("refuses a form on any blog page that is not a post, index and topic pages included", () => {
    for (const rel of ["blog/tools/x/index.html", "blog/play/x/index.html", "blog/index.html", "blog/topic/earnings/index.html"]) {
      expect.soft(fails({ rel, html: html(`<h1>x</h1>${door("x")}`) }), rel).toBe(true);
    }
  });

  it("requires the source and medium to be the same literal on every post", () => {
    const a = post("<p>a</p>", "why-a-call-loses");
    const b = { rel: "blog/other-post/index.html", html: html(`<h1>x</h1>${door("other-post")}`) };
    const c = { rel: "blog/third/index.html", html: html(`<h1>x</h1>${door("third", { source: "newsletter" })}`) };
    const m = (pages) => crossPageFailures(pages, ["why-a-call-loses", "other-post", "third"]);
    expect.soft(m([a, b])).toEqual([]);
    expect.soft(m([a, b, c]).length).toBe(1);
    expect.soft(m([a, b, c])[0]).toContain("[BLOG-DOOR]");
    expect.soft(m([a])).toEqual([]);
  });
});

describe("only blog pages meet the blog markup rules; other pages are not this gate's business", () => {
  it("an inline script on the pricing page is the entry-box gate's to catch, not this one", () => {
    expect.soft(scan({ rel: "pricing/index.html", html: html("<p>x</p><script>1</script>") })).toEqual([]);
  });
});

describe("posts must have a valid, unreserved slug (Decision 11)", () => {
  it("fails a file named like a reserved route, a bad slug, or a non-markdown file; passes a good one", () => {
    expect.soft(contentSlugFailures(["why-a-call-loses.md", "earnings-week.md"])).toEqual([]);
    for (const bad of ["tools.md", "topic.md", "page.md", "play.md", "feed.xml.md", "Has-Capital.md", "a_b.md", "post.mdx", "post.markdown", "post.txt", ".md"]) {
      expect.soft(contentSlugFailures([bad]).length, bad).toBe(1);
    }
    expect.soft(contentSlugFailures(["tools.md", "ok.md", "Bad.md"]).length).toBe(2);
  });
});

describe("stable addresses (Decision 1)", () => {
  const xml = (...u) => `<?xml version="1.0"?><urlset>${u.map((x) => `<url><loc>${x}</loc></url>`).join("")}</urlset>`;
  it("reads <loc> entries from a sitemap and reports an address that was live and is gone", () => {
    expect.soft(sitemapLocs(xml("https://twiceover.io/", "https://twiceover.io/blog/a"))).toEqual(["https://twiceover.io/", "https://twiceover.io/blog/a"]);
    const before = sitemapLocs(xml("https://twiceover.io/", "https://twiceover.io/blog/a", "https://twiceover.io/blog/b"));
    expect.soft(removedAddresses(before, sitemapLocs(xml("https://twiceover.io/", "https://twiceover.io/blog/a", "https://twiceover.io/blog/b", "https://twiceover.io/blog/c")))).toEqual([]);
    expect.soft(removedAddresses(before, sitemapLocs(xml("https://twiceover.io/", "https://twiceover.io/blog/a")))).toEqual(["https://twiceover.io/blog/b"]);
    expect.soft(removedAddresses(before, [])).toEqual(["https://twiceover.io/blog/a", "https://twiceover.io/blog/b"]);
  });
  it("only guards the blog: a removed address elsewhere is not this check's concern", () => {
    expect.soft(removedAddresses(["https://twiceover.io/pricing", "https://twiceover.io/blog/a"], ["https://twiceover.io/blog/a"])).toEqual([]);
  });
});

describe("postStrings — the exact title and description strings a list page prints", () => {
  it("reads the h1, the meta description and the page title from a built post", () => {
    const h = html("<h1>Why the sell-off was not a surprise</h1><p>x</p>", { head: '<meta name="description" content="What the options had priced in.">' }).replace("<title>t</title>", "<title>Why the sell-off was not a surprise · TwiceOver Blog</title>");
    expect.soft(postStrings(h)).toEqual(expect.arrayContaining(["Why the sell-off was not a surprise", "What the options had priced in."]));
  });
});
