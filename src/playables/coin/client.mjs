/**
 * Block script for "The 60% coin" (ADR 1088 Decision 1, ADR 1090 Decision 8). Bundled to public/js/blog-coin.js.
 *
 * It only shows, hides and moves what the served page already carries: the bars, legend, lesson and study panel
 * are in the HTML with their figures computed at build. This script runs the reader's own game with the shared
 * engine, draws it, reveals the bars after the first finished game and keeps the visit's tally in memory.
 * No network call of any kind, no storage, no read of any form field.
 */
import { COIN, createRng, flip, playToEnd, formatMoney } from "./coin-game.mjs";

const pc = (x) => Math.round(x * 100) + "%";
const NS = "http://www.w3.org/2000/svg";

/**
 * @param {Element} root the [data-coin] element
 * @param {{seed?: number, reduceMotion?: boolean, wait?: (fn: () => void, ms: number) => void}} [opts]
 */
export function init(root, opts = {}) {
  const q = (s) => root.querySelector(s);
  const seed = opts.seed ?? (Date.now() ^ 0x9e3779b9) >>> 0;
  const reduceMotion = opts.reduceMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const later = opts.wait ?? ((fn, ms) => setTimeout(fn, ms));
  const rng = createRng(seed);

  const controls = q("[data-controls]");
  const all = q("[data-all]");
  const wait = q("[data-wait]");
  const nojs = q("[data-nojs]");
  const svg = q("[data-run]");
  const cap = q("[data-cap]");
  if (!controls || !all || !svg || !cap) return null;

  let f = 0.2;
  let run = [COIN.start];
  let over = false;
  let shown = false;
  let last = "";
  let tick = 0;
  const tally = [0, 0, 0]; // cap, bust, neither

  // The bars' rows are buttons that pick that bet. Served as plain rows, so the page reads without script.
  for (const row of root.querySelectorAll(".sb[data-f]")) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = row.className;
    for (const a of row.getAttributeNames()) if (a !== "class") b.setAttribute(a, row.getAttribute(a));
    b.setAttribute("aria-pressed", "false");
    while (row.firstChild) b.appendChild(row.firstChild);
    row.replaceWith(b);
  }

  nojs && (nojs.hidden = true);
  controls.hidden = false;
  all.hidden = true;
  wait.hidden = false;

  const row = (x) => root.querySelector(`.sb[data-f="${x}"]`);

  function end(outcome) {
    over = true;
    shown = true;
    tally[outcome === "cap" ? 0 : outcome === "bust" ? 1 : 2]++;
  }

  function oneFlip() {
    const w = run[run.length - 1];
    const step = flip(w, f, rng, run.length);
    run.push(step.stack);
    last = `<b>${step.heads ? "Heads" : "Tails"}.</b> You bet ${formatMoney(step.bet)} and ${step.heads ? "won" : "lost"} it.`;
    if (step.over) end(step.outcome);
  }

  function toTheEnd() {
    const r = playToEnd(run, f, rng);
    run = r.run;
    end(r.outcome);
  }

  function chart(anim) {
    const n = run.length - 1;
    const w = run[n];
    const W = Math.max(260, Math.round(svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 700));
    const H = 230;
    const M = { l: 10, r: 10, t: 28, b: 14 };
    const y = (v) => H - M.b - (Math.log(Math.max(v, 1)) / Math.log(300)) * (H - M.t - M.b);
    const xm = over ? Math.max(1, n) : Math.max(30, n);
    const x = (i) => M.l + (i / xm) * (W - M.l - M.r);
    const col = w >= COIN.cap ? "var(--gain)" : w < COIN.bustBelow ? "var(--loss)" : "var(--ink)";
    const guide = (v, label, dash, stroke, anchor, dy) =>
      `<line class="gl" x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}" style="stroke-dasharray:${dash}${stroke ? `;stroke:${stroke}` : ""}"/>` +
      `<text class="ax" x="${anchor === "end" ? W - M.r : M.l}" y="${y(v) + dy}"${anchor === "end" ? ' text-anchor="end"' : ""}>${label}</text>`;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML =
      guide(COIN.cap, "$250 cap", "6 5", "var(--gain)", "end", -7) +
      guide(COIN.start, "start $25", "2 5", "", "end", -7) +
      guide(COIN.bustBelow, "bust under $2", "6 5", "var(--loss)", "start", 16) +
      (n ? `<path class="l2${anim ? " drawin" : ""}" pathLength="1" d="${run.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("")}"/>` : "") +
      `<circle class="${anim ? "popin" : ""}" cx="${x(n).toFixed(1)}" cy="${y(w).toFixed(1)}" r="7" fill="${col}" stroke="var(--plate)" stroke-width="3"/>`;
  }

  function draw(anim) {
    const n = run.length - 1;
    const w = run[n];
    const games = tally[0] + tally[1] + tally[2];
    for (const b of root.querySelectorAll(".chip")) b.setAttribute("aria-pressed", String(+b.dataset.f === f));
    for (const b of root.querySelectorAll(".sb[data-f]")) {
      const on = +b.dataset.f === f;
      b.classList.toggle("on", on);
      if (!b.classList.contains("hd")) b.setAttribute("aria-pressed", String(on));
    }
    q("[data-w]").textContent = formatMoney(w);
    q("[data-n]").textContent = n ? `after ${n} of ${COIN.maxFlips} flips` : "your balance";
    q("[data-one]").hidden = q("[data-end]").hidden = over;
    q("[data-again]").hidden = !over;
    wait.hidden = shown;
    all.hidden = !shown;
    const r = row(f);
    q("[data-line]").innerHTML = `Betting <b>${pc(f)}</b> on every flip hit the cap in <b>${r.dataset.capPct}%</b> of games and went bust in <b>${r.dataset.bustPct}%</b>. The middle game ended at <b>${r.dataset.median}</b>.`;
    chart(anim);
    const msg = over
      ? `<b>${w >= COIN.cap ? "Hit the $250 cap" : w < COIN.bustBelow ? "Went bust" : "Ended at " + formatMoney(w)}</b> after ${n} flips.` + (games > 1 ? ` Your ${games} games: ${tally[0]} cap, ${tally[1]} bust, ${tally[2]} neither.` : "")
      : n
        ? `${last} Next bet at ${pc(f)}: ${formatMoney(w * f)}.`
        : `A ${pc(f)} bet is ${formatMoney(w * f)} right now. Change it between flips if you like.`;
    const mine = ++tick;
    if (anim && !reduceMotion) {
      cap.textContent = "Flipping…";
      later(() => {
        if (mine === tick) cap.innerHTML = msg;
      }, 1100);
    } else cap.innerHTML = msg;
  }

  root.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("[data-f],[data-one],[data-end],[data-again]");
    if (!b || !root.contains(b)) return;
    if (b.dataset.f !== undefined) {
      if (b.classList.contains("hd")) return;
      f = +b.dataset.f;
      draw(false);
    } else if ("one" in b.dataset) {
      oneFlip();
      draw(false);
    } else if ("end" in b.dataset) {
      toTheEnd();
      draw(true);
    } else {
      run = [COIN.start];
      over = false;
      last = "";
      draw(false);
    }
  });

  draw(false);
  return { state: () => ({ f, run: run.slice(), over, shown, tally: tally.slice() }) };
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-coin]")) init(root);
}
