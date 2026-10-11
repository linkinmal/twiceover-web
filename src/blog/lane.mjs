/**
 * lane — the post-only review lane (ADR 1090 Decision 5, Security consult 1091 conditions).
 *
 * A pull request that touches a post, a post image or a share image is a POST pull request, and it may touch
 * only those, by exact path. Anything else in it fails. A pull request that touches none of them is not a post
 * pull request; the lane has nothing to say and passes it, to its normal review.
 *
 * This module only decides. It reads nothing and runs nothing from the pull request: `ci/blog-lane.mjs`
 * hands it the file list, the tree at the head commit (for file mode and size) and two readers, all from
 * the GitHub API, and the workflow that calls it is defined on `main` (`.github/workflows/lane.yml`).
 *
 * Beyond path, mode, type and size, one rule protects a published address: a post that is already live (its
 * base `publishAt` has passed) cannot be removed, renamed, or given a different `publishAt`. A pull request
 * builds with the clock far ahead and cannot see that on its own (PR 5b's stable-address check catches it
 * only after merge).
 */
import { readStrictFrontMatter } from "./frontmatter-grammar.mjs";
import { isValidSlug, parsePublishTime } from "./publish.mjs";

export const POST_DIR = "src/content/blog/";
/** The one post-image directory. Flat; `schema.mjs` allows `/blog-images/<name>` only. */
export const IMAGE_DIR = "public/blog-images/";
/** The one share-image directory: `public/blog-share/<slug>.png`, the card the post's page names (PR 5d). */
export const SHARE_DIR = "public/blog-share/";
export const LANE_PREFIXES = Object.freeze([POST_DIR, IMAGE_DIR, SHARE_DIR]);

export const LIMITS = Object.freeze({ postBytes: 200_000, imageBytes: 2_000_000, shareBytes: 1_000_000, imagesTotalBytes: 8_000_000, maxFiles: 400 });

const POST = /^src\/content\/blog\/([a-z0-9-]{1,64})\.md$/;
const IMAGE = /^public\/blog-images\/[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$/;
const SHARE = /^public\/blog-share\/([a-z0-9-]{1,64})\.png$/;

/** @returns {"post" | "image" | "share" | null} what an exact path is, or null when it is not an allowed path */
export function kindOf(path) {
  let m = POST.exec(path);
  if (m) return isValidSlug(m[1]) ? "post" : null;
  if (IMAGE.test(path)) return "image";
  m = SHARE.exec(path);
  if (m) return isValidSlug(m[1]) ? "share" : null;
  return null;
}

/** Whether a path is in a lane directory at all (allowed or not). */
export const inLaneDir = (path) => LANE_PREFIXES.some((p) => path.startsWith(p));

const startsWith = (b, bytes, at = 0) => bytes.every((x, i) => b[at + i] === x);
const ascii = (b, at, s) => [...s].every((c, i) => b[at + i] === c.charCodeAt(0));

/** @param {Uint8Array} b @returns {"png" | "jpeg" | "webp" | "avif" | null} the type the leading bytes say */
export function magicKind(b) {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "webp";
  if (ascii(b, 4, "ftyp") && (ascii(b, 8, "avif") || ascii(b, 8, "avis"))) return "avif";
  return null;
}

const extType = (path) => {
  const e = path.slice(path.lastIndexOf(".") + 1);
  return e === "jpg" ? "jpeg" : e;
};

/** A path made safe to print: JSON-quoted (no control character, no line that begins with `::`), and cut short. */
export const show = (p) => JSON.stringify(String(p)).slice(0, 200);

/**
 * @param {object} a
 * @param {{filename: string, previous_filename?: string, status: string}[]} a.files the pull request's files, from the API
 * @param {Map<string, {type: string, mode: string, size: number, sha: string}>} a.tree entries of the head commit's tree, by path
 * @param {(path: string, sha: string) => Promise<Uint8Array>} a.readHead the bytes of a file at the head commit
 * @param {(path: string) => Promise<string | null>} a.readBase a post's text at the base commit, or null if it was not there
 * @param {number} a.now the real clock, in epoch milliseconds
 * @returns {Promise<{post: boolean, problems: string[], lines: string[]}>}
 */
export async function evaluateLane({ files, tree, readHead, readBase, now }) {
  const names = (f) => [f.filename, f.previous_filename].filter((x) => typeof x === "string");
  const post = files.some((f) => names(f).some(inLaneDir));
  if (!post) return { post: false, problems: [], lines: [`not a post pull request: ${files.length} file(s), none in a post directory`] };

  const problems = [];
  const lines = [];
  if (files.length > LIMITS.maxFiles) problems.push(`${files.length} files; a post pull request carries at most ${LIMITS.maxFiles}`);

  let imageBytes = 0;
  for (const f of files) {
    const path = f.filename;
    for (const n of names(f)) if (kindOf(n) === null) problems.push(`${show(n)} is not an allowed path (a post pull request touches only src/content/blog/<slug>.md, public/blog-images/<name>.<png|jpg|jpeg|webp|avif> and public/blog-share/<slug>.png)`);
    if (kindOf(path) === null) continue;
    if (!["added", "modified", "removed", "renamed", "copied", "changed"].includes(f.status)) {
      problems.push(`${show(path)} has the status ${show(f.status)}, which the lane does not know`);
      continue;
    }

    const kind = kindOf(path);
    const prev = typeof f.previous_filename === "string" ? f.previous_filename : null;

    // A live post's address is never removed, renamed away, or re-dated.
    for (const old of [f.status === "removed" ? path : null, f.status === "renamed" ? prev : null]) {
      if (old && kindOf(old) === "post") {
        const base = await readBase(old);
        if (base === null) problems.push(`${show(old)}: its text at the base could not be read, so it cannot be shown not to be live`);
        else if (isLive(base, now)) problems.push(`${show(old)} is a live post; a published address is never removed or renamed`);
      }
    }
    if (f.status === "removed") continue;

    const entry = tree.get(path);
    if (!entry) {
      problems.push(`${show(path)} is not in the head commit's tree`);
      continue;
    }
    if (entry.type !== "blob" || entry.mode !== "100644") problems.push(`${show(path)} is not a plain file (mode ${show(entry.mode)}, type ${show(entry.type)}); no symlink, no executable`);
    const cap = kind === "post" ? LIMITS.postBytes : kind === "share" ? LIMITS.shareBytes : LIMITS.imageBytes;
    if (!(entry.size <= cap)) {
      problems.push(`${show(path)} is ${entry.size} bytes; the cap is ${cap}`);
      continue;
    }
    if (entry.type !== "blob" || entry.mode !== "100644") continue;

    const bytes = await readHead(path, entry.sha);
    if (!(bytes.length <= cap)) {
      problems.push(`${show(path)} reads as ${bytes.length} bytes; the cap is ${cap}`);
      continue;
    }
    if (kind !== "post") imageBytes += bytes.length;
    if (kind === "post") {
      // The lane reads a post only through the strict grammar (frontmatter-grammar.mjs), never as YAML: on text the
      // grammar accepts, its reading and the build's cannot differ. Anything else fails closed.
      const fm = readStrictFrontMatter(Buffer.from(bytes).toString("utf8"));
      if (!fm.ok) {
        problems.push(`${show(path)}: its front matter is outside the strict form the lane reads (line ${fm.line}: ${fm.reason})`);
        continue;
      }
      const headAt = parsePublishTime(fm.publishAt);
      if (headAt === null) {
        problems.push(`${show(path)}: no readable publishAt in its front matter`);
        continue;
      }
      if (f.status === "modified" || f.status === "changed") {
        const base = await readBase(path);
        if (base === null) problems.push(`${show(path)}: its text at the base could not be read`);
        else {
          const baseAt = publishTime(base);
          if (baseAt === null) problems.push(`${show(path)}: its text at the base is outside the strict form or has no readable publishAt, so it cannot be shown not to be live`);
          else if (baseAt <= now && baseAt !== headAt) problems.push(`${show(path)} is a live post; its publishAt cannot change`);
        }
      }
    } else {
      const got = magicKind(bytes);
      const want = kind === "share" ? "png" : extType(path);
      if (got !== want) problems.push(`${show(path)}: its first bytes say ${got ?? "no image type the lane allows"}, its name says ${want}`);
    }
    lines.push(`${kind} ${show(path)} (${f.status})`);
  }
  if (imageBytes > LIMITS.imagesTotalBytes) problems.push(`images total ${imageBytes} bytes; the cap is ${LIMITS.imagesTotalBytes}`);
  return { post: true, problems, lines };
}

/** A post is live when its publishAt has passed. A time that cannot be read counts as live: fail closed. */
function isLive(text, now) {
  const at = publishTime(text);
  return at === null || at <= now;
}

/** A post's publishAt as an instant, read through the strict grammar; null when the text is outside it or has none. */
function publishTime(text) {
  const fm = readStrictFrontMatter(text);
  return fm.ok ? parsePublishTime(fm.publishAt) : null;
}
