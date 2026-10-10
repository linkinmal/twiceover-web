/**
 * A deploy never runs on a moved blog clock (ADR 1090 Decision 4; Security consult 1091). Pull requests
 * set BLOG_NOW far ahead so every post is built; if that reached a deploy, future posts would go live.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// deploy.sh is a REAL deploy. This runs it only with BLOG_NOW set, and with a PATH that holds no npm, node
// or wrangler, so that even if the guard were ever removed the script would fail at its first command
// instead of building and deploying (a test of this once shipped a branch to production).
const run = (env) => spawnSync("/bin/bash", ["scripts/deploy.sh"], { env: { PATH: "/usr/bin:/bin", ...env }, encoding: "utf8", timeout: 20000 });

describe("scripts/deploy.sh", () => {
  it("refuses to run with BLOG_NOW set, before it builds or touches a credential", () => {
    const r = run({ BLOG_NOW: "2100-01-01T00:00:00Z" });
    expect.soft(r.status).toBe(1);
    expect.soft(r.stderr).toContain("BLOG_NOW is set");
    expect.soft(r.stdout).not.toContain("Build");
    expect.soft(readFileSync(new URL("./deploy.sh", import.meta.url), "utf8").indexOf("BLOG_NOW")).toBeLessThan(
      readFileSync(new URL("./deploy.sh", import.meta.url), "utf8").indexOf("npm run build"),
    );
  });
});

describe(".github/workflows/ci.yml", () => {
  const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const [buildJob, deployJob] = ci.split(/\n  deploy:/);

  it("sets BLOG_NOW in the checking job only for a pull request, and never in the deploy job", () => {
    expect.soft(buildJob).toMatch(/BLOG_NOW: \$\{\{ github\.event_name == 'pull_request' && '2100-01-01T00:00:00Z' \|\| '' \}\}/);
    expect.soft(deployJob).toBeDefined();
    expect.soft(deployJob).not.toContain("BLOG_NOW");
  });
});
