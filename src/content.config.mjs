/**
 * Content collections. `blog` is one markdown file per post under `src/content/blog/`, the file name
 * being its address (ADR 1090 Decision 1). `.md` only — never `.mdx`, so a post cannot import code.
 * The front matter is the closed schema in `src/blog/schema.mjs`; a post that breaks it fails the
 * build, and so its own pull request.
 */
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { postSchema } from "./blog/schema.mjs";

export const collections = {
  blog: defineCollection({ loader: glob({ pattern: "*.md", base: "./src/content/blog" }), schema: postSchema }),
};
