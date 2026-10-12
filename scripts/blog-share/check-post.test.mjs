/**
 * The writer-side check for one post (`npm run check:post`). It must say, before a pull request, what the lane and
 * CI would say: wrong shape, schema break, missing picture, missing or stale card. And it must pass the posts
 * the site's own fixtures treat as good.
 */
import { describe, expect, it } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { checkPost, generate } from "./posts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixture = (n) => join(root, "test-fixtures", n);

const POST = (extra = "", replace = {}) => {
  let md = `---\ntitle: "The stock jumped 4% and this call lost 21% of its value"\ndescription: "A call bought before earnings already carries the price of the jump."\npublishAt: "2026-10-09T07:00:00-04:00"\ntopic: "option-math"\nlens: "concept"\nbuild: "playable"\nlook: "blueprint"\nhit: "21%"\nsources: "Brady Report 1988; NYSE"\n${extra}---\n\nBody.\n`;
  for (const [a, b] of Object.entries(replace)) md = md.replace(a, b);
  return md;
};

/** A scratch repo's worth of folders, with the fixture cards for the fixture posts. */
function scratch() {
  const d = mkdtempSync(join(tmpdir(), "check-post-"));
  const dirs = { postsDir: join(d, "posts"), shareDir: join(d, "share"), imagesDir: join(d, "images") };
  cpSync(fixture("blog"), dirs.postsDir, { recursive: true });
  cpSync(fixture("blog-share"), dirs.shareDir, { recursive: true });
  mkdirSync(dirs.imagesDir);
  return dirs;
}
const run = (dirs, md, name = "a-call") => {
  const file = join(dirs.postsDir, `${name}.md`);
  writeFileSync(file, md);
  return { file, check: () => checkPost({ file, imagesDir: dirs.imagesDir, shareDir: dirs.shareDir }) };
};

describe("check:post", () => {
  it("passes every fixture post with its committed card", () => {
    const dirs = scratch(); // the fixture photo the second post names is not committed; the check wants it present
    writeFileSync(join(dirs.imagesDir, "fixture-photo.png"), readFileSync(join(root, "scripts/blog-share/golden/chart-5x3.png")));
    for (const f of ["first", "second", "third", "fourth", "future"]) {
      const file = join(dirs.postsDir, `${f}-fixture-post.md`);
      expect.soft(checkPost({ file, imagesDir: dirs.imagesDir, shareDir: dirs.shareDir }), f).toEqual([]);
    }
  });

  it("names the line when the file is not in the shape the lane reads", () => {
    const dirs = scratch();
    const { check } = run(dirs, POST("", { 'lens: "concept"': "lens: 'concept'" }));
    const f = check();
    expect.soft(f).toHaveLength(1);
    expect.soft(f[0]).toMatch(/line \d+: .*review lane reads only this shape/);
    expect.soft(f[0], "does not echo the post's text").not.toContain("concept");
  });

  it("reports a schema problem with its field name", () => {
    const dirs = scratch();
    const topic = run(dirs, POST("", { 'topic: "option-math"': 'topic: "not-a-topic"' })).check();
    expect.soft(topic.some((m) => /a-call\.md: topic: /.test(m))).toBe(true);
    // a refinement across fields (the hit words must appear in the title) is reported once the fields themselves pass
    const hit = run(dirs, POST("", { 'hit: "21%"': 'hit: "nowhere in the title"' })).check();
    expect.soft(hit.some((m) => /hit: must be words that appear in the title/.test(m))).toBe(true);
  });

  it("names a missing picture, a missing card and a stale card, and passes once the card is made", () => {
    const dirs = scratch();
    const img = 'image:\n  src: "/blog-images/chart.png"\n  alt: "A chart"\n  source: "TwiceOver"\n  licence: "Own chart"\n';
    const { check, file } = run(dirs, POST(img));
    expect.soft(check().some((m) => /the picture \/blog-images\/chart\.png is not in/.test(m))).toBe(true);

    writeFileSync(join(dirs.imagesDir, "chart.png"), readFileSync(join(root, "scripts/blog-share/golden/chart-5x3.png")));
    expect.soft(check().some((m) => /^a-call: no card; run `npm run gen:blog-share -- a-call`/.test(m))).toBe(true);

    generate({ ...dirs, slugs: ["a-call"] });
    expect.soft(check()).toEqual([]);

    writeFileSync(file, POST(img, { "4%": "5%" }));
    expect.soft(check().some((m) => /a-call: the card is stale/.test(m))).toBe(true);
  });

  it("refuses a file that is not a post address", () => {
    const dirs = scratch();
    const bad = join(dirs.postsDir, "Not A Post.md");
    writeFileSync(bad, POST());
    expect(checkPost({ file: bad, imagesDir: dirs.imagesDir, shareDir: dirs.shareDir })[0]).toMatch(/not a post file/);
  });

  it("is what `npm run check:post` runs: exit 0 on a good post, 1 with the problem on a bad one", () => {
    const good = spawnSync(process.execPath, ["scripts/check-post.mjs", "test-fixtures/blog/first-fixture-post.md"], { cwd: root, encoding: "utf8" });
    // the fixture's card lives in test-fixtures/, not public/blog-share, so the real command reports it missing:
    expect.soft(good.status).toBe(1);
    expect.soft(good.stderr).toMatch(/first-fixture-post: no card/);
    const none = spawnSync(process.execPath, ["scripts/check-post.mjs"], { cwd: root, encoding: "utf8" });
    expect.soft(none.status).toBe(1);
    expect.soft(none.stderr).toMatch(/name a post/);
  });
});
