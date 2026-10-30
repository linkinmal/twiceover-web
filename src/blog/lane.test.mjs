import { describe, expect, it } from "vitest";
import { LIMITS, REGEN_GROUPS, evaluateLane, kindOf, magicKind, regenKind, show } from "./lane.mjs";

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
  const tree = new Map(Object.entries(head).map(([p, b]) => [p, { type: types[p] ?? "blob", mode: modes[p] ?? "100644", size: p in sizes ? sizes[p] : b.length, sha: "sha-" + p }]));
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
    const png = new Uint8Array(1_900_000);
    png.set(PNG);
    const total = await lane({ files: names.map(add), head: Object.fromEntries(names.map((n) => [n, png])) });
    expect(total.problems.join("\n")).toContain("images total");
  });
  it("fails closed on a tree entry with no size, and on bytes that outgrow the size the tree reported", async () => {
    const path = "public/blog-share/a.png";
    const noSize = await lane({ files: [add(path)], head: { [path]: PNG }, sizes: { [path]: undefined } });
    expect.soft(noSize.problems.join("\n"), "no size").toContain("the cap is");
    const liar = await lane({ files: [add(path)], head: { [path]: Uint8Array.from([...PNG, ...new Uint8Array(LIMITS.shareBytes + 1)]) }, sizes: { [path]: 100 } });
    expect.soft(liar.problems.join("\n"), "reported 100 bytes, read more than the cap").toContain("the cap is");
  });
  it("fails a post with no publishAt in the strict form", async () => {
    const r = await lane({ files: [add("src/content/blog/a.md")], head: { "src/content/blog/a.md": enc('---\ntitle: "x"\n---\n') } });
    expect(r.problems.join("\n")).toContain("no readable publishAt");
  });
  it("fails a post whose front matter is outside the strict form, and says which line without echoing it", async () => {
    const r = await lane({ files: [add("src/content/blog/a.md")], head: { "src/content/blog/a.md": enc('---\ntitle: x\npublishAt: "2026-10-20T07:00:00-04:00"\n---\n') } });
    const text = r.problems.join("\n");
    expect.soft(text).toContain("outside the strict form");
    expect.soft(text).toContain("line 2");
    expect.soft(text).not.toContain("2026-10-20");
  });
});

// Security's blocking finding on PR 108: the lane and the build read `publishAt` differently, so a live post could
// be re-dated past the lane. Each head below is a different way to plant a decoy `publishAt:` line; the build reads
// 2030 from every one of them, while a regex reads 2020. The lane must refuse all of them.
describe("a pull request that tries to re-date a live post with a decoy publishAt", () => {
  const REAL = "2030-01-01T00:00:00Z";
  const DECOYS = {
    "a multi-line title and a flow mapping": `---\n{title: "x\npublishAt: '2020-01-01T00:00:00Z'\ny", publishAt: "${REAL}"}\n---\n`,
    "a multi-line title and an escaped key": `---\ntitle: "x\npublishAt: '2020-01-01T00:00:00Z'\ny"\n"\\u0070ublishAt": "${REAL}"\n---\n`,
    "a multi-line title and a second plain key": `---\ntitle: "x\npublishAt: '2020-01-01T00:00:00Z'\ny"\npublishAt: "${REAL}"\n---\n`,
  };
  it.each(Object.entries(DECOYS))("is refused: %s", async (_n, text) => {
    const path = "src/content/blog/a.md";
    const r = await lane({ files: [{ filename: path, status: "modified" }], head: { [path]: enc(text) }, base: { [path]: LIVE } });
    expect(r.problems.join("\n")).toContain("outside the strict form");
  });
  it("is refused when the BASE text is the decoy: a base the lane cannot read counts as live", async () => {
    const path = "src/content/blog/a.md";
    const r = await lane({ files: [{ filename: path, status: "modified" }], head: { [path]: enc(FUTURE) }, base: { [path]: DECOYS["a multi-line title and a flow mapping"] } });
    expect(r.problems.join("\n")).toContain("cannot be shown not to be live");
  });
  it("still lets an honest edit of a live post through when its publishAt is the same", async () => {
    const path = "src/content/blog/a.md";
    const edited = LIVE.replace('title: "x"', 'title: "x, corrected"');
    clean(await lane({ files: [{ filename: path, status: "modified" }], head: { [path]: enc(edited) }, base: { [path]: LIVE } }));
  });
  it("still fails an honest re-date of a live post", async () => {
    const path = "src/content/blog/a.md";
    const r = await lane({ files: [{ filename: path, status: "modified" }], head: { [path]: enc(FUTURE) }, base: { [path]: LIVE } });
    expect(r.problems.join("\n")).toContain("its publishAt cannot change");
  });
});

describe("the rest of a post pull request", () => {
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

// ADR 1090 Amendment 4: a regeneration pull request (a live card plus the generator chain that made it stale) is
// a third kind. Each case below is one line of the amendment's build list.
describe("a regen pull request", () => {
  const CARD = "public/blog-share/a-call.png";
  const REGEN_FILES = [
    "scripts/blog-share/card.mjs",
    "scripts/blog-share/golden/printout-figure.png",
    "tokens/blog-themes.tokens.json",
    "src/styles/blog.css",
    "test-fixtures/blog-share/future-fixture-post.png",
    "ci/blog-style.test.mjs",
  ];
  const bytes = (p) => (p.endsWith(".png") ? PNG : enc("text\n"));
  const regen = (extra = [], over = {}) => {
    const files = [add(CARD), ...REGEN_FILES.map(add), ...extra.map((e) => (typeof e === "string" ? add(e) : e))];
    const head = Object.fromEntries(files.filter((f) => f.status !== "removed").map((f) => [f.filename, bytes(f.filename)]));
    return lane({ files, head, ...over });
  };
  const text = (r) => r.problems.join("\n");

  it("passes a card plus every path of the regen set, and says so", async () => {
    const r = await regen();
    expect(r.post).toBe(true);
    expect.soft(r.kind).toBe("regen");
    clean(r);
    expect.soft(r.lines.join("\n")).toContain("scripts/blog-share/card.mjs");
  });
  it.each(REGEN_FILES)("passes with %s alone beside a card", async (path) => {
    const r = await lane({ files: [add(CARD), add(path)], head: { [CARD]: PNG, [path]: bytes(path) } });
    expect.soft(r.kind).toBe("regen");
    clean(r);
  });
  it.each([
    ".github/workflows/x.yml",
    "ci/blog-lane.mjs",
    "src/blog/lane.mjs",
    "package.json",
    "package-lock.json",
    "ci/check-content.mjs",
    "scripts/deploy.sh",
  ])("fails when it also touches %s, naming the path", async (path) => {
    const r = await regen([path]);
    expect(text(r)).toContain(show(path) + " is not an allowed path");
  });
  it("fails a post file and a post image beside a regen path, naming the regen path as not allowed", async () => {
    for (const f of ["src/content/blog/a.md", "public/blog-images/a.png"]) {
      const r = await regen([f], { now: NOW });
      expect.soft(text(r), f).toContain('"src/styles/blog.css" is not allowed beside a post or post image');
    }
  });
  it("fails a symlink and an executable anywhere in it", async () => {
    for (const path of [CARD, "src/styles/blog.css", "scripts/blog-share/card.mjs"]) {
      for (const mode of ["120000", "100755"]) {
        expect.soft(text(await regen([], { modes: { [path]: mode } })), `${path} ${mode}`).toContain("not a plain file");
      }
    }
  });
  it("fails a rename into or out of the set", async () => {
    const into = await regen([{ filename: "src/styles/blog.css", previous_filename: "src/styles/other.css", status: "renamed" }]);
    expect.soft(text(into)).toContain('"src/styles/other.css" is not an allowed path');
    const out = await regen([{ filename: "src/styles/other.css", previous_filename: "scripts/blog-share/card.mjs", status: "renamed" }]);
    expect.soft(text(out)).toContain('"src/styles/other.css" is not an allowed path');
    const inside = await regen([{ filename: "scripts/blog-share/b.mjs", previous_filename: "scripts/blog-share/a.mjs", status: "renamed" }]);
    clean(inside);
  });
  it("lets a regen-set file be removed, and fails a removal outside the set", async () => {
    clean(await regen([{ filename: "scripts/blog-share/old.mjs", status: "removed" }]));
    expect(text(await regen([{ filename: "ci/check-content.mjs", status: "removed" }]))).toContain("not an allowed path");
  });
  it.each([
    ["a climb out", "scripts/blog-share/../x.mjs"],
    ["a double slash", "scripts/blog-share//x.mjs"],
    ["an upper-case extension", "scripts/blog-share/x.MJS"],
    ["an extension the folder does not have", "scripts/blog-share/x.svg"],
    ["a segment that starts with a dot", "scripts/blog-share/.x.mjs"],
    ["four levels deep", "scripts/blog-share/a/b/c/d.mjs"],
    ["a nested fixture", "test-fixtures/blog-share/sub/a.png"],
    ["a fixture that is not a PNG", "test-fixtures/blog-share/a.jpg"],
    ["a name with two dots in a row", "scripts/blog-share/a..b.mjs"],
  ])("fails %s", async (_n, path) => {
    expect(text(await regen([path]))).toContain("not an allowed path");
  });
  it("fails a regen-set PNG that is not a PNG, and a file over its cap", async () => {
    const path = "scripts/blog-share/golden/printout-figure.png";
    const files = [add(CARD), add(path)];
    const wrong = await lane({ files, head: { [CARD]: PNG, [path]: JPG } });
    expect.soft(text(wrong)).toContain("first bytes say jpeg");
    const bigText = await lane({ files: [add(CARD), add("src/styles/blog.css")], head: { [CARD]: PNG, "src/styles/blog.css": enc("x") }, sizes: { "src/styles/blog.css": 200_001 } });
    expect.soft(text(bigText)).toContain("the cap is 200000");
    const bigPng = await lane({ files, head: { [CARD]: PNG, [path]: PNG }, sizes: { [path]: 1_000_001 } });
    expect.soft(text(bigPng)).toContain("the cap is 1000000");
  });
  it("still validates the card as a card: wrong bytes fail", async () => {
    expect(text(await regen([], { head: { [CARD]: JPG, ...Object.fromEntries(REGEN_FILES.map((p) => [p, bytes(p)])) } }))).toContain("first bytes say jpeg");
  });
  it("is not a post pull request when it has a regen path and no card", async () => {
    const r = await lane({ files: REGEN_FILES.map(add) });
    expect(r.post).toBe(false);
    clean(r);
  });
  it("is a post pull request, as before, when it has cards and no regen path", async () => {
    const r = await lane({ files: [add(CARD)], head: { [CARD]: PNG } });
    expect.soft(r.kind).toBe("post");
    clean(r);
    const bad = await lane({ files: [add(CARD), add("ci/check-content.mjs")], head: { [CARD]: PNG } });
    expect.soft(text(bad)).toContain("not an allowed path");
  });
});

describe("the regen set", () => {
  it("is exactly the five groups the amendment names, and none of the never-in paths is in it", () => {
    expect(REGEN_GROUPS).toEqual([
      "scripts/blog-share/**",
      "tokens/blog-themes.tokens.json",
      "src/styles/blog.css",
      "test-fixtures/blog-share/<name>.png",
      "ci/blog-style.test.mjs",
    ]);
    for (const never of [
      ".github/workflows/lane.yml",
      ".github/anything",
      "ci/blog-lane.mjs",
      "ci/blog-lane.test.mjs",
      "src/blog/lane.mjs",
      "src/blog/lane.test.mjs",
      "package.json",
      "package-lock.json",
      "ci/check-content.mjs",
      "ci/blog-style.mjs",
      "scripts/deploy.sh",
      "scripts/gen-blog-share.mjs",
      "src/styles/other.css",
      "tokens/marketing-looks.tokens.json",
    ]) {
      expect.soft(regenKind(never), never).toBeNull();
    }
  });
});

// The control: the kind is not blind. PR 177's own file list is what this amendment was written for.
describe("the replay of twiceover-web PR 177", () => {
  const FILES = [
    "ci/blog-style.test.mjs",
    "public/blog-share/september-cpi-next-yearly-rate-10-december.png",
    "scripts/blog-share/card.mjs",
    "scripts/blog-share/card.test.mjs",
    "scripts/blog-share/golden/printout-figure.png",
    "src/styles/blog.css",
    "test-fixtures/blog-share/future-fixture-post.png",
    "tokens/blog-themes.tokens.json",
  ].map((filename) => ({ filename, status: "modified" }));
  const head = Object.fromEntries(FILES.map((f) => [f.filename, f.filename.endsWith(".png") ? PNG : enc("x")]));
  it("returns regen with no problems", async () => {
    const r = await lane({ files: FILES, head });
    expect.soft(r.kind).toBe("regen");
    clean(r);
  });
  it("fails with the workflow named once .github/workflows/lane.yml is added", async () => {
    const r = await lane({ files: [...FILES, { filename: ".github/workflows/lane.yml", status: "modified" }], head });
    expect(r.problems.join("\n")).toContain('".github/workflows/lane.yml" is not an allowed path');
  });
});
