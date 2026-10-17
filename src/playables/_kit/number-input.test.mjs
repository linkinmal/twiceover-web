import { describe, expect, it } from "vitest";
import { readNumber, showNumber } from "./number-input.mjs";

describe("number-input", () => {
  it("reads a plain number with a dot or a comma as the decimal mark", () => {
    expect(readNumber("105")).toBe(105);
    expect(readNumber("2.46")).toBe(2.46);
    expect(readNumber("2,46")).toBe(2.46);
    expect(readNumber(" .5 ")).toBe(0.5);
    expect(readNumber("7.")).toBe(7);
    expect(readNumber("0")).toBe(0);
  });
  it("refuses everything else, so the box is marked invalid", () => {
    for (const bad of ["", " ", "abc", "-3", "+3", "1e3", "1 000", "1,000.50", "1.2.3", "$5", "5%", "NaN", "Infinity", "0x10", "٣"]) {
      expect(readNumber(bad), JSON.stringify(bad)).toBeNaN();
    }
  });
  it("refuses a comma followed by exactly three digits: a thousands separator, never cents (#4366)", () => {
    for (const bad of ["1,000", "1,250", "5,000", " 1,250 ", "0,125", "12,345"]) {
      expect(readNumber(bad), JSON.stringify(bad)).toBeNaN();
    }
    expect(readNumber("1,25")).toBe(1.25);
    expect(readNumber("1,5")).toBe(1.5);
    expect(readNumber("1.250")).toBe(1.25);
  });
  it("shows whole numbers bare and the rest with two decimals", () => {
    expect(showNumber(105)).toBe("105");
    expect(showNumber(2.1)).toBe("2.10");
    expect(showNumber(2.46)).toBe("2.46");
  });
});
