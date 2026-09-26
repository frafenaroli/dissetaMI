# DissetaMI

Una mappa interattiva di vedovelle e case dell'acqua di Milano.

- Trova il punto più vicino con la geolocalizzazione, oppure cercando un indirizzo o un quartiere.
- Apri le indicazioni a piedi in Google Maps.
- Leggi curiosità e FAQ sulle due categorie.
- Si installa come app (PWA) e i punti restano consultabili offline.
- In italiano e in inglese (testi in `js/i18n.js`).

Dati: open data del Comune di Milano ([vedovelle](https://dati.comune.milano.it/dataset/ds502_fontanelle-nel-comune-di-milano), [case dell'acqua](https://dati.comune.milano.it/dataset/ds625-case-dell-acqua-nel-comune-di-milano)), licenza CC BY. Mappa © OpenStreetMap, CARTO.

## Struttura

Sito statico senza build: `index.html`, `css/`, `js/app.js`, `js/i18n.js`, `sw.js`, `manifest.webmanifest`. Lo stile riprende quello di [MostraMI](https://github.com/frafenaroli/mostraMI). Usa [Leaflet](https://leafletjs.com) 1.9.4, incluso in `vendor/`.

## Aggiornare i dati

```sh
python3 scripts/aggiorna_dati.py --dry-run   # anteprima delle differenze
python3 scripts/aggiorna_dati.py             # scrive data/punti.json
python3 scripts/aggiorna_dati.py --verifica  # controllo usato anche dal deploy
```

In Claude Code c'è la skill `/aggiorna-dati` (`.claude/skills/aggiorna-dati/SKILL.md`) che esegue la procedura e pubblica.

## Provarlo in locale

```sh
python3 -m http.server 8000
```

e apri http://localhost:8000.

## Pubblicazione

Ogni push su `main` pubblica il sito su GitHub Pages tramite `.github/workflows/deploy.yml`. In **Settings → Pages** la sorgente deve essere **GitHub Actions**.
