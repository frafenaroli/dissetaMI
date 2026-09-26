#!/usr/bin/env python3
"""Scarica dagli open data del Comune di Milano vedovelle e case dell'acqua
e le salva in data/punti.json, il file letto dal sito.

Uso:
    python3 scripts/aggiorna_dati.py              # scarica e aggiorna
    python3 scripts/aggiorna_dati.py --dry-run    # mostra le differenze senza scrivere
    python3 scripts/aggiorna_dati.py --vedovelle a.csv --case b.csv   # usa CSV locali
    python3 scripts/aggiorna_dati.py --verifica   # controlla data/punti.json (usato dal deploy)

Solo libreria standard: nessuna dipendenza da installare.
"""

import argparse
import csv
import io
import json
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

CKAN = "https://dati.comune.milano.it/api/3/action/package_show?id="
DATASET = {
    "vedovelle": "ds502_fontanelle-nel-comune-di-milano",
    "case": "ds625-case-dell-acqua-nel-comune-di-milano",
}
OUT = Path(__file__).resolve().parent.parent / "data" / "punti.json"
# Riquadro largo attorno a Milano: scarta coordinate palesemente errate.
BBOX = (45.35, 45.56, 9.03, 9.30)  # lat min, lat max, lng min, lng max
UA = "DissetaMi/1.0 (+https://github.com/frafenaroli/dissetaMI)"


def scarica(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except urllib.error.URLError as e:
        sys.exit(f"Download non riuscito ({url}): {e.reason}\n"
                 "Se sei su Claude Code web, dati.comune.milano.it deve essere tra i domini consentiti.")


def url_csv(dataset_id):
    """Il nome del file cambia a ogni aggiornamento: lo ricava dalle API CKAN."""
    pkg = json.loads(scarica(CKAN + dataset_id))["result"]
    csvs = [r for r in pkg["resources"] if (r.get("format") or "").upper() == "CSV"]
    if not csvs:
        sys.exit(f"Nessuna risorsa CSV nel dataset {dataset_id}")
    csvs.sort(key=lambda r: r.get("last_modified") or r.get("created") or "", reverse=True)
    return csvs[0]["url"], pkg.get("metadata_modified", "")[:10]


def decodifica(raw):
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("latin-1")


def leggi(testo, tipo):
    punti, scartati = [], 0
    for riga in csv.DictReader(io.StringIO(testo), delimiter=";"):
        try:
            lat = float(riga["LAT_Y_4326"].replace(",", "."))
            lng = float(riga["LONG_X_4326"].replace(",", "."))
        except (KeyError, ValueError, AttributeError):
            scartati += 1
            continue
        if not (BBOX[0] <= lat <= BBOX[1] and BBOX[2] <= lng <= BBOX[3]):
            scartati += 1
            continue
        punti.append({
            "id": riga.get("objectID", "").strip(),
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "nil": (riga.get("NIL") or "").strip().title(),
            "mun": (riga.get("MUNICIPIO") or "").strip(),
            "cap": (riga.get("CAP") or "").strip(),
        })
    if not punti:
        sys.exit(f"Nessun punto valido per '{tipo}': il formato del CSV è cambiato?")
    punti.sort(key=lambda p: (p["lat"], p["lng"]))
    return punti, scartati


def differenze(vecchi, nuovi):
    a = {p["id"] for p in vecchi}
    b = {p["id"] for p in nuovi}
    return len(b - a), len(a - b)


def verifica():
    """Controlli minimi prima del deploy: file presente, entrambe le categorie non vuote, coordinate valide."""
    if not OUT.exists():
        sys.exit(f"✗ {OUT.name} mancante: esegui scripts/aggiorna_dati.py")
    dati = json.loads(OUT.read_text())
    errori = []
    for tipo in DATASET:
        punti = dati.get(tipo) or []
        if not punti:
            errori.append(f"nessun punto per '{tipo}'")
        for p in punti:
            if not (BBOX[0] <= p.get("lat", 0) <= BBOX[1] and BBOX[2] <= p.get("lng", 0) <= BBOX[3]):
                errori.append(f"{tipo} {p.get('id')}: coordinate fuori Milano")
        ids = [p.get("id") for p in punti]
        if len(ids) != len(set(ids)):
            errori.append(f"id duplicati in '{tipo}'")
    if not dati.get("aggiornato"):
        errori.append("campo 'aggiornato' mancante")
    if errori:
        sys.exit("✗ " + "\n✗ ".join(errori))
    conteggi = ", ".join(f"{len(dati[t])} {t}" for t in DATASET)
    print(f"✓ {OUT.name} valido: {conteggi}, aggiornato il {dati['aggiornato']}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="non scrive il file")
    ap.add_argument("--vedovelle", help="CSV locale delle vedovelle")
    ap.add_argument("--case", help="CSV locale delle case dell'acqua")
    ap.add_argument("--verifica", action="store_true", help="controlla soltanto data/punti.json")
    args = ap.parse_args()
    if args.verifica:
        verifica()
        return

    precedente = json.loads(OUT.read_text()) if OUT.exists() else {}
    dati = {"aggiornato": date.today().isoformat(), "fonti": {}}

    for tipo, dataset_id in DATASET.items():
        locale = getattr(args, tipo)
        if locale:
            testo, url, modificato = decodifica(Path(locale).read_bytes()), locale, ""
        else:
            url, modificato = url_csv(dataset_id)
            testo = decodifica(scarica(url))
        punti, scartati = leggi(testo, tipo)
        dati[tipo] = punti
        dati["fonti"][tipo] = {
            "dataset": f"https://dati.comune.milano.it/dataset/{dataset_id}",
            "aggiornato_dal_comune": modificato,
        }
        nuovi, rimossi = differenze(precedente.get(tipo, []), punti)
        print(f"{tipo}: {len(punti)} punti (+{nuovi} / -{rimossi}), {scartati} righe scartate")
        print(f"  fonte: {url}")

    if args.dry_run:
        print("Dry run: nessun file scritto.")
        return
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(dati, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Scritto {OUT.relative_to(OUT.parent.parent)}")


if __name__ == "__main__":
    main()
