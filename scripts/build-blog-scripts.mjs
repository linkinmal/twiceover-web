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
import { deriveBlogScripts } from "../ci/content-rules.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src/playables");
const defaultOutDir = join(root, "public/js");

/** The bundle name for each client file: `blog-<slug>`, the slug being the folder's name. */
export function blockNames(playablesDir = srcDir) {
  return deriveBlogScripts(playablesDir).map((u) => u.slice("/js/blog-".length, -".js".length));
}

/**
 * Builds one bundle per client file. A folder whose name is not a slug throws before anything is written. That the
 * bundles in dist/js are the derived list and nothing else is checked on the built site by ci/check-entry-box.mjs,
 * from the checkout and not from this script.
 */
export async function buildBlogScripts({ playablesDir = srcDir, outDir = defaultOutDir } = {}) {
  const names = blockNames(playablesDir);
  // Stale output from a renamed or removed client file goes first.
  for (const f of readdirSync(outDir)) if (/^blog-.*\.js$/.test(f)) rmSync(join(outDir, f));
  await Promise.all(
    names.map((name) =>
      build({
        entryPoints: [join(playablesDir, name, "client.mjs")],
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
  return names.map((n) => `/js/blog-${n}.js`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const built = await buildBlogScripts();
  console.log(`Blog block scripts built: ${built.join(", ")}`);
}
