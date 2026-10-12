/**
 * The per-post share image (ADR 1088 Decision 4 and Amendments 1 and 2; blog-handoff.md section 10a).
 *
 *   npm run gen:blog-share -- <slug> [<slug> ...]   write public/blog-share/<slug>.png for those posts
 *   npm run gen:blog-share -- --all                 write every post's card
 *   npm run check:share                             CI: every post has its card, no card lacks a post, none is stale
 *
 * `--posts`, `--share` and `--images` point it at other folders; the defaults are `src/content/blog`
 * (or `BLOG_CONTENT_DIR`), `public/blog-share` and `public/blog-images`. A card is a PNG committed with
 * its post; no SVG is written anywhere (ADR 1090 Decision 5), the drawing happens in memory.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blogContentDir } from "../src/blog/content-dir.mjs";
import { checkShare, generate } from "./blog-share/posts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parse(argv) {
  const o = { slugs: [], all: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") o.all = true;
    else if (a === "--check") o.check = true;
    else if (a === "--posts" || a === "--share" || a === "--images") o[a.slice(2)] = argv[++i];
    else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else o.slugs.push(a);
  }
  return o;
}

function main() {
  const o = parse(process.argv.slice(2));
  const dirs = {
    postsDir: resolve(root, o.posts ?? blogContentDir(process.env)),
    shareDir: resolve(root, o.share ?? "public/blog-share"),
    imagesDir: resolve(root, o.images ?? "public/blog-images"),
  };
  if (o.check) {
    const failures = checkShare(dirs);
    if (failures.length) {
      console.error(`Share-card gate FAILED (${failures.length}):`);
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log("Share-card gate passed: every post has its card, no card lacks a post, none is stale.");
    return;
  }
  if (!o.all && o.slugs.length === 0) throw new Error("name a post (npm run gen:blog-share -- <slug>) or pass --all");
  for (const w of generate({ ...dirs, slugs: o.all ? undefined : o.slugs })) console.log(`${w.slug}.png  ${w.bytes} bytes  (${w.body})`);
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
