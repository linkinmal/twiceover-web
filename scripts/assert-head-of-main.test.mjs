import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The guard runs against a real (local) remote, not a fake git: a bare repo whose main moves on.
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();

function remote() {
  const root = mkdtempSync(join(tmpdir(), "head-of-main-"));
  const bare = join(root, "bare.git");
  const work = join(root, "work");
  git(root, "init", "-q", "--bare", "-b", "main", bare);
  git(root, "clone", "-q", bare, work);
  git(work, "commit", "-q", "--allow-empty", "-m", "one");
  const first = git(work, "rev-parse", "HEAD");
  git(work, "push", "-q", "origin", "HEAD:main");
  git(work, "commit", "-q", "--allow-empty", "-m", "two");
  const second = git(work, "rev-parse", "HEAD");
  git(work, "push", "-q", "origin", "HEAD:main");
  return { work, first, second, root };
}

const guard = (cwd, env) => spawnSync("/bin/bash", [join(process.cwd(), "scripts/assert-head-of-main.sh")], { cwd, env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });

describe("scripts/assert-head-of-main.sh", () => {
  const { work, first, second, root } = remote();
  it("passes when the run's SHA is the head of main", () => {
    expect(guard(work, { GITHUB_SHA: second }).status).toBe(0);
  });
  it("refuses a run whose SHA main has moved past (an old run re-run, or one a newer merge overtook)", () => {
    const r = guard(work, { GITHUB_SHA: first });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("main is now at");
  });
  it("refuses with no SHA, and with a remote that has no main", () => {
    expect(guard(work, {}).status).toBe(1);
    const empty = join(root, "empty.git");
    git(root, "init", "-q", "--bare", "-b", "main", empty);
    git(work, "remote", "add", "empty", empty);
    const r = spawnSync("/bin/bash", [join(process.cwd(), "scripts/assert-head-of-main.sh"), "empty"], { cwd: work, env: { PATH: process.env.PATH, GITHUB_SHA: second }, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Could not read the head of main");
  });
});
