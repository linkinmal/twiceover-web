/**
 * The blog's one "root-relative" rule, and the share-image check built on it (Architect and Security
 * reviews of PR 96 and PR 97): `new URL("//host/a.png", site)` is another origin, so a page's own share
 * image must be refused unless it is a plain root-relative path.
 */
import { describe, expect, it } from "vitest";
import { assertShareImage, isRootRelative } from "./url.mjs";

const site = "https://twiceover.io";

describe("isRootRelative", () => {
  it("accepts a path under this site and nothing that resolves to another origin", () => {
    for (const ok of ["/", "/blog-images/a.png", "/blog/x?y=1#z"]) {
      expect.soft(isRootRelative(ok), ok).toBe(true);
      expect.soft(new URL(ok, site).origin, ok).toBe(site);
    }
    const bad = ["//evil.test/a.png", "/\\evil.test/a.png", "/\\/evil.test/a.png", "/\t/evil.test/a.png", "/\n/evil.test", "https://evil.test/a.png", "evil.test/a.png", "a.png", "", " /a.png", "/a b", "javascript:alert(1)", "data:image/png;base64,AA"];
    for (const v of bad) expect.soft(isRootRelative(v), JSON.stringify(v)).toBe(false);
    for (const v of [null, undefined, 5, {}]) expect.soft(isRootRelative(v)).toBe(false);
  });
});

describe("assertShareImage — the page layout's check", () => {
  it("returns a root-relative path unchanged and throws for any other, including the forms that resolve off-site", () => {
    expect.soft(assertShareImage("/blog-share/why-a-call-loses.png")).toBe("/blog-share/why-a-call-loses.png");
    for (const v of ["//evil.test/a.png", "/\\evil.test/a.png", "https://twiceover.io/a.png", "https://evil.test/a.png", ""]) {
      expect.soft(() => assertShareImage(v), JSON.stringify(v)).toThrow(/root-relative/);
    }
  });
});
