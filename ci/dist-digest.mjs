/**
 * The digest of a built site folder (ADR 1127 Decision 3). `verify` prints the digest of the `dist/` it checked;
 * `deploy` recomputes it on the artifact it is about to ship and refuses a mismatch, so what ships is what passed.
 *
 *   node ci/dist-digest.mjs <dir>                      prints sha256:<hex>
 *   node ci/dist-digest.mjs <dir> --expect sha256:<hex> exits 1 unless they match
 *
 * The digest covers every file's path and bytes, in sorted path order, each entry length-prefixed so that no
 * path/content split can collide with another. Node's standard library only: this runs in the secret-free and the
 * token-holding job, which never load the build's toolchain.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

function filesUnder(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(full));
    else if (e.isFile()) out.push(full);
    else throw new Error(`${full} is neither a file nor a folder`);
  }
  return out;
}

export function digestOf(dir) {
  const files = filesUnder(dir)
    .map((f) => ({ rel: relative(dir, f).split(sep).join("/"), full: f }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  if (!files.length) throw new Error(`${dir} has no files`);
  const h = createHash("sha256");
  for (const { rel, full } of files) {
    const name = Buffer.from(rel, "utf8");
    const body = readFileSync(full);
    h.update(`${name.length}:`).update(name).update(`${body.length}:`).update(body);
  }
  return `sha256:${h.digest("hex")}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [dir, flag, expected] = process.argv.slice(2);
  try {
    const d = digestOf(dir ?? "dist");
    if (flag === "--expect") {
      if (d !== expected) {
        console.error(`The artifact's digest ${d} does not match the one verify checked (${expected || "none"}). Refusing.`);
        process.exit(1);
      }
      console.error(`▸ The artifact is the one verify checked: ${d}`);
    }
    console.log(d);
  } catch (e) {
    console.error(`Cannot digest ${dir ?? "dist"}: ${e.message}`);
    process.exit(1);
  }
}
