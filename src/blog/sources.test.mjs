import { describe, expect, it } from "vitest";
import { postSchema } from "./schema.mjs";
import { renderable, readSources } from "./sources.mjs";

const ok = (s) => readSources(s);
const ARCHIVE = "https://archive.org/details/reportofpresiden01unit";

describe("readSources: the one-line `sources` field (#4286)", () => {
  it("reads names with and without a link, in order, trimmed", () => {
    const r = ok(`Brady Report 1988 | ${ARCHIVE}; NYSE`);
    expect.soft(r.ok).toBe(true);
    expect.soft(r.entries).toEqual([{ name: "Brady Report 1988", url: ARCHIVE }, { name: "NYSE" }]);
  });
  it("accepts two and five entries", () => {
    expect.soft(ok("A; B").ok).toBe(true);
    expect.soft(ok("A; B; C; D; E").ok).toBe(true);
  });
  it.each([
    ["one entry", "A"],
    ["six entries", "A; B; C; D; E; F"],
    ["an empty value", ""],
    ["an empty entry", "A; ; B"],
    ["a trailing separator", "A; B;"],
    ["an empty name", `A; | ${ARCHIVE}`],
    ["a name over 60 characters", `A; ${"x".repeat(61)}`],
    ["markup in a name", "A; <b>B</b>"],
    ["an http link", "A; B | http://example.com/x"],
    ["a link with a query string", "A; B | https://example.com/x?utm_source=y"],
    ["a link with a fragment", "A; B | https://example.com/x#y"],
    ["a link with a space", "A; B | https://example.com/x y"],
    ["a javascript link", "A; B | javascript:alert(1)"],
    ["a protocol-relative link", "A; B | //example.com/x"],
    ["a second link on one entry", "A; B | https://a.test/x | https://b.test/y"],
    ["an empty link after the bar", "A; B |"],
  ])("refuses %s", (_n, s) => {
    expect.soft(ok(s).ok, _n).toBe(false);
  });
  it("never echoes the field's text in the reason", () => {
    const r = ok("A; <b>SECRET</b>");
    expect.soft(r.ok).toBe(false);
    expect.soft(r.reason).not.toMatch(/SECRET/);
  });
});

describe("renderable: the page draws the line only for two to five entries", () => {
  it("draws two to five; draws nothing for none, one or six or more", () => {
    const n = (k) => Array.from({ length: k }, (_, i) => ({ name: `S${i}` }));
    for (const k of [2, 3, 5]) expect.soft(renderable(n(k)), String(k)).toBe(true);
    for (const k of [0, 1, 6, 7]) expect.soft(renderable(n(k)), String(k)).toBe(false);
    expect.soft(renderable(undefined)).toBe(false);
  });
});

describe("the post schema requires `sources` and returns entries", () => {
  const base = {
    title: "Why a call can lose money on the day the stock jumps",
    description: "A call's price holds a guess about how far the stock will move. When the guess is spent, the price falls.",
    publishAt: "2026-10-12T07:00:00-04:00",
    topic: "option-math",
    lens: "concept",
    build: "playable",
    look: "blueprint",
  };
  it("parses to [{name, url?}] and fails when absent or malformed", () => {
    const r = postSchema.safeParse({ ...base, sources: `Brady Report 1988 | ${ARCHIVE}; NYSE` });
    expect.soft(r.success).toBe(true);
    expect.soft(r.data?.sources).toEqual([{ name: "Brady Report 1988", url: ARCHIVE }, { name: "NYSE" }]);
    expect.soft(postSchema.safeParse(base).success, "absent").toBe(false);
    expect.soft(postSchema.safeParse({ ...base, sources: "only one" }).success, "one entry").toBe(false);
  });
});
