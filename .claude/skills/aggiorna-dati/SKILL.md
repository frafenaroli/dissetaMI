---
name: aggiorna-dati
description: >-
  Aggiorna data/punti.json con vedovelle e case dell'acqua dagli open data del
  Comune di Milano e lo pubblica. Usala quando l'utente chiede di aggiornare o
  rinfrescare i dati, ad esempio "/aggiorna-dati", "aggiorna le vedovelle",
  "scarica i dati nuovi dal Comune".
---

# Aggiorna i dati di DissetaMi

Il sito legge `data/punti.json`. Lo script `scripts/aggiorna_dati.py` lo rigenera
dai due dataset del Comune di Milano (aggiornati dal Comune ogni settimana):

- Vedovelle: https://dati.comune.milano.it/dataset/ds502_fontanelle-nel-comune-di-milano
- Case dell'acqua: https://dati.comune.milano.it/dataset/ds625-case-dell-acqua-nel-comune-di-milano

Il nome del file CSV cambia a ogni aggiornamento del Comune: lo script lo ricava
dalle API CKAN (`package_show`), quindi non va toccato a mano.

## Procedura

1. **Anteprima**: `python3 scripts/aggiorna_dati.py --dry-run`. Stampa, per ogni
   categoria, il numero di punti, quanti sono nuovi (+) e quanti spariti (-)
   rispetto al file attuale, e le righe scartate.
   - Se il download fallisce con `403` o `Tunnel connection failed`, l'ambiente
     non può raggiungere `dati.comune.milano.it`: chiedi all'utente di aggiungere
     il dominio ai domini consentiti nelle impostazioni dell'ambiente e fermati.
   - Se lo script dice che il formato del CSV è cambiato, apri il CSV e adatta la
     funzione `leggi()` alle nuove colonne. Non inventare coordinate.
2. **Controllo di buon senso**: variazioni piccole sono normali. Se una categoria
   perde più del 20% dei punti, o le righe scartate sono molte, fermati e
   riferisci all'utente prima di pubblicare.
3. **Aggiorna**: `python3 scripts/aggiorna_dati.py`.
4. **Verifica**: `python3 scripts/aggiorna_dati.py --verifica` deve stampare `✓`.
   Lo stesso controllo gira nel deploy e lo blocca se fallisce.
5. **Se nulla è cambiato** (+0 / -0 in entrambe le categorie) non pubblicare:
   dillo all'utente e basta.
6. **Pubblica**: committa `data/punti.json` e fai push su `main`; il workflow
   Deploy ripubblica il sito.

   ```sh
   git add data/punti.json
   git commit -m "Aggiorna dati (<data>): <n> vedovelle, <n> case dell'acqua"
   git push origin HEAD:main
   ```

   Serve che la Claude GitHub App abbia accesso in scrittura al repository; se il
   push viene rifiutato con `403`, chiedi all'utente di autorizzarla.
7. **Conferma il deploy**: controlla che l'ultima esecuzione di `deploy.yml` su
   `main` finisca con `success` (strumenti GitHub MCP `actions_list` /
   `actions_get`). Poi riassumi all'utente: totali per categoria, aggiunti e rimossi.

## Formato di data/punti.json

```json
{
  "aggiornato": "AAAA-MM-GG",
  "fonti": { "vedovelle": { "dataset": "…", "aggiornato_dal_comune": "AAAA-MM-GG" }, "case": { … } },
  "vedovelle": [ { "id": "…", "lat": 45.46, "lng": 9.19, "nil": "Brera", "mun": "1", "cap": "20121" } ],
  "case": [ … ]
}
```

`nil` è il Nucleo di Identità Locale (quartiere), `mun` il Municipio. I dati del
Comune non contengono indirizzi, quindi il sito mostra quartiere, Municipio e CAP.

## Note

- Se modifichi file del sito (non i dati), incrementa `VERSION` in `sw.js` così i
  browser scaricano la nuova versione.
