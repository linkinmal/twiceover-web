/**
 * card — a blog post's share image (ADR 1088 Decision 4 and Amendment 2; blog-handoff.md section 10a).
 *
 * 1200 x 630, drawn as SVG and rasterised by resvg. Every card shows the post's headline (its theme's own
 * display face, the `hit` words marked as the theme marks them) and its date, and then exactly ONE of:
 *
 *   picture  the post's own `image`, in a plate with its caption, only when its licence is "Own chart";
 *   figure   the post's `figure` value large, with its note;
 *   none     nothing, and the headline fills the card.
 *
 * Nothing else is on a card: no issue number (the card is a committed file platforms cache, so a number
 * computed from publish order would go wrong), no chart field, no writer override. What a theme looks like
 * is read from `src/styles/blog.css` itself, the same custom properties the page is drawn with, so a theme
 * change reaches the card with no second table to keep in step. What a theme DRAWS (how it marks a hit,
 * its texture, how it frames a picture) is the per-theme table below, written once from the same file.
 *
 * Pure but for the render: `cardSvg` takes plain data and returns a string; `renderCard` rasterises it.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { blockAfter, mixHex, topDeclarations } from "../../ci/blog-style.mjs";
import { formatDay, splitHit } from "../../src/blog/format.mjs";
import { LOOKS } from "../../src/blog/vocabulary.mjs";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FONT_DIR = join(ROOT, "scripts", "og-fonts");

export const CARD = Object.freeze({ w: 1200, h: 630 });
/** Small text on the card: 2.6% of the card's width is 9 px on a 350 px phone feed (section 10a). */
export const SMALL_PX = 32;
export const PHONE_WIDTH_PX = 350;
/** Only a picture drawn by us may travel on a card: a share card has no licence line (Amendment 2 limit (a)). */
export const CARD_LICENCE = "Own chart";

const PAD_Y = 60;
const PAD_X = 64.8;
const GAP = 48;
const INNER_W = CARD.w - 2 * PAD_X;
/** The kit's grid: 1.3fr headline, 1fr aside. */
const LEFT_W = ((INNER_W - GAP) * 1.3) / 2.3;
const RIGHT_W = INNER_W - GAP - LEFT_W;
const RIGHT_X = PAD_X + LEFT_W + GAP;

/** The faces the cards use, each a static TTF instanced from the site's own woff2 (og-fonts/instance-faces.py). */
export const FACES = Object.freeze({
  "source-serif-4-latin-opsz-normal@600": { family: "Source Serif 4 Display", weight: 600, file: "source-serif-4-display-600.ttf" },
  "big-shoulders-display-latin-wght-normal@800": { family: "Big Shoulders Display", weight: 800, file: "big-shoulders-display-800.ttf" },
  "bricolage-grotesque-latin-opsz-normal@700": { family: "Bricolage Grotesque", weight: 700, file: "bricolage-grotesque-700.ttf" },
  "bricolage-grotesque-latin-opsz-normal@800": { family: "Bricolage Grotesque", weight: 800, file: "bricolage-grotesque-800.ttf" },
  "fraunces-latin-opsz-normal@700": { family: "Fraunces", weight: 700, file: "fraunces-700.ttf" },
  "fraunces-latin-opsz-italic@300": { family: "Fraunces Italic", weight: 300, file: "fraunces-italic-300.ttf" },
  "archivo-latin-wdth-normal@800": { family: "Archivo", weight: 800, file: "archivo-800.ttf" },
  "besley-latin-wght-normal@900": { family: "Besley", weight: 900, file: "besley-900.ttf" },
  "ibm-plex-mono-latin-700-normal@700": { family: "IBM Plex Mono", weight: 700, file: "ibm-plex-mono-700.ttf" },
});
const SANS = { family: "Source Sans 3", file400: "source-sans-3-400.ttf", file600: "source-sans-3-600.ttf" };
const MONO = { family: "Source Code Pro", weight: 400, file: "source-code-pro-400.ttf" };

// ---------------------------------------------------------------- what a theme is, read from blog.css

const num = (v, fallback) => (v === undefined || Number.isNaN(parseFloat(v)) ? fallback : parseFloat(v));

/** A filter such as `grayscale(1) contrast(1.15) brightness(1.2)`: only these three functions occur. */
function parseFilter(v) {
  const f = { contrast: 1, brightness: 1 };
  for (const [, fn, arg] of String(v).matchAll(/(\w+)\(([^)]*)\)/g)) {
    if (fn === "contrast" || fn === "brightness") f[fn] = parseFloat(arg);
    else if (fn !== "grayscale") throw new Error(`blog.css --phf uses a filter the card does not draw: ${fn}`);
  }
  return f;
}

/** `transparent`, a hex colour, or `linear-gradient(<deg>deg,<c1>,<c2>)`. */
function parseBackdrop(v) {
  const s = String(v).trim();
  if (s === "transparent") return null;
  const g = s.match(/^linear-gradient\(\s*(-?[\d.]+)deg\s*,\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)$/i);
  if (g) return { gradient: { deg: parseFloat(g[1]), from: g[2], to: g[3] } };
  if (/^#[0-9a-f]{6}$/i.test(s)) return { color: s };
  throw new Error(`blog.css --phbg is not a colour or a two-stop gradient: ${s}`);
}

/**
 * One theme's values as the page draws them: colours, headline face settings, and the photo treatment.
 * @param {string} css blog.css
 * @param {string} name a theme's token name (a key of LOOKS)
 */
export function readLook(css, name) {
  const kit = LOOKS[name].kit;
  const base = topDeclarations(blockAfter(css, "[data-look]{") ?? "");
  const own = topDeclarations(blockAfter(css, `[data-look="${kit}"]{`) ?? "");
  const get = (k) => own.get(k) ?? base.get(k);
  const g = get("--g");
  const ink = get("--ink");
  if (!g || !ink) throw new Error(`blog.css has no ground and ink for theme "${name}"`);
  return {
    name,
    kit,
    g,
    plate: get("--plate"),
    ink,
    ink2: own.get("--ink2") ?? mixHex(ink, g, 62),
    a: get("--a"),
    a2: get("--a2"),
    rule: own.get("--rule") ?? `${mixHex(ink, g, 20)}`,
    fdw: num(get("--fdw"), 400),
    fdsz: num(get("--fdsz"), 1),
    fdlh: num(get("--fdlh"), 1.04),
    fdls: num(get("--fdls"), -0.02),
    italic: get("--fdst") === "italic",
    rad: num(get("--rad"), 0),
    photo: { filter: parseFilter(get("--phf") ?? "grayscale(1)"), blend: get("--phb") ?? "normal", backdrop: parseBackdrop(get("--phbg") ?? "transparent"), dots: num(get("--phd"), 0) },
  };
}

// ---------------------------------------------------------------- text measuring and wrapping

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Text widths, as a fraction of the font size, measured by resvg itself with the very faces the card is
 * drawn in (so wrapping and highlights agree with the pixels). resvg reports ink bounds, not advances, so a
 * string is measured between two bars and the bars' own span taken off.
 */
function makeMeter(fontFiles) {
  const cache = new Map();
  const bbox = (face, text) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="1600"><text x="200" y="1200" font-family="${esc(face.family)}" font-weight="${face.weight}" font-size="1000">${esc(text)}</text></svg>`;
    const b = new (require("@resvg/resvg-js").Resvg)(svg, { font: { loadSystemFonts: false, fontFiles } }).getBBox();
    if (!b) throw new Error(`could not measure ${JSON.stringify(text)} in ${face.family}`);
    return b.width;
  };
  return (face, text) => {
    const key = `${face.family}@${face.weight}\u0000${text}`;
    if (!cache.has(key)) cache.set(key, (bbox(face, `|${text}|`) - bbox(face, "||")) / 1000);
    return cache.get(key);
  };
}

/** Greedy wrap of `words` into lines no wider than `maxW` (px) at `size`; null if one word alone is too wide. */
function wrap(words, widthOf, maxW) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    const tryLine = [...cur, w];
    if (cur.length && widthOf(tryLine) > maxW) {
      lines.push(cur);
      cur = [w];
    } else cur = tryLine;
    if (widthOf(cur) > maxW && cur.length === 1) return null;
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/**
 * `text` wrapped to at most `maxLines` lines of `maxW` px (`widthOf(string)` in px). Past the limit the last
 * line is cut at a word and ends in an ellipsis, so a long caption is shortened where the reader can see it.
 * @returns {string[]}
 */
export function clampLines(text, widthOf, maxW, maxLines) {
  const words = text.split(/\s+/).filter(Boolean).map((t) => ({ text: t }));
  const lines = (wrap(words, (ws) => widthOf(ws.map((w) => w.text).join(" ")), maxW) ?? []).map((ws) => ws.map((w) => w.text));
  if (lines.length <= maxLines) return lines.map((l) => l.join(" "));
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  const cut = (ws) => `${ws.join(" ").replace(/[.,;:!?]+$/, "")}…`;
  while (last.length > 1 && widthOf(cut(last)) > maxW) last = last.slice(0, -1);
  kept[maxLines - 1] = [cut(last)];
  return kept.map((l) => l.join(" "));
}

/** The title as words, each carrying whether it falls in the `hit` span. */
function titleWords(title, hit) {
  const [pre, mid, post] = splitHit(title, hit);
  const out = [];
  const push = (s, isHit) => {
    for (const w of s.split(/\s+/).filter(Boolean)) out.push({ text: w, hit: isHit });
  };
  // A word touching the hit span's edge belongs to whichever side of the split it began on; a hit span that
  // starts or ends mid-word still marks its characters, so split by character ranges, not only by spaces.
  if (!mid) {
    push(title, false);
    return out;
  }
  const start = pre.length;
  const end = start + mid.length;
  let i = 0;
  for (const raw of title.split(/(\s+)/)) {
    const wStart = i;
    i += raw.length;
    if (!raw.trim()) continue;
    out.push({ text: raw, hit: wStart < end && wStart + raw.length > start });
  }
  return out;
}

// ---------------------------------------------------------------- the card

/** Which of the three bodies a post's card carries. A figure or picture is a post's own field. */
export function chooseBody(post) {
  if (post.image && post.image.licence === CARD_LICENCE) return "picture";
  if (post.figure) return "figure";
  return "none";
}

function imageMime(bytes) {
  const b = Buffer.from(bytes);
  if (b.length > 8 && b.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const bar = (x, y, w, h, fill, extra = "") => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${fill}" ${extra}/>`;

/** The ground and the motif behind every body (the look's own background, drawn once). */
function ground(L, grain) {
  const { w, h } = CARD;
  let defs = "";
  let art = bar(0, 0, w, h, L.g);
  switch (L.kit) {
    case "marker":
      defs = `<pattern id="mk" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.2" fill="rgba(33,29,23,.2)"/></pattern>`;
      art += bar(0, 0, w, h, "url(#mk)");
      break;
    case "blueprint": {
      const lines = [];
      for (let x = 0; x < w; x += 28) lines.push(`<rect x="${x}" y="0" width="1" height="${h}"/>`);
      for (let y = 0; y < h; y += 28) lines.push(`<rect x="0" y="${y}" width="${w}" height="1"/>`);
      art += `<g fill="rgba(207,227,255,.1)">${lines.join("")}</g>`;
      break;
    }
    case "newsprint":
    case "riso":
      defs = `<pattern id="gr" width="180" height="180" patternUnits="userSpaceOnUse"><image width="180" height="180" href="data:image/svg+xml;base64,${Buffer.from(grain).toString("base64")}"/></pattern>`;
      art += bar(0, 0, w, h, "url(#gr)");
      break;
    case "neon":
      defs =
        `<radialGradient id="n1" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${w * 0.85} 0) scale(${w * 0.6} 420)"><stop offset="0" stop-color="rgb(255,63,210)" stop-opacity=".24"/><stop offset="1" stop-color="rgb(255,63,210)" stop-opacity="0"/></radialGradient>` +
        `<radialGradient id="n2" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(0 260) scale(${w * 0.5} 380)"><stop offset="0" stop-color="rgb(77,181,255)" stop-opacity=".17"/><stop offset="1" stop-color="rgb(77,181,255)" stop-opacity="0"/></radialGradient>`;
      art += bar(0, 0, w, h, "url(#n1)") + bar(0, 0, w, h, "url(#n2)");
      break;
    case "printout": {
      const holes = [];
      for (let y = 14; y < h; y += 28) holes.push(`<circle cx="13" cy="${y}" r="5"/><circle cx="${w - 13}" cy="${y}" r="5"/>`);
      art += `<g fill="#C6CAC3">${holes.join("")}</g>`;
      break;
    }
    default:
  }
  return { defs, art };
}

/** The mark the page's masthead uses (BlogMark.astro), as a path at `s` x its 24 x 20 box. */
const mark = (x, y, s, fill) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}"><rect x="0" y="1" width="19" height="7" rx="3.5"/><rect x="5" y="12" width="19" height="7" rx="3.5" opacity=".5"/></g>`;

/** How each theme marks the `hit` words (the page's `.hit` rule), as boxes drawn behind the text and text colours. */
function hitStyle(L) {
  const pad = { nightdesk: 0, marker: 0.1, blueprint: 0.12, newsprint: 0, neon: 0, riso: 0.1, exhibit: 0, ticket: 0.14, printout: 0.12, house: 0 }[L.kit];
  const draw = (x, top, w, h, size) => {
    const em = size;
    switch (L.kit) {
      case "nightdesk":
        return bar(x, top + h - 0.13 * em, w, 0.13 * em, L.a);
      case "marker":
        return `<rect x="${x.toFixed(2)}" y="${(top + 0.16 * h).toFixed(2)}" width="${w.toFixed(2)}" height="${(0.74 * h).toFixed(2)}" rx="${(0.3 * em).toFixed(2)}" fill="${L.a2}"/>`;
      case "blueprint":
        return `<rect x="${(x + 0.75).toFixed(2)}" y="${(top + 0.75).toFixed(2)}" width="${(w - 1.5).toFixed(2)}" height="${(h - 1.5).toFixed(2)}" fill="none" stroke="${L.a}" stroke-width="1.5"/>`;
      case "newsprint":
        return bar(x, top + h - 0.1 * em, w, 0.1 * em, L.a);
      case "riso":
        return bar(x, top, w, h, L.a2);
      case "ticket":
      case "printout":
        return bar(x, top, w, h, L.ink);
      default:
        return "";
    }
  };
  const textFill = { ticket: L.g, printout: L.g, riso: L.ink, house: L.a, neon: L.a, exhibit: L.a }[L.kit] ?? L.ink;
  return { pad, draw, textFill, glow: L.kit === "neon" };
}

/**
 * Lay out the headline: the largest size at or under `maxSize` whose wrapped lines fit `maxW` x `maxH`.
 * @returns {{size:number, lines:Array<Array<{text:string,hit:boolean}>>}}
 */
function fitHeadline({ words, meter, face, L, hs, maxW, maxH, maxSize, minSize }) {
  const space = (size) => meter(face, " ") * size;
  const ls = (n, size) => n * L.fdls * size;
  const widthOf = (size) => (ws) => {
    const text = ws.map((x) => x.text).join(" ");
    const runPad = ws.some((x) => x.hit) ? 2 * hs.pad * size : 0;
    // The advance of the line at `size`: each word measured on its own, plus the spaces between them.
    return ws.reduce((s, x) => s + meter(face, x.text) * size, 0) + (ws.length - 1) * space(size) + ls(text.length, size) + runPad;
  };
  for (let size = maxSize; size >= minSize; size -= 2) {
    const lines = wrap(words, widthOf(size), maxW);
    if (lines && lines.length * size * L.fdlh <= maxH) return { size, lines };
  }
  throw new Error("the headline does not fit the card, even at the smallest size; shorten it");
}

/**
 * The card as SVG text, plus which body it carries. `image` is the post's picture file's bytes, needed only
 * when the body is a picture.
 *
 * @param {{title:string,hit?:string,publishAt:string,look:string,figure?:{value:string,note:string},image?:{src:string,alt:string,source:string,licence:string}}} post
 * @param {{css:string, grain:string|Buffer, image?:Uint8Array, fontFiles?:string[]}} ctx
 */
export function cardSvg(post, ctx) {
  const L = readLook(ctx.css, post.look);
  const display = FACES[`${LOOKS[post.look].display}@${L.fdw}`];
  if (!display) throw new Error(`theme "${post.look}": no instanced face for ${LOOKS[post.look].display} at weight ${L.fdw}`);
  const body = chooseBody(post);
  const files = [display.file, SANS.file400, SANS.file600, MONO.file, "ibm-plex-mono-700.ttf"].map((f) => join(FONT_DIR, f));
  const meter = makeMeter(files);
  const sansFace = { family: SANS.family, weight: 400 };
  const sansBold = { family: SANS.family, weight: 600 };
  const monoFace = L.kit === "printout" ? FACES["ibm-plex-mono-latin-700-normal@700"] : MONO;
  const hs = hitStyle(L);
  const { defs: gDefs, art } = ground(L, ctx.grain);
  const defs = [gDefs];
  const out = [];

  // masthead: the mark and "TwiceOver Blog", never a number
  const mastY = PAD_Y;
  out.push(mark(PAD_X, mastY - 2, 1.7, L.ink));
  out.push(`<text x="${(PAD_X + 24 * 1.7 + 14).toFixed(1)}" y="${mastY + 30}" font-family="${SANS.family}" font-weight="600" font-size="${SMALL_PX}" letter-spacing="${(SMALL_PX * 0.1).toFixed(2)}" fill="${L.ink2}">TWICEOVER BLOG</text>`);

  // date, bottom left
  const dateY = CARD.h - PAD_Y;
  out.push(`<text x="${PAD_X}" y="${dateY}" font-family="${SANS.family}" font-weight="400" font-size="${SMALL_PX}" fill="${L.ink2}">${esc(formatDay(post.publishAt))}</text>`);

  // headline
  const headTop = PAD_Y + 34 + 36;
  const headBottom = dateY - SMALL_PX - 24;
  const maxW = body === "none" ? INNER_W : LEFT_W;
  const useHit = Boolean(post.hit) && body !== "figure"; // on the figure card the hit mark is plain (section 10a)
  const words = titleWords(post.title, useHit ? post.hit : undefined);
  const base = 74.4 * L.fdsz;
  const { size, lines } = fitHeadline({
    words,
    meter,
    face: display,
    L,
    hs: useHit ? hs : { ...hs, pad: 0 },
    maxW,
    maxH: headBottom - headTop,
    maxSize: body === "none" ? 112 * L.fdsz : base,
    minSize: 36 * L.fdsz,
  });
  const lineH = size * L.fdlh;
  const glow = hs.glow && useHit ? `<filter id="gl" x="-30%" y="-60%" width="160%" height="220%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="${(0.35 * size * 0.5).toFixed(1)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : "";
  defs.push(glow);
  const headBox = [];
  const headText = [];
  const shadowText = []; // the risograph headline's offset second ink: the same words again, so tests set it aside
  const attrs = (fill, extra = "") => `font-family="${esc(display.family)}" font-weight="${display.weight}" font-size="${size.toFixed(2)}" letter-spacing="${(L.fdls * size).toFixed(3)}" fill="${fill}" ${extra}`;
  lines.forEach((line, i) => {
    const baseline = headTop + i * lineH + size * (0.5 * L.fdlh + 0.3);
    const top = baseline - size * 0.92;
    const boxH = size * 1.2;
    const pre = line.filter((_, j) => !line.slice(0, j + 1).some((x) => x.hit)).map((x) => x.text);
    const hitWords = line.filter((x) => x.hit).map((x) => x.text);
    const post_ = line.slice(pre.length + hitWords.length).map((x) => x.text);
    const adv = (text) => (text ? meter(display, text) * size + text.length * L.fdls * size : 0);
    const sp = meter(display, " ") * size + L.fdls * size;
    const preText = pre.join(" ");
    const hitText = hitWords.join(" ");
    const postText = post_.join(" ");
    let x = PAD_X;
    const draw = (text, fill, extra = "") => `<text x="${x.toFixed(2)}" y="${baseline.toFixed(2)}" ${attrs(fill, extra)}>${esc(text)}</text>`;
    const shadowAt = L.kit === "riso" ? 0.045 * size : 0;
    const row = [];
    if (preText) {
      row.push([x, preText, L.kit === "riso" ? L.a : L.ink, ""]);
      x += adv(preText) + sp;
    }
    if (hitText) {
      const padPx = hs.pad * size;
      const hitW = adv(hitText);
      headBox.push(hs.draw(x - 0, top, hitW + 2 * padPx, boxH, size));
      row.push([x + padPx, hitText, hs.textFill, hs.glow ? 'filter="url(#gl)"' : ""]);
      x += hitW + 2 * padPx + (postText ? sp : 0);
    }
    if (postText) row.push([x, postText, L.kit === "riso" ? L.a : L.ink, ""]);
    if (shadowAt) for (const [rx, t] of row.filter((r) => r[2] === L.a)) shadowText.push(`<text x="${(rx + shadowAt).toFixed(2)}" y="${(baseline + shadowAt).toFixed(2)}" ${attrs(L.a2)}>${esc(t)}</text>`);
    for (const [rx, t, fill, extra] of row) {
      x = rx;
      headText.push(draw(t, fill, extra));
    }
  });

  // the body beside the headline
  const aside = [];
  const bottom = dateY;
  if (body === "figure") {
    const fig = post.figure;
    let fs = 132;
    while (meter(monoFace, fig.value) * fs > RIGHT_W && fs > 40) fs -= 2;
    const noteLines = wrap(fig.note.split(/\s+/).map((t) => ({ text: t })), (ws) => meter(sansFace, ws.map((w) => w.text).join(" ")) * SMALL_PX, RIGHT_W) ?? [];
    const noteH = noteLines.length * SMALL_PX * 1.3;
    const noteTop = bottom - noteH + SMALL_PX * 0.95;
    noteLines.forEach((ws, i) => aside.push(`<text x="${RIGHT_X.toFixed(1)}" y="${(noteTop + i * SMALL_PX * 1.3).toFixed(1)}" font-family="${SANS.family}" font-weight="400" font-size="${SMALL_PX}" fill="${L.ink2}">${esc(ws.map((w) => w.text).join(" "))}</text>`));
    const figBase = bottom - noteH - 22 - fs * 0.1;
    aside.push(`<text x="${RIGHT_X.toFixed(1)}" y="${figBase.toFixed(1)}" font-family="${esc(monoFace.family)}" font-weight="${monoFace.weight}" font-size="${fs}" fill="${L.ink}">${esc(fig.value)}</text>`);
  } else if (body === "picture") {
    const mime = ctx.image ? imageMime(ctx.image) : null;
    if (!mime) throw new Error(`${post.title}: the picture must be a PNG, JPEG or WebP file (resvg reads no AVIF)`);
    const alt = post.image.alt.trim();
    const cap = /[.!?]$/.test(alt) ? alt : `${alt}.`;
    const capWidth = (text) => meter(sansFace, text) * SMALL_PX;
    const capLines = clampLines(cap, capWidth, RIGHT_W, 3).map((t) => ({ text: t }));
    const capH = capLines.length * SMALL_PX * 1.3;
    const plateH = (RIGHT_W * 3) / 5;
    const capTop = bottom - capH + SMALL_PX * 0.95;
    const plateY = bottom - capH - 20 - plateH;
    capLines.forEach((l, i) => aside.push(`<text x="${RIGHT_X.toFixed(1)}" y="${(capTop + i * SMALL_PX * 1.3).toFixed(1)}" font-family="${SANS.family}" font-weight="400" font-size="${SMALL_PX}" fill="${L.ink2}">${esc(l.text)}</text>`));
    aside.push(plate(L, { x: RIGHT_X, y: plateY, w: RIGHT_W, h: plateH, mime, data: Buffer.from(ctx.image).toString("base64"), defs }));
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.w}" height="${CARD.h}" viewBox="0 0 ${CARD.w} ${CARD.h}"><defs>${defs.join("")}</defs>` +
    art +
    out.join("") +
    (headBox.some(Boolean) ? `<g id="hit-boxes">${headBox.join("")}</g>` : "") +
    (shadowText.length ? `<g id="riso-shadow">${shadowText.join("")}</g>` : "") +
    headText.join("") +
    aside.join("") +
    `</svg>`;
  return { svg, body, size, fontFiles: files };
}

/** The plate a picture sits in, with the theme's own photo treatment (the page's `.photo .ph`). */
function plate(L, { x, y, w, h, mime, data, defs }) {
  const { filter, blend, backdrop, dots } = L.photo;
  const slope = filter.contrast * filter.brightness;
  const icpt = ((1 - filter.contrast) / 2) * filter.brightness;
  defs.push(`<filter id="pf" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="${slope}" intercept="${icpt}"/><feFuncG type="linear" slope="${slope}" intercept="${icpt}"/><feFuncB type="linear" slope="${slope}" intercept="${icpt}"/></feComponentTransfer></filter>`);
  defs.push(`<clipPath id="pc"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${L.rad}"/></clipPath>`);
  let bg = "";
  if (backdrop?.color) bg = bar(x, y, w, h, backdrop.color);
  else if (backdrop?.gradient) {
    const { deg, from, to } = backdrop.gradient;
    const t = (deg * Math.PI) / 180;
    const len = Math.abs(w * Math.sin(t)) + Math.abs(h * Math.cos(t));
    const cx = x + w / 2;
    const cy = y + h / 2;
    const dx = (Math.sin(t) * len) / 2;
    const dy = (-Math.cos(t) * len) / 2;
    defs.push(`<linearGradient id="pg" gradientUnits="userSpaceOnUse" x1="${(cx - dx).toFixed(2)}" y1="${(cy - dy).toFixed(2)}" x2="${(cx + dx).toFixed(2)}" y2="${(cy + dy).toFixed(2)}"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`);
    bg = bar(x, y, w, h, "url(#pg)");
  }
  let screen = "";
  if (L.kit === "printout") {
    const rows = [];
    for (let yy = y + 2; yy < y + h; yy += 3) rows.push(`<rect x="${x}" y="${yy}" width="${w}" height="1"/>`);
    screen = `<g fill="rgba(255,255,255,.6)">${rows.join("")}</g>`;
  } else if (dots > 0) {
    defs.push(`<pattern id="ht" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.2" fill="rgba(0,0,0,.62)"/></pattern>`);
    screen = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#ht)" opacity="${dots}" style="mix-blend-mode:overlay"/>`;
  }
  const img = `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" href="data:${mime};base64,${data}" filter="url(#pf)" style="mix-blend-mode:${blend}"/>`;
  const frame = `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${L.rad}" fill="none" stroke="${L.rule}" stroke-width="1"/>`;
  let behind = "";
  let wrapOpen = "";
  let wrapClose = "";
  if (L.kit === "riso") behind = bar(x + 10, y + 10, w, h, L.a2);
  if (L.kit === "blueprint") behind = `<rect x="${x - 6.5}" y="${y - 6.5}" width="${w + 13}" height="${h + 13}" fill="none" stroke="#CFE3FF" stroke-width="1"/>`;
  if (L.kit === "marker") {
    defs.push(`<filter id="ps" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="12" stdDeviation="13" flood-color="#211D17" flood-opacity=".22"/></filter>`);
    const cx = x + w / 2;
    const cy = y + h / 2;
    wrapOpen = `<g transform="rotate(-1.1 ${cx} ${cy})">`;
    behind = `<rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" fill="#fff" filter="url(#ps)"/>`;
    wrapClose = "</g>";
  }
  return `${wrapOpen}${behind}<g clip-path="url(#pc)" style="isolation:isolate">${bg}${img}${screen}</g>${frame}${wrapClose}`;
}

/** Everything a render reads that is not the post: the page's stylesheet and the paper texture. */
export function loadContext(root = ROOT) {
  return {
    css: readFileSync(join(root, "src/styles/blog.css"), "utf8"),
    grain: readFileSync(join(root, "public/blog-textures/paper-grain.svg")),
  };
}

/** The card as a PNG, 1200 x 630. */
export function renderCard(post, ctx) {
  const { svg, body, fontFiles } = cardSvg(post, ctx);
  const { Resvg } = require("@resvg/resvg-js");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: CARD.w }, font: { loadSystemFonts: false, fontFiles, defaultFontFamily: SANS.family } }).render().asPng();
  return { png, body, svg };
}
