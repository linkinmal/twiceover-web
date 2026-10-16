import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOG_SCRIPTS } from "../../ci/content-rules.mjs";
import { HUB_PATH, PLAYABLES, moreToPlay, otherPlayables, playablesNewestFirst } from "./playables.mjs";

describe("the playables registry", () => {
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
      expect.soft(p.art, `${p.slug}.art has no script or handler`).not.toMatch(/<script|\son[a-z]+=/i);
    }
  });
  it("lists every playable on the hub, newest update first, the registry's order breaking a tie", () => {
    expect.soft(HUB_PATH).toBe("/blog/play");
    expect.soft(playablesNewestFirst().map((p) => p.updatedAt)).toEqual([...PLAYABLES.map((p) => p.updatedAt)].sort().reverse());
    expect.soft(playablesNewestFirst().map((p) => p.slug), "the five written first keep their order").toEqual(["guess-the-gap", "implied-move-from-a-straddle", "coin", "overnight-call", "option-payoff-calculator"]);
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
  it("feeds the strip from the registry", () => {
    for (const p of PLAYABLES) expect.soft(otherPlayables(p.slug).map((m) => m.slug), p.slug).toEqual(moreToPlay(PLAYABLES, p.slug).map((m) => m.slug));
  });
});
