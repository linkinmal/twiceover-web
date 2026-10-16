import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { digestOf } from "./dist-digest.mjs";

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), "dist-digest-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}
const cli = (...args) => spawnSync(process.execPath, ["ci/dist-digest.mjs", ...args], { encoding: "utf8" });

describe("digestOf", () => {
  it("is the same for the same files written in another order, and is a sha256", () => {
    const a = tree({ "index.html": "<p>a</p>", "blog/x/index.html": "x", ".assetsignore": "" });
    const b = tree({ ".assetsignore": "", "blog/x/index.html": "x", "index.html": "<p>a</p>" });
    expect.soft(digestOf(a)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect.soft(digestOf(a)).toBe(digestOf(b));
  });

  it("changes when a byte changes, a file is renamed, added, or emptied", () => {
    const files = { "index.html": "<p>a</p>", "blog/x/index.html": "x" };
    const base = digestOf(tree(files));
    expect.soft(digestOf(tree({ ...files, "index.html": "<p>b</p>" }))).not.toBe(base);
    expect.soft(digestOf(tree({ ...files, "extra.js": "" }))).not.toBe(base);
    expect.soft(digestOf(tree({ ...files, "blog/x/index.html": "" }))).not.toBe(base);
    const moved = tree(files);
    renameSync(join(moved, "blog/x"), join(moved, "blog/y"));
    expect.soft(digestOf(moved)).not.toBe(base);
    // A name and content split differently must not collide.
    expect.soft(digestOf(tree({ a: "b\nc" }))).not.toBe(digestOf(tree({ "a\nb": "c" })));
  });

  it("refuses a missing or empty folder rather than digesting nothing", () => {
    expect.soft(() => digestOf(join(tmpdir(), "no-such-dist-digest"))).toThrow();
    expect.soft(() => digestOf(mkdtempSync(join(tmpdir(), "dist-digest-empty-")))).toThrow(/no files/);
  });
});

describe("dist-digest CLI", () => {
  const dir = tree({ "index.html": "<p>a</p>" });
  const d = digestOf(dir);

  it("prints the digest", () => {
    const r = cli(dir);
    expect.soft(r.status).toBe(0);
    expect.soft(r.stdout.trim()).toBe(d);
  });

  it("passes --expect when it matches and fails when it does not, or when it is empty", () => {
    expect.soft(cli(dir, "--expect", d).status).toBe(0);
    const bad = cli(dir, "--expect", "sha256:" + "0".repeat(64));
    expect.soft(bad.status).toBe(1);
    expect.soft(bad.stderr).toContain("does not match");
    expect.soft(cli(dir, "--expect", "").status, "an empty expectation (verify's output missing) fails").toBe(1);
  });
});
