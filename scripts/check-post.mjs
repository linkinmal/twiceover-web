/**
 * The writer-side check for one post (ADR 1090 Decision 5; blog-writers.md rule 11).
 *
 *   npm run check:post -- src/content/blog/<slug>.md
 *
 * Says before the pull request whether the post is in the shape the review lane accepts, passes the site's closed
 * schema, has its picture, and has a current share card (`npm run gen:blog-share -- <slug>` writes the card).
 * Exits 1 with each problem on its own line; no output of the post's own text beyond the field names.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPost } from "./blog-share/posts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("name a post: npm run check:post -- src/content/blog/<slug>.md");
  process.exit(1);
}
let failed = 0;
for (const f of files) {
  const failures = checkPost({ file: resolve(f), imagesDir: resolve(root, "public/blog-images"), shareDir: resolve(root, "public/blog-share") });
  if (failures.length) {
    failed += failures.length;
    for (const m of failures) console.error(`  - ${m}`);
  } else console.log(`${f}: ok (lane shape, schema, picture and card)`);
}
process.exit(failed ? 1 : 0);
