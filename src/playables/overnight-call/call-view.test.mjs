import { describe, expect, it } from "vitest";
import { money, nightHtml } from "./call-view.mjs";
import { DEFAULTS, runOvernight } from "./overnight-call.mjs";

describe("the overnight call's money", () => {
  it("prints an amount with the shared separator from $1,000 up, always at two decimals", () => {
    expect.soft(money(999.99)).toBe("$999.99");
    expect.soft(money(1000)).toBe("$1,000.00");
    expect.soft(money(100000)).toBe("$100,000.00");
    expect.soft(money(-1234.5)).toBe("$1,234.50");
  });

  it("prints the night sentence's strike and stock with the separator, whole dollars bare (a $100,000 stock)", () => {
    const big = nightHtml(runOvernight({ ...DEFAULTS, stock: 100000, strike: 99500 }));
    expect.soft(big).toContain("a $99,500 strike");
    expect.soft(big).toContain("on a $100,000 stock");
    expect.soft(nightHtml(runOvernight({ ...DEFAULTS, stock: 5000, strike: 5100.5 }))).toContain("a $5,100.50 strike");
    expect.soft(nightHtml(runOvernight(DEFAULTS))).toContain("a $105 strike");
  });
});
