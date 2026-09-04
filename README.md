# twiceover-web

Pre-launch **compliance site** for TwiceOver at [twiceover.io](https://twiceover.io) — the
prerequisite the Merchant-of-Record onboarding (Paddle + FastSpring) gates on. **Astro**
static site on **Cloudflare Workers Static Assets**, per ADR 0002; design per #48
(design-in-code, ADR 0004); copy per #41.

This is **not** the product application — static content only: no auth, no broker
connection, no checkout, no API calls, no analytics, no PII capture, no secrets.

## Routes

`/` · `/pricing` · `/terms` · `/privacy` · `/cookies` · `/refunds` · `404` — each content
page at its own clean path (#39 AC1/AC6).

## Layout

```
tokens/twiceover.tokens.json   DTCG tokens — BYTE-IDENTICAL copy of the canonical file in
                               stock-analyst-platform /ai-team/design/tokens/ (v0.1.0).
                               Never edited here; intake check is a literal byte-diff.
scripts/build-tokens.mjs       prebuild: tokens.json -> src/styles/tokens.css (generated,
                               gitignored) — semantic-only custom props + typography classes.
src/content/disclaimer.txt     THE shared disclaimer (AC4) — single source, rendered by
                               src/components/Disclaimer.astro on every page. Do not reword.
src/config.mjs                 [MoR]=Paddle (placeholder pending #31), entity, email, date.
src/layouts/                   Base (global chrome) · Policy (the four policy instances)
src/pages/                     index · pricing · terms · privacy · cookies · refunds · 404
ci/check-content.mjs           AC3/AC4 gate over built HTML (banned terms + disclaimer)
scripts/gen-favicons.mjs       PNG favicons (32/180/192) from public/favicon.svg (the mark)
```

Copy is verbatim from `ai-team/pm/site-copy-twiceover.md` + the woven GetTerms
boilerplate — **do not reword**; flag issues to PM on #39. Legal pages pend human review
before the MoR submission (#31).

## Build & check

```sh
npm install
npm run build    # prebuild derives tokens.css, then astro build -> dist/
npm run check    # AC3/AC4 content gate over dist/ (also runs in CI)
```

## Rotating the share card

The image every share of a link renders — X, Slack, iMessage, the preview in an AI answer — is one
of **three** cards, not one (ADR 0905). All three ship; `og:image` names the live one.

| Member | Shows | File |
|---|---|---|
| A · the projection path | the Outlook path across three horizons | `public/og-card-path.png` |
| B · the price line | 90 sessions, the 52-week range and the 50-DMA | `public/og-card-levels.png` |
| C · the spread | the held spread's payoff and its breakeven | `public/og-card-spread.png` |

**To rotate, change one line** in `src/layouts/Base.astro` and deploy:

```js
const OG_CARD = "/og-card-levels.png";   // was "/og-card-path.png"
```

That is the whole change — no asset rebuild, no cache to clear. It works *because* each member has
its own permanent URL: consumers cache on the URL, so overwriting one file changes nothing anyone
sees (Meta: *"Use a new URL for the new image or the image won't be updated"*). For the same reason,
**never overwrite or delete a card** — links already shared keep pointing at the one that was live
when they were posted, and that is the intended behaviour. Note that past shares never re-render;
rotating changes what *future* shares look like.

To regenerate the artwork after a chart, fixture or token change:

```sh
npm run gen:og-cards
```

Each card is drawn by the site's own chart modules against `src/charts/site-fixture.mjs`, so a
member cannot drift from what the product draws. `scripts/gen-og-cards.test.mjs` holds the other end
of that: it rebuilds each card and compares it to the committed `scripts/og-cards/*.svg`, so a chart
change that has not been regenerated fails CI. **Look at the three cards before committing them** —
their type is scaled to sit right on a 6px-as-rendered legibility floor at phone size (consult
0752), which no test can see for you.

## Deploy

Token lives in macOS Keychain — pulled at deploy time, never in the repo:

```sh
export CLOUDFLARE_API_TOKEN=$(security find-generic-password -s cloudflare-api-token-twiceover -w)
npm run build && npm run deploy
```
