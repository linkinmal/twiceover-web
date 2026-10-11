import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { blogPostingJsonLd, serializeJsonLd } from "./jsonld.mjs";
import { ORGANIZATION } from "./org.mjs";

const post = { title: "A call lost 21%", description: "The punchline sentence, long enough to be one.", publishAt: "2026-10-09T07:00:00-04:00" };

describe("blogPostingJsonLd", () => {
  it("has the closed BlogPosting shape, with New York times and the Organization as author and publisher", () => {
    const o = blogPostingJsonLd(post, { slug: "a-call-lost" });
    expect.soft(Object.keys(o).sort()).toEqual(["@context", "@type", "author", "dateModified", "datePublished", "description", "headline", "mainEntityOfPage", "publisher", "url"]);
    expect.soft(o["@type"]).toBe("BlogPosting");
    expect.soft(o.url).toBe("https://twiceover.io/blog/a-call-lost");
    expect.soft(o.datePublished).toBe("2026-10-09T07:00:00-04:00");
    expect.soft(o.dateModified).toBe("2026-10-09T07:00:00-04:00");
    expect.soft(o.author).toEqual(o.publisher);
  });
  it("moves dateModified only with an updatedAt, and adds the image only when given one", () => {
    const o = blogPostingJsonLd({ ...post, updatedAt: "2026-10-12T15:00:00Z" }, { slug: "x", imagePath: "/blog-share/x.png" });
    expect.soft(o.dateModified).toBe("2026-10-12T11:00:00-04:00");
    expect.soft(o.image).toBe("https://twiceover.io/blog-share/x.png");
  });
});

describe("serializeJsonLd", () => {
  it("a title that reads </script> cannot close the element, and the body still parses back to the object", () => {
    const o = blogPostingJsonLd({ ...post, title: "x</script><script>alert(1)</script>" }, { slug: "x" });
    const s = serializeJsonLd(o);
    expect.soft(s).not.toContain("<");
    expect.soft(s).toContain("\\u003c/script>");
    expect.soft(JSON.parse(s)).toEqual(JSON.parse(JSON.stringify(o)));
  });
  it("escapes the line and paragraph separators", () => {
    const s = serializeJsonLd({ a: "x\u2028y\u2029z" });
    expect.soft(s).not.toMatch(/[\u2028\u2029]/);
    expect.soft(JSON.parse(s).a).toBe("x\u2028y\u2029z");
  });
});

describe("the Organization record", () => {
  it("is the one the home page carries", () => {
    const home = readFileSync(new URL("../pages/index.astro", import.meta.url), "utf8");
    for (const v of [ORGANIZATION.name, ORGANIZATION.url, ORGANIZATION.logo, ...ORGANIZATION.sameAs]) {
      expect.soft(home, v).toContain(`"${v}"`);
    }
  });
});
