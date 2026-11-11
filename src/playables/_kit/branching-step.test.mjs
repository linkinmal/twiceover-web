// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { again, back, endingIds, hasBack, initial, mapHtml, mapSectionHtml, money, pick, playHtml, price, roundLine, signedMoney, stepHtml, toneOf, trailHtml, validateTree } from "./branching-step.mjs";
import { mount } from "./branching-step-client.mjs";

// The sample of blog-handoff-playables.md section 3: put strike $50, premium $1.20, close $48.00, buy-back $2.05,
// call strike $52, call premium $0.60, 100 shares. Every figure is worked here from those inputs, never typed.
const K = 50, PREM = 1.2, CLOSE = 48, BUY = 2.05, CK = 52, CPREM = 0.6, SH = 100;
const r2 = (x) => Math.round(x * 100) / 100;
const COST = r2(K - PREM);
const SHOWN = r2((CLOSE - COST) * SH);
const BUYRES = r2((PREM - BUY) * SH);
const COST2 = r2(COST - CPREM);
const CALLED = r2((CK - COST2) * SH);

const tree = {
  start: "s1",
  nodes: {
    s1: { kind: "step", sit: "The put is in the money.", q: "The put expires today. Which path next?", given: "You sold 1 put.", choices: [{ label: "Do nothing", sub: "Leave the put open.", to: "s2" }, { label: "Buy it back", sub: "Pay to end it.", to: "e1" }] },
    s2: { kind: "step", sit: "Monday: 100 shares.", happened: `You are assigned at ${price(K)}.`, q: "Monday morning. Which path next?", given: `The shares show ${signedMoney(SHOWN)}.`, choices: [{ label: "Hold", sub: "Keep them.", to: "e2" }, { label: "Sell", sub: "Sell all.", to: "e3" }, { label: "Sell a call", sub: "Take a premium.", to: "e4" }] },
    e1: { kind: "end", sit: "Bought back.", happened: "You pay to close it.", q: "No shares.", tiles: [{ figure: signedMoney(BUYRES), label: "result on the put", tone: toneOf(BUYRES) }, { figure: "0", label: "shares held" }] },
    e2: { kind: "end", sit: "Held.", happened: "You keep them.", q: "You hold 100 shares.", tiles: [{ figure: price(COST), label: "cost a share" }, { figure: signedMoney(SHOWN), label: `shown at ${price(CLOSE)}`, tone: toneOf(SHOWN) }] },
    e3: { kind: "end", sit: "Sold.", happened: "They sell.", q: "Sold.", tiles: [{ figure: signedMoney(SHOWN), label: "result", tone: toneOf(SHOWN) }, { figure: "0", label: "shares held" }] },
    e4: { kind: "end", sit: "Call sold.", happened: "A call sells.", q: "A call is sold.", tiles: [{ figure: price(COST2), label: "cost a share" }, { figure: signedMoney(CALLED), label: `result if called away at ${price(CK)}`, tone: toneOf(CALLED) }] },
  },
};

describe("the figures the sample prints", () => {
  it("are worked from the inputs and shown in cents-rounded money with a real minus", () => {
    expect.soft(price(COST)).toBe("$48.80");
    expect.soft(signedMoney(SHOWN)).toBe("−$80");
    expect.soft(signedMoney(BUYRES)).toBe("−$85");
    expect.soft(price(COST2)).toBe("$48.20");
    expect.soft(signedMoney(CALLED)).toBe("+$380");
    expect.soft(money(1234.5)).toBe("$1,234.50");
    expect.soft(money(0.1 + 0.2)).toBe("$0.30");
    expect.soft(signedMoney(-0.004)).toBe("+$0");
  });

  it("agree on sign, digits and tone at a half cent: a loss is never printed as a gain", () => {
    expect.soft(signedMoney(-0.005)).toBe("\u2212$0.01");
    expect.soft(toneOf(-0.005)).toBe("loss");
    expect.soft(signedMoney(-0.015)).toBe("\u2212$0.02");
    expect.soft(toneOf(-0.015)).toBe("loss");
    expect.soft(signedMoney(0.005)).toBe("+$0.01");
    expect.soft(toneOf(0.005)).toBe("gain");
    expect.soft(toneOf(-0.004), "a loss that rounds to zero is not shown as one").toBe("gain");
    expect.soft(signedMoney(0)).toBe("+$0");
  });
});

describe("the limits of the part", () => {
  it("accept the sample tree, with an ending that two paths can reach", () => {
    const shared = structuredClone(tree);
    shared.nodes.s1.choices[1].to = "e2";
    expect.soft(validateTree(tree)).toEqual([]);
    expect.soft(validateTree(shared)).toEqual(expect.arrayContaining(["e1: no path reaches it"]));
    delete shared.nodes.e1;
    expect.soft(validateTree(shared), "e2 is reached by two paths").toEqual([]);
  });

  it("name every breach: four choices, one tile, a missing target, a loop, an orphan", () => {
    const t = structuredClone(tree);
    t.nodes.s2.choices.push({ label: "x", sub: "x", to: "e1" }, { label: "y", sub: "y", to: "e1" });
    t.nodes.e1.tiles = [t.nodes.e1.tiles[0]];
    t.nodes.s1.choices[0].to = "nowhere";
    const errors = validateTree(t);
    expect.soft(errors).toContain("s2: a step has 2 or 3 choices, not 5");
    expect.soft(errors).toContain("e1: an ending has 2 or 3 tiles, not 1");
    expect.soft(errors).toContain('s1: choice "Do nothing" leads to a missing node "nowhere"');
    const loop = structuredClone(tree);
    loop.nodes.s2.choices[0].to = "s1";
    expect.soft(validateTree(loop)).toContain('a path loops back to "s1"');
    expect.soft(validateTree({ start: "zz", nodes: {} })).toEqual(["the start step does not exist"]);
  });
});

describe("walking the tree", () => {
  it("starts on step 1 with no trail and no way back; a pick takes the path and counts a found ending", () => {
    const s0 = initial(tree);
    expect.soft(roundLine(tree, s0)).toEqual({ left: "Step 1", right: "Endings reached: 0 of 4" });
    expect.soft(hasBack(tree, s0)).toBe(false);
    expect.soft(trailHtml(tree, s0)).toBe("");
    expect.soft(back(tree, s0)).toBe(s0);
    const s1 = pick(tree, s0, 0);
    expect.soft(s1.at).toBe("s2");
    expect.soft(roundLine(tree, s1).left).toBe("Step 2");
    expect.soft(trailHtml(tree, s1)).toBe("<li>Do nothing</li>");
    const s2 = pick(tree, s1, 2);
    expect.soft(s2.at).toBe("e4");
    expect.soft(roundLine(tree, s2)).toEqual({ left: "This path ended", right: "Endings reached: 1 of 4" });
    expect.soft(trailHtml(tree, s2)).toBe("<li>Do nothing</li><li>Sell a call</li>");
    expect.soft(pick(tree, s2, 0)).toBe(s2);
    expect.soft(pick(tree, s0, 9)).toBe(s0);
  });

  it("goes back one step, keeps what was found, and starts over without losing the count", () => {
    let s = pick(tree, pick(tree, initial(tree), 0), 0);
    expect.soft(s.found).toEqual(["e2"]);
    s = back(tree, s);
    expect.soft(s.at).toBe("s2");
    expect.soft(s.path).toHaveLength(1);
    expect.soft(s.found).toEqual(["e2"]);
    s = again(tree, pick(tree, s, 1));
    expect.soft(s.at).toBe("s1");
    expect.soft(s.path).toEqual([]);
    expect.soft(s.found).toEqual(["e2", "e3"]);
    expect.soft(endingIds(tree)).toEqual(["e1", "e2", "e3", "e4"]);
  });

  it("counts an ending once however often it is reached", () => {
    let s = pick(tree, initial(tree), 1);
    s = pick(tree, again(tree, s), 1);
    expect(s.found).toEqual(["e1"]);
  });
});

describe("the markup", () => {
  it("shows a step as a heading, a given line and stacked unselected choices; \"What happened\" only from step 2", () => {
    const first = document.createElement("div");
    first.innerHTML = stepHtml(tree, initial(tree));
    expect.soft(first.querySelector("h2#br-q")?.getAttribute("tabindex")).toBe("-1");
    expect.soft(first.querySelectorAll("button.br-choice")).toHaveLength(2);
    expect.soft(first.querySelector(".br-choice b")?.textContent).toBe("Do nothing");
    expect.soft(first.querySelector(".br-choice span")?.textContent).toBe("Leave the put open.");
    expect.soft(first.querySelector("[aria-pressed],[aria-checked],.selected")).toBeNull();
    expect.soft(first.querySelector(".br-happ")).toBeNull();
    expect.soft(first.querySelector("[data-br-back]"), "the first step has no way back").toBeNull();
    const second = document.createElement("div");
    second.innerHTML = stepHtml(tree, pick(tree, initial(tree), 0));
    expect.soft(second.querySelector(".br-happ .br-tl")?.textContent).toBe("What happened");
    expect.soft(second.querySelector(".br-happ")?.textContent).toContain("You are assigned at $50.00.");
    expect.soft(second.querySelectorAll("button.br-choice")).toHaveLength(3);
    expect.soft(second.querySelector("[data-br-back]")?.textContent).toBe("Back one step");
  });

  it("shows an ending with tiles, gain and loss colours only on gain and loss figures, and both buttons", () => {
    const d = document.createElement("div");
    d.innerHTML = stepHtml(tree, pick(tree, pick(tree, initial(tree), 0), 2));
    const tiles = [...d.querySelectorAll(".br-score div")];
    expect.soft(tiles.map((t) => t.querySelector("b")?.textContent)).toEqual(["$48.20", "+$380"]);
    expect.soft(tiles[0].querySelector("b")?.className).toBe("");
    expect.soft(tiles[1].querySelector("b")?.className).toBe("pos");
    expect.soft(tiles[1].querySelector("span")?.textContent).toBe("result if called away at $52.00");
    expect.soft(d.querySelector("[data-br-again]")?.textContent).toBe("Try another path");
    expect.soft(d.querySelector("[data-br-back]")?.textContent).toBe("Back one step");
    const loss = document.createElement("div");
    loss.innerHTML = stepHtml(tree, pick(tree, initial(tree), 1));
    expect.soft(loss.querySelector(".br-score b")?.className).toBe("neg");
  });

  it("escapes every word it prints: a markup payload in each field shows as text and makes no element", () => {
    const pay = (f) => `<img src=x onerror=alert(1)>${f} & "q"`;
    const t = structuredClone(tree);
    const set = (o, k) => (o[k] = pay(k));
    set(t.nodes.s1, "q"); set(t.nodes.s1, "given"); set(t.nodes.s1, "sit");
    set(t.nodes.s1.choices[0], "label"); set(t.nodes.s1.choices[0], "sub");
    set(t.nodes.s2, "happened");
    set(t.nodes.e2, "q"); set(t.nodes.e2, "sit"); set(t.nodes.e2, "happened");
    set(t.nodes.e2.tiles[0], "figure"); set(t.nodes.e2.tiles[0], "label");
    const html = (x) => {
      const d = document.createElement("div");
      d.innerHTML = x;
      return d;
    };
    const first = html(stepHtml(t, initial(t)));
    const second = html(stepHtml(t, { at: "s2", path: [{ at: "s1", pick: 0 }], found: [] }));
    const end = html(stepHtml(t, { at: "e2", path: [{ at: "s1", pick: 0 }, { at: "s2", pick: 0 }], found: ["e2"] }));
    const map = html(mapSectionHtml(t, ["e2"]));
    const trail = html(`<ol>${trailHtml(t, { at: "s2", path: [{ at: "s1", pick: 0 }], found: [] })}</ol>`);
    for (const d of [first, second, end, map, trail]) expect.soft(d.querySelectorAll("img")).toHaveLength(0);
    expect.soft(first.querySelector("h2")?.textContent).toBe(pay("q"));
    expect.soft(first.querySelector(".br-given")?.textContent).toBe(pay("given"));
    expect.soft(first.querySelector(".br-choice b")?.textContent).toBe(pay("label"));
    expect.soft(first.querySelector(".br-choice span")?.textContent).toBe(pay("sub"));
    expect.soft(second.querySelector(".br-happ")?.textContent).toBe("What happened" + pay("happened"));
    expect.soft(end.querySelector("h2")?.textContent).toBe(pay("q"));
    expect.soft(end.querySelector(".br-score b")?.textContent).toBe(pay("figure"));
    expect.soft(end.querySelector(".br-score span")?.textContent).toBe(pay("label"));
    expect.soft(trail.querySelector("li")?.textContent).toBe(pay("label"));
    expect.soft(map.querySelector(".br-sit")?.textContent).toBe(pay("sit"));
    expect.soft(map.textContent).toContain(pay("sit"));
    expect.soft(map.textContent).toContain(pay("label"));
  });

  it("draws the map as an open nested list of every step, pick and ending, with Reached on the found ones", () => {
    const d = document.createElement("div");
    d.innerHTML = mapHtml(tree, ["e2"]);
    expect.soft(d.querySelectorAll("svg, canvas, details")).toHaveLength(0);
    const text = d.textContent ?? "";
    for (const w of ["The put is in the money.", "Do nothing", "Buy it back", "Hold", "Sell a call", "Bought back.", "Held.", "Sold.", "Call sold."]) expect.soft(text, w).toContain(w);
    expect.soft(d.querySelectorAll(".br-got")).toHaveLength(1);
    expect.soft(d.querySelector(".br-got")?.parentElement?.textContent).toContain("You hold 100 shares.");
    expect.soft(d.querySelectorAll("ul ul ul").length).toBeGreaterThan(0);
  });

  it("prints the playing section hidden, so script off shows none of it", () => {
    const d = document.createElement("div");
    d.innerHTML = playHtml(tree);
    expect.soft(d.querySelector("[data-br-play]")?.hasAttribute("hidden")).toBe(true);
    expect.soft(d.querySelector("[data-br-left]")?.textContent).toBe("Step 1");
    expect.soft(d.querySelector("[data-br-right]")?.textContent).toBe("Endings reached: 0 of 4");
    expect.soft(d.querySelector("[data-br-step]")?.getAttribute("aria-live")).toBe("polite");
    expect.soft(d.querySelector("[data-br-trailwrap]")?.hasAttribute("hidden")).toBe(true);
  });
});

describe("the block script", () => {
  const served = () => {
    // Exactly the page contract in branching-step.mjs's header.
    document.body.innerHTML = `<div data-root>${playHtml(tree)}<section class="blk teach" data-br-lesson>lesson</section>${mapSectionHtml(tree)}<section class="blk" data-br-how>how</section></div>`;
    return document.querySelector("[data-root]");
  };
  const click = (sel) => document.querySelector(sel).click();

  it("shows the playing section, hides \"How it is played\", and holds the lesson and map until an ending", () => {
    const root = served();
    mount(root, tree);
    expect.soft(root.querySelector("[data-br-play]").hidden).toBe(false);
    expect.soft(root.querySelector("[data-br-how]").hidden).toBe(true);
    expect.soft(root.querySelector("[data-br-lesson]").hidden).toBe(true);
    expect.soft(root.querySelector("[data-br-mapblk]").hidden).toBe(true);
    expect.soft(document.activeElement).toBe(document.body);
  });

  it("takes a path on a tap: replaces the step, moves focus to its heading, shows the trail and the count", () => {
    const root = served();
    mount(root, tree);
    click("[data-br-pick='0']");
    expect.soft(root.querySelector("#br-q")?.textContent).toBe("Monday morning. Which path next?");
    expect.soft(document.activeElement).toBe(root.querySelector("#br-q"));
    expect.soft(root.querySelector("[data-br-left]")?.textContent).toBe("Step 2");
    expect.soft(root.querySelector("[data-br-trailwrap]").hidden).toBe(false);
    expect.soft(root.querySelector("[data-br-trail]")?.textContent).toBe("Do nothing");
    click("[data-br-pick='2']");
    expect.soft(root.querySelector("[data-br-left]")?.textContent).toBe("This path ended");
    expect.soft(root.querySelector("[data-br-right]")?.textContent).toBe("Endings reached: 1 of 4");
    expect.soft(root.querySelector("[data-br-lesson]").hidden).toBe(false);
    expect.soft(root.querySelector("[data-br-mapblk]").hidden).toBe(false);
    expect.soft(root.querySelectorAll(".br-got")).toHaveLength(1);
  });

  it("goes back one step and tries another path", () => {
    const root = served();
    const api = mount(root, tree);
    click("[data-br-pick='0']");
    click("[data-br-pick='0']");
    click("[data-br-back]");
    expect.soft(root.querySelector("#br-q")?.textContent).toBe("Monday morning. Which path next?");
    expect.soft(document.activeElement).toBe(root.querySelector("#br-q"));
    click("[data-br-back]");
    expect.soft(root.querySelector("[data-br-left]")?.textContent).toBe("Step 1");
    expect.soft(root.querySelector("[data-br-back]")).toBeNull();
    click("[data-br-pick='1']");
    click("[data-br-again]");
    expect.soft(root.querySelector("[data-br-left]")?.textContent).toBe("Step 1");
    expect.soft(root.querySelector("[data-br-trailwrap]").hidden).toBe(true);
    expect.soft(root.querySelector("[data-br-right]")?.textContent).toBe("Endings reached: 2 of 4");
    expect.soft(api.state().found).toEqual(["e2", "e1"]);
  });

  it("leaves a page without the section alone", () => {
    document.body.innerHTML = "<div data-root></div>";
    expect(mount(document.querySelector("[data-root]"), tree)).toBeNull();
  });
});
