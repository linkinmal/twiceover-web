/**
 * credit — the line a post prints under its picture. A picture we made carries the licence "Own chart" and prints
 * no line, because a credit to ourselves tells a reader nothing. Any other licence is a real credit and prints with
 * its source, as the post's front matter gives them (founder, 2026-11-17). The front matter fields stay required.
 * The share card (scripts/blog-share/card.mjs) imports this same constant for which pictures may travel on a card.
 */
export const OWN_LICENCE = "Own chart";

/** @param {{source: string, licence: string}} image @returns {{source: string, licence: string} | null} */
export function pictureCredit(image) {
  if (image.licence === OWN_LICENCE) return null;
  return { source: image.source, licence: image.licence };
}
