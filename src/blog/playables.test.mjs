import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOG_SCRIPTS } from "../../ci/content-rules.mjs";
import { HUB_PATH, PLAYABLES, loadPlayable, moreToPlay, orderPlayables, otherPlayables, playablesNewestFirst } from "./playables.mjs";

describe("the playables loader", () => {
  it("is one directory per playable: its folder is its slug and holds entry.mjs, page.astro and client.mjs", () => {
    const dirs = readdirSync(new URL("../playables", import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "_kit").map((d) => d.name).sort();
    expect.soft(PLAYABLES.map((p) => p.slug).sort(), "every folder is loaded, and nothing else").toEqual(dirs);
    for (const slug of dirs) {
      for (const f of ["entry.mjs", "page.astro", "client.mjs"]) expect.soft(existsSync(new URL(`../playables/${slug}/${f}`, import.meta.url)), `${slug}/${f}`).toBe(true);
    }
  });
  it("derives each address from the kind and the slug, and each script from the slug alone", () => {
    for (const p of PLAYABLES) {
      expect.soft(p.path, p.slug).toBe(`/blog/${p.kind === "game" ? "play" : "tools"}/${p.slug}`);
      expect.soft(BLOG_SCRIPTS, `${p.slug} script`).toContain(`/js/blog-${p.slug}.js`);
    }
    expect.soft(BLOG_SCRIPTS.length).toBe(PLAYABLES.length);
  });
  it("gives each playable the fields the pages read, and a static hub picture", () => {
    for (const p of PLAYABLES) {
      for (const k of ["title", "label", "deck", "description", "look", "topic", "updatedAt"]) expect.soft(typeof p[k], `${p.slug}.${k}`).toBe("string");
      expect.soft(p.art, `${p.slug}.art`).toMatch(/^<svg class="pa" [^]*<\/svg>$/);
      expect.soft(p.art, `${p.slug}.art has no script, handler, link or embedded markup`).not.toMatch(/<script|\son[a-z]+=|href|foreignObject|javascript:|<iframe|<image/i);
    }
  });
  it("lists every playable on the hub, newest update first, the order of PLAYABLES breaking a tie", () => {
    expect.soft(HUB_PATH).toBe("/blog/play");
    const hub = playablesNewestFirst();
    expect.soft(hub.map((p) => p.slug).sort(), "every playable, once").toEqual(PLAYABLES.map((p) => p.slug).sort());
    for (let i = 1; i < hub.length; i++) {
      const [a, b] = [hub[i - 1], hub[i]];
      expect.soft(Date.parse(a.updatedAt), `${a.slug} before ${b.slug}`).toBeGreaterThanOrEqual(Date.parse(b.updatedAt));
      if (Date.parse(a.updatedAt) === Date.parse(b.updatedAt)) expect.soft(PLAYABLES.indexOf(a), `${a.slug} and ${b.slug} tie: PLAYABLES order`).toBeLessThan(PLAYABLES.indexOf(b));
    }
  });
  it("keeps the five written first in their order on the hub, whatever else is added", () => {
    const five = ["guess-the-gap", "implied-move-from-a-straddle", "coin", "overnight-call", "option-payoff-calculator"];
    expect.soft(playablesNewestFirst().map((p) => p.slug).filter((s) => five.includes(s))).toEqual(five);
  });
  it("shows at most two other playables in the More to play strip, never the page itself", () => {
    for (const p of PLAYABLES) {
      const more = otherPlayables(p.slug);
      expect.soft(more.length, p.slug).toBeLessThanOrEqual(2);
      expect.soft(more.map((m) => m.slug), p.slug).not.toContain(p.slug);
    }
  });
  it("orders the strip: same topic first, then newest update, then slug (Designer, consult 1125 ask 5)", () => {
    const mk = (slug, topic, updatedAt) => ({ slug, topic, updatedAt });
    const list = [
      mk("self", "earnings", "2026-10-10T09:00:00-04:00"),
      mk("old-same", "earnings", "2026-10-01T09:00:00-04:00"),
      mk("new-other", "option-math", "2026-10-12T09:00:00-04:00"),
      mk("mid-other-b", "option-math", "2026-10-11T09:00:00-04:00"),
      mk("mid-other-a", "option-math", "2026-10-11T09:00:00-04:00"),
    ];
    expect.soft(moreToPlay(list, "self").map((p) => p.slug), "same topic first, whatever its age").toEqual(["old-same", "new-other"]);
    expect.soft(moreToPlay(list.filter((p) => p.slug !== "old-same"), "self").map((p) => p.slug), "no same topic: newest first").toEqual(["new-other", "mid-other-a"]);
    expect.soft(moreToPlay(list.filter((p) => !["old-same", "new-other"].includes(p.slug)), "self").map((p) => p.slug), "a tie goes to the slug").toEqual(["mid-other-a", "mid-other-b"]);
    expect.soft(moreToPlay(list.slice(0, 2), "self").map((p) => p.slug), "fewer than two others").toEqual(["old-same"]);
    expect.soft(moreToPlay(list, "absent"), "an unknown page gets the newest, not a crash").toHaveLength(2);
  });
  it("feeds the strip from PLAYABLES", () => {
    for (const p of PLAYABLES) expect.soft(otherPlayables(p.slug).map((m) => m.slug), p.slug).toEqual(moreToPlay(PLAYABLES, p.slug).map((m) => m.slug));
  });
  it("orders by instant, not by text: the same moment in two offsets is a tie that the slug breaks", () => {
    const mk = (slug, updatedAt) => ({ slug, topic: "t", updatedAt });
    const list = [mk("b", "2026-10-11T09:00:00-04:00"), mk("a", "2026-10-11T13:00:00Z"), mk("c", "2026-10-11T14:00:00Z")];
    expect.soft(moreToPlay(list, "zzz").map((p) => p.slug), "newest instant first, then slug").toEqual(["c", "a"]);
    expect.soft(moreToPlay(list.slice(0, 2), "zzz").map((p) => p.slug), "a tie in two offsets goes to the slug").toEqual(["a", "b"]);
  });
  it("orders an unknown page's strip by newest, then slug", () => {
    const mk = (slug, updatedAt) => ({ slug, topic: "t", updatedAt });
    expect(moreToPlay([mk("x", "2026-10-01T00:00:00Z"), mk("y", "2026-10-03T00:00:00Z"), mk("z", "2026-10-02T00:00:00Z")], "absent").map((p) => p.slug)).toEqual(["y", "z"]);
  });
  it("keeps the five written first in their order and puts any other page after them, by slug", () => {
    const slugs = ["zeta", "option-payoff-calculator", "alpha", "coin", "guess-the-gap", "overnight-call", "implied-move-from-a-straddle"];
    expect(orderPlayables(slugs.map((slug) => ({ slug }))).map((p) => p.slug)).toEqual(["guess-the-gap", "implied-move-from-a-straddle", "coin", "overnight-call", "option-payoff-calculator", "alpha", "zeta"]);
  });
});

describe("loadPlayable: an entry is checked against the folder it came from", () => {
  const ok = { slug: "coin", kind: "game" };
  const file = "/src/playables/coin/entry.mjs";
  const pages = ["/src/playables/coin/page.astro"];
  it("adds the address from the kind and the slug", () => {
    expect.soft(loadPlayable(file, ok, pages).path).toBe("/blog/play/coin");
    expect.soft(loadPlayable("/src/playables/x/entry.mjs", { slug: "x", kind: "tool" }, ["/src/playables/x/page.astro"]).path).toBe("/blog/tools/x");
  });
  it("refuses a slug that is not its folder's name, a missing page, and a kind that is not game or tool", () => {
    expect.soft(() => loadPlayable(file, { ...ok, slug: "other" }, pages)).toThrow(/must equal its directory name "coin"/);
    expect.soft(() => loadPlayable(file, ok, [])).toThrow(/page\.astro is missing/);
    for (const kind of ["post", "", undefined, "constructor", "toString", "__proto__"]) expect.soft(() => loadPlayable(file, { ...ok, kind }, pages), String(kind)).toThrow(/must be "game" or "tool"/);
  });
});
