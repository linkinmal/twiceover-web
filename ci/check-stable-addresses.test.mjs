import { describe, expect, it } from "vitest";
import { LIVE_INDEX, blogAddresses, builtUrls, liveUrls, locs, missingAddresses } from "./check-stable-addresses.mjs";

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
    const urls = await liveUrls(pages({ [LIVE_INDEX]: index("sitemap-0.xml"), [`${S}/sitemap-0.xml`]: sitemap("/", "/blog/a/") }), noWait);
    expect(urls).toEqual([`${S}/`, `${S}/blog/a/`]);
  });
  it("does not follow a child sitemap on another host", async () => {
    const evil = `<sitemapindex><sitemap><loc>https://evil.example/s.xml</loc></sitemap></sitemapindex>`;
    expect(await liveUrls(pages({ [LIVE_INDEX]: evil }), noWait)).toEqual([]);
  });
  it("retries a failed read, then fails rather than passing", async () => {
    let n = 0;
    const flaky = async (u) => {
      if (++n < 3) throw new Error("boom");
      return sitemap("/blog/a/");
    };
    expect(await liveUrls(flaky, noWait)).toEqual([`${S}/blog/a/`]);
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
