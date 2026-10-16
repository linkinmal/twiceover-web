#!/usr/bin/env python3
"""Trim the blog's variable fonts to the axis ranges the design actually sets
(stock-analyst-platform#4233; ADR 1088 Decision 2; Architect ruling on #4233, 2026-10-10).

The faces come from the Fontsource packages in devDependencies (latin subset, OFL-1.1, one package per
family). Their axes are wider than the design needs, and a blog page must fetch only a few faces within a
size ceiling, so each file is cut to the ranges the design kit requests (`blog-kit-2026-10-10-v2.html`
line 2, the Google Fonts URL the kit was drawn with). Fonttools' instancer narrows an axis without
changing any glyph inside the kept range.

Regenerate only when the design's ranges change or a family is added:

    python3 scripts/blog-fonts/trim-blog-fonts.py

Needs `fonttools` and `brotli` (`pip install fonttools brotli`), like scripts/og-fonts/instance-faces.py:
a one-off authoring tool, not a build or CI dependency. The outputs in public/fonts/ are committed.
Static IBM Plex Mono (400, 500, 700) is not variable and is copied as it is.
"""

import shutil
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
NM = ROOT / "node_modules"
OUT = ROOT / "public" / "fonts"

# (package, source file, axis limits) — limits are the kit's request, pinned where the design pins them.
FACES = [
    ("@fontsource-variable/archivo", "archivo-latin-wdth-normal", {"wdth": (90, 100), "wght": (400, 900)}),
    ("@fontsource-variable/besley", "besley-latin-wght-normal", {"wght": (400, 900)}),
    ("@fontsource-variable/bricolage-grotesque", "bricolage-grotesque-latin-opsz-normal", {"opsz": (12, 96), "wght": (400, 800)}),
    ("@fontsource-variable/caveat", "caveat-latin-wght-normal", {"wght": (500, 700)}),
    ("@fontsource-variable/fraunces", "fraunces-latin-opsz-normal", {"opsz": (9, 144), "wght": (400, 900)}),
    ("@fontsource-variable/fraunces", "fraunces-latin-opsz-italic", {"opsz": (9, 144), "wght": (300, 700)}),
    ("@fontsource-variable/newsreader", "newsreader-latin-opsz-normal", {"opsz": (6, 72), "wght": (400, 600)}),
    ("@fontsource-variable/newsreader", "newsreader-latin-opsz-italic", {"opsz": (6, 72), "wght": (400, 600)}),
    ("@fontsource-variable/big-shoulders-display", "big-shoulders-display-latin-wght-normal", {"wght": (600, 900)}),
    ("@fontsource-variable/source-serif-4", "source-serif-4-latin-opsz-normal", {"opsz": (8, 60), "wght": (400, 700)}),
    ("@fontsource-variable/source-serif-4", "source-serif-4-latin-opsz-italic", {"opsz": (8, 60), "wght": (400, 700)}),
    ("@fontsource-variable/source-sans-3", "source-sans-3-latin-wght-italic", {"wght": (400, 700)}),
]
STATIC = [("@fontsource/ibm-plex-mono", f"ibm-plex-mono-latin-{w}-normal") for w in (400, 500, 700)]

for pkg, name, limits in FACES:
    font = TTFont(NM / pkg / "files" / f"{name}.woff2")
    present = {a.axisTag for a in font["fvar"].axes}
    missing = set(limits) - present
    if missing:
        raise SystemExit(f"{name}: no axis {sorted(missing)} (has {sorted(present)})")
    font = instancer.instantiateVariableFont(font, limits)
    font.flavor = "woff2"
    font.save(OUT / f"{name}.woff2")
    print(f"{name}: {(OUT / f'{name}.woff2').stat().st_size:>7} bytes  {limits}")

for pkg, name in STATIC:
    shutil.copyfile(NM / pkg / "files" / f"{name}.woff2", OUT / f"{name}.woff2")
    print(f"{name}: {(OUT / f'{name}.woff2').stat().st_size:>7} bytes  static")
