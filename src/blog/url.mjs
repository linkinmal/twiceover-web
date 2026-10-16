/**
 * url — the one definition of "root-relative" the blog trusts.
 *
 * A backslash is out everywhere: browsers read "/\\host" as "//host", an off-site address that a
 * "starts with one slash" test lets through; a tab or newline, which browsers drop, is out too. The
 * content gate (`ci/content-rules.mjs`) and the page layout (`Base.astro`) both use this, so a share
 * image or a link cannot name another host by the same trick.
 */
const ROOT_RELATIVE_RE = /^\/(?![/\\])[^\s\\]*$/;

/** @param {unknown} v */
export const isRootRelative = (v) => typeof v === "string" && ROOT_RELATIVE_RE.test(v);

/**
 * A page's own share image: root-relative, or the build stops.
 * @param {string} v
 * @returns {string}
 */
export function assertShareImage(v) {
  if (!isRootRelative(v)) throw new Error(`share image must be a root-relative path, got ${JSON.stringify(v)}`);
  return v;
}
