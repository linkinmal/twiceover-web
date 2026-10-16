#!/usr/bin/env node
/**
 * The blog's block scripts: src/playables/<slug>/client.mjs -> public/js/blog-<slug>.js (ADR 1088 Decision 1,
 * ADR 1127 Decision 4). Each block script imports the same pure math the build used to render the finished page,
 * so the page and the script cannot disagree; esbuild folds the imports into one classic file. Run by `prebuild`,
 * and by `dev` through the same script. The output is generated and not committed (like src/styles/tokens.css);
 * the reviewed file is the source, and BLOG_SCRIPTS (ci/content-rules.mjs) is derived from the same directories: a
 * folder whose name is not a slug fails here, before anything is built, and what is built is checked against the list.
 */
import { build } from "esbuild";
import { readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BLOG_SCRIPTS, deriveBlogScripts } from "../ci/content-rules.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src/playables");
const outDir = join(root, "public/js");

/** The bundle name for each client file: `blog-<slug>`, the slug being the folder's name. */
export function blockNames(playablesDir = srcDir) {
  return deriveBlogScripts(playablesDir).map((u) => u.slice("/js/blog-".length, -".js".length));
}

export async function buildBlogScripts() {
  const names = blockNames();
  // Stale output from a renamed or removed client file goes first.
  for (const f of readdirSync(outDir)) if (/^blog-.*\.js$/.test(f)) rmSync(join(outDir, f));
  await Promise.all(
    names.map((name) =>
      build({
        entryPoints: [join(srcDir, name, "client.mjs")],
        outfile: join(outDir, `blog-${name}.js`),
        bundle: true,
        format: "iife",
        target: "es2020",
        minify: false,
        legalComments: "none",
        logLevel: "warning",
      }),
    ),
  );
  // What was built is the derived list and nothing else.
  const built = readdirSync(outDir).filter((f) => /^blog-.*\.js$/.test(f)).map((f) => `/js/${f}`).sort();
  if (JSON.stringify(built) !== JSON.stringify([...BLOG_SCRIPTS])) {
    throw new Error(`block scripts and BLOG_SCRIPTS differ: built [${built}], derived [${BLOG_SCRIPTS}]`);
  }
  return built;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const built = await buildBlogScripts();
  console.log(`Blog block scripts built: ${built.join(", ")}`);
}
