import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LIVE_INDEX, blogAddresses, builtUrls, liveUrls, locs, missingAddresses, run } from "./check-stable-addresses.mjs";

const S = "https://twiceover.io";
const sitemap = (...paths) => `<?xml version="1.0"?><urlset>${paths.map((p) => `<url><loc>${S}${p}</loc><lastmod>2026-10-11</lastmod></url>`).join("")}</urlset>`;
const index = (...files) => `<sitemapindex>${files.map((f) => `<sitemap><loc>${S}/${f}</loc></sitemap>`).join("")}</sitemapindex>`;

describe("missingAddresses", () => {
  it("is empty when every live blog address is still built, with or without a trailing slash", () => {
    expect(missingAddresses([`${S}/blog/a/`, `${S}/blog/b/`], [`${S}/blog/a`, `${S}/blog/b/`, `${S}/blog/new/`])).toEqual([]);
  });
  it("names a removed address and a renamed one", () => {
    expect(missingAddresses([`${S}/blog/a/`, `${S}/blog/b/`], [`${S}/blog/a/`, `${S}/blog/b-renamed/`])).toEqual([`${S}/blog/b`]);
  });
  it("looks only at the blog: a site page that moved is not this check's concern, and a foreign host is ignored", () => {
    expect(missingAddresses([`${S}/pricing/`, "https://evil.example/blog/x/"], [])).toEqual([]);
    expect(blogAddresses(["https://evil.example/blog/x/", `${S}/blog/ok/`])).toEqual([`${S}/blog/ok`]);
  });
});

describe("liveUrls", () => {
  const pages = (map) => async (u) => {
    if (!(u in map)) throw new Error("404");
    return map[u];
  };
  const noWait = { wait: async () => {} };
  it("follows the index to its child sitemaps", async () => {
    const urls = await liveUrls(pages({ [LIVE_INDEX]: index("sitemap-0.xml"), [`${S}/sitemap-0.xml`]: sitemap("", "/blog/a/") }), noWait);
    expect(urls).toEqual([S, `${S}/blog/a/`]);
  });
  it("does not follow a child sitemap on another host", async () => {
    const evil = `<sitemapindex><sitemap><loc>https://evil.example/s.xml</loc></sitemap></sitemapindex>`;
    await expect(liveUrls(pages({ [LIVE_INDEX]: evil }), noWait)).rejects.toThrow(/home page/);
  });
  it("fails on a 200 that is not a sitemap, an empty child, an index over the cap, and a sitemap without the home page", async () => {
    await expect(liveUrls(pages({ [LIVE_INDEX]: "<html>maintenance</html>" }), noWait)).rejects.toThrow(/not with a sitemap/);
    await expect(liveUrls(pages({ [LIVE_INDEX]: index("a.xml"), [`${S}/a.xml`]: "" }), noWait)).rejects.toThrow(/not with a sitemap/);
    const many = Array.from({ length: 21 }, (_, i) => `s${i}.xml`);
    await expect(liveUrls(pages({ [LIVE_INDEX]: index(...many) }), noWait)).rejects.toThrow(/lists 21 sitemaps/);
    await expect(liveUrls(pages({ [LIVE_INDEX]: index("a.xml"), [`${S}/a.xml`]: sitemap("/blog/a/") }), noWait)).rejects.toThrow(/home page/);
  });
  it("retries a failed read, then fails rather than passing", async () => {
    let n = 0;
    const flaky = async (u) => {
      if (++n < 3) throw new Error("boom");
      return sitemap("", "/blog/a/");
    };
    expect(await liveUrls(flaky, noWait)).toEqual([S, `${S}/blog/a/`]);
    await expect(liveUrls(async () => { throw new Error("down"); }, noWait)).rejects.toThrow(/after 3 tries/);
  });
});

describe("builtUrls", () => {
  const files = { "d/sitemap-index.xml": index("sitemap-0.xml"), "d/sitemap-0.xml": sitemap("/blog/a/") };
  it("reads the built index and the sitemaps it lists", () => {
    expect(builtUrls("d", (p) => files[p], (p) => p in files)).toEqual([`${S}/blog/a/`]);
  });
  it("fails when the index or a listed sitemap is missing", () => {
    expect(() => builtUrls("d", (p) => files[p], () => false)).toThrow(/build first/);
    expect(() => builtUrls("d", (p) => files[p], (p) => p === "d/sitemap-index.xml")).toThrow(/does not exist/);
  });
});

describe("locs", () => {
  it("reads <loc> values only", () => {
    expect(locs("<a><loc> https://x/ </loc></a><b>not a loc</b>")).toEqual(["https://x/"]);
  });
});

describe("run: the exit code", () => {
  const dist = mkdtempSync(join(tmpdir(), "stable-"));
  writeFileSync(join(dist, "sitemap-index.xml"), index("sitemap-0.xml"));
  writeFileSync(join(dist, "sitemap-0.xml"), sitemap("", "/blog/a/"));
  const live = (...paths) => async (u) => (u === LIVE_INDEX ? index("sitemap-0.xml") : sitemap("", ...paths));
  const wait = async () => {};
  const quiet = async (f) => {
    const log = console.log, err = console.error;
    console.log = console.error = () => {};
    try {
      return await f();
    } finally {
      console.log = log;
      console.error = err;
    }
  };
  it("fails (the CLI exits 1) when the live sitemap cannot be read", async () => {
    await expect(quiet(() => run(dist, { fetchText: async () => { throw new Error("down"); }, wait }))).rejects.toThrow(/after 3 tries/);
  });
  it("exits 0 for a readable sitemap with no blog address, and for one whose addresses are all still built", async () => {
    expect(await quiet(() => run(dist, { fetchText: live(), wait }))).toBe(0);
    expect(await quiet(() => run(dist, { fetchText: live("/blog/a/"), wait }))).toBe(0);
  });
  it("exits 1 when a live address is missing from the build", async () => {
    expect(await quiet(() => run(dist, { fetchText: live("/blog/a/", "/blog/gone/"), wait }))).toBe(1);
  });
});
