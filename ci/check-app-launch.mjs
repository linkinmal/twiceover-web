#!/usr/bin/env node
/**
 * The app launch surfaces over the BUILT output (dist/), for the variant this build was made for
 * (`SITE_APP_STORES`, app-launch-surfaces.md §2): the badges show only the live stores, Safari's
 * banner is on every full page except in the Android-only variant, the QR is where the boards put it,
 * and every link to /app is in place. The rules live in app-launch-rules.mjs. Run after `astro build`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_STORES } from "../src/app-launch.mjs";
import { appLaunchFailures } from "./app-launch-rules.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? htmlFiles(p) : entry.endsWith(".html") ? [p] : [];
  });
}

const pages = Object.fromEntries(htmlFiles(dist).map((p) => [relative(dist, p), readFileSync(p, "utf8")]));
const postSlugs = readdirSync(join(root, "src/content/blog"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""));
const failures = appLaunchFailures({ pages, variant: APP_STORES, postSlugs });
if (failures.length) {
  console.error(`APP LAUNCH CHECK FAILED (variant "${APP_STORES}"):\n`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`App launch check passed: variant "${APP_STORES}", ${Object.keys(pages).length} pages.`);
