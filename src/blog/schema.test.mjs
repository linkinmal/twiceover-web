/**
 * The post front-matter schema (ADR 1090 Decisions 1 and 11): closed — an unknown key fails — with
 * every enumerated field drawn from `vocabulary.mjs` and every path confined to the image directories.
 */
import { describe, expect, it } from "vitest";
import { postSchema } from "./schema.mjs";
import { BUILDS, LENSES, TOPICS } from "./vocabulary.mjs";

const good = () => ({
  title: "Why a call can lose money on the day the stock jumps",
  description: "A call's price holds a guess about how far the stock will move. When the guess is spent, the price falls.",
  publishAt: "2026-10-12T07:00:00-04:00",
  topic: TOPICS[0],
  lens: LENSES[0],
  build: BUILDS[0],
});
const fails = (over) => !postSchema.safeParse({ ...good(), ...over }).success;

describe("a valid post", () => {
  it("parses with and without the optional parts: updatedAt and an image with its alt text, source and licence", () => {
    expect.soft(postSchema.safeParse(good()).success).toBe(true);
    const full = {
      ...good(),
      updatedAt: "2026-10-13T09:30:00-04:00",
      image: { src: "/blog-images/earnings-gap.webp", alt: "A chart of one stock's gap", source: "TwiceOver", licence: "Own work" },
    };
    expect.soft(postSchema.safeParse(full).success).toBe(true);
  });
});

describe("a closed schema", () => {
  it("fails an unknown key, at the top and inside image, so a post cannot smuggle a field a template might trust", () => {
    expect.soft(fails({ draft: false })).toBe(true);
    expect.soft(fails({ slug: "x" })).toBe(true);
    expect.soft(fails({ image: { src: "/blog-images/a.png", alt: "a", source: "s", licence: "l", html: "<b>" } })).toBe(true);
  });

  it("fails a missing required field, one by one", () => {
    for (const key of ["title", "description", "publishAt", "topic", "lens", "build"]) {
      const p = good();
      delete p[key];
      expect.soft(postSchema.safeParse(p).success, key).toBe(false);
    }
  });

  it("fails a value outside the closed lists for topic, lens and build", () => {
    expect.soft(fails({ topic: "astrology" })).toBe(true);
    expect.soft(fails({ lens: "opinion" })).toBe(true);
    expect.soft(fails({ build: "video" })).toBe(true);
    for (const t of TOPICS) expect.soft(fails({ topic: t }), t).toBe(false);
    expect.soft(TOPICS.every((t) => /^[a-z0-9-]{1,64}$/.test(t))).toBe(true);
  });
});

describe("times", () => {
  it("must be an ISO time with an offset: a bare date, a time with no offset, an impossible day and prose all fail", () => {
    for (const t of ["2026-10-12", "2026-10-12T07:00:00", "2026-13-12T07:00:00-04:00", "2026-02-30T07:00:00-05:00", "Mon 12 Oct", "", 5]) {
      expect.soft(fails({ publishAt: t }), String(t)).toBe(true);
      expect.soft(fails({ updatedAt: t }), String(t)).toBe(true);
    }
    for (const t of ["2026-10-12T07:00:00-04:00", "2026-10-12T11:00:00Z", "2026-12-14T07:00-05:00", "2026-10-12T07:00:00.250+00:00"]) {
      expect.soft(fails({ publishAt: t }), t).toBe(false);
    }
  });
});

describe("an unquoted time", () => {
  it("fails with a message that says to quote it, because YAML would read it as a UTC Date and shift the post's hour", () => {
    for (const key of ["publishAt", "updatedAt"]) {
      const r = postSchema.safeParse({ ...good(), [key]: new Date("2026-10-12T11:00:00Z") });
      expect.soft(r.success, key).toBe(false);
      expect.soft(JSON.stringify(r.error?.issues), key).toContain("in quotes");
    }
  });
});

describe("text fields", () => {
  it("bounds the title and description and refuses empty or markup-looking values that a template might trust", () => {
    expect.soft(fails({ title: "" })).toBe(true);
    expect.soft(fails({ title: "x".repeat(141) })).toBe(true);
    expect.soft(fails({ description: "short" })).toBe(true);
    expect.soft(fails({ description: "x".repeat(301) })).toBe(true);
    expect.soft(fails({ title: "A <script>alert(1)</script> title" })).toBe(true);
    expect.soft(fails({ description: "A description with <b>markup</b> inside it, long enough" })).toBe(true);
  });
});

describe("images stay inside the image directory", () => {
  const img = (src) => ({ image: { src, alt: "alt", source: "s", licence: "l" } });
  it("accepts a flat file in /blog-images/ of PNG, JPEG, WebP or AVIF", () => {
    for (const s of ["/blog-images/a.png", "/blog-images/a-b_c.1.jpg", "/blog-images/x.jpeg", "/blog-images/x.webp", "/blog-images/x.avif"]) {
      expect.soft(fails(img(s)), s).toBe(false);
    }
  });
  it("refuses SVG, other directories, traversal, absolute URLs, protocol-relative and data URLs, and an empty alt", () => {
    for (const s of ["/blog-images/a.svg", "/img/a.png", "/blog-images/../a.png", "/blog-images/sub/a.png", "https://x.test/a.png", "//x.test/a.png", "data:image/png;base64,AAAA", "blog-images/a.png", "/blog-images/a.gif", "/blog-images/.png"]) {
      expect.soft(fails(img(s)), s).toBe(true);
    }
    expect.soft(fails({ image: { src: "/blog-images/a.png", alt: "", source: "s", licence: "l" } })).toBe(true);
  });
});
