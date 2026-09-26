#!/usr/bin/env python3
"""Genera vendor/lucide/sprite.svg con le sole icone Lucide usate dal sito.

Uso:
    npm pack lucide-static && tar xzf lucide-static-*.tgz
    python3 scripts/crea_sprite_lucide.py package/icons

Nel sito un'icona si usa così: <svg class="ico"><use href="vendor/lucide/sprite.svg#search"/></svg>
Per aggiungerne una, aggiungi il nome (da https://lucide.dev/icons) a ICONE e rigenera.
"""

import re
import sys
from pathlib import Path

ICONE = [
    "search", "x", "map-pin", "locate-fixed", "navigation", "clock", "droplet", "glass-water",
    "book-open", "circle-help", "maximize-2", "minimize-2", "languages", "arrow-up-right",
    "chevron-down", "plus", "minus", "sparkles", "info",
]
OUT = Path(__file__).resolve().parent.parent / "vendor" / "lucide" / "sprite.svg"


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    cartella = Path(sys.argv[1])
    versione = ""
    simboli = []
    for nome in ICONE:
        svg = (cartella / f"{nome}.svg").read_text()
        m = re.search(r"lucide-static v([\d.]+)", svg)
        versione = versione or (m.group(1) if m else "")
        corpo = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
        corpo = " ".join(riga.strip() for riga in corpo.strip().splitlines())
        simboli.append(f'  <symbol id="{nome}" viewBox="0 0 24 24">{corpo}</symbol>')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        f'<!-- Icone Lucide v{versione} (https://lucide.dev), licenza ISC. Generato da scripts/crea_sprite_lucide.py -->\n'
        '<svg xmlns="http://www.w3.org/2000/svg">\n' + "\n".join(simboli) + "\n</svg>\n"
    )
    print(f"Scritte {len(simboli)} icone in {OUT.relative_to(OUT.parent.parent.parent)}")


if __name__ == "__main__":
    main()
