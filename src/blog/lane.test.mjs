import { describe, expect, it } from "vitest";
import { LIMITS, evaluateLane, kindOf, magicKind, show } from "./lane.mjs";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const post = (publishAt) => `---\ntitle: "x"\npublishAt: "${publishAt}"\n---\nbody\n`;
const LIVE = post("2026-10-09T07:00:00-04:00");
const FUTURE = post("2026-10-20T07:00:00-04:00");
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Uint8Array.from([...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WEBP")]);
const AVIF = Uint8Array.from([0, 0, 0, 0x1c, ...Buffer.from("ftypavif")]);
const enc = (s) => new TextEncoder().encode(s);

/** A pull request: `files` as the API lists them, `head` as path -> bytes (the tree and reader derive from it), `base` as path -> text. */
async function lane({ files, head = {}, base = {}, modes = {}, sizes = {}, types = {}, now = NOW }) {
  const tree = new Map(Object.entries(head).map(([p, b]) => [p, { type: types[p] ?? "blob", mode: modes[p] ?? "100644", size: sizes[p] ?? b.length, sha: "sha-" + p }]));
  return evaluateLane({
    files,
    tree,
    readHead: async (p) => head[p],
    readBase: async (p) => (p in base ? base[p] : null),
    now,
  });
}
const add = (filename) => ({ filename, status: "added" });
const clean = (r) => expect.soft(r.problems).toEqual([]);

describe("a pull request with no file in a post directory", () => {
  it("is not a post pull request: the lane passes it to its normal review", async () => {
    const r = await lane({ files: [add("src/pages/index.astro"), { filename: "ci/x.mjs", status: "modified" }] });
    expect(r.post).toBe(false);
    clean(r);
  });
  it("is still a post pull request when only the OLD name of a rename was in a post directory", async () => {
    const r = await lane({ files: [{ filename: "elsewhere/x.md", previous_filename: "src/content/blog/x.md", status: "renamed" }], base: { "src/content/blog/x.md": FUTURE } });
    expect(r.post).toBe(true);
    expect(r.problems.join("\n")).toContain("elsewhere/x.md");
  });
});

describe("a post pull request", () => {
  it("passes with a new post, its image and its share image, all plain files", async () => {
    const r = await lane({
      files: [add("src/content/blog/a-call.md"), add("public/blog-images/a-call.webp"), add("public/blog-share/a-call.png")],
      head: { "src/content/blog/a-call.md": enc(FUTURE), "public/blog-images/a-call.webp": WEBP, "public/blog-share/a-call.png": PNG },
    });
    expect(r.post).toBe(true);
    clean(r);
  });
  it.each([
    ["a code file", "src/pages/index.astro"],
    ["a workflow", ".github/workflows/ci.yml"],
    ["an .mdx post", "src/content/blog/a.mdx"],
    ["a nested post path", "src/content/blog/sub/a.md"],
    ["an SVG image", "public/blog-images/a.svg"],
    ["an upper-case extension", "public/blog-images/a.PNG"],
    ["a reserved slug", "src/content/blog/tools.md"],
    ["a share image that is not a PNG", "public/blog-share/a.jpg"],
    ["a path that climbs out", "src/content/blog/../../ci/x.md"],
  ])("fails when it also touches %s", async (_n, filename) => {
    const r = await lane({ files: [add("src/content/blog/a.md"), add(filename)], head: { "src/content/blog/a.md": enc(FUTURE) } });
    expect(r.problems.length, filename).toBeGreaterThan(0);
  });
  it("fails a symlink, an executable and a tree entry that is not a plain blob", async () => {
    for (const [mode, type] of [["120000", "blob"], ["100755", "blob"], ["160000", "commit"], ["040000", "tree"]]) {
      const r = await lane({ files: [add("src/content/blog/a.md")], head: { "src/content/blog/a.md": enc(FUTURE) }, modes: { "src/content/blog/a.md": mode }, types: { "src/content/blog/a.md": type } });
      expect(r.problems.join("\n"), `${mode} ${type}`).toContain("not a plain file");
    }
  });
  it("fails an image whose bytes are not the type its name says, and one that is no image at all", async () => {
    const wrong = await lane({ files: [add("public/blog-images/a.png")], head: { "public/blog-images/a.png": JPG } });
    expect(wrong.problems.join("\n")).toContain("first bytes say jpeg");
    const none = await lane({ files: [add("public/blog-images/a.png")], head: { "public/blog-images/a.png": enc("<svg xmlns='http://www.w3.org/2000/svg'/>") } });
    expect(none.problems.join("\n")).toContain("no image type");
    const share = await lane({ files: [add("public/blog-share/a.png")], head: { "public/blog-share/a.png": JPG } });
    expect(share.problems.join("\n")).toContain("first bytes say jpeg");
  });
  it("accepts each allowed image type by its bytes", async () => {
    for (const [n, b] of [["a.png", PNG], ["a.jpg", JPG], ["a.jpeg", JPG], ["a.webp", WEBP], ["a.avif", AVIF]]) {
      clean(await lane({ files: [add("public/blog-images/" + n)], head: { ["public/blog-images/" + n]: b } }));
    }
  });
  it("fails a file over its cap, and a set of images over the total", async () => {
    const big = await lane({ files: [add("public/blog-images/a.png")], head: { "public/blog-images/a.png": PNG }, sizes: { "public/blog-images/a.png": LIMITS.imageBytes + 1 } });
    expect(big.problems.join("\n")).toContain("the cap is");
    const names = Array.from({ length: 5 }, (_, i) => `public/blog-images/i${i}.png`);
    const total = await lane({ files: names.map(add), head: Object.fromEntries(names.map((n) => [n, PNG])), sizes: Object.fromEntries(names.map((n) => [n, 1_900_000])) });
    expect(total.problems.join("\n")).toContain("images total");
  });
  it("fails a post with no readable publishAt", async () => {
    const r = await lane({ files: [add("src/content/blog/a.md")], head: { "src/content/blog/a.md": enc("---\ntitle: x\n---\n") } });
    expect(r.problems.join("\n")).toContain("no readable publishAt");
  });
  it("fails a file missing from the head tree, and an unknown status", async () => {
    expect((await lane({ files: [add("src/content/blog/a.md")] })).problems.join("\n")).toContain("not in the head commit's tree");
    expect((await lane({ files: [{ filename: "src/content/blog/a.md", status: "weird" }] })).problems.join("\n")).toContain("does not know");
  });
  it("fails more files than the cap", async () => {
    const files = Array.from({ length: LIMITS.maxFiles + 1 }, (_, i) => add(`public/blog-images/i${i}.png`));
    expect((await lane({ files, head: Object.fromEntries(files.map((f) => [f.filename, PNG])) })).problems.join("\n")).toContain("at most");
  });
});

describe("a live post's address", () => {
  const P = "src/content/blog/a.md";
  it("cannot be removed", async () => {
    expect((await lane({ files: [{ filename: P, status: "removed" }], base: { [P]: LIVE } })).problems.join("\n")).toContain("live post");
  });
  it("cannot be renamed away, but a post not yet live can be removed or renamed", async () => {
    const live = await lane({ files: [{ filename: "src/content/blog/b.md", previous_filename: P, status: "renamed" }], head: { "src/content/blog/b.md": enc(LIVE) }, base: { [P]: LIVE } });
    expect(live.problems.join("\n")).toContain("never removed or renamed");
    clean(await lane({ files: [{ filename: P, status: "removed" }], base: { [P]: FUTURE } }));
    clean(await lane({ files: [{ filename: "src/content/blog/b.md", previous_filename: P, status: "renamed" }], head: { "src/content/blog/b.md": enc(FUTURE) }, base: { [P]: FUTURE } }));
  });
  it("cannot have its publishAt changed, but its body and updatedAt can", async () => {
    const moved = await lane({ files: [{ filename: P, status: "modified" }], head: { [P]: enc(post("2026-10-30T07:00:00-04:00")) }, base: { [P]: LIVE } });
    expect(moved.problems.join("\n")).toContain("publishAt cannot change");
    const edited = LIVE.replace("body", "a corrected body").replace('publishAt:', 'updatedAt: "2026-10-11T09:00:00-04:00"\npublishAt:');
    clean(await lane({ files: [{ filename: P, status: "modified" }], head: { [P]: enc(edited) }, base: { [P]: LIVE } }));
  });
  it("is the same instant whatever offset the time is written in", async () => {
    clean(await lane({ files: [{ filename: P, status: "modified" }], head: { [P]: enc(post("2026-10-09T11:00:00Z")) }, base: { [P]: LIVE } }));
  });
  it("can be re-dated while it is not yet live", async () => {
    clean(await lane({ files: [{ filename: P, status: "modified" }], head: { [P]: enc(post("2026-10-25T07:00:00-04:00")) }, base: { [P]: FUTURE } }));
  });
  it("fails closed when the base text cannot be read or its time cannot be", async () => {
    expect((await lane({ files: [{ filename: P, status: "removed" }] })).problems.join("\n")).toContain("could not be read");
    expect((await lane({ files: [{ filename: P, status: "removed" }], base: { [P]: "---\ntitle: x\n---\n" } })).problems.join("\n")).toContain("live post");
  });
});

describe("helpers", () => {
  it("kindOf names exact paths only", () => {
    expect(kindOf("src/content/blog/a.md")).toBe("post");
    expect(kindOf("public/blog-images/a.jpeg")).toBe("image");
    expect(kindOf("public/blog-share/a.png")).toBe("share");
    expect(kindOf("src/content/blog/a.md/")).toBeNull();
    expect(kindOf("src/content/blog/-.md")).toBeNull();
  });
  it("magicKind reads the leading bytes", () => {
    expect([PNG, JPG, WEBP, AVIF, enc("GIF89a")].map(magicKind)).toEqual(["png", "jpeg", "webp", "avif", null]);
  });
  it("show quotes a path so it cannot start a workflow command or break a line", () => {
    expect(show("::error::x\nline")).toBe('"::error::x\\nline"');
    expect(show("a".repeat(500)).length).toBe(200);
  });
});
