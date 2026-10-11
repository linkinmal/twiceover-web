import { describe, expect, it } from "vitest";
import { BLOG_SCRIPTS } from "../../ci/content-rules.mjs";
import { PLAYABLES } from "./playables.mjs";

describe("the playables registry", () => {
  it("names, for every playable, a script that is on the fixed list", () => {
    for (const p of PLAYABLES) expect.soft(BLOG_SCRIPTS, `${p.slug} script "${p.script}"`).toContain(`/js/blog-${p.script}.js`);
  });
});
