/**
 * The build/deploy split (ADR 1127 Decision 3, Security consult 1125 condition 5).
 *
 * `build-and-check` builds and is treated as untrusted: admitted code runs there. `verify` runs every gate on the
 * built `dist/` from a fresh checkout, and `deploy` ships that same artifact. Neither of those two may run the build's
 * toolchain, and only the deploy step may hold the token. These tests pin that shape and that import graph.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const ci = read(".github/workflows/ci.yml");
const pkg = JSON.parse(read("package.json"));

/** The workflow's jobs, by name, each as its raw text. */
export function jobsOf(yml) {
  const body = yml.slice(yml.indexOf("\njobs:\n") + "\njobs:\n".length);
  const parts = body.split(/^  ([\w-]+):\n/m);
  const jobs = {};
  for (let i = 1; i < parts.length; i += 2) jobs[parts[i]] = parts[i + 1];
  return jobs;
}

/** A job's steps, each as its raw text. */
const stepsOf = (job = "") => job.split(/\n      - /).slice(1);
/** Every command a job's `run:` steps execute, one line each. */
function commandsOf(job) {
  const out = [];
  for (const s of stepsOf(job)) {
    const m = /(?:^|\n\s*)run: ?(\|)?([^\n]*)((?:\n {10,}[^\n]*)*)/.exec(s);
    if (!m) continue;
    if (m[1]) out.push(...m[3].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
    else out.push(m[2].trim());
  }
  return out;
}

const jobs = jobsOf(ci);
const GATES = Object.entries(pkg.scripts).filter(([k]) => k.startsWith("check:") && k !== "check:post").map(([, v]) => v);
GATES.push(pkg.scripts.check);

describe("ci.yml has three jobs, and only the deploy step holds the token", () => {
  it("names build-and-check (the required check), verify and deploy, and no other job", () => {
    expect(Object.keys(jobs)).toEqual(["build-and-check", "verify", "deploy"]);
  });

  it("reads the token once, in the env of the one step that runs the deploy", () => {
    expect.soft(ci.match(/\bsecrets\b/g), "every form: secrets.X, secrets['X'], toJSON(secrets), secrets: inherit").toHaveLength(1);
    expect.soft(ci).not.toMatch(/github\.token|GITHUB_TOKEN/);
    expect.soft(ci.match(/permissions:/g), "one workflow-level grant, no job widens it").toHaveLength(1);
    expect.soft(ci).toMatch(/\npermissions:\n  contents: read\n\njobs:/);
    const holders = stepsOf(jobs.deploy).filter((s) => s.includes("secrets.CLOUDFLARE_API_TOKEN"));
    expect.soft(holders).toHaveLength(1);
    expect.soft(holders[0]).toMatch(/^run: npm run deploy\n\s+env:\n\s+CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
    expect.soft(jobs.deploy.split("\n    steps:")[0], "no job-level env carries it").not.toContain("CLOUDFLARE_API_TOKEN");
  });

  it("checks out without persisted credentials in every job", () => {
    for (const [name, job] of Object.entries(jobs)) {
      const checkouts = stepsOf(job).filter((s) => s.startsWith("uses: actions/checkout@"));
      expect.soft(checkouts, name).toHaveLength(1);
      expect.soft(checkouts[0], name).toMatch(/\n\s+persist-credentials: false/);
    }
  });

  it("installs verify and deploy with --ignore-scripts and no cache, and builds nothing there", () => {
    for (const name of ["verify", "deploy"]) {
      const job = jobs[name];
      const cmds = commandsOf(job);
      expect.soft(cmds.filter((c) => /^npm (ci|install|i)\b/.test(c)), name).toEqual(["npm ci --ignore-scripts"]);
      expect.soft(job, name).not.toMatch(/\bcache:|actions\/cache/);
      expect.soft(cmds.filter((c) => /npm run build|npm test|\bastro\b|\bvite|vitest|npx (?!wrangler)/.test(c)), name).toEqual([]);
      expect.soft(job, `${name} downloads the build's artifact`).toMatch(/uses: actions\/download-artifact@v4\n\s+with:\n\s+name: dist\n\s+path: dist/);
    }
  });

  it("lets nothing in verify or deploy fail quietly or be skipped, and runs verify on every event", () => {
    expect.soft(jobs.verify).not.toMatch(/continue-on-error|^\s+if:/m);
    expect.soft(jobs.deploy).not.toMatch(/continue-on-error/);
    expect.soft(jobs.deploy.match(/^\s+if:/gm), "only the job's own main-only condition").toHaveLength(1);
    expect.soft(jobs.deploy).toMatch(/^    if: /m);
  });

  it("uses only checkout, setup-node and the artifact download in verify and deploy, and runs only known command forms", () => {
    const ALLOWED = /^(npm ci --ignore-scripts|node (ci|scripts)\/[\w.-]+\.mjs( [^;&|`$]*| dist --expect "\$VERIFIED_DIGEST")?|bash scripts\/[\w-]+\.sh|npm run deploy|d=\$\(node ci\/dist-digest\.mjs dist\)|echo "[^`]*")$/;
    for (const name of ["verify", "deploy"]) {
      const uses = stepsOf(jobs[name]).map((s) => /^uses: (\S+)/.exec(s)?.[1]).filter(Boolean);
      expect.soft(uses.filter((u) => !/^actions\/(checkout|setup-node|download-artifact)@v4$/.test(u)), name).toEqual([]);
      expect.soft(commandsOf(jobs[name]).filter((c) => !ALLOWED.test(c)), name).toEqual([]);
    }
  });

  it("gives wrangler no build command of its own, which would run in the deploy step", () => {
    expect(read("wrangler.jsonc").replace(/\/\/[^\n]*/g, "")).not.toMatch(/"build"\s*:/);
  });

  it("builds, tests and uploads dist/ in build-and-check, which runs no gate", () => {
    const cmds = commandsOf(jobs["build-and-check"]);
    expect.soft(cmds).toContain("npm run build");
    expect.soft(cmds).toContain("npm test");
    expect.soft(jobs["build-and-check"]).toMatch(/uses: actions\/upload-artifact@v4\n\s+with:\n\s+name: dist\n\s+path: dist\n\s+if-no-files-found: error\n\s+include-hidden-files: true\n/);
    expect.soft(cmds.filter((c) => GATES.includes(c) || /npm run check/.test(c)), "the one gate list is verify's").toEqual([]);
  });

  it("runs every gate in verify, after it downloads dist/, and prints the digest of what it checked", () => {
    const cmds = commandsOf(jobs.verify);
    expect.soft(GATES.length).toBeGreaterThan(9);
    for (const g of GATES) expect.soft(cmds, g).toContain(g);
    expect.soft(GATES).toContain("node ci/check-observability-off.mjs");
    expect.soft(jobs.verify).toMatch(/\n    outputs:\n      digest: \$\{\{ steps\.digest\.outputs\.digest \}\}/);
    const steps = stepsOf(jobs.verify);
    const at = (re) => steps.findIndex((s) => re.test(s));
    expect.soft(at(/download-artifact/)).toBeLessThan(at(/ci\/check-content\.mjs/));
    expect.soft(at(/id: digest/)).toBeGreaterThan(Math.max(...GATES.map((g) => at(new RegExp(g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))))));
  });

  it("deploys only after both, checks it is the head of main and that the artifact's digest is verify's, then deploys", () => {
    expect.soft(jobs.deploy).toMatch(/^    needs: \[build-and-check, verify\]$/m);
    const steps = stepsOf(jobs.deploy);
    const at = (re) => steps.findIndex((s) => re.test(s));
    const head = at(/scripts\/assert-head-of-main\.sh/);
    const digest = at(/^run: node ci\/dist-digest\.mjs dist --expect "\$VERIFIED_DIGEST"\n\s+env:\n\s+VERIFIED_DIGEST: \$\{\{ needs\.verify\.outputs\.digest \}\}/);
    const deploy = at(/run: npm run deploy/);
    expect.soft(head).toBeGreaterThan(-1);
    expect.soft(digest).toBeGreaterThan(at(/download-artifact/));
    expect.soft(Math.max(head, digest)).toBeLessThan(deploy);
    expect.soft(steps.filter((s) => /deploy|wrangler/.test(s.split("\n")[0])), "one deploy step").toHaveLength(1);
  });
});

// ── The import graph of what verify and deploy run ────────────────────────────
const FORBIDDEN_FILES = /^src\/(playables|blog-tools)\//;
const FORBIDDEN_PACKAGES = (name) => name === "astro" || name === "vite" || name.startsWith("@astrojs/") || name === "vitest";
const NPX_PACKAGE = { wrangler: "wrangler" };

/** The script files and npx packages a list of commands reaches, following `npm run` and `bash <script>`. */
export function entriesOf(commands, seen = new Set()) {
  const files = new Set();
  const packages = new Set();
  for (const c of commands) {
    for (const m of c.matchAll(/\bnode (\S+\.m?js)\b/g)) files.add(m[1]);
    for (const m of c.matchAll(/\bnpx (\S+)/g)) packages.add(NPX_PACKAGE[m[1]] ?? m[1]);
    for (const m of c.matchAll(/\bbash (\S+\.sh)\b/g)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      files.add(m[1]);
      const sub = entriesOf(read(m[1]).split("\n").filter((l) => !l.trim().startsWith("#")), seen);
      sub.files.forEach((f) => files.add(f));
      sub.packages.forEach((p) => packages.add(p));
    }
    for (const m of c.matchAll(/\bnpm run ([\w:-]+)/g)) {
      const scripts = [`pre${m[1]}`, m[1], `post${m[1]}`].map((k) => pkg.scripts[k]).filter(Boolean);
      const sub = entriesOf(scripts, seen);
      sub.files.forEach((f) => files.add(f));
      sub.packages.forEach((p) => packages.add(p));
    }
  }
  return { files: [...files], packages: [...packages] };
}

const packageName = (spec) => (spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);

/** Every project file the entries import, and every package they (and those packages, transitively) depend on. */
export async function reach({ files, packages }) {
  const js = files.filter((f) => /\.m?js$/.test(f)).map((f) => join(root, f));
  const inputs = new Set();
  const spawns = new Set();
  const pkgs = new Set(packages);
  if (js.length) {
    const r = await build({ entryPoints: js, bundle: true, platform: "node", format: "esm", packages: "external", metafile: true, write: false, logLevel: "silent", outdir: "out" });
    for (const [path, info] of Object.entries(r.metafile.inputs)) {
      inputs.add(path);
      for (const imp of info.imports) {
        if (imp.path === "node:child_process" || imp.path === "child_process") spawns.add(path);
        else if (imp.external && !imp.path.startsWith("node:")) pkgs.add(packageName(imp.path));
      }
      // createRequire's require("x") is not followed by the bundler; read it from the source.
      for (const m of readFileSync(join(root, path), "utf8").matchAll(/\brequire\(\s*["']([^"'.][^"']*)["']\s*\)/g)) pkgs.add(packageName(m[1]));
    }
  }
  const all = new Set();
  const visit = (name, from) => {
    if (all.has(name)) return;
    all.add(name);
    let dir = from;
    let found;
    for (;;) {
      const p = join(dir, "node_modules", name, "package.json");
      if (existsSync(p)) { found = p; break; }
      if (dir === root || dir === dirname(dir)) break;
      dir = dirname(dir);
    }
    if (!found) return;
    const meta = JSON.parse(readFileSync(found, "utf8"));
    for (const dep of Object.keys({ ...meta.dependencies, ...meta.optionalDependencies })) visit(dep, dirname(found));
  };
  for (const p of pkgs) visit(p, root);
  return { files: [...inputs], direct: [...pkgs], packages: [...all], spawns: [...spawns] };
}

const violations = ({ files, packages }) => [...files.filter((f) => FORBIDDEN_FILES.test(f)), ...packages.filter(FORBIDDEN_PACKAGES)];

describe("what verify and deploy run never reaches the build's toolchain or the playables", () => {
  const entries = entriesOf([...commandsOf(jobs.verify), ...commandsOf(jobs.deploy)]);

  it("finds the scripts the two jobs run", () => {
    for (const f of ["ci/check-content.mjs", "ci/check-observability-off.mjs", "ci/dist-digest.mjs", "scripts/gen-blog-share.mjs", "scripts/deploy.sh", "scripts/assert-head-of-main.sh"]) {
      expect.soft(entries.files, f).toContain(f);
    }
    expect.soft(entries.packages).toEqual(["wrangler"]);
  });

  it("reaches no file under src/playables/ or src/blog-tools/, and no astro, vite or vitest, directly or through a dependency", async () => {
    const r = await reach(entries);
    expect.soft(r.files, "the walk sees the share-card gate's schema").toContain("src/blog/schema.mjs");
    expect.soft(r.direct, "the walk sees createRequire's resvg").toContain("@resvg/resvg-js");
    expect.soft(r.packages, "the walk follows dependencies").toContain("zod");
    expect.soft(violations(r)).toEqual([]);
    expect.soft(r.spawns, "no script starts a process the walk cannot follow").toEqual([]);
  }, 30000);

  it("fails on a script that reaches astro, a playable, or a package that depends on vite", async () => {
    const dir = mkdtempSync(join(root, "node_modules", ".pipeline-test-"));
    const write = (name, body) => {
      writeFileSync(join(dir, name), body);
      return relative(root, join(dir, name));
    };
    try {
      const viaAstro = write("a.mjs", 'import { z } from "astro/zod"; export default z;');
      const viaTool = write("b.mjs", `import "${relative(dir, join(root, "src/blog-tools/coin-game.mjs"))}";`);
      expect.soft(violations(await reach({ files: [viaAstro], packages: [] }))).toContain("astro");
      expect.soft(violations(await reach({ files: [viaTool], packages: [] }))).toContain("src/blog-tools/coin-game.mjs");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect.soft(violations(await reach({ files: [], packages: ["vite-node"] })), "a dependency's own dependencies are walked").toContain("vite");
  }, 30000);
});
