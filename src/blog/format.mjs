/**
 * format — how a post's time is shown and marked up. Every visible date and every markup date is the same
 * instant in the same zone, New York (blog-handoff.md section 4a item 4; Growth's markup rule): the reader
 * sees "Published Fri 9 Oct 2026 · 07:00 New York" and the page carries `2026-10-09T07:00:00-04:00`.
 */
import { parsePublishTime } from "./publish.mjs";

const ZONE = "America/New_York";
const wall = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  hourCycle: "h23",
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parts(ms) {
  const o = {};
  for (const p of wall.formatToParts(new Date(ms))) o[p.type] = p.value;
  return o;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Fri 9 Oct 2026 · 07:00 New York" for a post time string (an ISO time with an offset). */
export function formatStamp(iso) {
  const ms = parsePublishTime(iso);
  if (ms === null) throw new Error(`not an ISO time with an offset: ${JSON.stringify(iso)}`);
  const p = parts(ms);
  return `${p.weekday} ${Number(p.day)} ${p.month} ${p.year} · ${p.hour}:${p.minute} New York`;
}

/** The same instant as `2026-10-09T07:00:00-04:00`, the offset New York has on that day (daylight saving applied). */
export function toNewYorkIso(iso) {
  const ms = parsePublishTime(iso);
  if (ms === null) throw new Error(`not an ISO time with an offset: ${JSON.stringify(iso)}`);
  const p = parts(ms);
  const m = String(MONTHS.indexOf(p.month) + 1).padStart(2, "0");
  const d = String(Number(p.day)).padStart(2, "0");
  const wallAsUtc = Date.UTC(Number(p.year), MONTHS.indexOf(p.month), Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  const offMin = Math.round((wallAsUtc - Math.floor(ms / 1000) * 1000) / 60000);
  const sign = offMin < 0 ? "-" : "+";
  const hh = String(Math.floor(Math.abs(offMin) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offMin) % 60).padStart(2, "0");
  return `${p.year}-${m}-${d}T${p.hour}:${p.minute}:${p.second}${sign}${hh}:${mm}`;
}

/** Whether an update is a real later change worth showing: after the publish time, not the same instant. */
export function hasUpdate(post) {
  if (!post.updatedAt) return false;
  return parsePublishTime(post.updatedAt) > parsePublishTime(post.publishAt);
}

/** "Fri 9 Oct 2026", the day alone, for an index row. */
export function formatDay(iso) {
  return formatStamp(iso).split(" · ")[0];
}

/** A title split around its highlighted words, so the template can wrap them: [before, hit, after]. */
export function splitHit(title, hit) {
  if (!hit) return [title, "", ""];
  const i = title.indexOf(hit);
  if (i < 0) return [title, "", ""];
  return [title.slice(0, i), hit, title.slice(i + hit.length)];
}
