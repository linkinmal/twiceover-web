import { describe, expect, it } from "vitest";
import { STRUCTURES, curvePoints, evaluate } from "./payoff-builder.mjs";
import { BAD_NUMBER, rowHtml } from "../_kit/number-input.mjs";
import { DESCRIPTIONS, FINDS, cardsHtml, chartSvg, describe as describeKind, headHtml, sentenceHtml, sixHtml, statsHtml, structureOf, termsHtml, typeRowHtml, whyHtml } from "./payoff-view.mjs";

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
      ...Object.values(DESCRIPTIONS).flatMap((d) => [d.s, d.d]),
      ...FINDS.flat(),
      BAD_NUMBER,
      cardsHtml("lc", "c"),
      sixHtml(),
      typeRowHtml("c"),
      ...models.flatMap(({ def, model }) => [termsHtml(def, def.kind), whyHtml(model), headHtml(model.e), sentenceHtml(model), statsHtml(model.e), describeKind(def.kind)]),
    ].join(" ");
    expect(all.replace(/<[^>]+>/g, " ")).not.toMatch(BARE);
  });
  it("states each structure's figures from the engine, scaled by contracts", () => {
    const by = Object.fromEntries(models.map((m) => [m.def.kind + (m.def.spreadType ?? ""), m]));
    expect(whyHtml(by.lc.model)).toContain("$492 in all");
    expect(whyHtml(by.csp.model)).toContain("set aside $19,000 in cash");
    expect(whyHtml(by.csp.model)).toContain("you take the shares at $95 and lose $200 for every $1 the stock falls below it");
    expect(whyHtml(by.cc.model)).toContain("200 shares");
    expect(whyHtml(by.st.model)).toContain("makes money only if the stock ends below $94 or above $106, the two breakevens");
    expect(whyHtml(by.vsc.model)).toContain("call you bought has a $100 strike and the call you sold has a $110 strike. Together they cost a net $2.50");
    expect(statsHtml(by.lc.model.e)).toContain("No limit");
    expect(statsHtml(by.lp.model.e)).toContain("if the stock went to zero");
  });
  it("gives three figures, with Breakeven as one word and the value at the price left to the headline", () => {
    for (const { model } of models) expect(statsHtml(model.e).match(/<div>/g)).toHaveLength(3);
    expect(statsHtml(models.find((m) => m.def.kind === "st").model.e)).toContain("breakevens, where it neither gains nor loses");
    expect(statsHtml(models.find((m) => m.def.kind === "st").model.e)).not.toMatch(/break-even/i);
  });
  it("draws the chart with the handle at the set price, the axis below it, and the slider's top given", () => {
    const { model } = models[0];
    const { svg, geom, axisTop, H } = chartSvg(model.e, curvePoints(model.e.position, 100, model.e.range.lo, model.e.range.hi), 600);
    expect(svg).toContain("$110 · +$508");
    expect(geom).toMatchObject({ lo: model.e.range.lo, hi: model.e.range.hi, W: 600 });
    expect(axisTop).toBe(262);
    expect(H).toBe(342);
  });
  it("makes six picker buttons, a read-only list of six, and typed boxes with the unit beside them", () => {
    expect((cardsHtml("vs", "p").match(/<button/g) ?? []).length).toBe(6);
    expect(cardsHtml("vs", "p")).toContain('data-k="vs" aria-pressed="true"');
    expect((sixHtml().match(/<li>/g) ?? []).length).toBe(6);
    expect(sixHtml()).not.toContain("<button");
    expect(sixHtml()).toContain("Breaks even at $107.46");
    const row = rowHtml("po-K", "Strike", "105", "$");
    expect(row).toContain('type="text" inputmode="decimal" autocomplete="off"');
    expect(row).toContain('<span class="u">$</span>');
    expect(structureOf("vs", "p").fields[0].label).toBe("Strike of the option you bought");
    expect(termsHtml(structureOf("csp", null), "csp")).toContain('id="po-cash"');
  });
});

describe("a typed value in a box", () => {
  it("is escaped, so text with a quote or a tag cannot leave the attribute", () => {
    const html = rowHtml("po-S0", "Stock price now", '1"><img src=x onerror=alert(1)>', "$");
    expect(html).not.toMatch(/<img/);
    expect(html).toContain('value="1&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"');
  });
  it("is escaped on the way through termsHtml as well", () => {
    const def = structureOf("lc", null);
    expect(termsHtml(def, "lc", '1"><img src=x>', "1")).not.toMatch(/<img/);
  });
  it("gives the whole-dollar strike and no-strike straddle wording the engine's numbers allow", () => {
    const def = structureOf("st", null);
    const values = { K: 3, Pc: 2, Pp: 2 };
    const e = evaluate({ kind: "st", spreadType: null, values, stockNow: 3, contracts: 1, handle: 3 });
    expect(whyHtml({ kind: "st", spreadType: null, values, stockNow: 3, e })).toContain("It makes money only if the stock ends above $7, its breakeven.");
  });
});

describe("a sentence states a breakeven or a maximum only when the engine has one", () => {
  const why = (kind, spreadType, values, stockNow = 100, contracts = 1) => {
    const e = evaluate({ kind, spreadType, values, stockNow, contracts, handle: stockNow });
    return whyHtml({ kind, spreadType, values, stockNow, e });
  };
  it("long put with a premium above its strike has no breakeven and no gain", () => {
    const t = why("lp", null, { K: 2, P: 3 });
    expect(t).not.toMatch(/-\$|\u2212\$|breaks even/);
    expect(t).toContain("makes money at no price");
  });
  it("covered call struck below the price has no breakeven and no best case", () => {
    const t = why("cc", null, { K: 90, P: 1.8 });
    expect(t).not.toMatch(/breaks even|best case/);
    expect(t).toContain("loses money at every price");
  });
  it("a call spread that is a net credit with no loss does not print a negative loss", () => {
    const t = why("vs", "c", { Kb: 100, Pb: 1, Ks: 110, Ps: 2 });
    expect(t).not.toMatch(/most it can lose is [-\u2212]/);
    expect(t).toContain("it cannot lose at any price");
  });
  it("groups the contract multiplier with commas", () => {
    expect(why("lc", null, { K: 105, P: 2.46 }, 100, 100)).toContain("$10,000 for every $1");
  });
});
