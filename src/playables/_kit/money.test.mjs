import { describe, expect, it } from "vitest";
import { dollarsFromCents, groupThousands, price, wholeDollars } from "./money.mjs";

describe("the shared money formatter", () => {
  it("puts the separator in from $1,000 and not before", () => {
    expect.soft(dollarsFromCents(99999)).toBe("$999.99");
    expect.soft(dollarsFromCents(100000)).toBe("$1,000.00");
    expect.soft(dollarsFromCents(10000000)).toBe("$100,000.00");
    expect.soft(dollarsFromCents(123456789)).toBe("$1,234,567.89");
    expect.soft(dollarsFromCents(1)).toBe("$0.01");
  });

  it("prints a per-contract amount whole, with the separator", () => {
    expect.soft(wholeDollars(450000)).toBe("$450,000");
    expect.soft(wholeDollars(900)).toBe("$900");
    expect.soft(wholeDollars(1000)).toBe("$1,000");
  });

  it("prints a price whole when whole and in cents otherwise", () => {
    expect.soft(price(5100)).toBe("$5,100");
    expect.soft(price(100000)).toBe("$100,000");
    expect.soft(price(1074.6)).toBe("$1,074.60");
    expect.soft(price(99.5)).toBe("$99.50");
  });

  it("groups only the whole-number part of a plain number string", () => {
    expect.soft(groupThousands("1234.5678")).toBe("1,234.5678");
    expect.soft(groupThousands("999")).toBe("999");
    expect.soft(groupThousands("1000000")).toBe("1,000,000");
  });
});
