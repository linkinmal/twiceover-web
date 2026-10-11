/**
 * Where the posts are. Production reads `src/content/blog`. `BLOG_CONTENT_DIR` points a build at another
 * folder of posts, which is how the fixture build (test-fixtures/blog) renders every template and runs every
 * gate without a real post in the tree. A deploy refuses it, like `BLOG_NOW` (scripts/deploy.sh).
 */
export const DEFAULT_CONTENT_DIR = "./src/content/blog";

/** @param {Record<string, string | undefined>} env */
export function blogContentDir(env) {
  const v = env.BLOG_CONTENT_DIR;
  return v === undefined || v === "" ? DEFAULT_CONTENT_DIR : v;
}
