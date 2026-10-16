import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { observabilityOn } from "./check-observability-off.mjs";

describe("observabilityOn (consultation 0008)", () => {
  it("is false with no observability block, a disabled one, or an enabled one only in a comment", () => {
    expect.soft(observabilityOn(`{ "name": "x" }`)).toBe(false);
    expect.soft(observabilityOn(`{ "observability": { "enabled": false } }`)).toBe(false);
    expect.soft(observabilityOn(`{\n  // "observability": { "enabled": true }\n  "name": "x"\n}`)).toBe(false);
  });

  it("is true when the block enables it, across lines and beside other keys", () => {
    expect.soft(observabilityOn(`{ "observability": { "enabled": true } }`)).toBe(true);
    expect.soft(observabilityOn(`{\n  "observability": {\n    "head_sampling_rate": 1,\n    "enabled": true\n  }\n}`)).toBe(true);
  });

  it("passes on this repo's wrangler.jsonc", () => {
    const r = spawnSync(process.execPath, ["ci/check-observability-off.mjs"], { encoding: "utf8" });
    expect.soft(r.status).toBe(0);
    expect.soft(r.stdout).toContain("observability off");
  });
});
