import { describe, it, expect } from "vitest";
import { luminance, ratio } from "./contrast.mjs";

describe("luminance", () => {
  it("throws on a 3-digit shorthand hex instead of returning NaN", () => {
    expect(() => luminance("#fff")).toThrow(/not a 6-digit hex/);
  });

  it("throws on a non-hex color keyword instead of returning NaN", () => {
    expect(() => luminance("red")).toThrow(/not a 6-digit hex/);
  });

  it("throws on a typo'd hex digit instead of returning NaN", () => {
    expect(() => luminance("#GGGGGG")).toThrow(/not a 6-digit hex/);
  });

  it("throws on an 8-digit ARGB hex (a shadow color, never a contrast subject)", () => {
    expect(() => luminance("#211D1714")).toThrow(/not a 6-digit hex/);
  });

  it("computes the known relative luminance of pure white", () => {
    expect(luminance("#FFFFFF")).toBeCloseTo(1, 10);
  });

  it("computes the known relative luminance of pure black", () => {
    expect(luminance("#000000")).toBeCloseTo(0, 10);
  });

  it("accepts a hex string without the leading #", () => {
    expect(luminance("FFFFFF")).toBeCloseTo(1, 10);
  });
});

describe("ratio", () => {
  it("computes the maximum WCAG contrast ratio for black on white", () => {
    expect(ratio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("computes 1:1 for identical colors", () => {
    expect(ratio("#855E10", "#855E10")).toBeCloseTo(1, 10);
  });

  it("propagates the malformed-input throw rather than silently passing", () => {
    expect(() => ratio("#fff", "#FFFFFF")).toThrow(/not a 6-digit hex/);
  });
});
