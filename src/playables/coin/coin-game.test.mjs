/**
 * The 60% coin game's math (`coin-game.mjs`) — ADR 1090 Decision 8; the design's `blog-handoff.md` §5.1.
 *
 * Money-relevant in the sense the constitution cares about: the page prints percentages a reader may
 * act on ("at 40% a flip, 49% went bust"), so the published figures are pinned. The reference numbers
 * were produced by an independent Python port of the same generator and rules, not read back from this
 * module: seed 1987, 2,000 games per bet size, cap $250, bust below $2, at most 300 flips.
 */
import { describe, expect, it } from "vitest";
import { COIN, barsAll, createRng, flip, formatMoney, lessonFigures, playToEnd, simulateBars } from "./coin-game.mjs";

/** A generator that returns the listed numbers, then fails loudly. */
const stub = (...xs) => {
  let i = 0;
  return () => {
    if (i >= xs.length) throw new Error("rng exhausted");
    return xs[i++];
  };
};

describe("the seeded generator", () => {
  it("reproduces the independent port's stream for seed 1987 and for seed 0, and stays inside [0, 1)", () => {
    const a = createRng(1987);
    expect.soft([a(), a(), a()]).toEqual([0.027248888509348035, 0.186082161962986, 0.527114175260067]);
    const z = createRng(0);
    expect.soft([z(), z()]).toEqual([0.26642920868471265, 0.0003297457005828619]);
    const r = createRng(12345);
    let inRange = true;
    for (let i = 0; i < 10000; i++) {
      const x = r();
      if (!(x >= 0 && x < 1)) inRange = false;
    }
    expect.soft(inRange).toBe(true);
  });

  it("gives the same stream for the same seed, a different one for another, and ignores bits past 32", () => {
    const first = (seed) => { const r = createRng(seed); return [r(), r(), r()]; };
    expect.soft(first(7)).toEqual(first(7));
    expect.soft(first(7)).not.toEqual(first(8));
    expect.soft(first(2 ** 32 + 7)).toEqual(first(7));
  });
});

describe("one flip", () => {
  it("a head wins the bet and a tail loses it: $25 at 20% is $30 or $20", () => {
    expect.soft(flip(25, 0.2, stub(0.5), 1)).toEqual({ bet: 5, heads: true, stack: 30, over: false, outcome: null });
    expect.soft(flip(25, 0.2, stub(0.6), 1)).toMatchObject({ bet: 5, heads: false, stack: 20, over: false }); // 0.6 is not < 0.6
    expect.soft(flip(25, 1, stub(0.1), 1)).toMatchObject({ bet: 25, heads: true, stack: 50 });
  });

  it("ends at the cap and clamps to $250 when a win would pass it", () => {
    expect.soft(flip(200, 0.4, stub(0.1), 4)).toEqual({ bet: 80, heads: true, stack: 250, over: true, outcome: "cap" });
    expect.soft(flip(250, 0.05, stub(0.1), 4)).toMatchObject({ stack: 250, over: true, outcome: "cap" });
    expect.soft(flip(220, 0.1, stub(0.1), 4)).toMatchObject({ stack: 242, over: false }); // 242 < 250: play on
  });

  it("ends bust below $2, but not at exactly $2", () => {
    expect.soft(flip(2.5, 1, stub(0.9), 9)).toMatchObject({ stack: 0, over: true, outcome: "bust" });
    expect.soft(flip(2.5, 0.5, stub(0.9), 9)).toMatchObject({ stack: 1.25, over: true, outcome: "bust" });
    expect.soft(flip(4, 0.5, stub(0.9), 9)).toMatchObject({ stack: 2, over: false, outcome: null });
  });

  it("ends 'neither' on the 300th flip when the stack is still between the bounds, and not before", () => {
    expect.soft(flip(25, 0.2, stub(0.5), 299)).toMatchObject({ over: false, outcome: null });
    expect.soft(flip(25, 0.2, stub(0.5), 300)).toMatchObject({ over: true, outcome: "limit" });
    // A cap or bust on the last flip is still a cap or a bust.
    expect.soft(flip(200, 0.4, stub(0.1), 300)).toMatchObject({ outcome: "cap" });
    expect.soft(flip(2.5, 1, stub(0.9), 300)).toMatchObject({ outcome: "bust" });
  });
});

describe("a whole game", () => {
  it("'flip to the end' from $25 at 20% on seed 4 matches the independent port: 210 flips, bust at $1.7409...", () => {
    const g = playToEnd([COIN.start], 0.2, createRng(4));
    expect.soft(g.run.slice(0, 6).map((x) => Math.round(x * 1e6) / 1e6)).toEqual([25, 20, 24, 28.8, 34.56, 41.472]);
    expect.soft(g.run.length - 1).toBe(210);
    expect.soft(g.run[g.run.length - 1]).toBeCloseTo(1.7409428471951558, 12);
    expect.soft(g.outcome).toBe("bust");
  });

  it("carries on from where a game stands, so 'flip once' then 'flip to the end' is one game", () => {
    const rng = createRng(4);
    const first = flip(25, 0.2, rng, 1);
    const g = playToEnd([25, first.stack], 0.2, rng);
    const whole = playToEnd([COIN.start], 0.2, createRng(4));
    expect.soft(g.run).toEqual(whole.run);
    expect.soft(g.outcome).toBe(whole.outcome);
  });

  it("never runs past 300 flips, and a game already over adds nothing", () => {
    // A fair-ish tiny bet that never reaches either bound inside 300 flips: always alternate heads, tails.
    let n = 0;
    const alt = () => (n++ % 2 === 0 ? 0.1 : 0.9);
    const g = playToEnd([25], 0.01, alt);
    expect.soft(g.run.length - 1).toBe(300);
    expect.soft(g.outcome).toBe("limit");
    const done = playToEnd(g.run, 0.01, alt);
    expect.soft(done.run).toEqual(g.run);
  });
});

describe("the 2,000-game bars (seed 1987)", () => {
  it("reproduces the six published cap/bust pairs: 72/0, 94/0, 91/7, 51/49, 31/69, 13/87", () => {
    const want = [[0.05, 72, 0], [0.1, 94, 0], [0.2, 91, 7], [0.4, 51, 49], [0.6, 31, 69], [1, 13, 87]];
    expect.soft(COIN.fractions).toEqual(want.map((w) => w[0]));
    for (const [f, cap, bust] of want) {
      const b = simulateBars(f);
      expect.soft([b.cap, b.bust], `bet ${f}`).toEqual([cap, bust]);
      expect.soft(b.neither, `bet ${f}`).toBe(100 - cap - bust);
    }
    expect.soft(barsAll().map((b) => [b.fraction, b.cap, b.bust])).toEqual(want);
  });

  it("gives the middle game's end stack, which the page prints in whole dollars: $250, $250, $250, $250, $2, $0", () => {
    // Worked with the independent port: the 1,000th and 1,001st sorted end values are equal at every bet size.
    const want = [250, 250, 250, 250, 1.7179869184, 0];
    expect.soft(barsAll().map((b) => b.median)).toEqual(want.map((w) => expect.closeTo(w, 9)));
    expect.soft(barsAll().map((b) => Math.round(b.median))).toEqual([250, 250, 250, 250, 2, 0]);
  });

  it("is the same every visit: a repeat call, and a call after another bet size, give identical bars", () => {
    const a = simulateBars(0.4);
    simulateBars(0.1);
    expect.soft(simulateBars(0.4)).toEqual(a);
    expect.soft(barsAll()).toEqual(barsAll());
  });

  it("rounds to the whole percent of 2,000 games (the 20% bust count is 131 → 6.55 → 7)", () => {
    // Worked with the independent port: 20% a flip gives 1820 caps and 131 busts in 2,000 games.
    const b = simulateBars(0.2);
    expect.soft(b.cap).toBe(Math.round((1820 / 2000) * 100));
    expect.soft(b.bust).toBe(Math.round((131 / 2000) * 100));
  });
});

describe("the lesson's figures come from the bars, never typed", () => {
  it("quotes the 10%, 20%, 40% and 100% rows: 94% cap at 10%, then 7%, 49% and 87% bust", () => {
    expect.soft(lessonFigures(barsAll())).toEqual({
      at10: { cap: 94, bust: 0 },
      at20: { bust: 7 },
      at40: { bust: 49 },
      at100: { bust: 87 },
    });
  });

  it("follows the bars it is given", () => {
    const fake = barsAll().map((b) => (b.fraction === 0.4 ? { ...b, bust: 3 } : b));
    expect.soft(lessonFigures(fake).at40.bust).toBe(3);
  });
});

describe("money format: whole dollars from $100, cents below", () => {
  it("prints $25.00, $99.99, $100, $250 and $1.74", () => {
    const got = [25, 99.99, 100, 249.6, 250, 1.7409].map(formatMoney);
    expect.soft(got).toEqual(["$25.00", "$99.99", "$100", "$250", "$250", "$1.74"]);
    expect.soft(formatMoney(0)).toBe("$0.00");
  });
});
