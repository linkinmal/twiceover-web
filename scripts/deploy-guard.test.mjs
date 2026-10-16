/**
 * A deploy never runs on a moved blog clock (ADR 1090 Decision 4; Security consult 1091). Pull requests
 * set BLOG_NOW far ahead so every post is built; if that reached a deploy, future posts would go live.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// deploy.sh is a REAL deploy (a test of this once shipped a branch to production). So it runs here only
// with a refusal's trigger set (BLOG_NOW, BLOG_CONTENT_DIR, or no token), and with a PATH whose first entry holds
// fake `npm`, `npx`, `node`, `wrangler` and `security` that record themselves and exit 99: if a refusal were ever
// removed, the script would hit a fake and the test would say one ran.
function runGuarded(extraEnv = { BLOG_NOW: "2100-01-01T00:00:00Z" }) {
  const bin = mkdtempSync(join(tmpdir(), "deploy-guard-"));
  const ran = join(bin, "ran.log");
  for (const name of ["npm", "npx", "node", "wrangler", "security"]) {
    const f = join(bin, name);
    writeFileSync(f, `#!/bin/sh\necho ${name} >> "${ran}"\nexit 99\n`);
    chmodSync(f, 0o755);
  }
  const r = spawnSync("/bin/bash", ["scripts/deploy.sh"], { env: { PATH: `${bin}:/usr/bin:/bin`, ...extraEnv }, encoding: "utf8", timeout: 20000 });
  return { ...r, ran: existsSync(ran) };
}

describe("scripts/deploy.sh", () => {
  // ADR 1127 Decision 3: the deploy job ships the artifact verify checked. It builds nothing, runs no gate (verify
  // is the one gate list), and reads the token only from the env of its own step: no Keychain fallback.
  it("builds nothing, runs no gate and has no Keychain fallback", () => {
    const src = readFileSync(new URL("./deploy.sh", import.meta.url), "utf8").replace(/^\s*#.*$/gm, "");
    expect.soft(src).not.toMatch(/npm run build|astro/);
    expect.soft(src).not.toMatch(/\bnode\b/);
    expect.soft(src).not.toMatch(/\bsecurity\b|find-generic-password/);
    expect.soft(src).toContain("npx wrangler deploy");
  });
  it("refuses to run with no token in its environment, before it starts anything", () => {
    const r = runGuarded({});
    expect.soft(r.status).toBe(1);
    expect.soft(r.stderr).toContain("CLOUDFLARE_API_TOKEN is not set");
    expect.soft(r.ran, "no npm, npx, node, wrangler or security was started").toBe(false);
  });
  it("refuses to run with BLOG_NOW set, before it starts anything", () => {
    const r = runGuarded();
    expect.soft(r.status).toBe(1);
    expect.soft(r.stderr).toContain("BLOG_NOW is set");
    expect.soft(r.ran, "no npm, npx, node, wrangler or security was started").toBe(false);
  });
});

describe("scripts/deploy.sh and the post folder", () => {
  it("refuses to run with BLOG_CONTENT_DIR set, before it starts anything", () => {
    const r = runGuarded({ BLOG_CONTENT_DIR: "test-fixtures/blog" });
    expect.soft(r.status).toBe(1);
    expect.soft(r.stderr).toContain("BLOG_CONTENT_DIR is set");
    expect.soft(r.ran, "no npm, npx, node, wrangler or security was started").toBe(false);
  });
});

describe(".github/workflows/ci.yml", () => {
  const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const [buildJob, deployJob] = ci.split(/\n  deploy:/);

  it("sets BLOG_NOW in the checking job only for a pull request, and never in the deploy job", () => {
    expect.soft(buildJob).toMatch(/BLOG_NOW: \$\{\{ github\.event_name == 'pull_request' && '2100-01-01T00:00:00Z' \|\| '' \}\}/);
    expect.soft(deployJob).toBeDefined();
    expect.soft(deployJob).not.toContain("BLOG_NOW");
    expect.soft(ci, "no job points the build at another folder of posts").not.toContain("BLOG_CONTENT_DIR");
  });

  it("names exactly three triggers that can deploy, each only on main, and never a pull request", () => {
    const cond = /deploy:[\s\S]*?\n    if: ([^\n]+)/.exec(ci)[1];
    expect.soft([...cond.matchAll(/github\.event_name == '(\w+)'/g)].map((m) => m[1]).sort()).toEqual(["push", "schedule", "workflow_dispatch"]);
    expect.soft(cond).toContain("github.ref == 'refs/heads/main'");
    expect.soft(cond).not.toContain("pull_request");
    expect.soft(ci).toMatch(/\n  schedule:\n    - cron: "7 11 \* \* \*"\n    - cron: "7 12 \* \* \*"\n  workflow_dispatch:/);
  });

  it("checks the run is the head of main before the one deploy step, and has no second deploy step", () => {
    const steps = deployJob.split("\n").filter((l) => /^      - run:/.test(l));
    const guard = steps.findIndex((l) => l.includes("scripts/assert-head-of-main.sh"));
    const deploy = steps.findIndex((l) => l.includes("npm run deploy"));
    expect.soft(guard).toBeGreaterThan(-1);
    expect.soft(guard).toBeLessThan(deploy);
    expect.soft(steps.filter((l) => /deploy|wrangler/.test(l))).toHaveLength(1);
  });

});
