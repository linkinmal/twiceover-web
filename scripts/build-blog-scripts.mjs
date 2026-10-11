#!/usr/bin/env node
/**
 * The blog's block scripts: src/blog-tools/client/<name>.mjs -> public/js/blog-<name>.js (ADR 1088 Decision 1,
 * ADR 1090 Decision 8). Each block script imports the same pure math the build used to render the finished page,
 * so the page and the script cannot disagree; esbuild folds the imports into one classic file. Run by `prebuild`,
 * and by `dev` through the same script. The output is generated and not committed (like src/styles/tokens.css);
 * the reviewed file is the source, and BLOG_SCRIPTS (ci/content-rules.mjs) names exactly what may ship.
 */
import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src/blog-tools/client");
const outDir = join(root, "public/js");

/** The block names: every client source file, without its extension. */
export function blockNames() {
  return readdirSync(srcDir)
    .filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs"))
    .map((f) => f.slice(0, -4))
    .sort();
}

export async function buildBlogScripts() {
  const names = blockNames();
  await Promise.all(
    names.map((name) =>
      build({
        entryPoints: [join(srcDir, `${name}.mjs`)],
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
