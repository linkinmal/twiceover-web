import { describe, expect, it } from "vitest";
import { OWN_LICENCE, pictureCredit } from "./credit.mjs";

describe("pictureCredit", () => {
  it("prints nothing for a picture we made, whatever its source field says", () => {
    expect.soft(pictureCredit({ source: "TwiceOver’s Earnings history section", licence: OWN_LICENCE })).toBeNull();
    expect.soft(pictureCredit({ source: "Haghani and Dewey, 2016", licence: "  Own chart " })).toBeNull();
  });
  it("prints the source and licence of any other picture", () => {
    expect.soft(pictureCredit({ source: "National Archives", licence: "Public domain" })).toEqual({ source: "National Archives", licence: "Public domain" });
    expect.soft(pictureCredit({ source: "TwiceOver", licence: "Own work" })).toEqual({ source: "TwiceOver", licence: "Own work" });
  });
  it("names the one licence value a picture of ours carries", () => {
    expect.soft(OWN_LICENCE).toBe("Own chart");
  });
});
