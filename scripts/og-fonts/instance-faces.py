#!/usr/bin/env python3
"""Static faces for the share-card renderer (stock-analyst-platform#3508, ADR 0905).

`gen-og-cards.mjs` rasterises through @resvg/resvg-js, which cannot use the fonts the SITE ships:

  * resvg 2.6.2 reads no woff2 at all — handed `public/fonts/*.woff2` it renders a blank page, with
    no error. (Measured 2026-09-04: every text case came back as an empty PNG.)
  * Those files are also VARIABLE faces whose default instance is ExtraLight — `Source Sans 3
    ExtraLight` and `Source Code Pro ExtraLight` are their literal family names — and resvg has no
    variable-axis support, so even decompressed they would render every weight at wght 200 and
    would not match a `font-family: "Source Sans 3"` lookup.

So each weight the cards actually use is instanced out to its own static TTF here, from the very
same woff2 the site serves — one source, no second download, no drift. Adding a woff2 decompressor
as a devDependency was the alternative and does not work: it fixes the container and leaves the
variable-axis problem exactly where it was.

Regenerate (only needed if the site's fonts change or a card starts using a new weight):

    python3 scripts/og-fonts/instance-faces.py

Requires `fonttools` and `brotli` (`pip install fonttools brotli`) — a one-off authoring tool, not a
build or CI dependency. The four outputs are committed, like the favicon PNGs.
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).resolve().parent
SRC = HERE.parent.parent / "public" / "fonts"

# (source woff2, family as site.css names it, weight, subfamily). Exactly the faces the three cards
# render — serif only ever at 600 (wordmark, headline, promise, horizon ticks), mono only at 400.
FACES = [
    ("source-serif-4-latin-wght-normal.woff2", "Source Serif 4", 600, "SemiBold"),
    ("source-sans-3-latin-wght-normal.woff2", "Source Sans 3", 400, "Regular"),
    ("source-sans-3-latin-wght-normal.woff2", "Source Sans 3", 600, "SemiBold"),
    ("source-code-pro-latin-wght-normal.woff2", "Source Code Pro", 400, "Regular"),
]


def set_name(font, name_id, value):
    for record in font["name"].names:
        if record.nameID == name_id:
            record.string = value.encode("utf-16-be" if record.platformID == 3 else "latin-1")


for woff2, family, weight, subfamily in FACES:
    variable = TTFont(SRC / woff2)
    variable.flavor = None  # woff2 -> raw TrueType
    static = instancer.instantiateVariableFont(variable, {"wght": weight}, inplace=False, updateFontNames=False)

    # resvg matches on family + usWeightClass, so both have to say what this face actually is.
    static["OS/2"].usWeightClass = weight
    set_name(static, 1, family)
    set_name(static, 2, subfamily)
    set_name(static, 4, f"{family} {subfamily}")
    set_name(static, 6, f"{family.replace(' ', '')}-{subfamily}")
    # Typographic family/subfamily would re-group these back under one variable family and defeat
    # the per-weight lookup.
    static["name"].names = [r for r in static["name"].names if r.nameID not in (16, 17)]

    out = HERE / f"{family.replace(' ', '-').lower()}-{weight}.ttf"
    static.save(out)
    print(f"{out.name}  {out.stat().st_size} bytes  ({family} {weight}, from {woff2})")
