/**
 * The blog's one date gate and its closed vocabulary (ADR 1090 Decisions 1, 2, 4, 11).
 * `isPublished` is the only place a post's `publishAt` meets the clock; the index, topic pages, feed
 * and sitemap all call it, so a future post is absent from every surface at once.
 */
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, blogNow, isPublished, isValidSlug, publishedPosts } from "./publish.mjs";

const post = (slug, publishAt) => ({ slug, publishAt });

describe("isPublished — the single comparison of a post's time to the clock", () => {
  it("is true at the instant and after, false one millisecond before, whatever offset the time is written in", () => {
    // 07:00 New York in October (EDT, -04:00) is 11:00 UTC.
    const p = post("a", "2026-10-12T07:00:00-04:00");
    const at = Date.parse("2026-10-12T11:00:00Z");
    expect.soft(isPublished(p, new Date(at - 1))).toBe(false);
    expect.soft(isPublished(p, new Date(at))).toBe(true);
    expect.soft(isPublished(p, new Date(at + 1))).toBe(true);
    // The same instant written in UTC and in winter time (EST, -05:00) gives the same answer.
    expect.soft(isPublished(post("b", "2026-10-12T11:00:00Z"), new Date(at))).toBe(true);
    expect.soft(isPublished(post("c", "2026-12-14T07:00:00-05:00"), new Date("2026-12-14T12:00:00Z"))).toBe(true);
    expect.soft(isPublished(post("c", "2026-12-14T07:00:00-05:00"), new Date("2026-12-14T11:59:59.999Z"))).toBe(false);
  });

  it("accepts a number or a Date for now, and refuses a date it cannot read instead of publishing by accident", () => {
    expect.soft(isPublished(post("a", "2026-10-12T07:00:00-04:00"), Date.parse("2030-01-01T00:00:00Z"))).toBe(true);
    expect.soft(() => isPublished(post("a", "soon"), new Date())).toThrow(/publishAt/);
    expect.soft(() => isPublished(post("a", undefined), new Date())).toThrow(/publishAt/);
    expect.soft(() => isPublished(post("a", "2026-10-12T07:00:00-04:00"), new Date("nope"))).toThrow(/clock/);
  });
});

describe("publishedPosts — what every surface lists", () => {
  it("drops future posts and orders the rest newest first, without changing the input", () => {
    const all = [post("old", "2026-10-05T07:00:00-04:00"), post("future", "2026-10-14T07:00:00-04:00"), post("new", "2026-10-12T07:00:00-04:00")];
    const copy = all.slice();
    const out = publishedPosts(all, new Date("2026-10-12T12:00:00Z"));
    expect.soft(out.map((p) => p.slug)).toEqual(["new", "old"]);
    expect.soft(all).toEqual(copy);
  });

  it("with the far-future clock a pull request uses, every post is built — the broken one fails its own pull request", () => {
    const all = [post("a", "2026-10-05T07:00:00-04:00"), post("b", "2099-01-01T07:00:00-05:00")];
    expect.soft(publishedPosts(all, blogNow({ BLOG_NOW: "2100-01-01T00:00:00Z" })).length).toBe(2);
    expect.soft(publishedPosts(all, new Date("2026-10-06T00:00:00Z")).length).toBe(1);
  });
});

describe("blogNow — the build's clock", () => {
  it("is the real time unless BLOG_NOW says otherwise, and a bad BLOG_NOW stops the build", () => {
    const t = blogNow({}).getTime();
    expect.soft(Math.abs(t - Date.now())).toBeLessThan(5000);
    expect.soft(blogNow({ BLOG_NOW: "2100-01-01T00:00:00Z" }).toISOString()).toBe("2100-01-01T00:00:00.000Z");
    expect.soft(() => blogNow({ BLOG_NOW: "tomorrow" })).toThrow(/BLOG_NOW/);
    expect.soft(blogNow({ BLOG_NOW: "" }).getTime()).toBeGreaterThan(0); // empty means unset
  });
});

describe("slugs — a post's address", () => {
  it("accepts 1 to 64 of a-z, 0-9 and hyphen, and refuses everything else, including the reserved names", () => {
    const ok = ["a", "why-a-call-loses", "0", "x".repeat(64)];
    const bad = ["", "x".repeat(65), "Has-Capital", "has_underscore", "has space", "a/b", "..", "ünï", "-", "dot.dot", "tools", "topic", "page", "feed.xml", "play"];
    for (const s of ok) expect.soft(isValidSlug(s), s).toBe(true);
    for (const s of bad) expect.soft(isValidSlug(s), JSON.stringify(s)).toBe(false);
    expect.soft(RESERVED_SLUGS).toEqual(expect.arrayContaining(["tools", "topic", "page", "feed.xml", "play"]));
  });

  it("refuses a slug that is not a string", () => {
    for (const s of [null, undefined, 5, {}, ["a"]]) expect.soft(isValidSlug(s)).toBe(false);
  });
});
