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
build or CI dependency. The outputs are committed, like the favicon PNGs. They are build inputs for
the card generators only: nothing under `scripts/og-fonts/` is under `public/`, so no reader is
ever sent one, and each family's SIL Open Font License text is the one in `public/fonts/licenses/`.
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).resolve().parent
SRC = HERE.parent.parent / "public" / "fonts"

# (source woff2, family, weight, subfamily, axes to pin, output file). The first four are exactly the
# faces the three site cards render — serif only ever at 600 (wordmark, headline, promise, horizon
# ticks), mono only at 400. The rest are the headline faces of the ten blog themes, for the per-post
# share image (ADR 1088 Amendment 2, blog-handoff.md section 10a): each at the weight and axes the
# theme's own `--fdw` / `--fdsz` ask for at card size (optical size 72 for the two faces that have
# one, which is what the browser picks for a ~74 px headline; Archivo at its 90 width, the kit's
# `font-stretch: 90%`). One file per face, so a family name is unique to its file.
FACES = [
    ("source-serif-4-latin-wght-normal.woff2", "Source Serif 4", 600, "SemiBold", {"wght": 600}, "source-serif-4-600.ttf"),
    ("source-sans-3-latin-wght-normal.woff2", "Source Sans 3", 400, "Regular", {"wght": 400}, "source-sans-3-400.ttf"),
    ("source-sans-3-latin-wght-normal.woff2", "Source Sans 3", 600, "SemiBold", {"wght": 600}, "source-sans-3-600.ttf"),
    ("source-code-pro-latin-wght-normal.woff2", "Source Code Pro", 400, "Regular", {"wght": 400}, "source-code-pro-400.ttf"),
    ("source-serif-4-latin-opsz-normal.woff2", "Source Serif 4 Display", 600, "SemiBold", {"wght": 600, "opsz": 60}, "source-serif-4-display-600.ttf"),
    ("big-shoulders-display-latin-wght-normal.woff2", "Big Shoulders Display", 800, "ExtraBold", {"wght": 800}, "big-shoulders-display-800.ttf"),
    ("bricolage-grotesque-latin-opsz-normal.woff2", "Bricolage Grotesque", 700, "Bold", {"wght": 700, "opsz": 72}, "bricolage-grotesque-700.ttf"),
    ("bricolage-grotesque-latin-opsz-normal.woff2", "Bricolage Grotesque", 800, "ExtraBold", {"wght": 800, "opsz": 72}, "bricolage-grotesque-800.ttf"),
    ("fraunces-latin-opsz-normal.woff2", "Fraunces", 700, "Bold", {"wght": 700, "opsz": 72}, "fraunces-700.ttf"),
    ("fraunces-latin-opsz-italic.woff2", "Fraunces Italic", 300, "Light Italic", {"wght": 300, "opsz": 72}, "fraunces-italic-300.ttf"),
    ("archivo-latin-wdth-normal.woff2", "Archivo", 800, "ExtraBold", {"wght": 800, "wdth": 90}, "archivo-800.ttf"),
    ("besley-latin-wght-normal.woff2", "Besley", 900, "Black", {"wght": 900}, "besley-900.ttf"),
    ("ibm-plex-mono-latin-700-normal.woff2", "IBM Plex Mono", 700, "Bold", {}, "ibm-plex-mono-700.ttf"),
]


def set_name(font, name_id, value):
    for record in font["name"].names:
        if record.nameID == name_id:
            record.string = value.encode("utf-16-be" if record.platformID == 3 else "latin-1")


for woff2, family, weight, subfamily, axes, out_name in FACES:
    variable = TTFont(SRC / woff2)
    variable.flavor = None  # woff2 -> raw TrueType
    if "fvar" in variable:
        static = instancer.instantiateVariableFont(variable, axes, inplace=False, updateFontNames=False)
    else:  # already static (IBM Plex Mono ships one file per weight): only the container changes
        static = variable

    # resvg matches on family + usWeightClass, so both have to say what this face actually is.
    static["OS/2"].usWeightClass = weight
    set_name(static, 1, family)
    set_name(static, 2, subfamily)
    set_name(static, 4, f"{family} {subfamily}")
    set_name(static, 6, f"{family.replace(' ', '')}-{subfamily}")
    # Typographic family/subfamily would re-group these back under one variable family and defeat
    # the per-weight lookup.
    static["name"].names = [r for r in static["name"].names if r.nameID not in (16, 17)]

    out = HERE / out_name
    static.save(out)
    print(f"{out.name}  {out.stat().st_size} bytes  ({family} {weight}, from {woff2})")
