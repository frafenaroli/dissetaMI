/* DissetaMI: mappa di vedovelle e case dell'acqua di Milano. Nessuna build, solo Leaflet. */
(function () {
  'use strict';

  const MILANO = [45.4642, 9.19];
  const BBOX_MILANO = '9.03,45.56,9.30,45.35'; // viewbox Nominatim: ovest,nord,est,sud
  const COLORI = { vedovelle: '#2f8f5b', case: '#3b6fd6' };
  const TIPI = Object.keys(COLORI);
  // Contenuti della finestra "Scopri di più e FAQ", per scheda.
  const SCOPRI = {
    vedovelle: { desc: 'ved.desc', curiosita: ['nome', 'dito', 'aperte', 'verde'], faq: ['v1', 'v2', 'v3', 'v4'] },
    case: { desc: 'case.desc', curiosita: ['stessa', 'plastica'], faq: ['c1', 'c2', 'c3', 'c4'] },
    acqua: { desc: 'intro', curiosita: ['falda'], faq: [] },
    sito: { desc: null, curiosita: [], faq: ['s1', 's2', 's3', 's4'] },
  };

  // Illustrazione al centro della scheda del punto, per categoria.
  const IMMAGINI = { vedovelle: 'img/vedovella.svg', case: 'img/casa-acqua.svg' };

  const $ = (id) => document.getElementById(id);
  const SPRITE = 'vendor/lucide/sprite.svg#';
  const stato = { dati: null, livelli: {}, io: null, pinIo: null, pinCerca: null, selezionato: null, evidenza: null, tabScopri: 'vedovelle' };

  function icona(nome, size) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'ico');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', SPRITE + nome);
    svg.appendChild(use);
    return svg;
  }

  /* ---------- Lingua ---------- */
  let lingua = (() => {
    try { const s = localStorage.getItem('dissetami-lingua'); if (s === 'it' || s === 'en') return s; } catch (e) { /* storage non disponibile */ }
    return (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en';
  })();

  function t(chiave, valori) {
    let s = (TESTI[lingua] && TESTI[lingua][chiave]) || TESTI.it[chiave] || chiave;
    if (valori) Object.keys(valori).forEach((k) => { s = s.replace('{' + k + '}', valori[k]); });
    return s;
  }

  function applicaLingua() {
    document.documentElement.lang = lingua;
    document.title = t('meta.title');
    document.querySelector('meta[name="description"]').setAttribute('content', t('meta.desc'));
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    $('lingua-sigla').textContent = lingua === 'it' ? 'EN' : 'IT';
    $('lingua-sigla').lang = lingua === 'it' ? 'en' : 'it';
    aggiornaSchermo();
    disegnaScopri();
    disegnaFooter();
    if (stato.selezionato) apriScheda(stato.selezionato.punto, stato.selezionato.tipo, stato.selezionato.origine);
    $('suggerimenti').hidden = true;
  }

  $('lingua').addEventListener('click', () => {
    lingua = lingua === 'it' ? 'en' : 'it';
    try { localStorage.setItem('dissetami-lingua', lingua); } catch (e) { /* storage non disponibile */ }
    applicaLingua();
  });

  function badge(tipo) {
    const b = document.createElement('span');
    b.className = 'badge badge-' + tipo;
    b.textContent = t('plurale.' + tipo);
    return b;
  }

  /* ---------- Finestra "Scopri di più e FAQ" ---------- */
  function disegnaScopri() {
    const tab = stato.tabScopri;
    const c = SCOPRI[tab];
    document.querySelectorAll('#scopri-tabs [role="tab"]').forEach((b) => {
      const attiva = b.dataset.tab === tab;
      b.setAttribute('aria-selected', attiva);
      b.tabIndex = attiva ? 0 : -1;
    });
    const corpo = $('scopri-corpo');
    corpo.className = 'popup-content scopri-corpo tab-' + tab;
    corpo.innerHTML = '';

    if (c.desc) {
      const desc = document.createElement('p');
      desc.className = 'scopri-desc';
      desc.textContent = t(c.desc);
      corpo.appendChild(desc);
    }
    const sezione = (ico, titolo, voci) => {
      if (!voci.length) return;
      const h = document.createElement('h3');
      h.className = 'scopri-sez';
      h.append(icona(ico, 14), t(titolo));
      corpo.appendChild(h);
      voci.forEach(([d, r]) => corpo.appendChild(tendina(d, r)));
    };
    sezione('sparkles', 'sez.curiosita', c.curiosita.map((k) => [t(`an.${k}.t`), t(`an.${k}.d`)]));
    sezione('circle-help', 'sez.faq', c.faq.map((id) => [t(`faq.${id}.q`), t(`faq.${id}.a`)]));
  }

  // Voce a tendina (curiosità e FAQ). Il testo è nostro e può contenere link.
  function tendina(domanda, risposta) {
    const d = document.createElement('details');
    const s = document.createElement('summary');
    s.append(document.createTextNode(domanda), icona('chevron-down', 18));
    const p = document.createElement('p');
    p.innerHTML = risposta;
    d.append(s, p);
    // Una voce aperta alla volta: aprendone una si chiudono le altre.
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      $('scopri-corpo').querySelectorAll('details[open]').forEach((altra) => { if (altra !== d) altra.open = false; });
    });
    return d;
  }

  function apriScopri(tab) {
    if (tab) stato.tabScopri = tab;
    disegnaScopri();
    $('scopri').hidden = false;
    $('scopri').querySelector('.popup').scrollTop = 0;
    $('scopri-chiudi').focus();
  }
  function chiudiScopri() { $('scopri').hidden = true; }

  $('footer-info').addEventListener('click', () => apriScopri('sito'));
  $('scheda-scopri').addEventListener('click', () => {
    const tipo = stato.selezionato && stato.selezionato.tipo;
    chiudiScheda();
    apriScopri(tipo);
  });
  $('scopri-chiudi').addEventListener('click', chiudiScopri);
  $('scopri').addEventListener('click', (e) => { if (e.target === $('scopri')) chiudiScopri(); });
  $('scopri-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[role="tab"]');
    if (b) { stato.tabScopri = b.dataset.tab; disegnaScopri(); }
  });
  $('scopri-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = Object.keys(SCOPRI);
    const i = (tabs.indexOf(stato.tabScopri) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    stato.tabScopri = tabs[i];
    disegnaScopri();
    $('scopri-tabs').querySelector(`[data-tab="${tabs[i]}"]`).focus();
  });

  function disegnaFooter() {
    const agg = stato.dati && stato.dati.aggiornato;
    if (!agg) { $('footer-dati').textContent = t('footer.datiSenzaData'); return; }
    const data = new Date(agg + 'T12:00:00').toLocaleDateString(lingua === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    $('footer-dati').textContent = t('footer.dati', { data });
  }

  /* ---------- Mappa ---------- */
  const mappa = L.map('map', {
    center: MILANO, zoom: 13, minZoom: 11, maxZoom: 19, zoomControl: false,
    preferCanvas: true, renderer: L.canvas({ tolerance: 8 }),
    maxBounds: [[45.25, 8.9], [45.65, 9.45]],
  });
  L.control.zoom({ position: 'bottomright' }).addTo(mappa);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mappa);

  /* ---------- Mappa a tutto schermo ----------
   * La classe CSS rende la mappa fissa su tutto il viewport (funziona anche su iPhone);
   * dove il browser lo consente si chiede anche il vero schermo intero, per nascondere le barre. */
  const card = $('mappa');
  const inSchermoIntero = () => card.classList.contains('schermo-intero');
  function aggiornaSchermo() {
    const on = inSchermoIntero();
    const btn = $('btn-schermo');
    btn.querySelector('use').setAttribute('href', SPRITE + (on ? 'minimize-2' : 'maximize-2'));
    btn.setAttribute('aria-label', t(on ? 'btn.esciSchermo' : 'btn.schermoIntero'));
    btn.title = btn.getAttribute('aria-label');
    btn.setAttribute('aria-pressed', on);
  }
  function impostaSchermo(on) {
    card.classList.toggle('schermo-intero', on);
    document.body.classList.toggle('bloccato', on);
    aggiornaSchermo();
    setTimeout(() => mappa.invalidateSize(), 50);
  }
  function entraSchermoIntero() {
    impostaSchermo(true);
    const root = document.documentElement;
    if (root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().catch(() => {});
  }
  function esciSchermoIntero() {
    impostaSchermo(false);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
  $('btn-schermo').addEventListener('click', () => (inSchermoIntero() ? esciSchermoIntero() : entraSchermoIntero()));
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && inSchermoIntero()) impostaSchermo(false);
  });

  // Punti più piccoli quando la mappa è lontana, per non coprire tutta la città.
  const raggio = () => (mappa.getZoom() < 14 ? 5 : 7);
  function stile(tipo) {
    return { radius: raggio(), color: '#fff', weight: raggio() < 7 ? 1.5 : 2, fillColor: COLORI[tipo], fillOpacity: 1 };
  }
  mappa.on('zoomend', () => {
    TIPI.forEach((tipo) => stato.livelli[tipo] && stato.livelli[tipo].eachLayer((l) => l.setStyle(stile(tipo))));
  });

  /* ---------- Utilità ---------- */
  function distanza(a, b) { // metri, formula dell'emisenoverso
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function formatDistanza(m) {
    if (m < 1000) return `${Math.round(m / 10) * 10} m`;
    const km = (m / 1000).toFixed(1);
    return `${lingua === 'it' ? km.replace('.', ',') : km} km`;
  }
  function minutiAPiedi(m) { return Math.max(1, Math.round(m / 80)); } // ~4,8 km/h
  function tipiAttivi() { return TIPI.filter((tp) => $('f-' + tp).checked); }

  let timerAvviso;
  function avviso(chiave, ms = 4500) {
    const el = $('avviso');
    el.textContent = t(chiave);
    el.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(() => { el.hidden = true; }, ms);
  }
  function vaiAllaMappa() {
    if (inSchermoIntero()) return;
    const r = $('mappa').getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) $('mappa').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- Scheda del punto ---------- */
  function apriScheda(punto, tipo, origine) {
    stato.selezionato = { punto, tipo, origine };
    const popup = document.querySelector('.popup');
    popup.className = 'popup ' + tipo;

    const tags = $('scheda-tags');
    tags.innerHTML = '';
    const b = badge(tipo);
    b.textContent = t('tipo.' + tipo);
    tags.appendChild(b);
    if (punto.mun) {
      const m = document.createElement('span');
      m.className = 'badge badge-neutro';
      m.textContent = t('scheda.municipio', { n: punto.mun });
      tags.appendChild(m);
    }
    $('scheda-titolo').textContent = punto.nil || 'Milano';
    $('scheda-luogo').querySelector('span').textContent = [punto.cap, 'Milano'].filter(Boolean).join(' ');

    const da = origine || stato.io;
    const rigaDist = $('scheda-distanza');
    if (da) {
      const d = distanza(da, punto);
      rigaDist.querySelector('span').textContent = t(origine ? 'scheda.daCercato' : 'scheda.distanza', { d: formatDistanza(d), m: minutiAPiedi(d) });
      rigaDist.hidden = false;
    } else rigaDist.hidden = true;

    const dest = `${punto.lat},${punto.lng}`;
    $('scheda-indicazioni').href = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
    const ill = $('scheda-illustrazione').querySelector('img');
    ill.src = IMMAGINI[tipo];
    $('scheda').hidden = false;

    if (stato.evidenza) stato.evidenza.remove();
    stato.evidenza = L.circleMarker([punto.lat, punto.lng], {
      radius: 13, color: COLORI[tipo], weight: 3, fill: false, interactive: false,
    }).addTo(mappa);
  }
  function chiudiScheda() {
    $('scheda').hidden = true;
    stato.selezionato = null;
    if (stato.evidenza) { stato.evidenza.remove(); stato.evidenza = null; }
  }
  $('scheda-chiudi').addEventListener('click', chiudiScheda);
  $('scheda').addEventListener('click', (e) => { if (e.target === $('scheda')) chiudiScheda(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('scheda').hidden) chiudiScheda();
    else if (!$('scopri').hidden) chiudiScopri();
    else if (inSchermoIntero()) esciSchermoIntero();
  });

  /* ---------- Dati ---------- */
  function caricaDati() {
    return fetch('data/punti.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((dati) => {
        stato.dati = dati;
        TIPI.forEach((tipo) => {
          const punti = dati[tipo] || [];
          const livello = L.layerGroup(punti.map((p) =>
            L.circleMarker([p.lat, p.lng], stile(tipo)).on('click', () => apriScheda(p, tipo))
          ));
          stato.livelli[tipo] = livello;
          if ($('f-' + tipo).checked) livello.addTo(mappa);
          $('n-' + tipo).textContent = punti.length || '';
        });
        disegnaFooter();
        if (!TIPI.some((tp) => (dati[tp] || []).length)) avviso('avviso.noDati', 6000);
      })
      .catch(() => avviso('avviso.errDati', 6000));
  }

  TIPI.forEach((tipo) => {
    $('f-' + tipo).addEventListener('change', (e) => {
      const livello = stato.livelli[tipo];
      if (!livello) return;
      if (e.target.checked) livello.addTo(mappa);
      else livello.remove();
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
    vaiAllaMappa();
    if (!tipiAttivi().length) { avviso('avviso.categoria'); return; }
    const v = piuVicino(da);
    if (!v) { avviso('avviso.nessunPunto'); return; }
    mappa.fitBounds(L.latLngBounds([da, v.p]), { maxZoom: 17, padding: [60, 60] });
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
    vaiAllaMappa();
    avviso(err && err.code === 1 ? 'avviso.geoNegata' : 'avviso.geoNo', 6000);
  }

  $('btn-posizione').addEventListener('click', () => {
    localizza().then((io) => mappa.setView([io.lat, io.lng], 16)).catch(erroreGeo);
  });
  ['btn-vicina', 'btn-vicina-mappa'].forEach((id) => $(id).addEventListener('click', () => {
    localizza().then((io) => mostraPiuVicino(io)).catch(erroreGeo);
  }));

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
    const perNil = new Map();
    TIPI.forEach((tipo) => (stato.dati[tipo] || []).forEach((p) => {
      if (!p.nil) return;
      if (!perNil.has(p.nil)) perNil.set(p.nil, []);
      perNil.get(p.nil).push(p);
    }));
    return [...perNil.entries()]
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
      const s = v.tipo === 'quartiere' ? 'sugg.quartieri' : 'sugg.indirizzi';
      if (s !== sezione) {
        sezione = s;
        const titolo = document.createElement('li');
        titolo.className = 'titolo';
        titolo.textContent = t(s);
        lista.appendChild(titolo);
      }
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      const nome = document.createElement('span');
      nome.textContent = v.nome;
      li.appendChild(nome);
      if (v.punti) {
        const n = document.createElement('small');
        n.textContent = v.punti.length === 1 ? t('sugg.punto') : t('sugg.punti', { n: v.punti.length });
        li.appendChild(n);
      }
      li.addEventListener('mousedown', (e) => { e.preventDefault(); scegli(i); });
      lista.appendChild(li);
    });
    if (messaggio) {
      const li = document.createElement('li');
      li.className = 'titolo';
      li.textContent = t(messaggio);
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
      vaiAllaMappa();
      mappa.fitBounds(L.latLngBounds(v.punti.map((p) => [p.lat, p.lng])), { maxZoom: 17, padding: [40, 40] });
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
    disegnaLista(quartieri(q), q.length >= 3 ? 'sugg.invio' : null);
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
    disegnaLista(locali, 'sugg.cerco');
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&bounded=1&accept-language=' + lingua +
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
        disegnaLista(voci, voci.length ? null : 'sugg.nessuno');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') disegnaLista(locali, 'sugg.offline');
      });
  });

  /* ---------- Avvio ---------- */
  applicaLingua();
  caricaDati();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
