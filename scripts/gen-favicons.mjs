#!/usr/bin/env node
/**
 * PNG favicon fallbacks (32 / 180 / 192) rendered from public/favicon.svg — the mark
 * asset as-is, no separate source (visual-identity.md). Run once via
 * `npm run gen:favicons`; outputs are committed (small, stable artifacts).
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public/favicon.svg"), "utf8");

const targets = [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
];

for (const [name, size] of targets) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(join(root, "public", name), png);
  console.log(`public/${name} (${size}px, ${png.length} bytes)`);
}
