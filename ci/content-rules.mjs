/**
 * content-rules — the content gate's rules as pure functions, so they can be mutation-tested
 * (consult 0811: a gate whose only proof is "the current build passes" is unfalsifiable by the gate
 * itself). `check-content.mjs` is the thin walker over `dist/` that calls them.
 *
 * The compliance rules (AC3 banned terms, AC4 disclaimer, the in-app link set) moved here unchanged.
 * Added for the blog (ADR 1090 Decisions 9 and 11, Security consults 1089 and 1091):
 *
 *   - Banned-term scan: a post body leaves it, by exact route and only when its slug is a file in the
 *     content folder; it takes a phrase floor instead, run on rendered, normalized text. The blog
 *     index and topic pages (exemption B) keep the full scan after the exact post titles and
 *     descriptions are subtracted, and take the floor too. Every other page, and every other page under
 *     `blog/` (games, tools), keeps the full scan. The disclaimer check stays on every page.
 *   - Markup rules on every blog page: no inline script (JSON-LD data excepted), no handler, no
 *     iframe/object/embed/base/meta refresh, scripts only from a fixed list, root-relative images,
 *     https or root-relative links, `rel="noopener noreferrer"` on external ones, `/go/try` links with
 *     only the pinned keys, and `<form>` only the pinned door on a post.
 *
 * The phrase floor is a floor, not the check: Growth's rails read is the check (ADR 1090 Decision 9).
 */
import { JSDOM } from "jsdom";
import { isValidSlug } from "../src/blog/publish.mjs";
import { isRootRelative } from "../src/blog/url.mjs";

// ---------------------------------------------------------------------------------------------
// Compliance rules (unchanged from the pre-blog gate)
// ---------------------------------------------------------------------------------------------

export const IN_APP_PAGES = [
  "in-app/terms/index.html",
  "in-app/privacy/index.html",
  "in-app/cookies/index.html",
];

// The closed set an in-app page may link to. Everything else — "/", "/pricing", "/go/*",
// "/refunds", any absolute URL — fails.
const IN_APP_HREF_ALLOWED = /^(?:#[\w-]*|mailto:[^"\s]+|\/in-app\/(?:terms|privacy|cookies)(?:#[\w-]*)?)$/;

export function hrefsOf(html) {
  return [...html.matchAll(/<a\b[^>]*?\bhref="([^"]*)"/gi)].map((m) => m[1]);
}

export function disallowedInAppHrefs(html) {
  return hrefsOf(html).filter((href) => !IN_APP_HREF_ALLOWED.test(href));
}

export const BANNED = [
  /\bbuy\b/g,
  /\bsell\b/g,
  /\bbuy now\b/g,
  /\bsell now\b/g,
  /\bstrong buy\b/g,
  /\brecommend(?:s|ed|ation|ations)?\b/g,
  /\bsuitable\b/g,
  /\bsuitability\b/g,
  /\badvice\b/g,
  /\badvise(?:s|d)?\b/g,
  /\byou should\b/g,
];

// Documented exceptions, verbatim from the signed copy sources. Negations and
// non-trading boilerplate only — never an actual directive.
export const ALLOWED = [
  // Home, "What TwiceOver is not" (site-copy-twiceover.md, ADR 0011 analysis-led swap) — quoted negation.
  'no recommendations, no trading signals, no scores, no ratings — and never a one-line verdict or a "buy" or "sell."',
  // Home, "What you see" outlook item (site-copy-twiceover.md, ADR 0011) — quoted negation.
  'never a score, never a "buy" or "sell."',
  // ToS "Nature of the service" insert (PM, compliance-load-bearing) — negation.
  "nothing it produces is investment advice, a recommendation, a solicitation, or a suitability determination",
  "not a registered investment adviser, broker-dealer, or financial planner",
  // Privacy PM clause — negation (data sale, not trading).
  "we do not sell or rent personal data",
  // GetTerms Privacy, Security section — security caveat, not investment advice.
  "we advise that no method of electronic transmission or storage is 100% secure",
  // GetTerms boilerplate "you should" instances — browser/policy mechanics, not
  // trading directives (privacy intro, cookie policy ×2).
  "you should read their posted privacy policy information",
  "you should instruct your browser to refuse cookies",
  "you should check the date of this cookie policy",
];

export const normalize = (s) => s.replace(/\s+/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();

/** Rendered text of an HTML document (script/style dropped, tags stripped, entities decoded). */
export function textOf(html) {
  return normalize(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " "),
  );
}

// ---------------------------------------------------------------------------------------------
// Blog: which page is which
// ---------------------------------------------------------------------------------------------

/** Scripts a blog page may load, root-relative and exact. Filled by the reviewed block files (PR 4). */
export const BLOG_SCRIPTS = Object.freeze([]);

/** The phrases a post may not contain: a floor, not the check (ADR 1090 Decision 9, 11). */
export const PHRASE_FLOOR = Object.freeze([
  "buy now",
  "sell now",
  "strong buy",
  "close your calls",
  "you should",
  "we recommend",
  "you must",
  "you need to",
  "i recommend",
  "we advise",
  "our pick",
  "go long",
  "go short",
]);

const LIST_ROUTES = [
  /^blog\/index\.html$/,
  /^blog\/topic\/[a-z0-9-]+\/index\.html$/,
  /^blog\/topic\/[a-z0-9-]+\/page\/\d+\/index\.html$/,
  /^blog\/page\/\d+\/index\.html$/,
];

/**
 * @param {string} rel a built page's path under dist/
 * @param {string[]} postSlugs the slugs that are files in the content folder
 * @returns {'post'|'list'|'blog'|'other'}
 *   post — a post page; list — the index, a topic page or a pagination page; blog — any other page
 *   under blog/ (a game, a tool, an unknown route); other — everything else.
 */
export function pageKind(rel, postSlugs) {
  if (!rel.startsWith("blog/")) return "other";
  if (LIST_ROUTES.some((re) => re.test(rel))) return "list";
  const m = /^blog\/([^/]+)\/index\.html$/.exec(rel);
  if (m && postSlugs.includes(m[1]) && isValidSlug(m[1])) return "post";
  return "blog";
}

// ---------------------------------------------------------------------------------------------
// Blog: rendered, normalized text
// ---------------------------------------------------------------------------------------------

// A list page subtracts a post's exact title or description before its full scan. A string this short
// could be one banned word, which would then pass across the whole page, so a short one is not subtracted.
const MIN_SUBTRACT = 20;
const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
const TEXT_ATTRS = ["alt", "aria-label", "title"];

/** Lower-case, invisible characters gone, every kind of space one space, quotes straight. */
export function normalizeBlog(s) {
  return normalize(s.replace(INVISIBLE, "")).toLowerCase();
}

const parse = (html) => new JSDOM(html).window.document;

// Elements a reader sees as separate lines or cells. Their text must not run into a neighbour's
// ("a headline" + "buy now" must not read "headlinebuy now"); inline elements (<b>, <a>, <span>) must
// NOT add a space, or "bu<b>y</b> now" would stop reading as "buy now".
const BLOCK = new Set(
  "address article aside blockquote body br caption dd details div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr li main nav ol option p pre section summary table tbody td tfoot th thead title tr ul".split(" "),
);

/**
 * What a reader sees (`visibleOnly`), or also what a screen reader and a search result show:
 * alt/aria-label/title and meta text. The disclaimer must be visible; the phrase floor reads it all.
 */
function blogText(doc, visibleOnly = false) {
  const clone = doc.documentElement.cloneNode(true);
  for (const el of clone.querySelectorAll("script, style")) el.remove();
  for (const el of clone.querySelectorAll("*")) {
    if (!BLOCK.has(el.tagName.toLowerCase())) continue;
    el.before(" ");
    el.after(" ");
  }
  const parts = [clone.textContent];
  if (visibleOnly) return normalizeBlog(parts.join(" "));
  for (const el of clone.querySelectorAll("*")) for (const a of TEXT_ATTRS) if (el.hasAttribute(a)) parts.push(el.getAttribute(a));
  for (const m of clone.querySelectorAll("meta[content]")) {
    const key = (m.getAttribute("name") || m.getAttribute("property") || "").toLowerCase();
    if (key === "description" || key.startsWith("og:") || key.startsWith("twitter:")) parts.push(m.getAttribute("content"));
  }
  return normalizeBlog(parts.join(" "));
}

/** The exact strings a list page prints for a post: its heading, description and page title. */
export function postStrings(html) {
  const doc = parse(html);
  const out = [doc.querySelector("h1")?.textContent, doc.querySelector('meta[name="description"]')?.getAttribute("content"), doc.querySelector("title")?.textContent];
  return out.map((s) => (s ?? "").trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------------------------
// Blog: markup rules and the door form
// ---------------------------------------------------------------------------------------------

const SITE = "https://twiceover.io";
const isSafeHref = (v) => /^https:\/\/[^\s\\]+$/.test(v) || /^#[^\s\\]*$/.test(v) || isRootRelative(v);
const isSiteLink = (v) => isRootRelative(v) || v.startsWith(SITE + "/");
const UTM_SMALL = /^[a-z0-9-]{1,32}$/;
const UTM_CAMPAIGN = /^[a-z0-9-]{1,64}$/;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"];
const FORM_ATTRS = ["formaction", "formmethod", "formtarget", "formenctype", "formnovalidate"];

function goTryQueryOk(href) {
  const u = new URL(href, "https://twiceover.io");
  if (u.pathname.replace(/\/+$/, "") !== "/go/try") return true;
  const keys = [...u.searchParams.keys()];
  if (keys.length === 0) return true;
  if (keys.length !== 3 || !UTM_KEYS.every((k) => keys.includes(k))) return false;
  return UTM_SMALL.test(u.searchParams.get("utm_source")) && UTM_SMALL.test(u.searchParams.get("utm_medium")) && UTM_CAMPAIGN.test(u.searchParams.get("utm_campaign"));
}

/** @returns {string[]} what is wrong with the pinned door form of a post (empty when it is exactly right). */
function doorProblems(form, slug) {
  const bad = [];
  if ((form.getAttribute("method") ?? "").toLowerCase() !== "get") bad.push('method is not "get"');
  if (form.getAttribute("action") !== "/go/try") bad.push('action is not "/go/try"');
  for (const a of ["target", "enctype"]) if (form.hasAttribute(a)) bad.push(`form has ${a}`);
  const controls = [...form.querySelectorAll("input, textarea, select, button, object, output, fieldset, datalist, keygen")];
  const inputs = controls.filter((c) => c.tagName === "INPUT");
  const buttons = controls.filter((c) => c.tagName === "BUTTON");
  const other = controls.filter((c) => c.tagName !== "INPUT" && c.tagName !== "BUTTON");
  if (other.length) bad.push(`form has a ${other[0].tagName.toLowerCase()}`);
  const names = inputs.map((i) => i.getAttribute("name"));
  const want = ["ticker", ...UTM_KEYS];
  if (inputs.length !== 4 || want.some((n) => names.filter((x) => x === n).length !== 1)) bad.push("inputs are not exactly ticker, utm_source, utm_medium, utm_campaign");
  const get = (n) => inputs.find((i) => i.getAttribute("name") === n);
  if (get("ticker") && get("ticker").getAttribute("type") !== "text") bad.push("ticker is not a text input");
  for (const k of UTM_KEYS) if (get(k) && get(k).getAttribute("type") !== "hidden") bad.push(`${k} is not hidden`);
  if (get("utm_source") && !UTM_SMALL.test(get("utm_source").getAttribute("value") ?? "")) bad.push("utm_source is not a short literal");
  if (get("utm_medium") && !UTM_SMALL.test(get("utm_medium").getAttribute("value") ?? "")) bad.push("utm_medium is not a short literal");
  if (get("utm_campaign") && get("utm_campaign").getAttribute("value") !== slug) bad.push("utm_campaign is not the page's own slug");
  if (buttons.length > 1) bad.push("more than one button");
  for (const b of buttons) {
    if (b.hasAttribute("name")) bad.push("the button has a name");
    if ((b.getAttribute("type") ?? "submit") !== "submit") bad.push("the button is not a plain submit");
  }
  for (const el of [form, ...form.querySelectorAll("*")]) for (const a of FORM_ATTRS) if (el.hasAttribute(a)) bad.push(`${a} on a form control`);
  return bad;
}

function markupFailures(doc, rel, kind, slug, allowedScripts) {
  const out = [];
  const add = (msg) => out.push(`[BLOG-MARKUP] ${rel}: ${msg}`);
  for (const s of doc.querySelectorAll("script")) {
    const src = s.getAttribute("src");
    if (src === null) {
      if ((s.getAttribute("type") ?? "").toLowerCase() !== "application/ld+json") add("inline script");
      else {
        try {
          JSON.parse(s.textContent);
        } catch {
          add("JSON-LD block is not valid JSON");
        }
      }
    } else if (!allowedScripts.includes(src)) add(`script src "${src}" is not on the fixed list`);
  }
  for (const el of doc.querySelectorAll("*")) {
    const handler = el.getAttributeNames().find((n) => n.startsWith("on"));
    if (handler) add(`inline handler ${handler}`);
  }
  for (const tag of ["iframe", "object", "embed", "base"]) if (doc.querySelector(tag)) add(`<${tag}> is not allowed`);
  if ([...doc.querySelectorAll("meta[http-equiv]")].some((m) => m.getAttribute("http-equiv").toLowerCase() === "refresh")) add("meta refresh");
  for (const el of doc.querySelectorAll("img[src], source[src]")) {
    if (!isRootRelative(el.getAttribute("src"))) add(`image src "${el.getAttribute("src")}" is not root-relative`);
  }
  for (const el of doc.querySelectorAll("img[srcset], source[srcset]")) {
    for (const cand of el.getAttribute("srcset").split(",")) {
      const url = cand.trim().split(/\s+/)[0];
      if (url && !isRootRelative(url)) add(`srcset url "${url}" is not root-relative`);
    }
  }
  for (const el of doc.querySelectorAll("a[href], link[href]")) {
    const href = el.getAttribute("href");
    if (!isSafeHref(href) || (el.tagName === "LINK" && !isSiteLink(href))) {
      add(`href "${href}" is not ${el.tagName === "LINK" ? "root-relative or on this site" : "https, root-relative or a fragment"}`);
      continue;
    }
    if (el.tagName === "A" && href.startsWith("https://")) {
      const rel2 = (el.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
      if (!rel2.includes("noopener") || !rel2.includes("noreferrer")) add(`external link "${href}" lacks rel="noopener noreferrer"`);
    }
    if (!goTryQueryOk(href)) add(`/go/try link "${href}" carries more than the pinned keys`);
  }
  return out;
}

/** Door literals on a post page, or null when it has no door. */
function doorOf(doc) {
  const form = doc.querySelector("form");
  if (!form) return null;
  const v = (n) => form.querySelector(`input[name="${n}"]`)?.getAttribute("value") ?? null;
  return { source: v("utm_source"), medium: v("utm_medium") };
}

/**
 * Source and medium are one literal across every post (consult 1089).
 * @param {{rel:string, html:string}[]} pages
 * @param {string[]} postSlugs
 */
export function crossPageFailures(pages, postSlugs) {
  const doors = pages
    .filter((p) => pageKind(p.rel, postSlugs) === "post")
    .map((p) => ({ rel: p.rel, door: doorOf(parse(p.html)) }))
    .filter((d) => d.door);
  if (doors.length < 2) return [];
  const first = doors[0].door;
  return doors
    .slice(1)
    .filter((d) => d.door.source !== first.source || d.door.medium !== first.medium)
    .map((d) => `[BLOG-DOOR] ${d.rel}: utm_source/utm_medium differ from ${doors[0].rel} — they must be one literal on every post`);
}

// ---------------------------------------------------------------------------------------------
// One page
// ---------------------------------------------------------------------------------------------

/**
 * Every rule that applies to one built page.
 * @param {{rel:string, html:string, disclaimer:string, postSlugs?:string[], listStrings?:string[], allowedScripts?:readonly string[]}} p
 * @returns {string[]} failures, empty when the page passes
 */
export function scanPage({ rel, html, disclaimer, postSlugs = [], listStrings = [], allowedScripts = BLOG_SCRIPTS }) {
  const failures = [];
  const kind = pageKind(rel, postSlugs);
  const isBlog = kind !== "other";
  const doc = isBlog ? parse(html) : null;
  const text = isBlog ? blogText(doc) : textOf(html).toLowerCase();
  const disc = isBlog ? normalizeBlog(disclaimer) : disclaimer.toLowerCase();

  if (IN_APP_PAGES.includes(rel)) {
    for (const href of disallowedInAppHrefs(html)) {
      failures.push(`[IN-APP] ${rel}: links to "${href}" — only its own anchors, mailto: and /in-app/* pages`);
    }
    if (!/<meta name="robots" content="noindex"/.test(html)) {
      failures.push(`[IN-APP] ${rel}: missing <meta name="robots" content="noindex">`);
    }
  }

  // AC4 — disclaimer verbatim on every page.
  const visible = isBlog ? blogText(doc, true) : text;
  if (!visible.includes(disc)) failures.push(`[AC4] ${rel}: shared disclaimer missing or altered`);

  let scrubbed = text.replaceAll(disc, " ");

  if (kind === "post" || kind === "list") {
    for (const p of PHRASE_FLOOR) {
      for (const m of scrubbed.matchAll(new RegExp(`\\b${p}\\b`, "g"))) {
        const ctx = scrubbed.slice(Math.max(0, m.index - 35), m.index + p.length + 35).trim();
        failures.push(`[BLOG-PHRASE] ${rel}: "${p}" — …${ctx}…`);
      }
    }
  }

  // AC3 — banned terms. A post body is exempt (the floor above stands in); the index and topic pages
  // keep it after their exact post titles and descriptions are subtracted; everything else keeps it.
  if (kind !== "post") {
    for (const phrase of ALLOWED) scrubbed = scrubbed.replaceAll(isBlog ? normalizeBlog(phrase) : normalize(phrase).toLowerCase(), " ");
    if (kind === "list") for (const s of listStrings) {
        const n = normalizeBlog(s);
        if (n.length >= MIN_SUBTRACT) scrubbed = scrubbed.replaceAll(n, " ");
      }
    for (const re of BANNED) {
      for (const m of scrubbed.matchAll(re)) {
        const ctx = scrubbed.slice(Math.max(0, m.index - 35), m.index + m[0].length + 35).trim();
        failures.push(`[AC3] ${rel}: banned term "${m[0]}" — …${ctx}…`);
      }
    }
  }

  if (isBlog) {
    const slug = kind === "post" ? /^blog\/([^/]+)\//.exec(rel)[1] : null;
    failures.push(...markupFailures(doc, rel, kind, slug, allowedScripts));
    const forms = doc.querySelectorAll("form");
    if (kind !== "post" && forms.length) failures.push(`[BLOG-DOOR] ${rel}: a form on a page that is not a post`);
    if (kind === "post") {
      if (forms.length > 1) failures.push(`[BLOG-DOOR] ${rel}: more than one form`);
      else if (forms.length === 1) for (const p of doorProblems(forms[0], slug)) failures.push(`[BLOG-DOOR] ${rel}: ${p}`);
      if (doc.querySelector("[form]")) failures.push(`[BLOG-DOOR] ${rel}: a control attached to a form from outside it`);
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------------------------
// Content folder and addresses
// ---------------------------------------------------------------------------------------------

/**
 * Every file in the content folder must be `<slug>.md` with a valid, unreserved slug.
 * @param {string[]} fileNames names in `src/content/blog/`
 */
export function contentSlugFailures(fileNames) {
  const out = [];
  for (const name of fileNames) {
    const m = /^(.*)\.md$/.exec(name);
    if (!m || !isValidSlug(m[1])) out.push(`[BLOG-SLUG] src/content/blog/${name}: not a valid, unreserved <slug>.md`);
  }
  return out;
}

/** The `<loc>` addresses of a sitemap. */
export function sitemapLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

/** Blog addresses that were live and are no longer: a published address never changes (Decision 1). */
export function removedAddresses(previous, current) {
  const now = new Set(current);
  return previous.filter((u) => /^https?:\/\/[^/]+\/blog(?:\/|$)/.test(u) && !now.has(u));
}
