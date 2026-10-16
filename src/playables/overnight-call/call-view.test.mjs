import { describe, expect, it } from "vitest";
import { money } from "./call-view.mjs";

describe("the overnight call's money", () => {
  it("prints an amount with the shared separator from $1,000 up, always at two decimals", () => {
    expect.soft(money(999.99)).toBe("$999.99");
    expect.soft(money(1000)).toBe("$1,000.00");
    expect.soft(money(100000)).toBe("$100,000.00");
    expect.soft(money(-1234.5)).toBe("$1,234.50");
  });
});
