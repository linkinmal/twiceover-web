import { describe, expect, it } from "vitest";
import { validateSets } from "./guess-gap.mjs";
import { REPORT_SETS } from "./guess-gap-reports.mjs";

describe("the reports baked into Guess the gap", () => {
  it("are well formed: whole tenths inside the slider's scale, five to a game, no report twice", () => {
    expect(validateSets(REPORT_SETS)).toEqual([]);
  });

  // The release gate (blog-handoff-playables.md section 1: "each checked at its source before publish"). It is red while
  // the file holds the design's invented samples, on purpose: the page must not ship on them.
  it("each carry where it was checked and when, so nothing invented or unchecked ships", () => {
    const unchecked = REPORT_SETS.flatMap((set, i) =>
      set.flatMap((r, k) => ((typeof r.source === "string" && r.source.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(r.checkedAt ?? "")) ? [] : [`set ${i + 1}, report ${k + 1} (${r.company})`])),
    );
    expect(unchecked, "reports with no source and checkedAt").toEqual([]);
  });
});
