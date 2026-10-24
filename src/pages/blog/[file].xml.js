// /blog/feed.xml: one RSS 2.0 feed of the published posts, newest first, built with @astrojs/rss (ADR 1090
// Decision 7). Each item is the post's headline, its one description, its address and its publish time.
// No published post, no feed: the route is not generated, so the <link rel="alternate"> every blog page
// carries never points at an empty file.
import rss from "@astrojs/rss";
import { getPublished } from "../../blog/collection.mjs";
import { INDEX_BLURB } from "../../blog/labels.mjs";
import { parsePublishTime } from "../../blog/publish.mjs";

export async function getStaticPaths() {
  const posts = await getPublished();
  return posts.length ? [{ params: { file: "feed" } }] : [];
}

export async function GET(context) {
  const posts = await getPublished();
  return rss({
    title: "TwiceOver Blog",
    description: INDEX_BLURB,
    site: context.site,
    trailingSlash: false,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      link: `/blog/${p.id}`,
      pubDate: new Date(parsePublishTime(p.data.publishAt)),
    })),
    customData: "<language>en-us</language>",
  });
}
