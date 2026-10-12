/**
 * posts — reading a post for its share card, and checking a folder of cards against a folder of posts
 * (ADR 1088 Decision 4 and Amendment 1).
 *
 * A post is read through the strict front-matter grammar the review lane uses (`src/blog/frontmatter-grammar.mjs`),
 * so this script and the lane agree on what a post says, and no YAML is interpreted. The check is the whole
 * staleness rule: a post has exactly one card, `<slug>.png`; a card has exactly one post; and the card is
 * byte-for-byte what the generator draws from the post today. Nothing is recorded inside a card to be trusted.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { readStrictFrontMatter } from "../../src/blog/frontmatter-grammar.mjs";
import { isValidSlug } from "../../src/blog/publish.mjs";
import { LOOKS } from "../../src/blog/vocabulary.mjs";
import { chooseBody, loadContext, renderCard } from "./card.mjs";

/** @returns {string[]} the post file names (`<slug>.md`), sorted so every run walks them in one order */
export function postFiles(dir) {
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
}

/**
 * The fields a card is drawn from, plus the bytes of the picture when the card will carry one.
 * @param {string} file path to the post's Markdown
 * @param {string} imagesDir the folder `image.src` (`/blog-images/<name>`) names files in
 */
export function readPost(file, imagesDir) {
  const slug = basename(file, ".md");
  if (!isValidSlug(slug)) throw new Error(`${file}: not a valid post address`);
  const r = readStrictFrontMatter(readFileSync(file, "utf8"));
  if (!r.ok) throw new Error(`${file}: line ${r.line}: ${r.reason}`);
  const { top, objects } = r;
  for (const k of ["title", "publishAt", "look"]) if (!top[k]) throw new Error(`${file}: front matter has no ${k}`);
  if (!(top.look in LOOKS)) throw new Error(`${file}: look "${top.look}" is not a theme`);
  const post = { title: top.title, publishAt: top.publishAt, look: top.look };
  if (top.hit) post.hit = top.hit;
  if (objects.figure) post.figure = { value: objects.figure.value, note: objects.figure.note };
  if (objects.image) post.image = { src: objects.image.src, alt: objects.image.alt, source: objects.image.source, licence: objects.image.licence };
  let image;
  if (chooseBody(post) === "picture") {
    const path = join(imagesDir, basename(post.image.src));
    if (!existsSync(path)) throw new Error(`${file}: the picture ${post.image.src} is not in ${imagesDir}`);
    image = readFileSync(path);
  }
  return { slug, post, image };
}

/** Render one post's card. */
export function cardFor(file, imagesDir, ctx) {
  const { slug, post, image } = readPost(file, imagesDir);
  const { png, body } = renderCard(post, { ...ctx, image });
  return { slug, png, body };
}

/**
 * Check the cards against the posts. Returns failure messages; empty means every post has its card, no card
 * lacks a post, and every card is what the generator draws today.
 */
export function checkShare({ postsDir, shareDir, imagesDir, ctx = loadContext() }) {
  const failures = [];
  const files = existsSync(postsDir) ? postFiles(postsDir) : [];
  const slugs = new Set(files.map((f) => basename(f, ".md")));
  const cards = existsSync(shareDir) ? readdirSync(shareDir).sort() : [];
  for (const c of cards) {
    if (!c.endsWith(".png") || !slugs.has(basename(c, ".png"))) failures.push(`${shareDir}/${c}: a card with no post (a card is public/blog-share/<slug>.png for a post src/content/blog/<slug>.md)`);
  }
  for (const f of files) {
    const slug = basename(f, ".md");
    const cardPath = join(shareDir, `${slug}.png`);
    let fresh;
    try {
      fresh = cardFor(join(postsDir, f), imagesDir, ctx);
    } catch (e) {
      failures.push(e.message);
      continue;
    }
    if (!existsSync(cardPath)) failures.push(`${slug}: no card; run \`npm run gen:blog-share -- ${slug}\` and commit ${cardPath}`);
    else if (!readFileSync(cardPath).equals(fresh.png)) failures.push(`${slug}: the card is stale (the post, the generator, the theme styles, a face or the paper texture changed); run \`npm run gen:blog-share -- ${slug}\` and commit it`);
  }
  return failures;
}

/** Write the card for each named post (or all of them). */
export function generate({ postsDir, shareDir, imagesDir, slugs, ctx = loadContext() }) {
  mkdirSync(shareDir, { recursive: true });
  const files = postFiles(postsDir).filter((f) => !slugs || slugs.includes(basename(f, ".md")));
  const wrote = [];
  for (const f of files) {
    const { slug, png, body } = cardFor(join(postsDir, f), imagesDir, ctx);
    writeFileSync(join(shareDir, `${slug}.png`), png);
    wrote.push({ slug, body, bytes: png.length });
  }
  if (slugs) for (const s of slugs) if (!files.some((f) => basename(f, ".md") === s)) throw new Error(`no post "${s}" in ${postsDir}`);
  return wrote;
}
