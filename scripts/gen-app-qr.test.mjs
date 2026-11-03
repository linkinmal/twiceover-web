import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QR_FILE, qrModules, qrSvg } from "./gen-app-qr.mjs";

describe("the QR code to twiceover.io/app", () => {
  it("the committed SVG is what the generator draws today, so it cannot go stale", () => {
    expect(readFileSync(QR_FILE, "utf8")).toBe(qrSvg());
  });

  it("is the 25-module code the QR board draws, with its three finder patterns", () => {
    const grid = qrModules();
    expect.soft(grid).toHaveLength(25);
    // Each finder is a 7×7 dark ring around a light ring around a dark 3×3 centre.
    for (const [r0, c0] of [[0, 0], [0, 18], [18, 0]]) {
      expect.soft(grid[r0][c0] && grid[r0 + 6][c0 + 6] && grid[r0 + 3][c0 + 3]).toBe(true);
      expect.soft(grid[r0 + 1][c0 + 1]).toBe(false);
    }
  });

  it("encodes a different code for a different address, so the test above is not blind", () => {
    expect(qrSvg("https://twiceover.io/pricing")).not.toBe(qrSvg());
  });
});
