/**
 * The post-only lane check, as a job (ADR 1090 Decision 5; Security consult 1091).
 *
 * Runs from `.github/workflows/lane.yml`, a `pull_request_target` workflow defined on `main`. It checks out
 * `main` (never the pull request), installs nothing, and reads the pull request ONLY through the GitHub API:
 * the file list (with `previous_filename`), the head commit's tree (mode, type, size), the bytes of the changed
 * post files and images, and each changed post's text at the base. The decision is `src/blog/lane.mjs`.
 * A pull request with a card and a path of the generator chain is a `regen` pull request (ADR 1090 Amendment 4); the
 * report says it is a normal-lane pull request, and the step output `lane` names the kind.
 *
 * Everything from the pull request is data. File names are printed JSON-quoted. Every API path is built from
 * a fixed route and a path that already matched an exact allowlist, or a commit SHA checked as 40 hex digits.
 * Any error (an API failure, a truncated tree, a file list at the API's 3000-file ceiling) fails the job.
 *
 *   env: GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, BASE_SHA, HEAD_SHA
 */
import { execFile } from "node:child_process";
import { appendFileSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { evaluateLane, inLaneDir, kindOf, regenKind } from "../src/blog/lane.mjs";

const run = promisify(execFile);
const PAGE = 100;
const API_FILE_CEILING = 3000;

/** The real API: `gh api`, with the arguments as an array (no shell). */
export const ghApi = async (args) => (await run("gh", ["api", ...args], { maxBuffer: 64 * 1024 * 1024, encoding: "buffer" })).stdout;

export function readEnv(env) {
  const need = (k, re) => {
    const v = env[k];
    if (typeof v !== "string" || !re.test(v)) throw new Error(`${k} is missing or malformed`);
    return v;
  };
  return {
    repo: need("GITHUB_REPOSITORY", /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
    pr: need("PR_NUMBER", /^[0-9]{1,9}$/),
    base: need("BASE_SHA", /^[0-9a-f]{40}$/),
    head: need("HEAD_SHA", /^[0-9a-f]{40}$/),
  };
}

/** @param {(args: string[]) => Promise<Buffer>} api */
export async function check({ repo, pr, base, head }, api, now = Date.now()) {
  const json = async (args) => JSON.parse((await api(args)).toString("utf8"));

  const files = [];
  for (let page = 1; page <= Math.ceil(API_FILE_CEILING / PAGE) + 1; page++) {
    const got = await json([`repos/${repo}/pulls/${pr}/files?per_page=${PAGE}&page=${page}`]);
    if (!Array.isArray(got)) throw new Error("the file list was not a list");
    files.push(...got);
    if (got.length < PAGE) break;
  }
  if (files.length >= API_FILE_CEILING) return { post: true, kind: "post", problems: [`the pull request lists ${files.length} files, the API's ceiling; the lane cannot see them all`], lines: [] };
  if (!files.some((f) => [f.filename, f.previous_filename].some((n) => typeof n === "string" && inLaneDir(n)))) {
    return { post: false, kind: "none", problems: [], lines: [`not a post pull request: ${files.length} file(s), none in a post directory`] };
  }

  const t = await json([`repos/${repo}/git/trees/${head}?recursive=1`]);
  if (t.truncated) throw new Error("the head commit's tree was truncated");
  const tree = new Map(t.tree.filter((e) => inLaneDir(e.path) || regenKind(e.path)).map((e) => [e.path, { type: e.type, mode: e.mode, size: e.size, sha: e.sha }]));

  return evaluateLane({
    files,
    tree,
    now,
    readHead: async (path, sha) => {
      if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("a tree entry has no valid blob SHA");
      const b = await json([`repos/${repo}/git/blobs/${sha}`]);
      if (b.encoding !== "base64") throw new Error("a blob was not base64");
      return Buffer.from(b.content, "base64");
    },
    readBase: async (path) => {
      if (kindOf(path) !== "post") throw new Error("the lane reads the base only for a post path");
      try {
        return (await api([`repos/${repo}/contents/${path}?ref=${base}`, "-H", "Accept: application/vnd.github.raw"])).toString("utf8");
      } catch (e) {
        if (/404|Not Found/.test(String(e.stderr ?? e.message))) return null;
        throw e;
      }
    },
  });
}

export function report(result) {
  const out = [];
  if (!result.post) out.push(`Lane: ${result.lines[0]}`);
  else if (result.problems.length === 0 && result.kind === "regen") {
    out.push(
      "Lane: regen pull request, every file allowed. This is a NORMAL-LANE pull request: it needs the Architect's and Security's review, and is not post-only.",
      "  The regeneration set paths and cards it touches:",
      ...result.lines.map((l) => `  ${l}`),
    );
  } else if (result.problems.length === 0) out.push("Lane: post-only pull request, every file allowed.", ...result.lines.map((l) => `  ${l}`));
  else out.push(`Lane FAILED: ${result.problems.length} problem(s).`, ...result.problems.map((p) => `  ${p}`));
  return out.join("\n");
}

async function main() {
  const result = await check(readEnv(process.env), ghApi);
  const text = report(result);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "```\n" + text + "\n```\n");
  // The lane kind, a fixed word and never a pull-request value: `none`, `post` or `regen`.
  if (process.env.GITHUB_OUTPUT && result.problems.length === 0) appendFileSync(process.env.GITHUB_OUTPUT, `lane=${result.post ? result.kind : "none"}\n`);
  return result.problems.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(
    (c) => process.exit(c),
    (e) => {
      console.error(`Lane FAILED: ${String(e.message).slice(0, 300)}`);
      process.exit(1);
    },
  );
}
