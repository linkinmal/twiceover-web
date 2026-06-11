// Site-wide values.
// MOR_NAME holds the APPROVED merchant-of-record name for the post-#31-approval flip.
// Per PM's 2026-06-11 MoR-naming decision the live site ships GENERIC wording (provider
// not committed — #31 runs Paddle + FastSpring in parallel), so this value is NOT
// rendered anywhere yet; on approval, swap it into the named form of the 3 MoR lines on
// /pricing + /refunds (a small copy edit per site-copy-twiceover.md).
export const MOR_NAME = "Paddle";
export const ENTITY = "Halit Okumuş"; // sole-proprietor legal name (GetTerms-filled)
export const EMAIL = "support@twiceover.io";
export const EFFECTIVE_DATE = "June 11, 2026"; // GetTerms-filled effective date
export const YEAR = "2026";
