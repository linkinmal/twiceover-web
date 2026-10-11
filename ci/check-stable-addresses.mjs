/**
 * A published address never changes (ADR 1090 Decision 1). Before a deploy, every blog address the live
 * sitemap lists must still be in the sitemap this build produced: a post that was removed, renamed or
 * pushed back to a later date would otherwise break its link and its place in search.
 *
 * The live sitemap is read from its fixed address. It is data from the network, never an instruction: only
 * `<loc>` values under the site's own /blog/ path are used, and nothing else in it is read. If the live
 * sitemap cannot be read after a few tries, the check fails: a check that passes when it could not look
 * is the failure it exists to catch. "Could not look" includes a 200 that is not a sitemap, an index longer
 * than the cap (never truncated silently), and a sitemap that does not list the home page (the one address
 * known to be there). A live sitemap that is a real sitemap with no blog address in it (the blog is dark)
 * has nothing to protect and passes.
 *
 *   node ci/check-stable-addresses.mjs [distDir]
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const SITE = "https://twiceover.io";
export const LIVE_INDEX = `${SITE}/sitemap-index.xml`;
const BLOG = `${SITE}/blog/`;
const MAX_CHILD_SITEMAPS = 20;

/** @param {string} xml @returns {string[]} the `<loc>` values */
export function locs(xml) {
  return [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/** An address as a key: no trailing slash, so `/blog/x` and `/blog/x/` are the same address. */
const key = (u) => u.replace(/\/+$/, "");

/** @returns {string[]} the blog addresses among `urls`, as keys, sorted and unique */
export function blogAddresses(urls) {
  return [...new Set(urls.filter((u) => u.startsWith(BLOG)).map(key))].sort();
}

/** @returns {string[]} the live blog addresses that the built sitemap no longer lists */
export function missingAddresses(liveUrls, builtUrls) {
  const built = new Set(blogAddresses(builtUrls));
  return blogAddresses(liveUrls).filter((u) => !built.has(u));
}

/** Read every sitemap an index points to (the index itself when it is a plain sitemap). */
async function readAll(indexUrl, read) {
  const top = await read(indexUrl);
  if (!/<sitemapindex[\s>]/.test(top)) return locs(top);
  const children = locs(top).filter((u) => u.startsWith(`${SITE}/`));
  if (children.length > MAX_CHILD_SITEMAPS) throw new Error(`${indexUrl} lists ${children.length} sitemaps; the check reads at most ${MAX_CHILD_SITEMAPS}`);
  const urls = [];
  for (const c of children) urls.push(...locs(await read(c)));
  return urls;
}

/** The live sitemap's URLs, with `tries` attempts at each read. `fetchText(url)` must reject on a non-200. */
export async function liveUrls(fetchText, { tries = 3, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const read = async (u) => {
    let last;
    for (let i = 0; i < tries; i++) {
      try {
        const body = await fetchText(u);
        if (!/<(urlset|sitemapindex)[\s>]/.test(body)) throw new Error(`${u} answered, but not with a sitemap`);
        return body;
      } catch (e) {
        last = e;
        if (i < tries - 1) await wait(1000 * (i + 1));
      }
    }
    throw new Error(`could not read ${u} after ${tries} tries: ${last?.message ?? last}`);
  };
  const urls = await readAll(LIVE_INDEX, read);
  // The one address known to be there. A sitemap without it was not read whole, whatever it contains.
  if (!urls.some((u) => key(u) === SITE)) throw new Error("the live sitemap does not list the home page, so it was not read whole");
  return urls;
}

/** The built sitemap's URLs, from the files in `dist`. */
export function builtUrls(dist, readFile = (p) => readFileSync(p, "utf8"), exists = existsSync) {
  const index = join(dist, "sitemap-index.xml");
  if (!exists(index)) throw new Error(`${index} does not exist; build first`);
  const top = readFile(index);
  const urls = [];
  for (const c of locs(top).filter((u) => u.startsWith(`${SITE}/`))) {
    const f = join(dist, c.slice(SITE.length + 1));
    if (!exists(f)) throw new Error(`the built index lists ${c}, but ${f} does not exist`);
    urls.push(...locs(readFile(f)));
  }
  return urls;
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

export async function run(dist, { fetchText: fetcher = fetchText, wait } = {}) {
  const built = builtUrls(dist);
  const live = await liveUrls(fetcher, wait ? { wait } : undefined);
  const gone = missingAddresses(live, built);
  if (gone.length) {
    console.error(`Stable-address check FAILED: ${gone.length} published blog address(es) are not in this build:`);
    for (const g of gone) console.error(`  ${g}`);
    console.error("A published address never changes (ADR 1090 Decision 1). Restore the post, its slug and its publishAt.");
    return 1;
  }
  console.log(`Stable-address check passed: ${blogAddresses(live).length} live blog address(es), all still in the build.`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv[2] ?? "dist").then((c) => process.exit(c), (e) => {
    console.error(`Stable-address check FAILED: ${e.message}`);
    process.exit(1);
  });
}
