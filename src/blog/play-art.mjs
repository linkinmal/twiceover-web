/**
 * The hub's picture cells (blog-handoff.md section 5.4; ai-team/design/assets/blog-hub-2026-10-11.html): one small
 * inline SVG per playable, drawn once at build time from the page's own opening state, in that page's theme. Static
 * strings, no script and no data from a reader or a post. A playable with no entry gets no picture, and its row
 * still reads and links as text.
 */
export const PLAY_ART = Object.freeze({
  coin:
    '<svg class="pa" viewBox="0 0 200 100" preserveAspectRatio="none" role="img" aria-label="Bars, one per bet size">' +
    '<rect x="8" y="58" width="26" height="42" fill="#4DB5FF"/><rect x="47" y="30" width="26" height="70" fill="#4DB5FF"/>' +
    '<rect x="86" y="8" width="26" height="92" fill="#FF3FD2"/><rect x="125" y="44" width="26" height="56" fill="#4DB5FF"/>' +
    '<rect x="164" y="82" width="26" height="18" fill="#4DB5FF"/></svg>',
  "overnight-call":
    '<svg class="pa" viewBox="0 0 200 100" preserveAspectRatio="none" role="img" aria-label="A grid of cases, some shaded">' +
    '<g fill="#CFCFC9"><rect x="0" y="0" width="36" height="22"/><rect x="41" y="0" width="36" height="22"/><rect x="0" y="26" width="36" height="22"/>' +
    '<rect x="164" y="78" width="36" height="22"/><rect x="123" y="78" width="36" height="22"/><rect x="164" y="52" width="36" height="22"/></g>' +
    '<g fill="#1F3BFF"><rect x="82" y="0" width="36" height="22" opacity=".35"/><rect x="123" y="0" width="36" height="22" opacity=".7"/>' +
    '<rect x="164" y="0" width="36" height="22"/><rect x="41" y="26" width="36" height="22" opacity=".2"/><rect x="82" y="26" width="36" height="22" opacity=".45"/>' +
    '<rect x="123" y="26" width="36" height="22" opacity=".7"/><rect x="164" y="26" width="36" height="22" opacity=".85"/>' +
    '<rect x="0" y="52" width="36" height="22" opacity=".12"/><rect x="41" y="52" width="36" height="22" opacity=".2"/>' +
    '<rect x="82" y="52" width="36" height="22" opacity=".35"/><rect x="123" y="52" width="36" height="22" opacity=".5"/>' +
    '<rect x="0" y="78" width="36" height="22" opacity=".08"/><rect x="41" y="78" width="36" height="22" opacity=".12"/>' +
    '<rect x="82" y="78" width="36" height="22" opacity=".2"/></g></svg>',
  "option-payoff-calculator":
    '<svg class="pa" viewBox="0 0 200 100" role="img" aria-label="A payoff line: flat, then rising">' +
    '<line x1="0" y1="60" x2="200" y2="60" stroke="#7FA3D1" stroke-width="1" stroke-dasharray="3 4"/>' +
    '<polyline points="0,82 104,82 196,10" fill="none" stroke="#FFB347" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="132" cy="60" r="5" fill="#0F3563" stroke="#F4F7FB" stroke-width="2"/></svg>',
  "implied-move-from-a-straddle":
    '<svg class="pa" viewBox="0 0 200 100" role="img" aria-label="A V-shaped payoff line inside a shaded band">' +
    '<rect x="48" y="0" width="104" height="100" fill="#FFB511" opacity=".45"/>' +
    '<line x1="0" y1="50" x2="200" y2="50" stroke="#1A1814" stroke-width="1" stroke-dasharray="3 4"/>' +
    '<polyline points="0,8 100,92 200,8" fill="none" stroke="#0078BF" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  "guess-the-gap":
    '<svg class="pa" viewBox="0 0 200 100" role="img" aria-label="A scale with a shaded priced band and a marker beyond it">' +
    '<line x1="8" y1="50" x2="192" y2="50" stroke="#17131F" stroke-width="2"/>' +
    '<rect x="8" y="36" width="52" height="28" fill="#4B1FD1" opacity=".3"/><line x1="60" y1="36" x2="60" y2="64" stroke="#4B1FD1" stroke-width="2" stroke-dasharray="4 3"/>' +
    '<rect x="128" y="22" width="4" height="56" fill="#17131F"/></svg>',
});
