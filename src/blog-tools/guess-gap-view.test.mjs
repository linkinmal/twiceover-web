import { describe, expect, it } from "vitest";
import { answerHtml, barsHtml, dateLabel, endTitle, givenHtml, lessonBig, meterHtml, percent, reportLine, scoreHtml, scoreLine, tallyHtml, whyText } from "./guess-gap-view.mjs";

// Invented figures for the wording's own tests; the baked-in set is checked in guess-gap-reports.test.mjs.
const set = [
  { company: "Sample Co. A", date: "2025-07-24", pricedTenths: 51, movedTenths: 112 },
  { company: "Sample Co. B", date: "2025-07-30", pricedTenths: 74, movedTenths: -30 },
  { company: "Sample Co. C", date: "2025-08-05", pricedTenths: 42, movedTenths: 11 },
  { company: "Sample Co. D", date: "2025-08-21", pricedTenths: 90, movedTenths: -146 },
  { company: "Sample Co. E", date: "2025-09-04", pricedTenths: 63, movedTenths: 58 },
];
const R = (priced, moved, company = "Sample Co.") => ({ company, date: "2025-07-24", pricedTenths: priced, movedTenths: moved });

describe("Guess the gap's words", () => {
  it("formats tenths as a percent, an ISO date as day, month and year, and the progress lines", () => {
    expect.soft(percent(112)).toBe("11.2%");
    expect.soft(percent(5)).toBe("0.5%");
    expect.soft(percent(0)).toBe("0.0%");
    expect.soft(dateLabel("2025-07-24")).toBe("24 Jul 2025");
    expect.soft(dateLabel("2025-09-04")).toBe("4 Sep 2025");
    expect.soft(reportLine(0, 5)).toBe("Report 1 of 5");
    expect.soft(scoreLine(set, [])).toBe("Score so far: none yet");
    expect.soft(scoreLine(set, [110])).toBe("Score so far: 1 of 1 hits");
    expect.soft(scoreLine(set, [10, 0])).toBe("Score so far: 0 of 2 hits");
  });

  it("gives the report and the priced move, and the move that happened in words as well as colour", () => {
    expect.soft(givenHtml(set[0])).toBe("<b>Sample Co. A</b> reported on 24 Jul 2025. Options had priced a move of <b>5.1%</b>.");
    expect.soft(answerHtml(set[0])).toBe('It moved <span class="pos">up 11.2%</span>.');
    expect.soft(answerHtml(set[1])).toBe('It moved <span class="neg">down 3.0%</span>.');
  });

  it("escapes a company name, so a name can never become markup", () => {
    expect.soft(givenHtml(R(50, 10, '<img src=x onerror=alert(1)>'))).not.toContain("<img");
    expect.soft(tallyHtml([R(50, 10, "A&B <i>")], [])).toContain("A&amp;B &lt;i&gt;");
    expect.soft(barsHtml([R(50, 10, "A&B <i>")])).toContain("A&amp;B &lt;i&gt;");
  });

  it("builds the why sentence from the two numbers, tier by tier, then how far off the guess was", () => {
    expect.soft(whyText(R(51, 112), 110)).toBe("That is 2.2 times the 5.1% options had priced. Your guess was 0.2 points away, a hit.");
    expect.soft(whyText(R(50, 89), 60)).toBe("That is more than the 5.0% options had priced. Your guess was 2.9 points away.");
    expect.soft(whyText(R(100, -105), 100)).toBe("That is close to the 10.0% options had priced. Your guess was 0.5 points away, a hit.");
    expect.soft(whyText(R(74, -30), 130)).toBe("That is inside the 7.4% options had priced. Your guess was 10.0 points away.");
  });

  it("says a hit exactly when the printed distance is 2.0 or less, never a distance of 2.0 without the hit", () => {
    expect.soft(whyText(R(50, 21), 41)).toBe("That is inside the 5.0% options had priced. Your guess was 2.0 points away, a hit.");
    expect.soft(whyText(R(50, 21), 42)).toBe("That is inside the 5.0% options had priced. Your guess was 2.1 points away.");
  });

  it("draws the meter: the priced band, the guess and the move, and one merged mark when they sit close", () => {
    const apart = meterHtml(R(51, 112), 20);
    expect.soft(apart).toContain('class="gg-bd" style="width:17%"');
    expect.soft(apart).toContain("priced: 0 to 5.1%");
    expect.soft(apart).toContain("you 2.0%");
    expect.soft(apart).toContain("moved 11.2%");
    const near = meterHtml(R(51, 112), 110);
    expect.soft(near).not.toContain('gg-mk you');
    expect.soft(near).toContain("you 11.0% · moved 11.2%");
    expect.soft(meterHtml(R(50, 300), 300)).toContain("edge-r");
    expect.soft(meterHtml(R(50, 0), 0)).toContain("edge-l");
  });

  it("tallies the answers, with the guess columns only once a guess was made", () => {
    const bare = tallyHtml(set, []);
    expect.soft(bare).toContain("<th>Report</th><th>Priced</th><th>Moved</th></tr>");
    expect.soft(bare).not.toContain("Your guess");
    const played = tallyHtml(set, [110, null, 40]);
    expect.soft(played).toContain("<th>Your guess</th><th>Off by</th>");
    expect.soft(played).toContain("<td>11.0%</td><td>0.2 pts</td>");
    expect.soft(played).toContain("<td>not played</td><td></td>");
  });

  it("titles and scores the end: the guesses made, hits and the average miss", () => {
    expect.soft(endTitle([])).toBe("All five answers");
    expect.soft(endTitle([1, 2, 3, 4, 5])).toBe("Your five guesses");
    expect.soft(endTitle([1])).toBe("Your 1 guess");
    expect.soft(endTitle([1, null, 3])).toBe("Your 2 guesses");
    expect.soft(scoreHtml(set, [])).toBe("");
    expect.soft(scoreHtml(set, [110, 50, 80, 120, 60])).toBe("<div><b>3 of 5</b><span>guesses within 2 points</span></div><div><b>2.4</b><span>points off, on average</span></div>");
  });

  it("says in how many of the reports the stock moved less than options had priced, and draws a pair of bars for each", () => {
    expect.soft(lessonBig(set)).toBe("In 3 of these 5 reports, the stock moved less than options had priced.");
    const bars = barsHtml(set);
    expect.soft(bars.match(/gg-tr p/g)).toHaveLength(5);
    expect.soft(bars.match(/gg-tr m/g)).toHaveLength(5);
    expect.soft(bars).toContain("up 11.2%");
    expect.soft(bars).toContain("down 14.6%");
  });
});
