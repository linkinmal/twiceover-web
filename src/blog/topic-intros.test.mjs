import { describe, expect, it } from "vitest";
import { TOPIC_INTROS } from "./topic-intros.mjs";
import { TOPICS } from "./vocabulary.mjs";

const words = (paras) => paras.join(" ").split(/\s+/).length;

describe("topic intros", () => {
  it("has two paragraphs of real length for every topic and none for a value that does not exist", () => {
    expect.soft(Object.keys(TOPIC_INTROS).sort()).toEqual([...TOPICS].sort());
    for (const [topic, paras] of Object.entries(TOPIC_INTROS)) {
      expect.soft(paras.length, `${topic} paragraphs`).toBe(2);
      expect.soft(words(paras), `${topic} words`).toBeGreaterThanOrEqual(80);
      expect.soft(words(paras), `${topic} words`).toBeLessThanOrEqual(160);
    }
  });
  it("keeps to the house rules: no dash joining clauses, no sourcing or advice words", () => {
    for (const [topic, paras] of Object.entries(TOPIC_INTROS)) {
      const text = paras.join(" ");
      expect.soft(text, `${topic} dash`).not.toMatch(/[—–]| - /);
      expect.soft(text, `${topic} banned`).not.toMatch(/\blicensed\b|\byou should\b|\bwe recommend\b|\bsuitable\b|\bbuy\b|\bsell\b|\bUS\b|\bU\.S\./i);
    }
  });
});
