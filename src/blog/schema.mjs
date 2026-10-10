/**
 * schema — the closed front-matter schema of a blog post (ADR 1090 Decisions 1 and 11).
 *
 * Closed: an unknown key fails, at the top and inside `image`. Every enumerated field is drawn from
 * `vocabulary.mjs`; every image path must sit in the one image directory and be a raster type, so the
 * post-only review lane (PR 5) can allow exact paths and nothing else. The post's address is its
 * file name (checked by `isValidSlug`), never a front-matter field.
 */
import { z } from "astro/zod";
import { parsePublishTime } from "./publish.mjs";
import { BUILDS, LENSES, TOPICS } from "./vocabulary.mjs";

const noMarkup = (s) => !/[<>]/.test(s);
// YAML turns an unquoted timestamp into a Date, and one with no offset into a UTC instant — a silent
// hour-shift for a post meant for 07:00 New York. So the value must be a quoted string, and a Date fails.
const QUOTED = { invalid_type_error: 'write the time in quotes, such as "2026-10-12T07:00:00-04:00"' };
const time = z.string(QUOTED).refine((s) => parsePublishTime(s) !== null, "an ISO time with an offset, such as 2026-10-12T07:00:00-04:00");

const image = z
  .object({
    src: z.string().regex(/^\/blog-images\/[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp|avif)$/, "a flat PNG, JPEG, WebP or AVIF file in /blog-images/"),
    alt: z.string().min(1).max(300).refine(noMarkup, "no markup"),
    source: z.string().min(1).max(200).refine(noMarkup, "no markup"),
    licence: z.string().min(1).max(200).refine(noMarkup, "no markup"),
  })
  .strict();

export const postSchema = z
  .object({
    title: z.string().min(1).max(140).refine(noMarkup, "no markup"),
    description: z.string().min(20).max(300).refine(noMarkup, "no markup"),
    publishAt: time,
    updatedAt: time.optional(),
    topic: z.enum(TOPICS),
    lens: z.enum(LENSES),
    build: z.enum(BUILDS),
    image: image.optional(),
  })
  .strict();
