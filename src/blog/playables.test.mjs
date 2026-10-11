import { describe, expect, it } from "vitest";
import { BLOG_SCRIPTS } from "../../ci/content-rules.mjs";
import { HUB_PATH, PLAYABLES, otherPlayables, playablesNewestFirst } from "./playables.mjs";

describe("the playables registry", () => {
  it("names, for every playable, a script that is on the fixed list", () => {
    for (const p of PLAYABLES) expect.soft(BLOG_SCRIPTS, `${p.slug} script "${p.script}"`).toContain(`/js/blog-${p.script}.js`);
  });
  it("lists every playable on the hub, newest update first, the registry's order breaking a tie", () => {
    expect.soft(HUB_PATH).toBe("/blog/play");
    expect.soft(playablesNewestFirst().map((p) => p.slug)).toEqual(PLAYABLES.map((p) => p.slug));
    expect.soft(playablesNewestFirst().map((p) => p.updatedAt)).toEqual([...PLAYABLES.map((p) => p.updatedAt)].sort().reverse());
  });
  it("shows at most two other playables in the More to play strip, never the page itself", () => {
    for (const p of PLAYABLES) {
      const more = otherPlayables(p.slug);
      expect.soft(more.length, p.slug).toBeLessThanOrEqual(2);
      expect.soft(more.map((m) => m.slug), p.slug).not.toContain(p.slug);
    }
  });
});
