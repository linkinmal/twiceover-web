import { describe, expect, it } from "vitest";
import { STRUCTURES, curvePoints, evaluate } from "./payoff-builder.mjs";
import { DESCRIPTIONS, FINDS, headHtml, inputsHtml, kindsHtml, sentenceHtml, shapesHtml, statsHtml, whyHtml, chartSvg, structureOf } from "./payoff-view.mjs";

const models = STRUCTURES.map((def) => {
  const values = Object.fromEntries(def.fields.map((f) => [f.id, f.default]));
  const e = evaluate({ kind: def.kind, spreadType: def.spreadType, values, stockNow: 100, contracts: 2, handle: def.handle });
  return { def, model: { kind: def.kind, spreadType: def.spreadType, values, stockNow: 100, e } };
});

// Game and tool pages keep the full banned-word scan (ADR 1090 Decision 9): none of these strings may carry the bare verbs.
const BARE = /\b(buy|sell|advice|recommend|suitable)\b/i;

describe("the payoff view's wording", () => {
  it("never prints a word the tool-page scan bans, for any of the seven structures", () => {
    const all = [
      ...Object.values(DESCRIPTIONS),
      ...FINDS.flat(),
      kindsHtml("lc"),
      shapesHtml({ kind: "lc" }, true),
      ...models.flatMap(({ def, model }) => [inputsHtml(def), whyHtml(model), headHtml(model.e), sentenceHtml(model), statsHtml(model.e)]),
    ].join(" ");
    expect(all.replace(/<[^>]+>/g, " ")).not.toMatch(BARE);
  });
  it("states each structure's figures from the engine, scaled by contracts", () => {
    const by = Object.fromEntries(models.map((m) => [m.def.kind + (m.def.spreadType ?? ""), m]));
    expect(whyHtml(by.lc.model)).toContain("$492 in all");
    expect(whyHtml(by.csp.model)).toContain("set aside $19,000 in cash");
    expect(whyHtml(by.cc.model)).toContain("200 shares");
    expect(whyHtml(by.st.model)).toContain("breaks even below $94.00 or above $106.00");
    expect(statsHtml(by.lc.model.e)).toContain("No limit");
    expect(statsHtml(by.lp.model.e)).toContain("if the stock went to zero");
  });
  it("draws the chart with the handle at the set price and no markup from input", () => {
    const { model } = models[0];
    const { svg, geom } = chartSvg(model.e, curvePoints(model.e.position, 100, model.e.range.lo, model.e.range.hi), 600);
    expect(svg).toContain("$110 · +$508");
    expect(geom).toMatchObject({ lo: model.e.range.lo, hi: model.e.range.hi, W: 600 });
  });
  it("lists one picker chip per kind and a card per shape; served cards are not buttons", () => {
    expect((kindsHtml("vs").match(/data-k=/g) ?? []).length).toBe(6);
    expect((shapesHtml({ kind: "vs", spreadType: "c" }, false).match(/<li>/g) ?? []).length).toBe(6);
    expect(shapesHtml({ kind: "vs", spreadType: "c" }, false)).not.toContain("<button");
    expect(structureOf("vs", "p").fields[0].label).toBe("Strike you bought, $");
  });
});
