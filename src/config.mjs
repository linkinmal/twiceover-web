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

// ADR 0119/0120 (consult 0129) — the machine-readable ToS version an account's signup
// attestation record (stock-analyst-platform#436) pins to. Deliberately NOT the same value
// as EFFECTIVE_DATE: that constant is shared across BOTH /terms and /privacy via
// Policy.astro, so a privacy-only edit would silently "bump" the ToS version and vice
// versa — the wrong coupling for a record that has to prove "ToS version X was accepted."
// Bump ONLY on a substantive terms.astro change (not a privacy-only edit, not a typo fix),
// and keep in sync with apps/account-api/wrangler.jsonc's TOS_VERSION var in the other repo
// (manual, human/PM-gated — ToS changes are rare and already gated by legal review).
export const TOS_VERSION = "2026-06-11";
