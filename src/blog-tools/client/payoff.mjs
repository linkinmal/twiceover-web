/**
 * Block script for "The payoff builder" (ADR 1088 Decision 1, ADR 1090 Decision 8). Bundled to public/js/blog-payoff.js.
 * It reads the page's own number and range fields, runs the shared engine and writes the same sentences and drawing the
 * build printed (payoff-view.mjs) back into the page. The chart handle drags by pointer; the range slider with its
 * minus and plus buttons is the accessible control. Nothing is sent, stored or read from the address.
 */
import { STRUCTURES, curvePoints, evaluate, findsMet, validatePayoffInputs } from "../payoff-builder.mjs";
import { breakEvenHtml, chartCaption, chartLabel, chartSvg, fieldHtml, findsHtml, handleText, headHtml, inputsHtml, kindsHtml, sentenceHtml, shapesHtml, spreadTypeHtml, statsHtml, structureOf, summaryHtml, whyHtml, DESCRIPTIONS } from "../payoff-view.mjs";

/** @param {Element} root the [data-payoff] element */
export function init(root, opts = {}) {
  const q = (s) => root.querySelector(s);
  const el = (id) => root.querySelector("#" + id);
  const controls = q("[data-controls]");
  const svg = q("[data-chart]");
  if (!controls || !svg || !el("po-h")) return null;
  const reduceMotion = opts.reduceMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

  const state = { kind: "lc", spreadType: null, handleSet: false, drag: false, geom: null };
  const found = [false, false, false];
  let last = null;

  q("[data-nojs]") && (q("[data-nojs]").hidden = true);
  controls.hidden = false;
  q("[data-handle]").hidden = false;
  svg.style.touchAction = "pan-y";

  const def = () => structureOf(state.kind, state.spreadType);
  const num = (id) => parseFloat(el(id).value);

  // Rebuild the structure's own fields; keep the stock price and contracts the reader typed.
  function build(keepHandle) {
    const d = def();
    const keep = { S0: el("po-S0").value, n: el("po-n").value };
    q("[data-kinds]").innerHTML = kindsHtml(state.kind);
    q("[data-desc]").textContent = DESCRIPTIONS[state.kind];
    const type = q("[data-type]");
    type.hidden = state.kind !== "vs";
    type.innerHTML = state.kind === "vs" ? spreadTypeHtml(state.spreadType) : "";
    q("[data-in]").innerHTML = inputsHtml(d);
    q("[data-in2]").innerHTML = fieldHtml("S0", "Stock price now, $", keep.S0, 1) + fieldHtml("n", "Contracts", keep.n, 1);
    if (!keepHandle || !state.handleSet) el("po-h").value = String(d.handle);
  }

  function read() {
    const d = def();
    const values = {};
    for (const f of d.fields) values[f.id] = num("po-" + f.id);
    return { kind: state.kind, spreadType: state.spreadType, values, stockNow: num("po-S0"), contracts: num("po-n") };
  }

  function mark(errors) {
    const ids = [...def().fields.map((f) => f.id), "S0", "n"];
    for (const id of ids) {
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
    q("[data-bad]").hidden = check.ok;
    if (!check.ok) {
      const inFold = check.errors.S0 || check.errors.n;
      if (inFold) q("[data-fold]").open = true;
      return;
    }
    const d = def();
    const range = evaluate({ ...input, handle: input.stockNow }).range;
    const h = el("po-h");
    h.min = String(range.lo);
    h.max = String(range.hi);
    h.step = String(range.step);
    let handle = parseFloat(h.value);
    if (!Number.isFinite(handle)) handle = input.stockNow;
    handle = Math.min(range.hi, Math.max(range.lo, handle));
    h.value = String(handle);
    const e = evaluate({ ...input, handle });
    if (!e.ok) return;
    last = e;
    const model = { ...input, e };
    const ht = handleText(e);
    el("po-hv").textContent = ht.value;
    const he = el("po-he");
    he.className = "eff " + ht.tone;
    he.textContent = ht.effect;
    q("[data-sum]").innerHTML = summaryHtml(e);
    q("[data-head]").innerHTML = headHtml(e);
    q("[data-s1]").innerHTML = sentenceHtml(model);
    q("[data-s2]").innerHTML = breakEvenHtml(e);
    q("[data-why]").innerHTML = whyHtml(model);
    q("[data-stats]").innerHTML = statsHtml(e);
    findsMet(e).forEach((hit, i) => hit && (found[i] = true));
    q("[data-finds]").innerHTML = findsHtml(found);
    q("[data-fc]").textContent = `· ${found.filter(Boolean).length} of 3 found`;
    q("[data-shapes]").innerHTML = shapesHtml({ kind: state.kind, spreadType: state.spreadType }, true);
    const W = Math.max(260, Math.round(svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 600));
    const chart = chartSvg(e, curvePoints(e.position, input.stockNow, e.range.lo, e.range.hi), W);
    svg.setAttribute("viewBox", `0 0 ${W} ${chart.H}`);
    svg.innerHTML = chart.svg;
    svg.setAttribute("aria-label", chartLabel(d, e));
    q("[data-cap]").textContent = chartCaption(d, e);
    state.geom = chart.geom;
  }

  function pick(kind, spreadType) {
    state.kind = kind;
    state.spreadType = kind === "vs" ? spreadType ?? "c" : null;
    state.handleSet = false;
    build(false);
    run();
  }

  root.addEventListener("input", (e) => {
    if (!e.target.matches || !e.target.matches("input")) return;
    if (e.target.id === "po-h") state.handleSet = true;
    run();
  });
  root.addEventListener("click", (ev) => {
    const t = ev.target.closest ? ev.target : null;
    if (!t) return;
    const step = t.closest(".stp");
    if (step && root.contains(step)) {
      const input = el(step.dataset.for);
      step.dataset.d === "1" ? input.stepUp() : input.stepDown();
      if (input.id === "po-h") state.handleSet = true;
      return run();
    }
    const kindBtn = t.closest("[data-kinds] [data-k]");
    if (kindBtn) return pick(kindBtn.dataset.k, kindBtn.dataset.k === "vs" ? "c" : null);
    const vt = t.closest("[data-vt]:not(.shape)");
    if (vt) {
      state.spreadType = vt.dataset.vt;
      state.handleSet = false;
      build(false);
      return run();
    }
    const shape = t.closest(".shape[data-k]");
    if (shape) return pick(shape.dataset.k, shape.dataset.vt || null);
    if (t.closest("[data-reset]")) return pick(state.kind, state.spreadType);
  });

  // The chart handle: a pointer shortcut to the same range field.
  const setFromPointer = (ev) => {
    const g = state.geom;
    if (!g) return;
    const r = svg.getBoundingClientRect();
    const vx = ((ev.clientX - r.left) / (r.width || g.W)) * g.W;
    const t = Math.min(1, Math.max(0, (vx - g.ml) / (g.W - g.ml - g.mr)));
    const h = el("po-h");
    const step = parseFloat(h.step) || 1;
    h.value = String(Math.round((g.lo + t * (g.hi - g.lo)) / step) * step);
    state.handleSet = true;
    run();
  };
  svg.addEventListener("pointerdown", (ev) => {
    svg.setPointerCapture && svg.setPointerCapture(ev.pointerId);
    state.drag = true;
    setFromPointer(ev);
  });
  svg.addEventListener("pointermove", (ev) => state.drag && setFromPointer(ev));
  svg.addEventListener("pointerup", () => (state.drag = false));
  svg.addEventListener("pointercancel", () => (state.drag = false));
  void reduceMotion;

  run();
  return { result: () => last, found: () => found.slice(), kinds: STRUCTURES.length };
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-payoff]")) init(root);
}
