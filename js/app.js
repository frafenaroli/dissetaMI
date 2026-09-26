/* DissetaMi: mappa di vedovelle e case dell'acqua di Milano. Nessuna build, solo Leaflet. */
(function () {
  'use strict';

  const MILANO = [45.4642, 9.19];
  const BBOX_MILANO = '9.03,45.56,9.30,45.35'; // viewbox Nominatim: ovest,nord,est,sud
  const TIPI = {
    vedovelle: { nome: 'Vedovella', plurale: 'Vedovelle', colore: '#1f6f43' },
    case: { nome: "Casa dell'acqua", plurale: "Case dell'acqua", colore: '#1668c7' },
  };

  const $ = (id) => document.getElementById(id);
  const stato = { dati: null, livelli: {}, io: null, pinIo: null, pinCerca: null, selezionato: null, evidenza: null };

  /* ---------- Navigazione tra Mappa e Scopri ---------- */
  function mostraVista() {
    const scheda = location.hash === '#scopri' ? 'scopri' : 'mappa';
    $('vista-mappa').hidden = scheda !== 'mappa';
    $('vista-scopri').hidden = scheda !== 'scopri';
    document.querySelectorAll('.tabs a').forEach((a) => {
      if (a.dataset.tab === scheda) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (scheda === 'mappa' && mappa) setTimeout(() => mappa.invalidateSize(), 0);
  }
  window.addEventListener('hashchange', mostraVista);

  /* ---------- Mappa ---------- */
  const mappa = L.map('map', {
    center: MILANO, zoom: 13, minZoom: 11, maxZoom: 19, zoomControl: false,
    preferCanvas: true, renderer: L.canvas({ tolerance: 8 }),
    maxBounds: [[45.25, 8.9], [45.65, 9.45]],
  });
  L.control.zoom({ position: 'bottomleft' }).addTo(mappa);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Dati © Comune di Milano',
  }).addTo(mappa);
  mostraVista();

  function stile(tipo) {
    return { radius: 7, color: '#fff', weight: 2, fillColor: TIPI[tipo].colore, fillOpacity: 1 };
  }

  /* ---------- Utilità ---------- */
  function distanza(a, b) { // metri, formula dell'emisenoverso
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function formatDistanza(m) {
    if (m < 1000) return `${Math.round(m / 10) * 10} m`;
    return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  }
  function minutiAPiedi(m) { return Math.max(1, Math.round(m / 80)); } // ~4,8 km/h
  function tipiAttivi() { return Object.keys(TIPI).filter((t) => $('f-' + t).checked); }

  let timerAvviso;
  function avviso(testo, ms = 4000) {
    const el = $('avviso');
    el.textContent = testo;
    el.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(() => { el.hidden = true; }, ms);
  }

  /* ---------- Scheda del punto ---------- */
  function apriScheda(punto, tipo, origine) {
    stato.selezionato = { punto, tipo };
    const t = TIPI[tipo];
    const tipoEl = $('scheda-tipo');
    tipoEl.textContent = t.nome;
    tipoEl.className = 'scheda-tipo ' + tipo;
    $('scheda-titolo').textContent = punto.nil || 'Milano';

    const parti = [];
    if (punto.mun) parti.push('Municipio ' + punto.mun);
    if (punto.cap) parti.push(punto.cap + ' Milano');
    const da = origine || stato.io;
    if (da) {
      const d = distanza(da, punto);
      parti.push(`${formatDistanza(d)} · circa ${minutiAPiedi(d)} min a piedi` + (origine ? " dall'indirizzo cercato" : ''));
    }
    $('scheda-info').textContent = parti.join(' · ');

    const dest = `${punto.lat},${punto.lng}`;
    $('scheda-indicazioni').href = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
    $('scheda-maps').href = `https://www.google.com/maps/search/?api=1&query=${dest}`;
    $('scheda').hidden = false;

    if (stato.evidenza) stato.evidenza.remove();
    stato.evidenza = L.circleMarker([punto.lat, punto.lng], {
      radius: 13, color: t.colore, weight: 3, fill: false, interactive: false,
    }).addTo(mappa);
  }
  function chiudiScheda() {
    $('scheda').hidden = true;
    stato.selezionato = null;
    if (stato.evidenza) { stato.evidenza.remove(); stato.evidenza = null; }
  }
  $('scheda-chiudi').addEventListener('click', chiudiScheda);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiScheda(); });

  /* ---------- Dati ---------- */
  function caricaDati() {
    return fetch('data/punti.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((dati) => {
        stato.dati = dati;
        Object.keys(TIPI).forEach((tipo) => {
          const punti = dati[tipo] || [];
          const livello = L.layerGroup(punti.map((p) =>
            L.circleMarker([p.lat, p.lng], stile(tipo))
              .on('click', () => apriScheda(p, tipo))
          ));
          stato.livelli[tipo] = livello;
          if ($('f-' + tipo).checked) livello.addTo(mappa);
          $('n-' + tipo).textContent = punti.length ? punti.length : '';
        });
        if (dati.aggiornato) {
          const d = new Date(dati.aggiornato + 'T12:00:00');
          $('info-aggiornamento').textContent = 'Ultimo aggiornamento: ' +
            d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) + '.';
        }
        const totale = Object.keys(TIPI).reduce((n, t) => n + (dati[t] || []).length, 0);
        if (!totale) avviso('I dati non sono ancora disponibili.', 6000);
      })
      .catch(() => avviso('Impossibile caricare i dati. Riprova più tardi.', 6000));
  }

  Object.keys(TIPI).forEach((tipo) => {
    $('f-' + tipo).addEventListener('change', (e) => {
      const livello = stato.livelli[tipo];
      if (!livello) return;
      if (e.target.checked) livello.addTo(mappa);
      else {
        livello.remove();
        if (stato.selezionato && stato.selezionato.tipo === tipo) chiudiScheda();
      }
    });
  });

  function piuVicino(da) {
    let migliore = null;
    tipiAttivi().forEach((tipo) => {
      (stato.dati[tipo] || []).forEach((p) => {
        const d = distanza(da, p);
        if (!migliore || d < migliore.d) migliore = { p, tipo, d };
      });
    });
    return migliore;
  }

  function mostraPiuVicino(da, origine) {
    if (!stato.dati) return;
    if (!tipiAttivi().length) { avviso('Seleziona almeno una categoria.'); return; }
    const v = piuVicino(da);
    if (!v) { avviso('Nessun punto disponibile.'); return; }
    // Spazio per la barra di ricerca in alto e per la scheda in basso.
    mappa.fitBounds(L.latLngBounds([da, v.p]), { maxZoom: 17, paddingTopLeft: [40, 140], paddingBottomRight: [40, 260] });
    apriScheda(v.p, v.tipo, origine);
  }

  /* ---------- Geolocalizzazione ---------- */
  function localizza() {
    return new Promise((ok, ko) => {
      if (!('geolocation' in navigator)) { ko(new Error('non supportata')); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          stato.io = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!stato.pinIo) {
            stato.pinIo = L.marker([stato.io.lat, stato.io.lng], {
              icon: L.divIcon({ className: '', html: '<div class="pin-io"></div>', iconSize: [18, 18] }),
              keyboard: false, interactive: false,
            }).addTo(mappa);
          } else stato.pinIo.setLatLng([stato.io.lat, stato.io.lng]);
          $('btn-posizione').classList.add('attivo');
          ok(stato.io);
        },
        (err) => ko(err),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
  }
  function erroreGeo(err) {
    const msg = err && err.code === 1
      ? 'Posizione non consentita: cerca un indirizzo per trovare il punto più vicino.'
      : 'Posizione non disponibile: cerca un indirizzo per trovare il punto più vicino.';
    avviso(msg, 6000);
    $('cerca-input').focus();
  }

  $('btn-posizione').addEventListener('click', () => {
    localizza().then((io) => mappa.setView([io.lat, io.lng], 16)).catch(erroreGeo);
  });
  $('btn-vicina').addEventListener('click', () => {
    localizza().then((io) => mostraPiuVicino(io)).catch(erroreGeo);
  });

  /* ---------- Ricerca ---------- */
  const input = $('cerca-input');
  const lista = $('suggerimenti');
  let risultati = [];
  let indice = -1;

  function normalizza(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function quartieri(q) {
    if (!stato.dati || q.length < 2) return [];
    const nq = normalizza(q);
    const mappaNil = new Map();
    Object.keys(TIPI).forEach((tipo) => (stato.dati[tipo] || []).forEach((p) => {
      if (!p.nil) return;
      if (!mappaNil.has(p.nil)) mappaNil.set(p.nil, []);
      mappaNil.get(p.nil).push(p);
    }));
    return [...mappaNil.entries()]
      .filter(([nome]) => normalizza(nome).includes(nq))
      .slice(0, 5)
      .map(([nome, punti]) => ({ tipo: 'quartiere', nome, punti }));
  }

  function disegnaLista(voci, messaggio) {
    risultati = voci;
    indice = -1;
    lista.innerHTML = '';
    let sezione = null;
    voci.forEach((v, i) => {
      const s = v.tipo === 'quartiere' ? 'Quartieri' : 'Indirizzi';
      if (s !== sezione) {
        sezione = s;
        const t = document.createElement('li');
        t.className = 'titolo';
        t.textContent = s;
        lista.appendChild(t);
      }
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.i = i;
      const nome = document.createElement('span');
      nome.textContent = v.nome;
      li.appendChild(nome);
      if (v.punti) {
        const n = document.createElement('small');
        n.textContent = v.punti.length === 1 ? '1 punto' : `${v.punti.length} punti`;
        li.appendChild(n);
      }
      li.addEventListener('mousedown', (e) => { e.preventDefault(); scegli(i); });
      lista.appendChild(li);
    });
    if (messaggio) {
      const li = document.createElement('li');
      li.className = 'titolo';
      li.textContent = messaggio;
      lista.appendChild(li);
    }
    lista.hidden = !voci.length && !messaggio;
  }

  function scegli(i) {
    const v = risultati[i];
    if (!v) return;
    lista.hidden = true;
    input.value = v.nome;
    input.blur();
    if (v.tipo === 'quartiere') {
      chiudiScheda();
      mappa.fitBounds(L.latLngBounds(v.punti.map((p) => [p.lat, p.lng])).pad(0.25), { maxZoom: 17 });
      return;
    }
    const pos = { lat: v.lat, lng: v.lng };
    if (!stato.pinCerca) {
      stato.pinCerca = L.marker([pos.lat, pos.lng], {
        icon: L.divIcon({ className: '', html: '<div class="pin-cerca"></div>', iconSize: [22, 22], iconAnchor: [11, 22] }),
        keyboard: false, interactive: false,
      }).addTo(mappa);
    } else stato.pinCerca.setLatLng([pos.lat, pos.lng]);
    mostraPiuVicino(pos, pos);
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    const voci = quartieri(q);
    disegnaLista(voci, q.length >= 3 ? 'Premi Invio per cercare l’indirizzo' : null);
  });
  input.addEventListener('keydown', (e) => {
    const opzioni = lista.querySelectorAll('[role="option"]');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!opzioni.length) return;
      e.preventDefault();
      indice = (indice + (e.key === 'ArrowDown' ? 1 : -1) + opzioni.length) % opzioni.length;
      opzioni.forEach((o, i) => o.setAttribute('aria-selected', i === indice));
    } else if (e.key === 'Escape') {
      lista.hidden = true;
    }
  });
  input.addEventListener('blur', () => setTimeout(() => { lista.hidden = true; }, 150));

  let controllore = null;
  $('cerca').addEventListener('submit', (e) => {
    e.preventDefault();
    if (indice >= 0) { scegli(indice); return; }
    const q = input.value.trim();
    if (q.length < 3) return;
    const locali = quartieri(q);
    if (controllore) controllore.abort();
    controllore = new AbortController();
    disegnaLista(locali, 'Cerco…');
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&bounded=1&accept-language=it' +
      '&viewbox=' + BBOX_MILANO + '&q=' + encodeURIComponent(q + ', Milano');
    fetch(url, { signal: controllore.signal })
      .then((r) => r.json())
      .then((res) => {
        const indirizzi = res.map((r) => ({
          tipo: 'indirizzo',
          nome: r.display_name.split(', ').slice(0, 3).join(', '),
          lat: parseFloat(r.lat), lng: parseFloat(r.lon),
        }));
        const voci = locali.concat(indirizzi);
        if (voci.length === 1) { disegnaLista(voci); scegli(0); return; }
        disegnaLista(voci, voci.length ? null : 'Nessun risultato a Milano');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') disegnaLista(locali, 'Ricerca indirizzi non disponibile offline');
      });
  });

  /* ---------- Avvio ---------- */
  caricaDati();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
