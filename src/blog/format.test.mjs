import { describe, expect, it } from "vitest";
import { formatStamp, toNewYorkIso, hasUpdate } from "./format.mjs";

describe("formatStamp", () => {
  it("prints the instant in New York, whatever offset the source carries", () => {
    expect.soft(formatStamp("2026-10-09T07:00:00-04:00")).toBe("Fri 9 Oct 2026 · 07:00 New York");
    expect.soft(formatStamp("2026-10-09T11:00:00Z")).toBe("Fri 9 Oct 2026 · 07:00 New York");
    expect.soft(formatStamp("2026-10-09T13:00:00+02:00")).toBe("Fri 9 Oct 2026 · 07:00 New York");
  });
  it("crosses midnight and a year the way the New York wall clock does, and keeps a single-digit day plain", () => {
    expect.soft(formatStamp("2027-01-01T02:30:00Z")).toBe("Thu 31 Dec 2026 · 21:30 New York");
    expect.soft(formatStamp("2026-11-02T12:00:00Z")).toBe("Mon 2 Nov 2026 · 07:00 New York");
  });
  it("refuses a time it cannot read", () => {
    expect(() => formatStamp("tomorrow")).toThrow(/not an ISO time/);
  });
});

describe("toNewYorkIso", () => {
  // Independent reference: New York is UTC-4 from the second Sunday of March to the first Sunday of November, UTC-5 otherwise.
  it.each([
    ["2026-10-09T11:00:00Z", "2026-10-09T07:00:00-04:00"],
    ["2026-11-02T12:00:00Z", "2026-11-02T07:00:00-05:00"],
    ["2026-03-08T11:00:00Z", "2026-03-08T07:00:00-04:00"],
    ["2026-03-08T06:59:59Z", "2026-03-08T01:59:59-05:00"],
    ["2026-11-01T11:00:00Z", "2026-11-01T06:00:00-05:00"],
    ["2026-11-01T05:30:00Z", "2026-11-01T01:30:00-04:00"],
    ["2026-07-04T00:00:00-04:00", "2026-07-04T00:00:00-04:00"],
  ])("%s -> %s", (input, expected) => {
    expect(toNewYorkIso(input)).toBe(expected);
  });
  it("names the same instant as its input", () => {
    for (const t of ["2026-10-09T11:00:00Z", "2026-12-24T23:59:59-05:00", "2026-03-08T07:00:00-04:00"]) {
      expect.soft(Date.parse(toNewYorkIso(t)), t).toBe(Date.parse(t));
    }
  });
});

describe("hasUpdate", () => {
  it("is true only for an update after the publish time", () => {
    const p = { publishAt: "2026-10-09T07:00:00-04:00" };
    expect.soft(hasUpdate(p)).toBe(false);
    expect.soft(hasUpdate({ ...p, updatedAt: "2026-10-09T11:00:00Z" })).toBe(false);
    expect.soft(hasUpdate({ ...p, updatedAt: "2026-10-10T08:00:00-04:00" })).toBe(true);
  });
});

import { formatDay, splitHit } from "./format.mjs";

describe("formatDay and splitHit", () => {
  it("formatDay is the stamp without the time", () => {
    expect(formatDay("2026-10-09T11:00:00Z")).toBe("Fri 9 Oct 2026");
  });
  it("splitHit cuts the title around the first occurrence of the highlighted words, or leaves it whole", () => {
    expect.soft(splitHit("a call lost 21% of its value", "21%")).toEqual(["a call lost ", "21%", " of its value"]);
    expect.soft(splitHit("a call", "21%")).toEqual(["a call", "", ""]);
    expect.soft(splitHit("a call", undefined)).toEqual(["a call", "", ""]);
    expect.soft(splitHit("21% and 21%", "21%")).toEqual(["", "21%", " and 21%"]);
  });
});
