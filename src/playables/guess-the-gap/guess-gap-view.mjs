/**
 * guess-gap-view — the words and pictures of "Guess the gap" (blog-handoff-playables.md section 1). The build imports
 * these to print the first question, all five answers and the lesson; the block script imports them to play. The wording
 * is the artifact's (blog-sources-guess-gap-2026-10-12.html); Growth sets the final words. Figures come from
 * guess-gap.mjs, in tenths of a percent. A company name comes from the baked-in report set and is escaped all the same.
 */
import { MAX_TENTHS, hit, insideCount, offTenths, ratioTier, score } from "./guess-gap.mjs";

const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const size = (r) => Math.abs(r.movedTenths);
const pos = (tenths) => Math.round(Math.min(100, Math.max(0, (tenths / MAX_TENTHS) * 100)) * 100) / 100;
const dir = (r) => (r.movedTenths >= 0 ? "up" : "down");
const dirClass = (r) => (r.movedTenths >= 0 ? "pos" : "neg");

export const QUESTION = "How far did the stock move the next day, up or down?";
export const percent = (tenths) => `${(tenths / 10).toFixed(1)}%`;
export const dateLabel = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
export const reportLine = (i, n) => `Report ${i + 1} of ${n}`;
export function scoreLine(set, guesses) {
  const s = score(set, guesses);
  return s.played ? `Score so far: ${s.hits} of ${s.played} hits` : "Score so far: none yet";
}

export const givenHtml = (r) => `<b>${esc(r.company)}</b> reported on ${dateLabel(r.date)}. Options had priced a move of <b>${percent(r.pricedTenths)}</b>.`;
export const answerHtml = (r) => `It moved <span class="${dirClass(r)}">${dir(r)} ${percent(size(r))}</span>.`;

export function whyText(r, guessTenths) {
  const { tier, ratioTenths } = ratioTier(r);
  const priced = percent(r.pricedTenths);
  const lead = {
    times: `That is ${(ratioTenths / 10).toFixed(1)} times the ${priced} options had priced.`,
    more: `That is more than the ${priced} options had priced.`,
    close: `That is close to the ${priced} options had priced.`,
    inside: `That is inside the ${priced} options had priced.`,
  }[tier];
  return `${lead} Your guess was ${(offTenths(r, guessTenths) / 10).toFixed(1)} points away${hit(r, guessTenths) ? ", a hit." : "."}`;
}

function mark(cls, tenths, label) {
  const e = pos(tenths);
  const edge = e < 8 ? " edge-l" : e > 92 ? " edge-r" : "";
  return `<span class="gg-mk ${cls}${edge}" style="left:${e}%">${label}<i></i></span>`;
}

/** The one 0 to 30% scale: the priced band, the guess and the move (one mark when they sit within 12% of its width). */
export function meterHtml(r, guessTenths) {
  const a = size(r);
  const close = Math.abs(pos(guessTenths) - pos(a)) < 12;
  return (
    `<span class="gg-ax"></span><span class="gg-bd" style="width:${pos(r.pricedTenths)}%"></span><span class="gg-bl" style="left:0">priced: 0 to ${percent(r.pricedTenths)}</span>` +
    (close ? "" : mark("you", guessTenths, `you ${percent(guessTenths)}`)) +
    mark("act", a, `${close ? `you ${percent(guessTenths)} · ` : ""}moved ${percent(a)}`)
  );
}

const played = (guesses) => guesses.filter((g) => g !== null && g !== undefined).length;

/** The answers table. The guess columns appear only once a guess was made. */
export function tallyHtml(set, guesses) {
  const any = played(guesses) > 0;
  let rows = `<tr><th>Report</th><th>Priced</th><th>Moved</th>${any ? "<th>Your guess</th><th>Off by</th>" : ""}</tr>`;
  set.forEach((r, k) => {
    const g = guesses[k];
    const has = g !== null && g !== undefined;
    rows += `<tr><td>${esc(r.company)}</td><td>${percent(r.pricedTenths)}</td><td class="${dirClass(r)}">${dir(r)} ${percent(size(r))}</td>`;
    if (any) rows += `<td>${has ? percent(g) : "not played"}</td><td>${has ? `${(offTenths(r, g) / 10).toFixed(1)} pts` : ""}</td>`;
    rows += "</tr>";
  });
  return rows;
}

export function endTitle(guesses) {
  const n = played(guesses);
  if (!n) return "All five answers";
  return `Your ${n === 5 ? "five" : n} guess${n === 1 ? "" : "es"}`;
}

export function scoreHtml(set, guesses) {
  const s = score(set, guesses);
  if (!s.played) return "";
  return `<div><b>${s.hits} of ${s.played}</b><span>guesses within 2 points</span></div><div><b>${(s.avgTenths / 10).toFixed(1)}</b><span>points off, on average</span></div>`;
}

export const scoreResultLine = (set, guesses) => {
  const s = score(set, guesses);
  return s.played ? `Score: ${s.hits} of ${s.played} hits` : "No guesses made";
};

export const lessonBig = (set) => `In ${insideCount(set)} of these ${set.length} reports, the stock moved less than options had priced.`;

/** A pair of bars for each report: the priced move, and the move that happened, on the one 0 to 30% scale. */
export function barsHtml(set) {
  return set
    .map(
      (r) =>
        `<span class="gg-nm">${esc(r.company)}</span><span class="gg-tr p"><i style="width:${pos(r.pricedTenths)}%"></i></span><span class="gg-v">${percent(r.pricedTenths)}</span>` +
        `<span class="gg-tr m"><i style="width:${pos(size(r))}%"></i></span><span class="gg-v">${dir(r)} ${percent(size(r))}</span><span class="gg-sp"></span>`,
    )
    .join("");
}
