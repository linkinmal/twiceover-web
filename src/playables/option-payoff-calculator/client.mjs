/**
 * Block script for "The option payoff calculator" (ADR 1088 Decision 1, ADR 1090 Decision 8). Bundled to
 * public/js/blog-payoff.js. It reads the page's own typed boxes and range slider, runs the shared engine and writes
 * the same sentences and drawing the build printed (payoff-view.mjs) back into the page. The slider sits on the
 * chart's price axis; dragging the chart moves the same slider. Nothing is sent, stored or read from the address.
 */
import { curvePoints, evaluate, findsMet, validatePayoffInputs } from "./payoff-builder.mjs";
import { BAD_NUMBER, readNumber, showNumber } from "../_kit/number-input.mjs";
import { cardsHtml, chartCaption, chartLabel, chartSvg, describe, findsHtml, headHtml, pm, pp, sentenceHtml, statsHtml, structureOf, termsHtml, typeRowHtml, whyHtml } from "./payoff-view.mjs";

/** @param {Element} root the [data-payoff] element */
export function init(root) {
  const q = (s) => root.querySelector(s);
  const el = (id) => root.querySelector("#" + id);
  const svg = q("[data-chart]");
  const slider = el("po-h");
  if (!svg || !slider) return null;

  const state = { kind: "lc", spreadType: null, geom: null, drag: false };
  const found = [false, false, false];
  let last = null;

  root.querySelectorAll("[data-js]").forEach((n) => (n.hidden = false));
  root.querySelectorAll("[data-nojs]").forEach((n) => (n.hidden = true));
  q("[data-type]").hidden = true;

  const def = () => structureOf(state.kind, state.spreadType);
  const handleStart = () => def().handle;

  function buildTerms(stockNow, contracts) {
    const d = def();
    q("[data-tt]").textContent = d.name;
    q("[data-type]").hidden = state.kind !== "vs";
    q("[data-type]").innerHTML = state.kind === "vs" ? typeRowHtml(state.spreadType) : "";
    q("[data-in]").innerHTML = termsHtml(d, state.kind, stockNow, contracts);
    q("[data-cards]").innerHTML = cardsHtml(state.kind, state.spreadType ?? "c");
    q("[data-desc]").textContent = describe(state.kind);
  }

  function read() {
    const d = def();
    const values = {};
    for (const f of d.fields) values[f.id] = readNumber(el("po-" + f.id).value);
    return { kind: state.kind, spreadType: state.spreadType, values, stockNow: readNumber(el("po-S0").value), contracts: readNumber(el("po-n").value) };
  }

  function mark(errors) {
    for (const id of [...def().fields.map((f) => f.id), "S0", "n"]) {
      const bad = Boolean(errors[id]);
      el("po-" + id).setAttribute("aria-invalid", String(bad));
      const note = el("po-" + id + "-x");
      note.hidden = !bad;
      note.textContent = bad ? errors[id] : "";
    }
  }

  function run() {
    const input = read();
    const check = validatePayoffInputs(input);
    mark(check.errors);
    q("[data-bad]").textContent = check.ok ? "" : BAD_NUMBER;
    if (!check.ok) return;
    const d = def();
    const range = evaluate({ ...input, handle: input.stockNow }).range;
    slider.min = String(range.lo);
    slider.max = String(range.hi);
    slider.step = String(range.step);
    let handle = parseFloat(slider.value);
    if (!Number.isFinite(handle)) handle = input.stockNow;
    handle = Math.min(range.hi, Math.max(range.lo, handle));
    slider.value = String(handle);
    const e = evaluate({ ...input, handle });
    if (!e.ok) return;
    last = e;
    const model = { ...input, e };
    el("po-hv").textContent = pp(e.handle);
    q("[data-head]").innerHTML = headHtml(e);
    q("[data-s1]").innerHTML = sentenceHtml(model);
    q("[data-why]").innerHTML = whyHtml(model);
    q("[data-stats]").innerHTML = statsHtml(e);
    const shares = el("po-sh");
    const cash = el("po-cash");
    if (shares) shares.textContent = e.multiplier.toLocaleString("en-US");
    if (cash) cash.textContent = pm(input.values.K * e.multiplier);
    findsMet(e).forEach((hit, i) => hit && (found[i] = true));
    q("[data-finds]").innerHTML = findsHtml(found);
    q("[data-fc]").textContent = `· ${found.filter(Boolean).length} of 3 found`;
    const W = Math.max(260, Math.round(svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 600));
    const chart = chartSvg(e, curvePoints(e.position, input.stockNow, e.range.lo, e.range.hi), W);
    svg.setAttribute("viewBox", `0 0 ${W} ${chart.H}`);
    svg.innerHTML = chart.svg;
    svg.parentNode.style.setProperty("--axy", chart.axisTop + "px");
    svg.setAttribute("aria-label", chartLabel(d, e));
    q("[data-cap]").textContent = chartCaption(d, e);
    state.geom = chart.geom;
  }

  /** Pick a structure: its example numbers load, the stock price and contracts stay (reset starts them over). */
  function pick(kind, spreadType, fresh) {
    // Typed text never goes back into the page raw: it is read as a number and shown from that number, else the default.
    const kept = (id, d) => { const x = readNumber(el(id).value); return Number.isNaN(x) ? d : showNumber(x); };
    const keep = fresh ? { S0: "100", n: "1" } : { S0: kept("po-S0", "100"), n: kept("po-n", "1") };
    state.kind = kind;
    state.spreadType = kind === "vs" ? spreadType ?? "c" : null;
    buildTerms(keep.S0, keep.n);
    slider.value = String(state.kind === "vs" && state.spreadType === "p" ? 92 : handleStart());
    run();
  }

  root.addEventListener("input", (ev) => ev.target.matches && ev.target.matches("input") && run());
  root.addEventListener("click", (ev) => {
    const t = ev.target.closest ? ev.target : null;
    if (!t) return;
    const card = t.closest(".shapes [data-k]");
    if (card) return pick(card.dataset.k, state.spreadType ?? "c", false);
    const vt = t.closest("[data-type] [data-vt]");
    if (vt) return pick("vs", vt.dataset.vt, false);
    if (t.closest("[data-reset]")) pick(state.kind, "c", true);
  });

  // The chart is a shortcut to the same slider.
  const setFromPointer = (ev) => {
    const g = state.geom;
    if (!g) return;
    const r = svg.getBoundingClientRect();
    const vx = ((ev.clientX - r.left) / (r.width || g.W)) * g.W;
    const t = Math.min(1, Math.max(0, (vx - g.ml) / (g.W - g.ml - g.mr)));
    const step = parseFloat(slider.step) || 1;
    slider.value = String(Math.round((g.lo + t * (g.hi - g.lo)) / step) * step);
    run();
  };
  svg.style.touchAction = "pan-y";
  svg.addEventListener("pointerdown", (ev) => {
    try {
      svg.setPointerCapture(ev.pointerId);
    } catch {
      /* a pointer already released: the drag still follows moves on the chart */
    }
    state.drag = true;
    setFromPointer(ev);
  });
  svg.addEventListener("pointermove", (ev) => state.drag && setFromPointer(ev));
  svg.addEventListener("pointerup", () => (state.drag = false));
  svg.addEventListener("pointercancel", () => (state.drag = false));

  run();
  return { result: () => last, found: () => found.slice() };
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-payoff]")) init(root);
}
