/**
 * jsonld — the one structured-data block a post page carries (ADR 1090 Amendment 1; Growth's blog-seo.md
 * section 3, Engineer item 1). The block is emitted by the template from the post's schema fields, never
 * written in a post, and its shape is closed: only the keys below.
 */
import { ORGANIZATION } from "./org.mjs";
import { toNewYorkIso } from "./format.mjs";

const SITE = "https://twiceover.io";

/**
 * @param {{title:string, description:string, publishAt:string, updatedAt?:string}} data
 * @param {{slug:string, imagePath?:string}} ctx imagePath is the root-relative share image, when there is one
 */
export function blogPostingJsonLd(data, { slug, imagePath }) {
  const url = `${SITE}/blog/${slug}`;
  const obj = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: data.title,
    description: data.description,
    url,
    mainEntityOfPage: url,
    datePublished: toNewYorkIso(data.publishAt),
    dateModified: toNewYorkIso(data.updatedAt ?? data.publishAt),
    author: ORGANIZATION,
    publisher: ORGANIZATION,
  };
  if (imagePath) obj.image = `${SITE}${imagePath}`;
  return obj;
}

/**
 * JSON for a `<script type="application/ld+json">` body. `<` becomes `<`, so a title that reads
 * `</script>` cannot close the element; the line and paragraph separators are escaped too. The result is
 * still valid JSON and parses back to the same object.
 */
export function serializeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
