import { describe, expect, it } from "vitest";
import { issueNumbers, paginate, keepReading, topicsWithPosts } from "./list.mjs";
import { labelGaps, TOPIC_LABELS } from "./labels.mjs";
import { TOPICS } from "./vocabulary.mjs";

const p = (id, publishAt, topic = "earnings") => ({ id, data: { publishAt, topic } });

describe("issueNumbers", () => {
  it("numbers by publish order, oldest first, whatever order the posts come in, and breaks a tie by slug", () => {
    const n = issueNumbers([p("c", "2026-10-12T07:00:00-04:00"), p("a", "2026-10-07T07:00:00-04:00"), p("b2", "2026-10-09T07:00:00-04:00"), p("b1", "2026-10-09T11:00:00Z")]);
    expect([...n.entries()]).toEqual([["a", "001"], ["b1", "002"], ["b2", "003"], ["c", "004"]]);
  });
});

describe("paginate", () => {
  it("splits into pages of the size, always gives one page, and refuses a bad size", () => {
    expect.soft(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect.soft(paginate([1, 2], 2)).toEqual([[1, 2]]);
    expect.soft(paginate([], 12)).toEqual([[]]);
    expect(() => paginate([1], 0)).toThrow();
  });
});

describe("keepReading", () => {
  const all = [p("new", "2026-10-12T07:00:00-04:00", "macro-fed"), p("mid", "2026-10-09T07:00:00-04:00", "earnings"), p("old", "2026-10-07T07:00:00-04:00", "macro-fed"), p("self", "2026-10-05T07:00:00-04:00", "macro-fed")];
  it("puts the same subject first, never the post itself, newest first, capped", () => {
    expect.soft(keepReading(all[3], all).map((x) => x.id)).toEqual(["new", "old", "mid"]);
    expect.soft(keepReading(all[3], all, 2).map((x) => x.id)).toEqual(["new", "old"]);
    expect.soft(keepReading(all[0], [all[0]])).toEqual([]);
  });
});

describe("topicsWithPosts and labels", () => {
  it("lists only topics that have a post, in vocabulary order", () => {
    expect(topicsWithPosts([p("a", "x", "macro-fed"), p("b", "x", "earnings")], TOPICS)).toEqual(["earnings", "macro-fed"]);
  });
  it("every closed value has a label and no label is orphaned", () => {
    expect.soft(labelGaps()).toEqual([]);
    expect.soft(Object.keys(TOPIC_LABELS)).toEqual([...TOPICS]);
  });
});
