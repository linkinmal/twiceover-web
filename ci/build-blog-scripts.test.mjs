import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildBlogScripts } from "../scripts/build-blog-scripts.mjs";

// The block-script build over a throwaway playables folder and output folder (ADR 1127 Decision 4).
const made = [];
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));
function site(dirs) {
  const base = mkdtempSync(join(tmpdir(), "blog-scripts-"));
  made.push(base);
  const playablesDir = join(base, "playables");
  const outDir = join(base, "js");
  mkdirSync(playablesDir);
  mkdirSync(outDir);
  for (const [slug, files] of Object.entries(dirs)) {
    mkdirSync(join(playablesDir, slug));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(playablesDir, slug, name), body);
  }
  return { playablesDir, outDir };
}

describe("buildBlogScripts", () => {
  it("writes /js/blog-<slug>.js for each client.mjs, folding its imports in, and clears a stale bundle first", async () => {
    const s = site({ a: { "client.mjs": 'import { x } from "./dep.mjs"; console.log(x);', "dep.mjs": "export const x = 1;" }, "b-two": { "client.mjs": "console.log(2);" }, "no-client": { "entry.mjs": "" } });
    writeFileSync(join(s.outDir, "blog-stale.js"), "old");
    expect(await buildBlogScripts(s)).toEqual(["/js/blog-a.js", "/js/blog-b-two.js"]);
    expect.soft(readdirSync(s.outDir).sort()).toEqual(["blog-a.js", "blog-b-two.js"]);
  });
  it("rejects a folder outside the slug pattern before it writes or removes anything", async () => {
    const s = site({ ok: { "client.mjs": "1;" }, "Bad Name": { "client.mjs": "1;" } });
    writeFileSync(join(s.outDir, "blog-keep.js"), "kept");
    await expect(buildBlogScripts(s)).rejects.toThrow(/outside the slug pattern/);
    expect.soft(readdirSync(s.outDir)).toEqual(["blog-keep.js"]);
    expect.soft(existsSync(join(s.outDir, "blog-ok.js"))).toBe(false);
  });
});
