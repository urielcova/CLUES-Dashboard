import { useEffect, useMemo, useRef, useState } from "react";
import { ENT_CENTROS, ENT_NOMBRES, capaReferencia, entidadesGeo, municipiosGeo } from "../datos";
import { C, OSM_TILES, instInfo } from "../instituciones";
import { ZOOM_SIN_GRUPOS, crearCapaPuntos } from "./capaPuntos";
import { ICO_EXPAND, ICO_GMAPS, ICO_LOCATE, makePin, popupHtml, popupOpts } from "./leaflet";
import { esc, fmtN, fold, titleCase } from "../util";

export function MapaClues({ L, filtrados, nearest, userPos, distancias, focus, pickMode, onPick, entidades = [], municipios = [], onTilesStatus, tilesOk, onDetalle, onMapReady, onLocate, ampliado, onAmpliar, onPopup, sombra, puntosZona = [], geoKey = "", onVista, visible = true }) {
  const [entFC, setEntFC] = useState(null);
  const [munFC, setMunFC] = useState(null);
  const [zoom, setZoom] = useState(5);
  const [vista, setVista] = useState(0);
  const pendiente = useRef(null); // acción a ejecutar cuando el mapa vuelva a ser visible
  const setEntF = useMemo(() => new Set(entidades.map((e) => fold(e))), [entidades]);
  const setMunF = useMemo(() => new Set(municipios.map((k) => fold(k))), [municipios]);
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const lyr = useRef({});
  const live = useRef({});
  live.current = { pickMode, onPick, distancias, onDetalle, userPos, onLocate, onAmpliar, ampliado, onVista, onPopup };

  useEffect(() => {
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const map = L.map(elRef.current, { center: [23.6, -102.5], zoom: 5, minZoom: 4, maxZoom: 18, worldCopyJump: true, zoomSnap: 0.5 });
    mapRef.current = map;

    // Fondo vectorial (entidades INEGI) SIEMPRE visible, debajo de las teselas (si OSM carga, lo cubre)
    map.createPane("fondo").style.zIndex = 150;
    map.createPane("limites").style.zIndex = 380; // municipios y resaltado: encima de las teselas, debajo de los puntos
    map.getPane("limites").style.pointerEvents = "none";
    const vec = L.canvas({ padding: 0.3, pane: "limites" });
    const base = L.layerGroup().addTo(map);
    const limites = L.layerGroup().addTo(map);
    const resaltado = L.layerGroup().addTo(map);
    map.createPane("etiquetas").style.zIndex = 390;
    map.getPane("etiquetas").style.pointerEvents = "none";
    const etiquetas = L.layerGroup().addTo(map);
    const fondoCanvas = L.canvas({ padding: 0.3, pane: "fondo" });
    entidadesGeo().then((fc) => {
      L.geoJSON(fc, { pane: "fondo", renderer: fondoCanvas, interactive: false, style: { color: "#bfae9f", weight: 1.2, opacity: 1, fillColor: "#f5f1ea", fillOpacity: 1 } }).addTo(base);
      setEntFC(fc);
    });
    // Referencias para orientarse sin mapa de calles (se construyen solo si hacen falta)
    lyr.current.cargarReferencia = null;
      // Referencias para orientarse sin mapa de calles: manchas urbanas, agua y carreteras (Natural Earth)
    lyr.current.cargarReferencia = () => capaReferencia().then((R) => {
        const opt = { pane: "fondo", renderer: fondoCanvas, interactive: false };
        L.geoJSON(R.urbano, { ...opt, style: { stroke: false, fillColor: "#e6dccd", fillOpacity: 1 } }).addTo(base);
        L.geoJSON(R.lagos, { ...opt, style: { color: "#9cc3d8", weight: 0.8, fillColor: "#b9d7e6", fillOpacity: 1 } }).addTo(base);
        L.geoJSON(R.rios, { ...opt, style: { color: "#9cc3d8", weight: 1.2 } }).addTo(base);
        const carreteras = [2, 1, 0].map((t) =>
          L.layerGroup([
            L.geoJSON(R.carreteras[t], { ...opt, style: { color: "#ffffff", weight: [5, 3.6, 2.6][t], opacity: 0.95, lineCap: "round" } }),
            L.geoJSON(R.carreteras[t], { ...opt, style: { color: ["#e59a4d", "#f2c36b", "#d9cbb8"][t], weight: [2.8, 1.8, 1.2][t], lineCap: "round" } }),
          ])
        );
        const mostrar = () => {
          const z = map.getZoom();
          carreteras.forEach((g, i) => { const t = 2 - i; const ver = t === 0 ? z >= 5 : t === 1 ? z >= 6 : z >= 7; if (ver) g.addTo(base); else base.removeLayer(g); });
        };
        mostrar();
        map.on("zoomend", mostrar);
      });
    // Diagnóstico: ¿el visor bloquea las imágenes del mapa por política de seguridad (CSP)?
    const onCSP = (e) => { if (/cartocdn|openstreetmap|arcgisonline|googleapis/.test(e.blockedURI || "")) onTilesStatus(false, "csp"); };
    document.addEventListener("securitypolicyviolation", onCSP);
    map.on("zoomend", () => setZoom(map.getZoom()));
    map.on("moveend", () => { setVista((v) => v + 1); live.current.onVista?.(map.getBounds()); });
    setTimeout(() => live.current.onVista?.(map.getBounds()), 80);

    // ---- Mapas base (selector arriba a la derecha). Las capas nunca se quitan solas: si un visor
    //      bloquea las imágenes externas, debajo queda el fondo INEGI.
    const attrOSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    const optT = { updateWhenIdle: coarse, keepBuffer: coarse ? 1 : 2, maxZoom: 19 };
    const calles = L.tileLayer(OSM_TILES, { ...optT, attribution: attrOSM }); // CARTO ahora exige API key; se usa OpenStreetMap
    const osm = L.tileLayer(OSM_TILES, { ...optT, attribution: attrOSM });
    const satImg = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { ...optT, attribution: "Imágenes &copy; Esri, Maxar, Earthstar Geographics" });
    const satRef = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", optT);
    const satelite = L.layerGroup([satImg, satRef]);
    const soloInegi = L.layerGroup();
    // Google Maps (Map Tiles API). Clave restringida por referrer a urielcova.github.io
    const GOOGLE_KEY = "AIzaSyAPkjJ2v-NpklMxCeV8gMK1ciGvfB4Li-s";
    const capaGoogle = (mapType, layerTypes) => {
      const ly = L.tileLayer("data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", { ...optT, attribution: "&copy; Google" });
      let pedida = false;
      ly.on("add", () => {
        if (pedida) return; pedida = true;
        fetch("https://tile.googleapis.com/v1/createSession?key=" + GOOGLE_KEY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapType, language: "es-MX", region: "MX", ...(layerTypes ? { layerTypes } : {}) }) })
          .then((r) => r.json()).then((d) => { if (!d.session) throw 0; ly.setUrl("https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=" + d.session + "&key=" + GOOGLE_KEY); })
          .catch(() => { pedida = false; });
      });
      return ly;
    };
    const gCalles = capaGoogle("roadmap"), gSat = capaGoogle("satellite", ["layerRoadmap"]);
    let cargadas = 0, tDet = 0;
    const vigilar = () => {
      cargadas = 0;
      clearTimeout(tDet);
      tDet = setTimeout(() => { if (!cargadas) onTilesStatus(false, navigator.onLine === false ? "offline" : "red"); }, 7000);
    };
    [calles, osm, satImg, gCalles, gSat].forEach((t) => t.on("tileload", () => { if (!cargadas++) onTilesStatus(true); }));
    calles.addTo(map);
    vigilar();
    L.control.layers({ "Calles": calles, "Satélite": satelite, "OpenStreetMap": osm, "Google Calles": gCalles, "Google Satélite": gSat, "Solo límites INEGI": soloInegi }, null, { position: "topright", collapsed: true }).addTo(map);
    map.on("baselayerchange", (e) => { if (e.layer === soloInegi) { clearTimeout(tDet); onTilesStatus(false, "manual"); } else vigilar(); });
    L.control.scale({ imperial: false, position: "bottomleft", maxWidth: 110 }).addTo(map);

    // ---- Controles de orientación: mi ubicación, ampliar y Google Maps
    const Botones = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const box = L.DomUtil.create("div", "leaflet-bar clues-ctrl");
        const mk = (html, title, fn) => {
          const a = L.DomUtil.create("a", "", box);
          a.href = "#";
          a.title = title;
          a.setAttribute("role", "button");
          a.setAttribute("aria-label", title);
          a.innerHTML = html;
          L.DomEvent.on(a, "click", (ev) => { L.DomEvent.preventDefault(ev); fn(); });
          return a;
        };
        mk(ICO_LOCATE, "Mi ubicación: encontrar la CLUES más cercana", () => live.current.onLocate?.());
        mk(ICO_EXPAND, "Ampliar / reducir el mapa", () => live.current.onAmpliar?.());
        const g = L.DomUtil.create("a", "clues-ctrl-gmaps", box);
        g.title = "Ver esta zona en Google Maps";
        g.setAttribute("aria-label", g.title);
        g.target = "_blank";
        g.rel = "noopener noreferrer";
        g.innerHTML = ICO_GMAPS;
        const sync = () => { const c = map.getCenter(); g.href = `https://www.google.com/maps/@${c.lat.toFixed(5)},${c.lng.toFixed(5)},${Math.round(map.getZoom())}z`; };
        sync();
        map.on("moveend", sync);
        L.DomEvent.disableClickPropagation(box);
        return box;
      },
    });
    new Botones().addTo(map);

    const Puntos = crearCapaPuntos(L);
    const puntos = new Puntos().addTo(map);

    const tol = coarse ? 12 : 5;
    map.on("click", (e) => {
      const p = live.current;
      if (p.pickMode) { p.onPick(e.latlng.lat, e.latlng.lng); return; }
      const h = puntos.hit(e.containerPoint, tol);
      if (!h) return;
      if (h.tipo === "punto") {
        const u = h.u;
        L.popup(popupOpts()).setLatLng([u.LATITUD, u.LONGITUD]).setContent(popupHtml(u, p.distancias.get(u.CLUES))).openOn(map);
        return;
      }
      // Grupo: acercar a sus unidades; si todas comparten el mismo punto, listarlas
      const { g, rows } = h;
      const mismoPunto = g.nN - g.s < 0.0002 && g.e - g.w < 0.0002;
      if (mismoPunto || map.getZoom() >= map.getMaxZoom() - 1) {
        const items = rows.slice(0, 12).map((u) => `<li style="margin:0 0 6px"><button type="button" data-accion="detalle" data-clues="${esc(u.CLUES)}" style="all:unset;cursor:pointer;color:#9F2241;font-weight:600">${esc(titleCase(u["NOMBRE DE LA UNIDAD"]))}</button><br><span style="font-size:11px;color:#777">${esc(u.CLUES)} · ${esc(instInfo(u["NOMBRE DE LA INSTITUCION"]).sigla)}</span></li>`).join("");
        L.popup(popupOpts()).setLatLng(e.latlng).setContent(`<div class="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-white bg-guinda" style="padding-right:30px">${fmtN(rows.length)} unidades en este punto</div><ul style="list-style:none;margin:0;padding:10px 14px;max-height:220px;overflow:auto;font-size:12.5px">${items}</ul>${rows.length > 12 ? `<p style="padding:0 14px 10px;font-size:11px;color:#777">y ${fmtN(rows.length - 12)} más; usa los filtros o la lista.</p>` : ""}`).openOn(map);
      } else {
        map.fitBounds([[g.s, g.w], [g.nN, g.e]], { padding: [50, 50], maxZoom: Math.min(map.getZoom() + 4, ZOOM_SIN_GRUPOS + 1), animate: true });
      }
    });
    if (!coarse) {
      let raf = 0;
      map.on("mousemove", (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const over = !live.current.pickMode && puntos.hit(e.containerPoint, tol);
          map.getContainer().style.cursor = live.current.pickMode ? "crosshair" : over ? "pointer" : "";
        });
      });
    }

    // Botón "Ver detalles" dentro de los popups del mapa
    map.on("popupclose", () => live.current.onPopup?.(false));
    map.on("popupopen", (e) => {
      live.current.onPopup?.(true);
      const el = e.popup.getElement();
      el?.querySelectorAll("[data-accion=detalle]").forEach((b) =>
        b.addEventListener("click", () => { map.closePopup(); live.current.onDetalle(b.dataset.clues); })
      );
    });
    onMapReady?.(map);

    // Máscara: sombrea lo que queda fuera de las entidades / municipios filtrados
    map.createPane("mascara").style.zIndex = 370;
    map.getPane("mascara").style.pointerEvents = "none";
    const mascara = L.layerGroup().addTo(map);
    lyr.current = { ...lyr.current, mascara, vecMascara: L.canvas({ padding: 0.5, pane: "mascara" }), base, limites, resaltado, etiquetas, vec, puntos, extra: L.layerGroup().addTo(map), iconNearest: makePin(L, C.dorado, C.guindaDark, coarse ? 34 : 40, true) };
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => { clearTimeout(t); clearTimeout(tDet); document.removeEventListener("securitypolicyviolation", onCSP); map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  // Municipios INEGI: se cargan al elegir una entidad o al acercarse (zoom ≥ 8)
  const verMunicipios = setEntF.size > 0 || setMunF.size > 0 || zoom >= 8;
  const [localidades, setLocalidades] = useState(null);
  useEffect(() => {
    if (tilesOk !== false || localidades) return;
    if (!lyr.current.refHecha && lyr.current.cargarReferencia) { lyr.current.refHecha = true; lyr.current.cargarReferencia(); }
    capaReferencia().then((R) => setLocalidades(R.localidades));
  }, [tilesOk, localidades]);

  // Etiquetas propias (solo cuando no hay mapa de calles): entidades a zoom bajo, municipios visibles a zoom ≥ 9
  useEffect(() => {
    const { etiquetas } = lyr.current;
    const map = mapRef.current;
    if (!etiquetas || !map) return;
    etiquetas.clearLayers();
    if (tilesOk !== false) return;
    const lbl = (lat, lng, txt, cls) =>
      L.marker([lat, lng], { pane: "etiquetas", interactive: false, keyboard: false, icon: L.divIcon({ className: "", html: `<span class="${cls}">${esc(txt)}</span>`, iconSize: [0, 0] }) }).addTo(etiquetas);
    if (zoom < 7) {
      ENT_CENTROS.forEach(([la, lo], i) => lbl(la, lo, titleCase(ENT_NOMBRES[i]), "clues-lbl clues-lbl-ent"));
    } else if (localidades) {
      // Localidades (centro de sus unidades CLUES verificadas), por importancia y sin encimarse
      const minUnidades = zoom < 8 ? 25 : zoom < 9 ? 8 : zoom < 10 ? 3 : zoom < 11 ? 2 : 1;
      const b = map.getBounds();
      const puestos = [];
      for (const [la, lo, n, nombre, ent] of localidades) {
        if (n < minUnidades) break; // vienen ordenadas de mayor a menor
        if (setEntF.size && !setEntF.has(fold(ent))) continue;
        if (!b.contains([la, lo])) continue;
        const txt = titleCase(nombre);
        const pt = map.latLngToContainerPoint([la, lo]);
        const grande = n >= 60;
        const w = txt.length * (grande ? 7 : 6.2) + 10, h = grande ? 18 : 15;
        const r = [pt.x - w / 2, pt.y - h / 2, pt.x + w / 2, pt.y + h / 2];
        if (puestos.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) continue;
        puestos.push(r);
        lbl(la, lo, txt, `clues-lbl ${grande ? "clues-lbl-ciudad" : "clues-lbl-loc"}`);
        if (puestos.length > 180) break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, tilesOk, zoom, vista, localidades, setEntF]);
  useEffect(() => { if (verMunicipios && !munFC) municipiosGeo().then(setMunFC); }, [verMunicipios, munFC]);

  // Sombreado fuera del área filtrada: un polígono del mundo con "huecos" en la zona seleccionada
  useEffect(() => {
    const { mascara, vecMascara } = lyr.current;
    if (!mascara) return;
    mascara.clearLayers();
    if (!sombra?.activa || (!setEntF.size && !setMunF.size)) return;
    let feats = null;
    if (setMunF.size) {
      if (!munFC) return; // se vuelve a ejecutar cuando carguen los municipios
      feats = munFC.features.filter((x) => setMunF.has(fold(`${x.properties.ent}||${x.properties.mun}`)));
    } else {
      if (!entFC) return;
      feats = entFC.features.filter((x) => setEntF.has(fold(x.properties.ent)));
    }
    if (!feats.length) return;
    const huecos = [];
    for (const f of feats) for (const poly of f.geometry.coordinates) huecos.push(poly[0].map(([lng, lat]) => [lat, lng]));
    const mundo = [[-85, -540], [85, -540], [85, 540], [-85, 540]];
    L.polygon([mundo, ...huecos], {
      renderer: vecMascara, pane: "mascara", interactive: false, stroke: false,
      fillColor: sombra.color, fillOpacity: sombra.opacidad, fillRule: "evenodd", smoothFactor: 0.5,
    }).addTo(mascara);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, entFC, munFC, setEntF, setMunF, sombra?.activa, sombra?.color, sombra?.opacidad]);

  // Límites municipales y resaltado de entidad / municipio elegidos
  useEffect(() => {
    const { limites, resaltado, vec } = lyr.current;
    if (!limites) return;
    limites.eachLayer((l) => limites.removeLayer(l));
    resaltado.clearLayers();
    const eq = (a, b) => fold(a || "") === fold(b || "");
    if (munFC && verMunicipios) {
      // capas cacheadas: una por entidad (se construyen la primera vez y se reutilizan)
      const cache = (lyr.current.munCache ??= new Map());
      const estilo = { color: tilesOk !== false ? C.guindaDark : "#b3a294", weight: 0.8, opacity: tilesOk !== false ? 0.45 : 0.9, fill: false, dashArray: tilesOk !== false ? null : "3 3" };
      const ents = setEntF.size ? [...setEntF] : [...new Set(munFC.features.map((f) => fold(f.properties.ent || "")))];
      for (const ent of ents) {
        let capa = cache.get(ent);
        if (!capa) {
          capa = L.geoJSON({ type: "FeatureCollection", features: munFC.features.filter((f) => fold(f.properties.ent || "") === ent) }, { renderer: vec, interactive: false, style: estilo });
          cache.set(ent, capa);
        } else capa.setStyle(estilo);
        capa.addTo(limites);
      }
    }
    if (entFC && setEntF.size) {
      const f = entFC.features.filter((x) => setEntF.has(fold(x.properties.ent)));
      L.geoJSON({ type: "FeatureCollection", features: f }, { renderer: vec, interactive: false, style: { color: C.dorado, weight: 2.5, fillColor: C.dorado, fillOpacity: setMunF.size ? 0.04 : 0.1 } }).addTo(resaltado);
    }
    if (munFC && setMunF.size) {
      const f = munFC.features.filter((x) => setMunF.has(fold(`${x.properties.ent}||${x.properties.mun}`)));
      L.geoJSON({ type: "FeatureCollection", features: f }, { renderer: vec, interactive: false, style: { color: C.guinda, weight: 2.5, dashArray: "6 4", fillColor: C.dorado, fillOpacity: 0.16 } }).addTo(resaltado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, entFC, munFC, setEntF, setMunF, verMunicipios, tilesOk]);

  // Puntos: solo los de la zona que el usuario pidió ver ("Ver CLUES en esta zona")
  useEffect(() => { lyr.current.puntos?.setRows(puntosZona); }, [L, puntosZona]);

  // Reencuadre al cambiar el filtro geográfico (entidades / municipios)
  const geoPrevio = useRef(geoKey);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || geoPrevio.current === geoKey) return;
    geoPrevio.current = geoKey;
    if (!map.getSize().x) pendiente.current = () => reencuadrar();
    reencuadrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, geoKey, filtrados]);
  function reencuadrar() {
    const map = mapRef.current;
    if (!map || !map.getSize().x) return;
    if (!geoKey) { map.setView([23.6, -102.5], 5, { animate: true }); return; }
    let s = 90, w = 180, nN = -90, e = -180, k = 0;
    for (const u of filtrados) {
      if (u.LATITUD == null) continue;
      k++;
      if (u.LATITUD < s) s = u.LATITUD; if (u.LATITUD > nN) nN = u.LATITUD;
      if (u.LONGITUD < w) w = u.LONGITUD; if (u.LONGITUD > e) e = u.LONGITUD;
    }
    if (!k) return;
    if (k === 1) map.setView([s, w], 15, { animate: true });
    else map.fitBounds([[s, w], [nN, e]], { padding: [30, 30], maxZoom: 15, animate: true });
  }

  // Ubicación del usuario, línea y pin dorado de la más cercana
  useEffect(() => {
    const { extra, iconNearest } = lyr.current;
    if (!extra) return;
    extra.clearLayers();
    lyr.current.nearestMarker = null;
    if (!userPos) return;
    if (userPos.prec && userPos.prec > 30) L.circle([userPos.lat, userPos.lng], { radius: userPos.prec, color: "#0284c7", weight: 1, opacity: 0.5, fillColor: "#0284c7", fillOpacity: 0.07, interactive: false }).addTo(extra);
    L.circleMarker([userPos.lat, userPos.lng], { radius: 16, weight: 0, fillColor: "#0284c7", fillOpacity: 0.18, interactive: false }).addTo(extra);
    L.circleMarker([userPos.lat, userPos.lng], { radius: 7, color: "#fff", weight: 3, fillColor: "#0284c7", fillOpacity: 1, interactive: false }).addTo(extra);
    if (nearest) {
      L.polyline([[userPos.lat, userPos.lng], [nearest.u.LATITUD, nearest.u.LONGITUD]], { color: C.dorado, weight: 3, dashArray: "8 8", interactive: false }).addTo(extra);
      lyr.current.nearestMarker = L.marker([nearest.u.LATITUD, nearest.u.LONGITUD], { icon: iconNearest, zIndexOffset: 1000 })
        .bindPopup(popupHtml(nearest.u, nearest.km, true), popupOpts())
        .addTo(extra);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, userPos, nearest?.u.CLUES]);

  // Enfoque en una unidad (más cercana o clic en la lista)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    if (!map.getSize().x) { pendiente.current = () => setFocusInterno({ ...focus, n: Date.now() }); return; }
    aplicarFoco(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);
  const [focusInterno, setFocusInterno] = useState(null);
  useEffect(() => { if (focusInterno) aplicarFoco(focusInterno); }, [focusInterno]); // eslint-disable-line
  function aplicarFoco(focus) {
    const map = mapRef.current;
    const destino = L.latLng(focus.u.LATITUD, focus.u.LONGITUD);
    let seMueve;
    if (focus.bounds) {
      // tu ubicación + las unidades más cercanas, todas a la vista
      const b = L.latLngBounds(focus.bounds);
      const z = Math.min(16, map.getBoundsZoom(b, false, L.point(60, 60)));
      seMueve = map.getZoom() !== z || map.getCenter().distanceTo(b.getCenter()) > 2;
      map.fitBounds(b, { padding: [60, 60], maxZoom: 16, animate: true });
    } else {
      seMueve = map.getZoom() !== focus.zoom || map.getCenter().distanceTo(destino) > 2;
      map.setView(destino, focus.zoom, { animate: true });
    }
    if (!seMueve) live.current.onVista?.(map.getBounds()); // sin movimiento no hay "moveend": avisar la vista igual
    (seMueve ? (fn) => map.once("moveend", fn) : (fn) => fn())(() => {
      if (focus.popup === false) return;
      if (focus.nearest && lyr.current.nearestMarker) lyr.current.nearestMarker.openPopup();
      else L.popup(popupOpts()).setLatLng([focus.u.LATITUD, focus.u.LONGITUD]).setContent(popupHtml(focus.u, live.current.distancias.get(focus.u.CLUES))).openOn(map);
    });
  }


  // Al ampliar, reducir o cambiar de pestaña, Leaflet debe recalcular el tamaño y ejecutar lo pendiente
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const t = setTimeout(() => {
      const antes = map.getSize(); // tamaño previo: 0×0 si el mapa se creó con la pestaña oculta
      map.invalidateSize({ pan: false });
      const p = pendiente.current;
      pendiente.current = null;
      if (p) p();
      else if (!antes.x || !antes.y) map.fitBounds([[14.5, -118.4], [32.7, -86.7]], { animate: false }); // primer encuadre real: todo México
      else live.current.onVista?.(map.getBounds());
    }, 60);
    return () => clearTimeout(t);
  }, [ampliado, visible]);

  // Cursor de selección
  useEffect(() => { if (mapRef.current) mapRef.current.getContainer().style.cursor = pickMode ? "crosshair" : ""; }, [pickMode]);

  return <div ref={elRef} className="h-full w-full" style={{ background: "#cddfe8" }} />;
}
