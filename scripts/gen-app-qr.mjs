#!/usr/bin/env node
/**
 * The QR code to twiceover.io/app (app-launch-surfaces.md §2, stock-analyst-platform#4598), written
 * once into `src/assets/app-qr.svg` and inlined by `AppQr.astro`. Run via `npm run gen:app-qr`; the
 * SVG is committed, like the share cards.
 *
 * Inline SVG because the site's CSP is `img-src 'self'` and serves no script that could draw one.
 * Generated here, never at runtime: `qrcode-generator` is a build-time devDependency only.
 * `gen-app-qr.test.mjs` regenerates it and compares against the committed file, so a change to the URL
 * or the drawing cannot leave the artwork stale.
 *
 * One `<path>` of unit squares in module coordinates, so it scales crisply at any size. Error
 * correction M: the URL fits a 25×25 code, the size the Designer's QR board draws.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-generator";
import { APP_PAGE_URL } from "../src/app-launch.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const QR_FILE = join(root, "src/assets/app-qr.svg");

/** The modules of the code to `url`, as a boolean grid (true is a dark module). */
export function qrModules(url = APP_PAGE_URL) {
  const qr = qrcode(0, "M");
  qr.addData(url, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** The committed SVG: `currentColor` modules on no background (the frame around it draws the paper). */
export function qrSvg(url = APP_PAGE_URL) {
  const grid = qrModules(url);
  const n = grid.length;
  const d = grid.flatMap((row, r) => row.flatMap((dark, c) => (dark ? [`M${c} ${r}h1v1h-1z`] : []))).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">` +
    `<path fill="currentColor" d="${d}"/></svg>\n`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(QR_FILE, qrSvg());
  console.log(`src/assets/app-qr.svg  ${qrModules().length}×${qrModules().length} modules → ${APP_PAGE_URL}`);
}
