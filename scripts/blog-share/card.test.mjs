/**
 * The per-post share card (ADR 1088 Decision 4, Amendments 1 and 2; blog-handoff.md section 10a).
 *
 * What is worth testing is not that resvg draws pixels but the rules the card exists to keep:
 *
 *  1. exactly one body (picture, figure or nothing), chosen by what the post carries and its licence;
 *  2. nothing on a card beyond the post's own fields: no issue number, no second figure, no extra words;
 *  3. every piece of small text clears the legibility floor, and the longest headline still fits;
 *  4. the card is a pure function of its inputs, and each input that matters (the post, the theme styles) reaches it;
 *  5. the staleness gate fails a missing, orphaned and stale card.
 *
 * The golden PNGs pin the rendered bytes on every machine this runs on, so a Mac and the CI runner are held to
 * the same pixels (Amendment 1's second spike question).
 */
import { describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lookValues, THEMES } from "../../ci/blog-style.mjs";
import { LOOK_NAMES, LOOKS } from "../../src/blog/vocabulary.mjs";
import { CARD, CARD_LICENCE, FACES, SMALL_PX, PHONE_WIDTH_PX, cardSvg, chooseBody, clampLines, loadContext, readLook, renderCard } from "./card.mjs";
import { checkShare, generate } from "./posts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const here = dirname(fileURLToPath(import.meta.url));
const ctx = loadContext(root);
const chart = readFileSync(join(here, "golden", "chart-5x3.png"));

const BASE = {
  title: "The stock jumped 4% and this call lost 21% of its value",
  hit: "21%",
  publishAt: "2026-10-09T07:00:00-04:00",
  look: "blueprint",
  figure: { value: "−21%", note: "on a call, with the stock up 4%" },
  image: { src: "/blog-images/chart.png", alt: "Value of the $105 call against the stock price, before and after the report", source: "TwiceOver", licence: CARD_LICENCE },
};
const withBody = (look, body, extra = {}) => {
  const p = { ...BASE, look, ...extra };
  if (body !== "picture") delete p.image;
  if (body === "none") delete p.figure;
  return p;
};
const texts = (svg) => [...svg.replace(/<g id="riso-shadow">.*?<\/g>/s, "").matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const sizes = (svg) => [...svg.matchAll(/<text\b[^>]*font-size="([\d.]+)"/g)].map((m) => parseFloat(m[1]));

describe("which body a post's card carries (Amendment 2)", () => {
  it("is the picture only when its licence is exactly 'Own chart'; else the figure; else nothing", () => {
    const own = { ...BASE.image, licence: "Own chart" };
    expect.soft(chooseBody({ image: own, figure: BASE.figure })).toBe("picture");
    expect.soft(chooseBody({ image: own })).toBe("picture");
    expect.soft(chooseBody({ image: { ...own, licence: "Own work" }, figure: BASE.figure }), "another licence falls to the figure").toBe("figure");
    expect.soft(chooseBody({ image: { ...own, licence: "own chart" }, figure: BASE.figure }), "the match is exact").toBe("figure");
    expect.soft(chooseBody({ image: { ...own, licence: "Public domain" } }), "no figure: the headline fills the card").toBe("none");
    expect.soft(chooseBody({ figure: BASE.figure })).toBe("figure");
    expect.soft(chooseBody({})).toBe("none");
  });
});

describe("what is on a card", () => {
  for (const look of LOOK_NAMES) {
    for (const body of ["picture", "figure", "none"]) {
      it(`${look} / ${body}: the post's own words and nothing else; no number; small text clears the floor`, () => {
        const post = withBody(look, body);
        const { svg, body: got } = cardSvg(post, { ...ctx, image: chart });
        expect.soft(got).toBe(body);
        const t = texts(svg);
        // The masthead and the date always; the headline's words; then only the body's own field.
        const words = t.join(" ");
        expect.soft(t, "masthead").toContain("TWICEOVER BLOG");
        expect.soft(t, "date").toContain("Fri 9 Oct 2026");
        expect.soft(words).not.toMatch(/No\.|#\d|\bNo \d/);
        const headline = t.filter((x) => x !== "TWICEOVER BLOG" && x !== "Fri 9 Oct 2026").join(" ");
        const expectedTail = body === "figure" ? [BASE.figure.value, BASE.figure.note] : body === "picture" ? [`${BASE.image.alt}.`] : [];
        let rest = headline;
        for (const tail of expectedTail) rest = rest.replace(tail, "").replace(/\s+/g, " ");
        expect.soft(rest.replace(/\s+/g, " ").trim(), "the headline words are the title, every one of them").toBe(post.title);
        expect.soft(/href="data:image\/(png|jpeg|webp)/.test(svg), "a picture only on the picture card").toBe(body === "picture");
        // legibility: every text is at least the floor (9 px on a 350 px phone feed); the headline is far above it
        const floor = (0.026 * CARD.w * PHONE_WIDTH_PX) / PHONE_WIDTH_PX;
        expect.soft(Math.min(...sizes(svg)), "smallest text").toBeGreaterThanOrEqual(floor);
        expect.soft(SMALL_PX).toBeGreaterThanOrEqual(floor);
      });
    }
  }

  it("marks the hit words on the picture and headline cards, and leaves them plain on the figure card", () => {
    for (const look of ["ticket", "printout", "risograph", "paper-marker", "night-desk", "newsprint", "blueprint"]) {
      const has = (body) => cardSvg(withBody(look, body), { ...ctx, image: chart }).svg.includes('id="hit-boxes"');
      expect.soft(has("picture"), `${look} picture`).toBe(true);
      expect.soft(has("none"), `${look} none`).toBe(true);
      expect.soft(has("figure"), `${look} figure`).toBe(false);
    }
  });

  it("fits the longest headline the schema allows, in every theme and body", () => {
    const long = `${"A call that has gained value even though the stock has not moved is a call that is priced on the next day ".repeat(2)}`.slice(0, 140).trim();
    for (const look of LOOK_NAMES) {
      for (const body of ["picture", "figure", "none"]) {
        expect(() => cardSvg(withBody(look, body, { title: long, hit: long.slice(10, 20) }), { ...ctx, image: chart }), `${look} / ${body}`).not.toThrow();
      }
    }
  });
});

describe("the picture", () => {
  it("must be a file resvg can read; a card never falls back silently", () => {
    const avif = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypavif"), Buffer.alloc(32)]);
    expect(() => cardSvg(withBody("house", "picture"), { ...ctx, image: avif })).toThrow(/PNG, JPEG or WebP/);
    expect(() => cardSvg(withBody("house", "picture"), { ...ctx })).toThrow(/PNG, JPEG or WebP/);
  });
  it("shortens a long caption at a word with an ellipsis, never past three lines", () => {
    const widthOf = (s) => s.length * 10;
    const out = clampLines("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.", widthOf, 100, 3);
    expect.soft(out).toHaveLength(3);
    expect.soft(out[2].endsWith("…")).toBe(true);
    expect.soft(out[2]).not.toMatch(/\.…$/);
    expect.soft(clampLines("short caption.", widthOf, 400, 3)).toEqual(["short caption."]);
  });
});

describe("the faces and themes are the page's own", () => {
  const css = ctx.css;
  it("every theme has an instanced face for its display font at its weight, and the file is there", () => {
    for (const name of LOOK_NAMES) {
      const L = readLook(css, name);
      const face = FACES[`${LOOKS[name].display}@${L.fdw}`];
      expect.soft(face, `${name}: ${LOOKS[name].display}@${L.fdw}`).toBeDefined();
      expect.soft(existsSync(join(root, "scripts/og-fonts", face?.file ?? "missing")), `${name} file`).toBe(true);
      expect.soft(face?.weight, `${name} weight`).toBe(L.fdw);
    }
  });
  it("reads every theme's ground, ink, plate and accent from blog.css as the token files carry them", () => {
    const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
    const blog = read("tokens/blog-themes.tokens.json");
    const marketing = read("tokens/marketing-looks.tokens.json");
    for (const t of THEMES) {
      const v = lookValues(blog, marketing, t.token);
      const L = readLook(css, t.token);
      expect.soft(L.g.toLowerCase(), `${t.token} ground`).toBe(String(v.ground).toLowerCase());
      expect.soft(L.ink.toLowerCase(), `${t.token} ink`).toBe(String(v.ink).toLowerCase());
      expect.soft(L.a.toLowerCase(), `${t.token} accent`).toBe(String(v[t.accent]).toLowerCase());
    }
  });
  it("reads each theme's own size factor, line height and photo treatment", () => {
    expect.soft(readLook(css, "night-desk")).toMatchObject({ fdsz: 1.17, fdlh: 0.96, fdw: 800 });
    expect.soft(readLook(css, "printout")).toMatchObject({ fdsz: 0.74, fdw: 700 });
    expect.soft(readLook(css, "neon")).toMatchObject({ italic: true, fdw: 300 });
    expect.soft(readLook(css, "neon").photo).toMatchObject({ blend: "multiply", filter: { contrast: 1.25, brightness: 1.2 }, backdrop: { gradient: { deg: 120 } } });
    expect.soft(readLook(css, "risograph").photo).toMatchObject({ blend: "screen", dots: 0.35, backdrop: { color: "#0078BF" } });
    expect.soft(readLook(css, "house").photo).toMatchObject({ blend: "normal", backdrop: null, dots: 0 });
  });
  it("draws the printout theme's holes and band in the colours blog.css names", () => {
    expect(css).toContain("#CDD1CB");
    expect(css).toContain("#E6F0E4");
    const { svg } = cardSvg(withBody("printout", "none"), ctx);
    expect.soft(svg).toContain("#CDD1CB");
    expect.soft(svg).toContain("#E6F0E4");
  });
});

describe("a card is a pure function of its inputs, and each input reaches it", () => {
  const render = (post, c = ctx) => renderCard(post, { ...c, image: chart }).png;
  it("renders the same bytes twice", () => {
    expect(render(withBody("neon", "picture")).equals(render(withBody("neon", "picture")))).toBe(true);
  });
  it("changes when the headline, the date, the figure, the theme or the picture changes", () => {
    const base = render(withBody("risograph", "picture"));
    for (const [what, post] of [
      ["title", withBody("risograph", "picture", { title: "The stock jumped 5% and this call lost 21% of its value" })],
      ["date", withBody("risograph", "picture", { publishAt: "2026-10-10T07:00:00-04:00" })],
      ["theme", withBody("exhibit", "picture")],
      ["caption", withBody("risograph", "picture", { image: { ...BASE.image, alt: "A different chart" } })],
      ["hit", withBody("risograph", "picture", { hit: "jumped" })],
    ]) {
      expect.soft(render(post).equals(base), what).toBe(false);
    }
    expect.soft(render(withBody("risograph", "figure", { figure: { ...BASE.figure, value: "−22%" } })).equals(render(withBody("risograph", "figure"))), "figure").toBe(false);
    const other = Buffer.from(chart);
    other[other.length - 20] ^= 0xff; // the picture file's own bytes are an input
    expect.soft(renderCard(withBody("risograph", "picture"), { ...ctx, image: other }).png.equals(base), "picture bytes").toBe(false);
  });
  it("changes when the theme's styles change (blog.css is an input, so a theme edit makes every card stale)", () => {
    const base = render(withBody("house", "none"));
    const edited = { ...ctx, css: ctx.css.replace(/(\[data-look="house"\]\{--g:)#F4F0E8/, "$1#F4F0E9") };
    expect(edited.css).not.toBe(ctx.css);
    expect(render(withBody("house", "none"), edited).equals(base)).toBe(false);
  });
  it("changes when the paper texture changes", () => {
    const base = render(withBody("newsprint", "none"));
    const edited = { ...ctx, grain: Buffer.from(String(ctx.grain).replace("opacity='.3'", "opacity='.4'")) };
    expect(render(withBody("newsprint", "none"), edited).equals(base)).toBe(false);
  });
});

describe("golden cards: the same bytes on every machine", () => {
  const GOLDEN = [
    ["neon-picture", withBody("neon", "picture")],
    ["riso-picture", withBody("risograph", "picture")],
    ["printout-figure", withBody("printout", "figure")],
    ["newsprint-none", withBody("newsprint", "none")],
  ];
  for (const [name, post] of GOLDEN) {
    it(`${name} renders to the committed PNG`, () => {
      const png = renderCard(post, { ...ctx, image: chart }).png;
      const file = join(here, "golden", `${name}.png`);
      if (process.env.UPDATE_GOLDEN) writeFileSync(file, png);
      // If this fails after an intended change to the generator, a theme or a face, regenerate with
      // `UPDATE_GOLDEN=1 npx vitest run scripts/blog-share` and review the four images; if it fails with no such change,
      // the renderer differs between machines and Amendment 1's digest fallback is what is left.
      expect(png.equals(readFileSync(file))).toBe(true);
    });
  }
});

describe("the staleness gate (Amendment 1)", () => {
  const fixture = (name) => join(root, "test-fixtures", name);
  const POST = (extra = "") => `---\ntitle: "The stock jumped 4% and this call lost 21% of its value"\ndescription: "A call bought before earnings already carries the price of the jump."\npublishAt: "2026-10-09T07:00:00-04:00"\ntopic: "option-math"\nlens: "concept"\nbuild: "playable"\nlook: "blueprint"\nhit: "21%"\n${extra}---\n\nBody.\n`;
  /** A scratch copy of the fixture posts and their committed cards, and an empty picture folder. */
  const scratch = () => {
    const d = mkdtempSync(join(tmpdir(), "share-"));
    const dirs = { postsDir: join(d, "posts"), shareDir: join(d, "share"), imagesDir: join(d, "images") };
    cpSync(fixture("blog"), dirs.postsDir, { recursive: true });
    cpSync(fixture("blog-share"), dirs.shareDir, { recursive: true });
    mkdirSync(dirs.imagesDir);
    return dirs;
  };

  it("passes on the fixture posts with their committed cards", () => {
    expect(checkShare({ postsDir: fixture("blog"), shareDir: fixture("blog-share"), imagesDir: join(fixture("blog"), "..", "blog-images") })).toEqual([]);
  });

  it("fails a stale card, a card with no post, and a file that is not a card", () => {
    const dirs = scratch();
    expect(checkShare(dirs)).toEqual([]);
    const first = join(dirs.shareDir, "first-fixture-post.png");
    const bytes = readFileSync(first);
    const flipped = Buffer.from(bytes);
    flipped[flipped.length - 30] ^= 1;
    writeFileSync(first, flipped);
    writeFileSync(join(dirs.shareDir, "no-such-post.png"), bytes);
    writeFileSync(join(dirs.shareDir, "notes.txt"), "x");
    const failures = checkShare(dirs);
    expect.soft(failures.some((f) => /no-such-post\.png: a card with no post/.test(f))).toBe(true);
    expect.soft(failures.some((f) => /notes\.txt: a card with no post/.test(f))).toBe(true);
    expect.soft(failures.some((f) => /first-fixture-post: the card is stale/.test(f))).toBe(true);
    expect.soft(failures).toHaveLength(3);
  });

  it("fails a post with no card, and a post whose front matter the lane's grammar refuses", () => {
    const dirs = scratch();
    writeFileSync(join(dirs.postsDir, "new-post.md"), POST());
    expect.soft(checkShare(dirs).some((f) => /^new-post: no card/.test(f))).toBe(true);
    writeFileSync(join(dirs.postsDir, "bad-post.md"), POST().replace('lens: "concept"', "lens: 'concept'"));
    expect.soft(checkShare(dirs).some((f) => /bad-post\.md: line \d+/.test(f))).toBe(true);
  });

  it("names a missing picture file instead of drawing a card without it", () => {
    const dirs = scratch();
    writeFileSync(join(dirs.postsDir, "chart-post.md"), POST('image:\n  src: "/blog-images/nope.png"\n  alt: "A chart"\n  source: "TwiceOver"\n  licence: "Own chart"\n'));
    expect(checkShare(dirs).some((f) => /the picture \/blog-images\/nope\.png is not in/.test(f))).toBe(true);
  });

  it("goes stale when the picture file changes, and passes again once the card is regenerated", () => {
    const dirs = scratch();
    const md = POST('image:\n  src: "/blog-images/chart.png"\n  alt: "A chart"\n  source: "TwiceOver"\n  licence: "Own chart"\n');
    writeFileSync(join(dirs.postsDir, "chart-post.md"), md);
    writeFileSync(join(dirs.imagesDir, "chart.png"), chart);
    generate({ ...dirs, slugs: ["chart-post"] });
    expect.soft(checkShare(dirs)).toEqual([]);
    const other = Buffer.from(chart);
    other[other.length - 20] ^= 0xff;
    writeFileSync(join(dirs.imagesDir, "chart.png"), other);
    expect.soft(checkShare(dirs).some((f) => /^chart-post: the card is stale/.test(f))).toBe(true);
  });

  it("every file in the fixture card folder is a card for a fixture post", () => {
    const posts = readdirSync(fixture("blog")).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ".png")).sort();
    expect(readdirSync(fixture("blog-share")).sort()).toEqual(posts);
  });
});
