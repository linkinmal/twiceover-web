import { describe, expect, it } from "vitest";
import { frontMatterTimes, readPostTimes, sitemapSerialize } from "./sitemap.mjs";

const fm = (body) => `---\ntitle: "T"\n${body}\n---\nText\n`;

describe("frontMatterTimes", () => {
  it("reads quoted times, either quote style, and nothing from the body", () => {
    expect.soft(frontMatterTimes(fm('publishAt: "2026-10-12T07:00:00-04:00"\nupdatedAt: \'2026-10-13T09:00:00-04:00\''))).toEqual({ publishAt: "2026-10-12T07:00:00-04:00", updatedAt: "2026-10-13T09:00:00-04:00" });
    expect.soft(frontMatterTimes('---\ntitle: "T"\n---\npublishAt: "2026-01-01T00:00:00Z"\n')).toEqual({});
    expect.soft(frontMatterTimes("no front matter")).toEqual({});
  });
  it("does not read an unquoted time (the schema rejects it)", () => {
    expect(frontMatterTimes(fm("publishAt: 2026-10-12T07:00:00-04:00"))).toEqual({});
  });
});

describe("readPostTimes", () => {
  it("maps each valid <slug>.md to its times, skips other files and reserved slugs, and survives a missing folder", () => {
    const files = { "a-post.md": fm('publishAt: "2026-10-12T07:00:00-04:00"'), "tools.md": fm('publishAt: "2026-10-12T07:00:00-04:00"'), "notes.txt": "x" };
    const m = readPostTimes("dir", { list: () => Object.keys(files), read: (p) => files[p.split("/").pop()] });
    expect.soft([...m.keys()]).toEqual(["a-post"]);
    expect.soft(readPostTimes("nope").size).toBe(0);
  });
});

describe("sitemapSerialize", () => {
  const times = new Map([["new", { publishAt: "2026-10-12T11:00:00Z" }], ["edited", { publishAt: "2026-10-12T11:00:00Z", updatedAt: "2026-11-02T12:00:00Z" }]]);
  const ser = sitemapSerialize(times);
  it("gives a post its publish time, or its update time when it has one, in New York time", () => {
    expect.soft(ser({ url: "https://twiceover.io/blog/new" }).lastmod).toBe("2026-10-12T07:00:00-04:00");
    expect.soft(ser({ url: "https://twiceover.io/blog/edited/" }).lastmod).toBe("2026-11-02T07:00:00-05:00");
  });
  it("leaves every other address alone and never adds priority or changefreq", () => {
    for (const url of ["https://twiceover.io/", "https://twiceover.io/blog", "https://twiceover.io/blog/topic/earnings", "https://twiceover.io/blog/unknown"]) {
      const out = ser({ url });
      expect.soft(Object.keys(out), url).toEqual(["url"]);
    }
    const out = ser({ url: "https://twiceover.io/blog/new" });
    expect.soft("priority" in out || "changefreq" in out).toBe(false);
  });
});
