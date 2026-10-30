import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { check, readEnv, report } from "./blog-lane.mjs";

const SHA = (c) => c.repeat(40);
const ctx = { repo: "o/r", pr: "7", base: SHA("a"), head: SHA("b") };
const enc = (o) => Buffer.from(JSON.stringify(o));
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const FUTURE = '---\npublishAt: "2026-10-20T07:00:00-04:00"\n---\n';

/** A fake `gh api`: routes by path, records every call. */
function fakeApi({ files, tree, truncated = false, blobs = {}, bases = {} }) {
  const calls = [];
  const api = async (args) => {
    calls.push(args);
    const u = args[0];
    if (u.includes("/pulls/7/files")) {
      const page = Number(/[?&]page=(\d+)/.exec(u)[1]);
      return enc(files.slice((page - 1) * 100, page * 100));
    }
    if (u.includes("/git/trees/")) return enc({ truncated, tree });
    const b = /git\/blobs\/([0-9a-f]{40})/.exec(u);
    if (b) return enc({ encoding: "base64", content: Buffer.from(blobs[b[1]]).toString("base64") });
    const c = /contents\/(.+)\?ref=/.exec(u);
    if (c) {
      if (c[1] in bases) return Buffer.from(bases[c[1]]);
      const e = new Error("gh: Not Found (HTTP 404)");
      e.stderr = "gh: Not Found (HTTP 404)";
      throw e;
    }
    throw new Error("unexpected call " + u);
  };
  return { api, calls };
}
const entry = (path, sha, size) => ({ path, mode: "100644", type: "blob", sha, size });

describe("the lane job, end to end against a fake API", () => {
  it("passes a post pull request and reads only the changed post files from the API", async () => {
    const { api, calls } = fakeApi({
      files: [
        { filename: "src/content/blog/a.md", status: "added" },
        { filename: "public/blog-share/a.png", status: "added" },
      ],
      tree: [entry("src/content/blog/a.md", SHA("1"), FUTURE.length), entry("public/blog-share/a.png", SHA("2"), PNG.length), entry("src/pages/x.astro", SHA("3"), 5)],
      blobs: { [SHA("1")]: FUTURE, [SHA("2")]: PNG },
    });
    const r = await check(ctx, api, Date.parse("2026-10-12T12:00:00Z"));
    expect(r.problems).toEqual([]);
    expect(report(r)).toContain("every file allowed");
    expect(calls.every((a) => a[0].startsWith("repos/o/r/"))).toBe(true);
  });
  it("fails a post pull request that also changes a code file, and says which", async () => {
    const { api } = fakeApi({ files: [{ filename: "src/content/blog/a.md", status: "added" }, { filename: "scripts/deploy.sh", status: "modified" }], tree: [entry("src/content/blog/a.md", SHA("1"), 40)], blobs: { [SHA("1")]: FUTURE } });
    const r = await check(ctx, api);
    expect(r.problems.join("\n")).toContain('"scripts/deploy.sh" is not an allowed path');
  });
  it("is not a post pull request for a code-only change, and then reads nothing but the file list", async () => {
    const { api, calls } = fakeApi({ files: [{ filename: "ci/x.mjs", status: "modified" }], tree: [] });
    const r = await check(ctx, api);
    expect(r.post).toBe(false);
    expect(r.problems).toEqual([]);
    expect(calls).toHaveLength(1);
  });
  it("fails a live post that is re-dated, reading its base through the contents API", async () => {
    const LIVE = '---\npublishAt: "2026-10-09T07:00:00-04:00"\n---\n';
    const MOVED = '---\npublishAt: "2026-10-30T07:00:00-04:00"\n---\n';
    const { api } = fakeApi({ files: [{ filename: "src/content/blog/a.md", status: "modified" }], tree: [entry("src/content/blog/a.md", SHA("1"), 50)], blobs: { [SHA("1")]: MOVED }, bases: { "src/content/blog/a.md": LIVE } });
    expect((await check(ctx, api, Date.parse("2026-10-12T12:00:00Z"))).problems.join("\n")).toContain("publishAt cannot change");
  });
  it("fails closed on a truncated tree, a file list at the API ceiling, and an API error", async () => {
    await expect(check(ctx, fakeApi({ files: [{ filename: "src/content/blog/a.md", status: "added" }], tree: [], truncated: true }).api)).rejects.toThrow(/truncated/);
    const many = Array.from({ length: 3000 }, (_, i) => ({ filename: `public/blog-images/i${i}.png`, status: "added" }));
    expect((await check(ctx, fakeApi({ files: many, tree: [] }).api)).problems.join("\n")).toContain("ceiling");
    await expect(check(ctx, async () => { throw new Error("rate limited"); })).rejects.toThrow(/rate limited/);
  });
});

describe("a regen pull request, end to end against a fake API", () => {
  const CARD = "public/blog-share/a.png";
  const FILES = [CARD, "scripts/blog-share/card.mjs", "src/styles/blog.css", "tokens/blog-themes.tokens.json"].map((filename) => ({ filename, status: "modified" }));
  const tree = [entry(CARD, SHA("1"), PNG.length), entry("scripts/blog-share/card.mjs", SHA("2"), 5), entry("src/styles/blog.css", SHA("3"), 5), entry("tokens/blog-themes.tokens.json", SHA("4"), 5), entry("src/pages/x.astro", SHA("5"), 5)];
  const blobs = { [SHA("1")]: PNG, [SHA("2")]: "x", [SHA("3")]: "x", [SHA("4")]: "x" };
  it("passes, names itself a normal-lane pull request with the paths listed, and reads no post text", async () => {
    const { api, calls } = fakeApi({ files: FILES, tree, blobs });
    const r = await check(ctx, api);
    expect(r.problems).toEqual([]);
    expect.soft(r.kind).toBe("regen");
    const text = report(r);
    expect.soft(text).toContain("regen pull request");
    expect.soft(text).toContain("NORMAL-LANE");
    expect.soft(text).toContain("not post-only");
    expect.soft(text).toContain('"src/styles/blog.css"');
    expect.soft(text).not.toContain("post-only pull request, every file allowed");
    expect.soft(calls.every((a) => a[0].startsWith("repos/o/r/") && !a[0].includes("/contents/"))).toBe(true);
  });
  it("fails when the workflow is among the files, with the path named", async () => {
    const files = [...FILES, { filename: ".github/workflows/lane.yml", status: "modified" }];
    const r = await check(ctx, fakeApi({ files, tree, blobs }).api);
    expect(report(r)).toContain('Lane FAILED');
    expect(r.problems.join("\n")).toContain('".github/workflows/lane.yml" is not an allowed path');
  });
  it("sees a regen-set file's mode from the head tree: an executable generator fails", async () => {
    const t = tree.map((e) => (e.path === "scripts/blog-share/card.mjs" ? { ...e, mode: "100755" } : e));
    const r = await check(ctx, fakeApi({ files: FILES, tree: t, blobs }).api);
    expect(r.problems.join("\n")).toContain("not a plain file");
  });
  it("is a regen-set change with no card: not a post pull request, and the report says so", async () => {
    const r = await check(ctx, fakeApi({ files: FILES.slice(1), tree: [] }).api);
    expect.soft(r.post).toBe(false);
    expect.soft(report(r)).toContain("not a post pull request");
  });
});

describe("the job's output", () => {
  const src = readFileSync(new URL("./blog-lane.mjs", import.meta.url), "utf8");
  it("writes the lane kind to GITHUB_OUTPUT as a fixed word, only on a pass", () => {
    expect(src).toContain("lane=${result.post ? result.kind : \"none\"}");
    expect(src).toMatch(/GITHUB_OUTPUT && result\.problems\.length === 0/);
  });
  it("is declared on the job and read from the one step, with no pull-request value in it", () => {
    const wf = readFileSync(new URL("../.github/workflows/lane.yml", import.meta.url), "utf8").replace(/^\s*#.*$/gm, "");
    expect(wf).toContain("    outputs:\n      lane: ${{ steps.lane.outputs.lane }}\n");
    expect(wf).toContain("      - id: lane\n        run: node ci/blog-lane.mjs\n");
  });
});

describe("readEnv", () => {
  const ok = { GITHUB_REPOSITORY: "o/r", PR_NUMBER: "7", BASE_SHA: SHA("a"), HEAD_SHA: SHA("b") };
  it("accepts well-formed values and refuses anything else", () => {
    expect(readEnv(ok)).toEqual(ctx);
    for (const [k, v] of [["PR_NUMBER", "7; rm -rf /"], ["BASE_SHA", "main"], ["HEAD_SHA", SHA("g")], ["GITHUB_REPOSITORY", "o/r/../x"], ["PR_NUMBER", undefined]]) {
      expect(() => readEnv({ ...ok, [k]: v }), k).toThrow(/malformed/);
    }
  });
});

describe(".github/workflows/lane.yml", () => {
  const wf = readFileSync(new URL("../.github/workflows/lane.yml", import.meta.url), "utf8");
  const body = wf.replace(/^\s*#.*$/gm, "");
  it("runs on pull_request_target only, with a read-only token", () => {
    expect(body).toMatch(/\non:\n  pull_request_target:/);
    expect(body).not.toMatch(/\n  (pull_request|push|workflow_dispatch|schedule):/);
    expect(body).toMatch(/permissions:\n  contents: read\n  pull-requests: read\n/);
    expect(body).not.toMatch(/: write/);
  });
  it("checks out the base only, installs nothing, and runs the one script", () => {
    const steps = body.split("\n").filter((l) => /^      - (uses|run|id):|^        run:/.test(l));
    expect(steps).toEqual(["      - uses: actions/checkout@v4", "      - id: lane", "        run: node ci/blog-lane.mjs"]);
    expect(body).not.toMatch(/\bref:|repository:/);
    expect(body).toContain("persist-credentials: false");
    expect(body).not.toMatch(/npm |npx |pnpm |yarn |setup-node/);
  });
  it("puts pull-request values in env only, never in a run line, and never the branch name, title or body", () => {
    const runs = body.split("\n").filter((l) => /^\s*(- )?run:/.test(l));
    expect(runs.some((l) => l.includes("${{"))).toBe(false);
    expect(body).not.toMatch(/pull_request\.(head\.ref|title|body|user|head\.repo|labels)/);
    expect(body).toContain("HEAD_SHA: ${{ github.event.pull_request.head.sha }}");
  });
});
