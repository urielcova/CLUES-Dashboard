/**
 * Dashboard CLUES — Establecimientos de Salud en México (base completa)
 * Fuente: ESTABLECIMIENTO_SALUD_202609.xlsx, hoja CLUES_202609
 * Criterio: ESTATUS DE OPERACION = "EN OPERACION" y NIVEL ATENCION ∈ {PRIMER, SEGUNDO, TERCER}
 *
 * Archivo único. Importa solo `react` y `lucide-react`.
 * Leaflet se carga desde cdnjs; los datos van comprimidos (gzip + base64) al final del archivo.
 */
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Hospital, Activity, HeartPulse, Building, Building2, Stethoscope, Shield, Anchor, Fuel, Cross, Users, GraduationCap, Landmark,
  LocateFixed, MapPin, Filter, RotateCcw, X, Crosshair, Database, Layers3, Layers2, Layers, Search,
  AlertTriangle, Loader2, Navigation, MousePointerClick, MapPinOff, ChevronDown, ChevronRight,
  Check, Copy, Clock, ExternalLink, Route, Map as MapIcon, Target, FileText, ShieldCheck, Download, UploadCloud, Home, List as ListIcon, Eye,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* 1. PALETA, CONSTANTES E ÍCONOS POR INSTITUCIÓN                      */
/* ------------------------------------------------------------------ */
const C = { guinda: "#9F2241", guindaDark: "#6B1C35", dorado: "#BC955C", fondo: "#F4F6F8" };
const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const PAGE = 40;

const INSTITUCIONES = {
  "INSTITUTO MEXICANO DEL SEGURO SOCIAL": { sigla: "IMSS", Icon: Hospital },
  "SERVICIOS DE SALUD IMSS BIENESTAR": { sigla: "IMSS-BIENESTAR", Icon: HeartPulse },
  "INSTITUTO DE SEGURIDAD Y SERVICIOS SOCIALES DE LOS TRABAJADORES DEL ESTADO": { sigla: "ISSSTE", Icon: Building },
  "SECRETARIA DE SALUD": { sigla: "SSA", Icon: Stethoscope },
  "SECRETARIA DE LA DEFENSA NACIONAL": { sigla: "SEDENA", Icon: Shield },
  "SECRETARIA DE MARINA": { sigla: "SEMAR", Icon: Anchor },
  "PETROLEOS MEXICANOS": { sigla: "PEMEX", Icon: Fuel },
  "SERVICIOS MEDICOS PRIVADOS": { sigla: "PRIVADO", Icon: Building2 },
  "CRUZ ROJA MEXICANA": { sigla: "CRUZ ROJA", Icon: Cross },
  "SISTEMA NACIONAL PARA EL DESARROLLO INTEGRAL DE LA FAMILIA": { sigla: "DIF", Icon: Users },
  "SERVICIOS MEDICOS ESTATALES": { sigla: "ESTATAL", Icon: Landmark },
  "SERVICIOS MEDICOS MUNICIPALES": { sigla: "MUNICIPAL", Icon: Landmark },
  "SERVICIOS MEDICOS UNIVERSITARIOS": { sigla: "UNIVERSITARIO", Icon: GraduationCap },
  "CENTROS DE INTEGRACION JUVENIL": { sigla: "CIJ", Icon: Users },
};
const instInfo = (nombre) => INSTITUCIONES[nombre] || { sigla: nombre.split(/\s+/).filter((w) => w.length > 2).map((w) => w[0]).join(""), Icon: Activity };

/* Color de la insignia por institución (código visual del tablero, no son colores oficiales) */
const INST_COLOR = {
  IMSS: "#11694F", "IMSS-BIENESTAR": "#9F2241", ISSSTE: "#1F5E8C", SSA: "#6B1C35", SEDENA: "#4B5E2A", SEMAR: "#1B2A4A",
  PEMEX: "#B45309", PRIVADO: "#57534E", "CRUZ ROJA": "#C8102E", DIF: "#7C3AED", ESTATAL: "#475569", MUNICIPAL: "#64748B",
  UNIVERSITARIO: "#1D4ED8", CIJ: "#0E7490",
};
const instColor = (sigla) => INST_COLOR[sigla] || "#6B7280";

/* LOGOS INSTITUCIONALES — recortados de la imagen proporcionada por el usuario.
   full: logotipo completo · mark: emblema compacto para tamaños pequeños (opcional) */
const LOGOS = /*__LOGOS__*/;
const logoDe = (sigla, size) => { const l = LOGOS[sigla]; return l ? (size < 60 && l.mark) || l.full : null; };

function InstBadge({ nombre, size = 40, activa = false }) {
  const { sigla, Icon } = instInfo(nombre);
  const color = instColor(sigla);
  const logo = logoDe(sigla, size);
  const s = { width: size, height: size, minWidth: size };
  if (logo) {
    return (
      <span className="grid place-items-center overflow-hidden rounded-lg bg-white" style={{ ...s, padding: Math.round(size * 0.08), border: `1.5px solid ${activa ? C.dorado : "#e5e5e5"}` }} title={sigla}>
        <img src={logo} alt={sigla} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
      </span>
    );
  }
  return (
    <span className="grid place-items-center rounded-lg text-white" style={{ ...s, background: activa ? C.dorado : color }} title={sigla}>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} />
    </span>
  );
}
function InstChip({ nombre }) {
  const { sigla } = instInfo(nombre);
  const color = instColor(sigla);
  return (
    <span className="truncate rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color, background: color + "14" }}>
      {sigla}
    </span>
  );
}
/* Niveles de atención: tres tonos distinguibles (validados para daltonismo) + forma distinta.
   Primer = círculo verde azulado · Segundo = cuadro naranja · Tercer = rombo guinda */
const NIVEL_COLOR = { "PRIMER NIVEL": "#0A8F84", "SEGUNDO NIVEL": "#C96A00", "TERCER NIVEL": "#9F2241" };
const NIVEL_FORMA = { "PRIMER NIVEL": "circulo", "SEGUNDO NIVEL": "cuadro", "TERCER NIVEL": "rombo" };
// Traza la forma del nivel nv (0,1,2) centrada en x,y con "radio" r
function trazarForma(ctx, nv, x, y, r) {
  if (nv === 0) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); }
  else if (nv === 1) { const h = r * 0.9; ctx.rect(x - h, y - h, h * 2, h * 2); }
  else { const d = r * 1.4; ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath(); }
}
function NivelIcono({ nivel, size = 12, hueco = false }) {
  const c = NIVEL_COLOR[nivel], f = NIVEL_FORMA[nivel];
  const p = hueco ? { fill: "none", stroke: c, strokeWidth: 2 } : { fill: c, stroke: "#fff", strokeWidth: 1.2 };
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" style={{ flexShrink: 0, display: "inline-block", verticalAlign: "-1px" }}>
      {f === "circulo" ? <circle cx="7" cy="7" r="5.6" {...p} /> : f === "cuadro" ? <rect x="1.8" y="1.8" width="10.4" height="10.4" rx="1" {...p} /> : <path d="M7 0.6 13.4 7 7 13.4 0.6 7Z" {...p} />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 2. UTILIDADES                                                       */
/* ------------------------------------------------------------------ */
// Fórmula de Haversine: distancia en km sobre la superficie terrestre
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0088;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000).toLocaleString("es-MX")} m` : `${km.toLocaleString("es-MX", { maximumFractionDigits: km < 10 ? 2 : 1 })} km`);
const fmtN = (n) => n.toLocaleString("es-MX");
const titleCase = (s) => s.toLowerCase().replace(/(^|\s|\(|"|\.)([a-záéíóúñü])/g, (m) => m.toUpperCase());
const uniqSorted = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, "es"));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fold = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const normEntidad = (s = "") => fold(s).replace(/ DE IGNACIO DE LA LLAVE| DE OCAMPO| DE ZARAGOZA/g, "").trim();

/* Decodifica la base empaquetada (gzip + base64) → arreglo de registros con las columnas originales */
// Los bloques de datos pueden venir en <script type="text/plain" id="..."> (versión HTML: no se analizan como JS)
const blob = (id, valor) => (valor && valor.length > 8 ? valor : document.getElementById(id)?.textContent.trim() || "");
async function gunzipB64(b64) {
  const s = atob(b64);
  const bin = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
  return JSON.parse(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
}

/* Calidad de la coordenada, validada contra el Marco Geoestadístico INEGI 2025 (entidad y municipio declarados) */
const CALIDAD = {
  0: { t: "Verificada", d: "La coordenada cae dentro de su municipio declarado.", c: "#15803d", mapa: true, cercana: true },
  1: { t: "Otro municipio", d: "La coordenada cae en otro municipio de la misma entidad.", c: "#b45309", mapa: true, cercana: true },
  2: { t: "Coordenada genérica", d: "Varias unidades comparten exactamente esta coordenada; probablemente es un punto de referencia, no el domicilio.", c: "#b45309", mapa: true, cercana: false },
  3: { t: "Corregida", d: "Se corrigió el signo de la longitud registrada (venía positiva).", c: "#1d4ed8", mapa: true, cercana: true },
  4: { t: "Fuera de su entidad", d: "La coordenada registrada cae fuera de la entidad declarada.", c: "#b91c1c", mapa: false, cercana: false },
  5: { t: "Sin coordenadas", d: "La unidad no tiene coordenadas registradas.", c: "#6b7280", mapa: false, cercana: false },
  6: { t: "Entidad registrada inconsistente", d: "La coordenada y el código postal del domicilio coinciden entre sí, pero no con la entidad registrada en el catálogo.", c: "#b45309", mapa: true, cercana: true },
};
const FILTRO_CALIDAD = { verificada: [0, 3], revisar: [1, 2, 6], excluida: [4, 5] };

let _packActual = null; // empaque del catálogo en uso (para comparar contra uno nuevo)
const cargarBase = async () => construirBase(await gunzipB64(blob("d-base", DATA_GZ_B64)));
function construirBase(pack) {
  _packActual = pack;
  const { I, E, M, V, T, C: [cl, nom, ii, mm, vv, tt, la, lo, qq, ff] } = pack;
  const out = new Array(cl.length);
  for (let k = 0; k < cl.length; k++) {
    const latR = la[k] == null ? null : la[k] / 1e5, lngR = lo[k] == null ? null : lo[k] / 1e5;
    const q = qq[k];
    const enMapa = CALIDAD[q].mapa && latR != null;
    const lat = enMapa ? latR : null, lng = enMapa ? lngR : null;
    out[k] = {
      CLUES: cl[k],
      "NOMBRE DE LA INSTITUCION": I[ii[k]],
      "NOMBRE DE LA UNIDAD": nom[k],
      ENTIDAD: E[M[mm[k]][0]],
      MUNICIPIO: M[mm[k]][1],
      "NIVEL ATENCION": V[vv[k]],
      "NOMBRE TIPO ESTABLECIMIENTO": T[tt[k]],
      LATITUD: lat,
      LONGITUD: lng,
      _latReg: latR,
      _lngReg: lngR,
      _calidad: q,
      _cae: ff[k], // índice de la entidad donde cae la coordenada registrada (-1: fuera de México)
      _cercana: CALIDAD[q].cercana && lat != null,
      _i: k,
      _nv: vv[k],
      // proyección Web Mercator a zoom 0 (256 px), precalculada una sola vez
      _px: lng == null ? null : ((lng + 180) / 360) * 256,
      _py: lat == null ? null : (0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)) * 256,
    };
  }
  return out;
}

/* Geometrías INEGI (Marco Geoestadístico 2025): anillos con coordenadas enteras en delta */
const decodeRings = (rings, q) =>
  rings.map((f) => {
    const out = [];
    let x = f[0], y = f[1];
    out.push([x / q, y / q]);
    for (let i = 2; i < f.length; i += 2) { x += f[i]; y += f[i + 1]; out.push([x / q, y / q]); }
    return [out];
  });
let _entGeo = null, _munGeo = null, _ref = null;
const decodeLines = (lines, q) =>
  lines.map((f) => {
    const out = [];
    let x = f[0], y = f[1];
    out.push([x / q, y / q]);
    for (let i = 2; i < f.length; i += 2) { x += f[i]; y += f[i + 1]; out.push([x / q, y / q]); }
    return out;
  });
/* Capa de referencia (Natural Earth 1:10m, dominio público) + localidades a partir de la base CLUES */
const capaReferencia = () =>
  (_ref ??= gunzipB64(blob("d-ref", BASE_GZ_B64)).then((B) => {
    const fcL = (lst) => ({ type: "FeatureCollection", features: lst.map((parts) => ({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: decodeLines(parts, B.q) } })) });
    const fcP = (lst) => ({ type: "FeatureCollection", features: lst.map((parts) => ({ type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: decodeLines(parts, B.q).map((r) => [r]) } })) });
    const porTipo = [[], [], []];
    B.r.forEach(([t, parts]) => porTipo[t].push(parts));
    return {
      carreteras: porTipo.map(fcL),
      urbano: fcP(B.u),
      lagos: fcP(B.l),
      rios: fcL(B.v),
      localidades: B.p.map(([la, lo, n, nombre, ent]) => [la / B.q, lo / B.q, n, nombre, ent]),
    };
  }));
const entidadesGeo = () =>
  (_entGeo ??= gunzipB64(blob("d-ent", ENT_GZ_B64)).then((E) => ({
    type: "FeatureCollection",
    features: E.g.map((r, i) => ({ type: "Feature", properties: { ent: E.n[i] }, geometry: { type: "MultiPolygon", coordinates: decodeRings(r, E.q) } })),
  })));
const municipiosGeo = () =>
  (_munGeo ??= gunzipB64(blob("d-mun", MUN_GZ_B64)).then((Mg) => ({
    type: "FeatureCollection",
    features: Mg.g.map((r, i) => ({
      type: "Feature",
      properties: { key: Mg.k[i], mun: Mg.nm[i], ent: ENT_NOMBRES[Mg.e[i] - 1], lat: Mg.c[i][0] / 1e3, lng: Mg.c[i][1] / 1e3 },
      geometry: { type: "MultiPolygon", coordinates: decodeRings(r, Mg.q) },
    })),
  })));

/* Detalles (dirección, teléfono, tipología, horarios, servicios): se descomprimen la primera vez que se abre una ficha */
let _detallesPromesa = null;
const cargarDetalles = () => (_detallesPromesa ??= gunzipB64(blob("d-detalles", DETALLES_GZ_B64)));
const noEsp = (v) => (v && !/^NO ESPECIFICADO$/i.test(v) ? v : "");
function detalleDe(pk, i) {
  const c = pk.C;
  const g = (col) => c[col][i];
  return {
    localidad: pk.loc[g(0)],
    jurisdiccion: pk.jur[g(1)],
    tipologia: pk.tip[g(2)],
    subtipologia: pk.sub[g(3)],
    tipoVialidad: noEsp(pk.vt[g(4)]),
    vialidad: g(5),
    numExt: g(6),
    numInt: g(7),
    tipoAsentamiento: noEsp(pk.at[g(8)]),
    asentamiento: g(9),
    cp: g(10),
    telefono: g(11),
    extension: g(12),
    inicioOperacion: g(13),
    estrato: pk.est[g(14)],
    institucionAdm: noEsp(pk.adm[g(15)]),
    horario: parseHorario(pk.hor[g(16)]),
    servicios: g(17).map((k) => { const [area, servicio, horario] = pk.srv[k].split("|"); return { area, servicio, horario }; }),
  };
}

/* Horario: grupos "1111100|08:00|16:00" (DOM..SÁB) → 7 días (lunes primero) */
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
function parseHorario(str) {
  const porDia = DIAS.map(() => []);
  if (!str) return null;
  for (const grp of str.split(";")) {
    const [mask, ini, fin] = grp.split("|");
    if (!ini || !fin) continue;
    [...mask].forEach((b, d) => { if (b === "1") porDia[d].push([ini, fin]); });
  }
  return porDia.some((x) => x.length) ? porDia : null;
}
const rango = ([a, b]) => (a === "00:00" && (b === "23:59" || b === "24:00") ? "24 horas" : `${a} – ${b}`);
function abiertoAhora(porDia) {
  if (!porDia) return null;
  const now = new Date();
  const hm = now.toTimeString().slice(0, 5);
  return porDia[now.getDay()].some(([a, b]) => (a <= b ? hm >= a && hm <= b : hm >= a || hm <= b));
}

/* Guardar un archivo generado: en Claude usa la capacidad "downloads" (pide confirmación); en un navegador normal, descarga directa */
async function guardarArchivo(nombre, contenido, tipo = "text/csv") {
  try {
    const dl = window.claude?.use ? await Promise.race([window.claude.use("downloads"), new Promise((r) => setTimeout(() => r(null), 4000))]) : null;
    if (dl) { await dl.save({ filename: nombre, data: new Blob([contenido], { type: tipo }) }); return "guardado"; }
  } catch (e) {
    if (e?.code === "declined") return "cancelado";
  }
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "guardado";
}
const csvCelda = (v) => { const t = v == null ? "" : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

/* Catálogo cargado por el usuario: se guarda SOLO en este navegador (IndexedDB) */
const idb = (modo, fn) =>
  new Promise((ok, mal) => {
    let req;
    try { req = indexedDB.open("clues-dashboard", 1); } catch (e) { mal(e); return; }
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onerror = () => mal(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction("kv", modo);
      const r = fn(tx.objectStore("kv"));
      tx.oncomplete = () => ok(r?.result);
      tx.onerror = () => mal(tx.error);
    };
  });
const idbGet = (k) => idb("readonly", (s) => s.get(k)).catch(() => null);
const idbSet = (k, v) => idb("readwrite", (s) => s.put(v, k));
const idbDel = (k) => idb("readwrite", (s) => s.delete(k)).catch(() => null);

const META_PUBLICADO = { archivo: "ESTABLECIMIENTO_SALUD_202609.xlsx", corte: "2026-09", fuente: "publicado" };
const XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const WORKER_SRC = /*__WORKER__*/;
async function crearWorkerCatalogo() {
  // Lector de Excel (SheetJS): incluido comprimido en la versión HTML (funciona sin internet); si no, desde cdnjs
  const gz = document.getElementById("w-xlsx-gz")?.textContent.trim();
  let pre = `importScripts(${JSON.stringify(XLSX_CDN)});`;
  if (gz && gz.length > 1000) {
    const s = atob(gz);
    const bin = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
    pre = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  return new Worker(URL.createObjectURL(new Blob([pre, "\n;\n", WORKER_SRC], { type: "text/javascript" })));
}
async function geometriaParaValidar() {
  const [ent, mun] = await Promise.all([entidadesGeo(), municipiosGeo()]);
  const conv = (f) => {
    const r = f.geometry.coordinates.map((p) => p[0]);
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    for (const ring of r) for (const [x, y] of ring) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
    return { b: [a, b, c, d], r };
  };
  return { ent: ent.features.map(conv), mun: mun.features.map((f) => ({ ...conv(f), k: f.properties.key })) };
}

/* Google Maps: cómo llegar (con origen si se conoce la ubicación del usuario) */
const urlComoLlegar = (u, origen) =>
  `https://www.google.com/maps/dir/?api=1&destination=${u.LATITUD},${u.LONGITUD}${origen ? `&origin=${origen.lat},${origen.lng}` : ""}`;
const urlVerEnMaps = (u) => `https://www.google.com/maps/search/?api=1&query=${u.LATITUD},${u.LONGITUD}`;



const pinSvg = (fill, stroke) =>
  `<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="12" cy="12" r="4.6" fill="#fff"/><path d="M12 9.2v5.6M9.2 12h5.6" stroke="${fill}" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const makePin = (L, fill, stroke, w, pulse = false) =>
  L.divIcon({
    className: "",
    html: `<div class="clues-pin${pulse ? " clues-pin--pulse" : ""}" style="width:${w}px;height:${w * 1.33}px">${pinSvg(fill, stroke)}</div>`,
    iconSize: [w, w * 1.33],
    iconAnchor: [w / 2, w * 1.33],
    popupAnchor: [0, -w * 1.2],
  });

const popupHtml = (u, km, destacado) => {
  const { sigla } = instInfo(u["NOMBRE DE LA INSTITUCION"]);
  return `<div class="py-2 pl-3.5 text-[11px] font-bold uppercase tracking-wider text-white ${destacado ? "bg-dorado" : "bg-guinda"}" style="padding-right:30px">${destacado ? "★ Más cercana · " : ""}${esc(sigla)}</div>
  <div class="space-y-1 px-3.5 py-3">
    ${logoDe(sigla, 40) ? `<img src="${logoDe(sigla, 40)}" alt="${esc(sigla)}" style="float:right;width:38px;height:38px;object-fit:contain;margin:0 0 4px 8px">` : ""}
    <p class="text-[13px] font-bold leading-snug text-neutral-900">${esc(titleCase(u["NOMBRE DE LA UNIDAD"]))}</p>
    <p class="text-xs text-guinda">${esc(titleCase(u["NOMBRE DE LA INSTITUCION"]))}</p>
    <p class="pt-1 text-xs text-neutral-600">CLUES: <span class="rounded bg-dorado/15 px-1 font-mono font-semibold text-guindaDark">${esc(u.CLUES)}</span></p>
    <p class="text-[11px] text-neutral-500">${esc(titleCase(u["NIVEL ATENCION"]))} · ${esc(titleCase(u["NOMBRE TIPO ESTABLECIMIENTO"]))}</p>
    <p class="text-[11px] text-neutral-500">${esc(titleCase(u.MUNICIPIO))}, ${esc(titleCase(u.ENTIDAD))}</p>
    ${km != null ? `<p class="text-xs font-semibold text-neutral-700">Distancia: ${fmtKm(km)}</p>` : ""}
    ${u._calidad ? `<p class="text-[11px] font-semibold" style="color:${CALIDAD[u._calidad].c}">⚠ Ubicación: ${CALIDAD[u._calidad].t.toLowerCase()}</p>` : ""}
  </div>
  <div class="grid grid-cols-2 gap-1.5 border-t border-neutral-100 p-2">
    <button type="button" data-accion="detalle" data-clues="${esc(u.CLUES)}" class="rounded-lg bg-guinda px-2 py-2 text-xs font-bold text-white">Ver detalles</button>
    <a href="${urlComoLlegar(u, origenActual)}" target="_blank" rel="noopener noreferrer" class="clues-gmaps rounded-lg border border-dorado px-2 py-2 text-center text-xs font-bold">Cómo llegar ↗</a>
  </div>`;
};
let origenActual = null; // ubicación del usuario para los enlaces de Google Maps en los popups del mapa
const svgI = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICO_LOCATE = svgI('<circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>');
const ICO_EXPAND = svgI('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>');
const ICO_GMAPS = svgI('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>') ;
const popupOpts = () => { const w = Math.min(290, (window.innerWidth || 400) - 70); return { className: "clues-popup", minWidth: Math.min(240, w), maxWidth: w, autoPanPaddingTopLeft: [56, 112], autoPanPaddingBottomRight: [16, 120] }; };

/* Carga Leaflet (UMD) una sola vez desde cdnjs */
function useLeaflet() {
  const [state, setState] = useState(() => (typeof window !== "undefined" && window.L ? { L: window.L, status: "ok" } : { L: null, status: "loading" }));
  useEffect(() => {
    if (window.L) return;
    let s = document.querySelector("script[data-clues-leaflet]");
    if (!s) {
      s = document.createElement("script");
      s.src = LEAFLET_JS;
      s.async = true;
      s.dataset.cluesLeaflet = "1";
      document.head.appendChild(s);
    }
    const ok = () => setState({ L: window.L, status: "ok" });
    const ko = () => setState({ L: null, status: "error" });
    s.addEventListener("load", ok);
    s.addEventListener("error", ko);
    return () => { s.removeEventListener("load", ok); s.removeEventListener("error", ko); };
  }, []);
  return state;
}

/* ------------------------------------------------------------------ */
/* 3. MAPA (Leaflet + OpenStreetMap)                                   */
/*    Los puntos se dibujan en UNA sola capa canvas (rápida en celular) */
/* ------------------------------------------------------------------ */
const NIVELES = ["PRIMER NIVEL", "SEGUNDO NIVEL", "TERCER NIVEL"];
const PAD = 0.25; // margen del canvas alrededor de la vista (evita bordes vacíos al arrastrar)
const radioPorZoom = (z) => (z <= 5 ? 1.8 : z <= 7 ? 2.4 : z <= 9 ? 3.2 : z <= 12 ? 4.2 : z <= 14 ? 5.2 : 6.5);
const ZOOM_SIN_GRUPOS = 14; // a partir de este zoom se ven todas las unidades sin agrupar
const TAM_CELDA = 64; // px de pantalla por grupo

/* Capa de puntos en canvas: proyección precalculada (zoom 0) + dibujo por lotes + búsqueda de clic */
function crearCapaPuntos(L) {
  return L.Layer.extend({
    initialize() { this._rows = []; this._sx = new Float32Array(0); this._sy = new Float32Array(0); this._vis = new Int32Array(0); this._nvis = 0; },
    setRows(rows) {
      this._rows = rows.filter((u) => u._px != null);
      this._redraw();
    },
    onAdd(map) {
      this._map = map;
      const c = (this._canvas = L.DomUtil.create("canvas", "leaflet-zoom-animated clues-points"));
      c.style.pointerEvents = "none";
      map.getPanes().overlayPane.appendChild(c);
      map.on("moveend zoomend resize viewreset", this._reset, this);
      map.on("zoomanim", this._animateZoom, this);
      this._reset();
    },
    onRemove(map) {
      L.DomUtil.remove(this._canvas);
      map.off("moveend zoomend resize viewreset", this._reset, this);
      map.off("zoomanim", this._animateZoom, this);
    },
    _animateZoom(e) {
      // misma fórmula que L.Renderer: escala el canvas durante la animación de zoom
      const map = this._map;
      const scale = map.getZoomScale(e.zoom, this._zoom);
      const viewHalf = map.getSize().multiplyBy(0.5 + PAD);
      const topLeft = viewHalf.multiplyBy(-scale).add(map.project(this._center, e.zoom)).subtract(map._getNewPixelOrigin(e.center, e.zoom));
      L.DomUtil.setTransform(this._canvas, topLeft, scale);
    },
    _reset() {
      const map = this._map;
      if (!map) return;
      const size = map.getSize();
      const pad = (this._pad = size.multiplyBy(PAD).round());
      const W = size.x + pad.x * 2, H = size.y + pad.y * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = this._canvas;
      L.DomUtil.setPosition(c, map.containerPointToLayerPoint([-pad.x, -pad.y]));
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
        c.style.width = W + "px";
        c.style.height = H + "px";
      }
      this._dpr = dpr;
      this._W = W; this._H = H;
      this._center = map.getCenter();
      this._zoom = map.getZoom();
      this._redraw();
    },
    _redraw() {
      const map = this._map;
      if (!map || !this._canvas || !this._pad) return;
      const ctx = this._canvas.getContext("2d");
      const dpr = this._dpr || 1;
      const pad = this._pad;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this._W, this._H);
      const z = map.getZoom();
      const k = Math.pow(2, z);
      const o = map.getPixelBounds().min;
      const ox = o.x - pad.x, oy = o.y - pad.y;
      const r = radioPorZoom(z);
      const rows = this._rows;
      const n = rows.length;
      const W = this._W + 30, H = this._H + 30;
      // 1) proyectar y quedarnos con lo visible
      const vis = [];
      for (let i = 0; i < n; i++) {
        const u = rows[i];
        const x = u._px * k - ox, y = u._py * k - oy;
        if (x < -30 || y < -30 || x > W || y > H) continue;
        vis.push(i, x, y);
      }
      // 2) agrupar en celdas de pantalla si hay muchos puntos y el zoom es bajo
      const agrupar = z < ZOOM_SIN_GRUPOS && vis.length / 3 > 60;
      const puntos = []; // [i, x, y]
      const grupos = []; // {x, y, n, r, s, w, nN, e, nivel:[3], rows:[]}
      if (agrupar) {
        const cel = TAM_CELDA;
        const celdas = new Map();
        for (let j = 0; j < vis.length; j += 3) {
          const i = vis[j], x = vis[j + 1], y = vis[j + 2];
          const key = Math.floor(x / cel) * 100000 + Math.floor(y / cel);
          let c = celdas.get(key);
          if (!c) celdas.set(key, (c = { sx: 0, sy: 0, n: 0, idx: [] }));
          c.sx += x; c.sy += y; c.n++; c.idx.push(i);
        }
        for (const c of celdas.values()) {
          if (c.n < 3) { for (const i of c.idx) puntos.push(i, rows[i]._px * k - ox, rows[i]._py * k - oy); continue; }
          let s = 90, w = 180, nN = -90, e = -180;
          const nivel = [0, 0, 0];
          for (const i of c.idx) {
            const u = rows[i];
            nivel[u._nv]++;
            if (u.LATITUD < s) s = u.LATITUD; if (u.LATITUD > nN) nN = u.LATITUD;
            if (u.LONGITUD < w) w = u.LONGITUD; if (u.LONGITUD > e) e = u.LONGITUD;
          }
          grupos.push({ x: c.sx / c.n, y: c.sy / c.n, n: c.n, r: Math.min(22, 10 + 2.4 * Math.log2(c.n)), s, w, nN, e, nivel, idx: c.idx });
        }
      } else {
        for (let j = 0; j < vis.length; j += 3) puntos.push(vis[j], vis[j + 1], vis[j + 2]);
      }
      this._puntos = puntos;
      this._grupos = grupos;
      this._r = r;
      // 3) puntos sueltos: forma y color por nivel (primer → tercer, el más alto queda encima);
      //    coordenadas genéricas: la misma forma, sin relleno
      const borde = z >= 7;
      const porNivel = [[], [], []], genericas = [[], [], []];
      for (let j = 0; j < puntos.length; j += 3) {
        const u = rows[puntos[j]];
        (u._calidad === 2 ? genericas : porNivel)[u._nv].push(puntos[j + 1], puntos[j + 2]);
      }
      for (let nv = 0; nv < 3; nv++) {
        const g = porNivel[nv];
        const rn = nv === 0 ? r : r * 1.12;
        if (g.length) {
          ctx.beginPath();
          for (let j = 0; j < g.length; j += 2) trazarForma(ctx, nv, g[j], g[j + 1], rn);
          ctx.fillStyle = NIVEL_COLOR[NIVELES[nv]];
          ctx.fill();
          if (borde) { ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.stroke(); }
        }
        const h = genericas[nv];
        if (h.length) {
          ctx.beginPath();
          for (let j = 0; j < h.length; j += 2) trazarForma(ctx, nv, h[j], h[j + 1], Math.max(rn, 2.8));
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = NIVEL_COLOR[NIVELES[nv]];
          ctx.stroke();
        }
      }
      // 4) grupos: número al centro y anillo con la proporción de cada nivel; un rombo guinda avisa que hay tercer nivel
      if (grupos.length) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const g of grupos) {
          ctx.beginPath();
          ctx.arc(g.x, g.y, g.r + 1.5, 0, 6.2832);
          ctx.fillStyle = "#fff";
          ctx.shadowColor = "rgba(40,20,25,0.35)";
          ctx.shadowBlur = 5;
          ctx.fill();
          ctx.shadowBlur = 0;
          let ang = -Math.PI / 2;
          ctx.lineWidth = 5;
          for (let nv = 0; nv < 3; nv++) {
            if (!g.nivel[nv]) continue;
            const da = (g.nivel[nv] / g.n) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(g.x, g.y, g.r - 2.5, ang, ang + Math.max(da, 0.12));
            ctx.strokeStyle = NIVEL_COLOR[NIVELES[nv]];
            ctx.stroke();
            ang += da;
          }
          ctx.fillStyle = "#2b2023";
          ctx.font = `700 ${g.n >= 1000 ? 10.5 : 11.5}px Montserrat, system-ui, sans-serif`;
          ctx.fillText(g.n >= 1000 ? `${(g.n / 1000).toFixed(g.n >= 10000 ? 0 : 1)}k` : String(g.n), g.x, g.y + 0.5);
          if (g.nivel[2]) {
            const bx = g.x + g.r * 0.72, by = g.y - g.r * 0.72;
            ctx.beginPath();
            trazarForma(ctx, 2, bx, by, 4.2);
            ctx.fillStyle = NIVEL_COLOR["TERCER NIVEL"];
            ctx.fill();
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = "#fff";
            ctx.stroke();
          }
        }
      }
    },
    // Devuelve {tipo:"grupo", g} o {tipo:"punto", u} bajo el punto de pantalla (o null)
    hit(cp, tol) {
      if (!this._pad) return null;
      const px = cp.x + this._pad.x, py = cp.y + this._pad.y;
      for (const g of this._grupos || []) {
        const dx = g.x - px, dy = g.y - py;
        if (dx * dx + dy * dy <= (g.r + tol) * (g.r + tol)) return { tipo: "grupo", g, rows: g.idx.map((i) => this._rows[i]) };
      }
      const t = (this._r || 3) + tol;
      let best = null, bd = t * t;
      const p = this._puntos || [];
      for (let j = 0; j < p.length; j += 3) {
        const dx = p[j + 1] - px, dy = p[j + 2] - py;
        const d = dx * dx + dy * dy;
        if (d <= bd) { bd = d; best = this._rows[p[j]]; }
      }
      return best ? { tipo: "punto", u: best } : null;
    },
  });
}

function MapaClues({ L, filtrados, nearest, userPos, distancias, focus, pickMode, onPick, entidades = [], municipios = [], onTilesStatus, tilesOk, onDetalle, onMapReady, onLocate, ampliado, onAmpliar, onPopup, sombra, puntosZona = [], geoKey = "", onVista, visible = true }) {
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

/* ------------------------------------------------------------------ */
/* 4. COMPONENTES DE UI                                                */
/* ------------------------------------------------------------------ */
const resumenSel = (arr, plural) => (!arr.length ? "" : arr.length <= 2 ? arr.join(", ") : `${arr.length} ${plural}`);

/* Selector de opción múltiple con búsqueda, "seleccionar todo" y etiquetas removibles */
function MultiSelect({ label, options, selected, onChange, placeholder, buscar = false }) {
  const [abierto, setAbierto] = useState(false);
  const [txt, setTxt] = useState("");
  const ref = useRef(null);
  const sel = useMemo(() => new Set(selected), [selected]);
  const porValor = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    const esc = (e) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);
  const f = fold(txt.trim());
  const visibles = useMemo(() => (f ? options.filter((o) => fold(`${o.label} ${o.sub || ""}`).includes(f)) : options), [options, f]);
  const MAX = 300;
  const toggle = (v) => onChange(sel.has(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const resumen = !selected.length ? placeholder : selected.length === 1 ? porValor.get(selected[0])?.label || selected[0] : `${selected.length} seleccionados`;
  return (
    <div className="relative block" ref={ref}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">{label}</span>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white/95 px-3 py-2.5 text-left text-sm font-medium shadow-sm outline-none transition ${abierto ? "border-dorado ring-2 ring-dorado/60" : "border-white/15"} ${selected.length ? "text-neutral-900" : "text-neutral-500"}`}
      >
        <span className="min-w-0 flex-1 truncate">{resumen}</span>
        {selected.length > 0 && <span className="shrink-0 rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: C.guinda }}>{selected.length}</span>}
        <ChevronDown className={`shrink-0 text-guinda transition ${abierto ? "rotate-180" : ""}`} style={{ width: 16, height: 16 }} />
      </button>
      {abierto && (
        <div className="absolute left-0 z-[1200] mt-1 overflow-hidden rounded-xl bg-white text-neutral-800 shadow-2xl ring-1 ring-black/10" style={{ width: "max(100%, min(380px, calc(100vw - 2rem)))" }}>
          {buscar && (
            <div className="border-b border-neutral-100 p-2">
              <input autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Buscar…" className="w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm outline-none focus:border-dorado" />
            </div>
          )}
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-1.5 text-xs">
            <button type="button" onClick={() => onChange([...new Set([...selected, ...visibles.slice(0, MAX).map((o) => o.value)])])} className="font-semibold text-guinda hover:underline">
              Seleccionar {f ? "visibles" : "todo"}
            </button>
            <button type="button" onClick={() => onChange([])} className="font-semibold text-neutral-500 hover:underline" disabled={!selected.length}>Quitar selección</button>
          </div>
          <ul className="overflow-y-auto overscroll-contain py-1" style={{ maxHeight: "min(320px, 55vh)" }} role="listbox" aria-multiselectable="true">
            {visibles.slice(0, MAX).map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm hover:bg-dorado/10">
                  <input type="checkbox" checked={sel.has(o.value)} onChange={() => toggle(o.value)} className="mt-0.5 shrink-0" style={{ accentColor: C.guinda, width: 16, height: 16 }} />
                  <span className="min-w-0 flex-1 leading-snug" style={{ overflowWrap: "anywhere" }}>
                    {o.label}
                    {o.sub && <span className="mt-0.5 block text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">{o.sub}</span>}
                  </span>
                </label>
              </li>
            ))}
            {!visibles.length && <li className="px-3 py-3 text-xs text-neutral-500">Sin coincidencias.</li>}
            {visibles.length > MAX && <li className="px-3 py-2 text-[11px] text-neutral-500">Se muestran {MAX} de {fmtN(visibles.length)}. Escribe para acotar.</li>}
          </ul>
          <div className="border-t border-neutral-100 p-2 text-right">
            <button type="button" onClick={() => setAbierto(false)} className="rounded-md px-3 py-1 text-xs font-bold text-white" style={{ background: C.guinda }}>Listo</button>
          </div>
        </div>
      )}
      {selected.length > 1 && selected.length <= 8 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map((v) => (
            <button key={v} type="button" onClick={() => toggle(v)} className="flex max-w-full items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white hover:bg-white/25" title="Quitar">
              <span className="truncate">{porValor.get(v)?.label || v}</span> <X style={{ width: 11, height: 11 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectFiltro({ label, value, onChange, options, todos, fmt = (o) => o }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-lg border border-white/15 bg-white/95 bg-[length:16px] bg-[right_10px_center] bg-no-repeat px-3 py-2.5 pr-9 text-sm font-medium text-neutral-800 shadow-sm outline-none transition focus:border-dorado focus:ring-2 focus:ring-dorado/60"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239F2241' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
      >
        <option value="">{todos}</option>
        {options.map((o) => (
          <option key={o} value={o}>{fmt(o)}</option>
        ))}
      </select>
    </label>
  );
}

function KpiCard({ Icon, titulo, valor, detalle, color }) {
  return (
    <div className="rounded-2xl bg-white px-3 pb-3 pt-3.5 text-center shadow-[0_6px_24px_-8px_rgba(60,20,35,0.18)] sm:px-5 sm:pb-4 sm:pt-5">
      <Icon className="mx-auto hidden h-8 w-8 text-dorado sm:block" style={{ width: 32, height: 32 }} strokeWidth={1.4} />
      <p className="flex items-center justify-center gap-1.5 border-b border-neutral-200 pb-1.5 text-[13px] font-medium text-guinda sm:mt-2 sm:text-[15px]">
        {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
        {titulo}
      </p>
      <p className="mt-1.5 border-b-2 border-dorado pb-1 text-xl font-semibold tabular-nums text-neutral-800 sm:mt-2 sm:text-2xl">{valor}</p>
      <p className="mt-1 text-[11px] text-neutral-500 sm:text-xs">{detalle}</p>
    </div>
  );
}

function UnidadCard({ u, activa, distancia, onClick }) {
  const sinCoord = u.LATITUD == null;
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-start gap-3 rounded-xl border bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:p-3.5 ${
        activa ? "border-dorado ring-2 ring-dorado/40" : "border-neutral-200/80"
      }`}
    >
      <InstBadge nombre={u["NOMBRE DE LA INSTITUCION"]} size={46} activa={activa} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-dorado/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-guindaDark">{u.CLUES}</span>
          <InstChip nombre={u["NOMBRE DE LA INSTITUCION"]} />
          {distancia != null && <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-guinda">{fmtKm(distancia)}</span>}
          {sinCoord && <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px]" style={{ color: CALIDAD[u._calidad].c }}><MapPinOff style={{ width: 14, height: 14 }} /> {u._calidad === 4 ? "Fuera de entidad" : "Sin coord."}</span>}
        </span>
        <span className="mt-1 block text-sm font-semibold leading-snug text-neutral-800 group-hover:text-guinda">{titleCase(u["NOMBRE DE LA UNIDAD"])}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">
          {titleCase(u.MUNICIPIO)}, {titleCase(u.ENTIDAD)} · <span className="inline-flex items-center gap-1 font-medium text-neutral-700"><NivelIcono nivel={u["NIVEL ATENCION"]} size={11} />{titleCase(u["NIVEL ATENCION"])}</span>
        </span>
        {(u._calidad === 1 || u._calidad === 2 || u._calidad === 6) && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: CALIDAD[u._calidad].c }}>
            <AlertTriangle style={{ width: 12, height: 12 }} /> Ubicación por revisar: {CALIDAD[u._calidad].t.toLowerCase()}
          </span>
        )}
      </span>
      <ChevronRight className="mt-3 shrink-0 text-neutral-300 group-hover:text-guinda" style={{ width: 18, height: 18 }} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 4b. FICHA DE LA UNIDAD (ventana emergente con pestañas)              */
/* ------------------------------------------------------------------ */
function Dato({ label, children }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-neutral-100 py-2 text-sm last:border-0 sm:grid-cols-[160px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-neutral-800">{children}</dd>
    </div>
  );
}

function FichaUnidad({ u, userPos, km, esCercana, onClose, onVerMapa }) {
  const [tab, setTab] = useState("general");
  const [det, setDet] = useState(null);
  const [err, setErr] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    setTab("general");
    setDet(null);
    cargarDetalles().then((pk) => vivo && setDet(detalleDe(pk, u._i))).catch((e) => vivo && setErr(String(e?.message || e)));
    return () => { vivo = false; };
  }, [u]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const { sigla } = instInfo(u["NOMBRE DE LA INSTITUCION"]);
  const color = instColor(sigla);
  const conCoord = u.LATITUD != null;
  const abierto = det ? abiertoAhora(det.horario) : null;
  const tabs = [
    ["general", "General"],
    ["ubicacion", "Ubicación"],
    ["horario", "Horario"],
    ["servicios", `Servicios${det?.servicios.length ? ` (${det.servicios.length})` : ""}`],
  ];
  const copiar = async () => {
    try { await navigator.clipboard.writeText(u.CLUES); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch { /* sin portapapeles */ }
  };
  const direccion = det && [
    [det.tipoVialidad, det.vialidad && titleCase(det.vialidad)].filter(Boolean).join(" ") + (det.numExt && !/^S\/?N|SIN N/i.test(det.numExt) ? ` ${det.numExt}` : det.numExt ? " s/n" : "") + (det.numInt ? `, int. ${det.numInt}` : ""),
    [det.tipoAsentamiento && titleCase(det.tipoAsentamiento), det.asentamiento && titleCase(det.asentamiento)].filter(Boolean).join(" "),
    det.cp ? `C.P. ${det.cp}` : "",
    [titleCase(det.localidad || ""), titleCase(u.MUNICIPIO), titleCase(u.ENTIDAD)].filter(Boolean).join(", "),
  ].filter((x) => x && x.trim());
  const hoy = new Date().getDay();
  const ordenDias = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Ficha de ${u["NOMBRE DE LA UNIDAD"]}`}>
      <div className="clues-fade absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="clues-sheet relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        {/* Encabezado */}
        <div className="relative px-4 pb-3 pt-4 text-white sm:px-6 sm:pt-5" style={{ background: `linear-gradient(135deg, ${C.guindaDark}, ${C.guinda})` }}>
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/40 sm:hidden" />
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Cerrar">
            <X style={{ width: 20, height: 20 }} />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <span className="rounded-xl bg-white p-1"><InstBadge nombre={u["NOMBRE DE LA INSTITUCION"]} size={LOGOS[sigla] ? 72 : 46} /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={copiar} title="Copiar CLUES" className="flex items-center gap-1 rounded bg-white/15 px-1.5 py-0.5 font-mono text-xs font-bold text-white hover:bg-white/25">
                  {u.CLUES} {copiado ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                </button>
                <span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ background: C.dorado }}>{sigla}</span>
                {esCercana && <span className="rounded bg-white px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-guinda">★ Más cercana</span>}
              </div>
              <h3 className="mt-1.5 text-base font-bold leading-snug sm:text-lg">{titleCase(u["NOMBRE DE LA UNIDAD"])}</h3>
              <p className="text-xs text-white/80 sm:text-sm">{titleCase(u["NOMBRE DE LA INSTITUCION"])}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/85">
            <span className="flex items-center gap-1"><Layers style={{ width: 13, height: 13 }} /> {titleCase(u["NIVEL ATENCION"])}</span>
            <span className="flex items-center gap-1"><MapPin style={{ width: 13, height: 13 }} /> {titleCase(u.MUNICIPIO)}, {titleCase(u.ENTIDAD)}</span>
            {km != null && <span className="flex items-center gap-1 font-semibold text-white"><Navigation style={{ width: 13, height: 13 }} /> {fmtKm(km)}</span>}
            {abierto != null && (
              <span className="flex items-center gap-1 font-semibold" style={{ color: abierto ? "#bbf7d0" : "#fecaca" }}>
                <Clock style={{ width: 13, height: 13 }} /> {abierto ? "Abierto ahora" : "Cerrado ahora"}
              </span>
            )}
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-2 sm:px-4" role="tablist">
          {tabs.map(([k, t]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${tab === k ? "border-dorado text-guinda" : "border-transparent text-neutral-500 hover:text-guinda"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="min-h-[220px] flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          {err ? (
            <p className="flex items-center gap-2 text-sm text-guinda"><AlertTriangle style={{ width: 16, height: 16 }} /> No fue posible leer los detalles: {err}</p>
          ) : !det ? (
            <p className="flex items-center gap-2 py-8 text-sm text-neutral-500"><Loader2 className="animate-spin text-dorado" style={{ width: 16, height: 16 }} /> Cargando ficha…</p>
          ) : tab === "general" ? (
            <dl>
              <Dato label="Institución">{titleCase(u["NOMBRE DE LA INSTITUCION"])}</Dato>
              <Dato label="Administra">{det.institucionAdm && fold(det.institucionAdm) !== fold(u["NOMBRE DE LA INSTITUCION"]) ? titleCase(det.institucionAdm) : ""}</Dato>
              <Dato label="Tipo">{titleCase(u["NOMBRE TIPO ESTABLECIMIENTO"])}</Dato>
              <Dato label="Tipología">{det.tipologia && titleCase(det.tipologia)}</Dato>
              <Dato label="Subtipología">{det.subtipologia && titleCase(det.subtipologia)}</Dato>
              <Dato label="Nivel de atención"><span className="inline-flex items-center gap-1.5 font-semibold"><NivelIcono nivel={u["NIVEL ATENCION"]} size={13} />{titleCase(u["NIVEL ATENCION"])}</span></Dato>
              <Dato label="Estrato">{det.estrato && titleCase(det.estrato)}</Dato>
              <Dato label="Jurisdicción">{det.jurisdiccion && titleCase(det.jurisdiccion)}</Dato>
              <Dato label="Inicio de operación">{det.inicioOperacion}</Dato>
              <Dato label="Teléfono">
                {det.telefono && (
                  <a href={`tel:${det.telefono}`} className="font-semibold text-guinda underline decoration-dorado underline-offset-2">
                    {det.telefono.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, "$1 $2 $3")}{det.extension ? ` ext. ${det.extension}` : ""}
                  </a>
                )}
              </Dato>
            </dl>
          ) : tab === "ubicacion" ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-fondo p-3.5 text-sm leading-relaxed text-neutral-800">
                {direccion.length ? direccion.map((l, i) => <p key={i} className={i === 0 ? "font-semibold" : ""}>{l}</p>) : <p className="text-neutral-500">Sin domicilio registrado.</p>}
              </div>
              <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: CALIDAD[u._calidad].c + "55", background: CALIDAD[u._calidad].c + "0d", color: CALIDAD[u._calidad].c }}>
                {u._calidad === 0 ? <ShieldCheck className="mt-px shrink-0" style={{ width: 16, height: 16 }} /> : <AlertTriangle className="mt-px shrink-0" style={{ width: 16, height: 16 }} />}
                <div>
                  <p className="font-bold">Ubicación: {CALIDAD[u._calidad].t}</p>
                  <p className="text-neutral-700">
                    {CALIDAD[u._calidad].d}
                    {u._calidad === 6 && ` La coordenada cae en ${u._cae >= 0 ? titleCase(ENT_NOMBRES[u._cae]) : "—"}, igual que su código postal; probablemente la entidad registrada (${titleCase(u.ENTIDAD)}) es la incorrecta.`}
                    {u._calidad === 4 && ` La coordenada registrada (${u._latReg?.toFixed(5)}, ${u._lngReg?.toFixed(5)}) cae en ${u._cae >= 0 ? titleCase(ENT_NOMBRES[u._cae]) : "un punto fuera de México"}, no en ${titleCase(u.ENTIDAD)}. No se muestra en el mapa ni se usa para buscar la unidad más cercana.`}
                    {u._calidad === 2 && " Se muestra en el mapa con un anillo, pero no se usa para buscar la unidad más cercana."}
                    {u._calidad === 0 && " Validada contra el Marco Geoestadístico INEGI 2025."}
                  </p>
                </div>
              </div>
              <dl>
                <Dato label="Coordenadas">{conCoord ? `${u.LATITUD.toFixed(5)}, ${u.LONGITUD.toFixed(5)}` : u._latReg != null ? `${u._latReg.toFixed(5)}, ${u._lngReg.toFixed(5)} (no confiable)` : "Sin coordenadas registradas"}</Dato>
                <Dato label="Distancia">{km != null ? `${fmtKm(km)} en línea recta` : ""}</Dato>
              </dl>
              {conCoord && (
                <a href={urlVerEnMaps(u)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-guinda underline decoration-dorado underline-offset-2">
                  <ExternalLink style={{ width: 14, height: 14 }} /> Abrir el punto en Google Maps
                </a>
              )}
            </div>
          ) : tab === "horario" ? (
            det.horario ? (
              <div className="overflow-hidden rounded-xl border border-neutral-200">
                {ordenDias.map((d) => (
                  <div key={d} className={`flex items-center justify-between px-4 py-2.5 text-sm ${d === hoy ? "bg-dorado/10 font-semibold" : "odd:bg-neutral-50"}`}>
                    <span className="flex items-center gap-2">{DIAS[d]} {d === hoy && <span className="rounded bg-dorado px-1.5 text-[10px] font-bold uppercase text-white">Hoy</span>}</span>
                    <span className={det.horario[d].length ? "tabular-nums text-neutral-800" : "text-neutral-400"}>
                      {det.horario[d].length ? det.horario[d].map(rango).join(" · ") : "Cerrado"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-sm text-neutral-500">Esta unidad no tiene horario registrado en el catálogo.</p>
            )
          ) : det.servicios.length ? (
            <div className="space-y-3">
              {Object.entries(det.servicios.reduce((acc, x) => ((acc[x.area] ??= []).push(x), acc), {})).map(([area, xs]) => (
                <div key={area}>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-dorado">{titleCase(area)}</p>
                  <ul className="space-y-1.5">
                    {xs.map((x, i) => (
                      <li key={i} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                        <p className="font-semibold text-neutral-800">{titleCase(x.servicio)}</p>
                        {x.horario && <p className="text-xs text-neutral-500">{x.horario}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-sm text-neutral-500">No hay servicios especiales registrados (hoja SUBCLUES) para esta unidad.</p>
          )}
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 bg-white p-3 sm:flex sm:justify-end sm:px-6" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          {conCoord && (
            <button onClick={onVerMapa} className="flex items-center justify-center gap-1.5 rounded-xl border border-guinda/30 px-4 py-2.5 text-sm font-semibold text-guinda hover:bg-guinda/5">
              <MapIcon style={{ width: 16, height: 16 }} /> Ver en el mapa
            </button>
          )}
          {conCoord ? (
            <a
              href={urlComoLlegar(u, userPos)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-105"
              style={{ background: C.dorado }}
            >
              <Route style={{ width: 16, height: 16 }} /> Cómo llegar
              <ExternalLink style={{ width: 13, height: 13 }} className="opacity-80" />
            </a>
          ) : (
            <span className="col-span-2 text-center text-xs text-neutral-500">Sin ubicación confiable: no es posible trazar la ruta.</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4c. CATÁLOGO: revisión del archivo vigente y carga de uno nuevo      */
/* ------------------------------------------------------------------ */
const PASOS_CATALOGO = ["Leer el archivo", "Revisar estructura", "Validar coordenadas (INEGI)", "Preparar catálogo", "Comparar con el actual"];

function CatalogoPanel({ catalogo, data, onAplicar, onVolverPublicado, onClose }) {
  const [estado, setEstado] = useState("inicio"); // inicio | procesando | revision | error | aplicado
  const [paso, setPaso] = useState({ n: 0, texto: "" });
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [tab, setTab] = useState("altas");
  const [msg, setMsg] = useState("");
  const inputRef = useRef(null);
  const workerRef = useRef(null);
  const t0 = useRef(0);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && estado !== "procesando" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; workerRef.current?.terminate(); };
  }, [onClose, estado]);

  const actual = useMemo(() => {
    const q = [0, 0, 0, 0, 0, 0, 0], nv = [0, 0, 0];
    for (const u of data) { q[u._calidad]++; nv[u._nv]++; }
    return { q, nv };
  }, [data]);

  const procesar = async (file) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { setEstado("error"); setError("El archivo debe ser el catálogo en Excel (.xlsx), por ejemplo ESTABLECIMIENTO_SALUD_202612.xlsx."); return; }
    setEstado("procesando");
    setError("");
    setPaso({ n: 1, texto: "Leyendo el archivo…" });
    t0.current = Date.now();
    try {
      const [buf, geo] = await Promise.all([file.arrayBuffer(), geometriaParaValidar()]);
      const P = _packActual;
      const actualMin = {
        cl: P.C[0], nom: P.C[1], inst: P.C[2].map((i) => P.I[i]), ent: P.C[3].map((m) => P.E[P.M[m][0]]), mun: P.C[3].map((m) => P.M[m][1]),
        niv: P.C[4], la: P.C[6], lo: P.C[7],
      };
      const w = await crearWorkerCatalogo();
      workerRef.current = w;
      w.onmessage = (ev) => {
        const m = ev.data;
        if (m.tipo === "paso") setPaso({ n: m.n, texto: m.texto });
        else if (m.tipo === "error") { setEstado("error"); setError(m.texto); w.terminate(); }
        else if (m.tipo === "listo") { setRes({ ...m, segundos: Math.round((Date.now() - t0.current) / 1000) }); setEstado("revision"); setTab(m.reporte.cambios.length ? "cambios" : m.reporte.altas.length ? "altas" : "bajas"); w.terminate(); }
      };
      w.onerror = (e) => { setEstado("error"); setError(`No fue posible procesar el archivo (${e.message || "error del lector de Excel"}). Si estás sin internet en la versión de Claude, vuelve a intentarlo con conexión.`); };
      w.postMessage({ buf, nombre: file.name, geo, entNombres: ENT_NOMBRES, actual: actualMin }, [buf]);
    } catch (e) {
      setEstado("error");
      setError(String(e?.message || e));
    }
  };

  const descargarReporte = async () => {
    const { altas, bajas, cambios } = res.reporte;
    const filas = [["MOVIMIENTO", "CLUES", "UNIDAD", "INSTITUCION", "ENTIDAD", "MUNICIPIO", "NIVEL", "CAMPO", "ANTES", "AHORA"].join(",")];
    const base = (x) => [x.clues, x.unidad, x.inst, x.ent, x.mun, x.nivel];
    altas.forEach((x) => filas.push(["ALTA", ...base(x), "", "", ""].map(csvCelda).join(",")));
    bajas.forEach((x) => filas.push(["BAJA", ...base(x), "", "", ""].map(csvCelda).join(",")));
    cambios.forEach((x) => x.dif.forEach(([campo, antes, ahora]) => filas.push(["CAMBIO", ...base(x), campo, antes, ahora].map(csvCelda).join(","))));
    const r = await guardarArchivo(`Cambios_CLUES_${catalogo.corte || "actual"}_a_${res.meta.corte || "nuevo"}.csv`, "﻿" + filas.join("\r\n"));
    setMsg(r === "cancelado" ? "Descarga cancelada." : "Reporte de cambios descargado.");
  };

  const aplicar = async () => {
    const guardado = await onAplicar(res);
    setEstado("aplicado");
    setMsg(guardado ? "" : "Se aplicó, pero este navegador no permitió guardarlo: al recargar volverá el catálogo publicado.");
  };

  const BarraCalidad = ({ q, total }) => (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
        {[0, 3, 1, 6, 2, 4, 5].map((k) => (q[k] ? <span key={k} style={{ width: `${(q[k] / total) * 100}%`, background: CALIDAD[k].c }} title={`${CALIDAD[k].t}: ${fmtN(q[k])}`} /> : null))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-600">
        {[0, 3, 1, 6, 2, 4, 5].map((k) => (q[k] ? <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: CALIDAD[k].c }} />{CALIDAD[k].t}: <b className="tabular-nums">{fmtN(q[k])}</b></span> : null))}
      </div>
    </div>
  );
  const Lista = ({ items, render }) => (
    <div className="max-h-64 overflow-y-auto rounded-xl border border-neutral-200">
      {items.length ? (
        <ul className="divide-y divide-neutral-100">
          {items.slice(0, 150).map((x) => (
            <li key={x.clues} className="px-3 py-2 text-xs">
              <p className="flex items-center gap-2"><span className="rounded bg-dorado/15 px-1 font-mono text-[11px] font-semibold text-guindaDark">{x.clues}</span><span className="font-semibold text-neutral-800">{titleCase(x.unidad)}</span></p>
              <p className="mt-0.5 text-neutral-500">{instInfo(x.inst).sigla} · {titleCase(x.mun)}, {titleCase(x.ent)} · {x.nivel}</p>
              {render?.(x)}
            </li>
          ))}
          {items.length > 150 && <li className="px-3 py-2 text-[11px] text-neutral-500">y {fmtN(items.length - 150)} más en el reporte descargable.</li>}
        </ul>
      ) : (
        <p className="px-3 py-6 text-center text-xs text-neutral-500">Sin movimientos de este tipo.</p>
      )}
    </div>
  );

  const R = res?.reporte;
  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Catálogo CLUES">
      <div className="clues-fade absolute inset-0 bg-black/45" onClick={() => estado !== "procesando" && onClose()} />
      <div className="clues-sheet relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <div className="relative px-4 pb-4 pt-4 text-white sm:px-6 sm:pt-5" style={{ background: `linear-gradient(135deg, ${C.guindaDark}, ${C.guinda})` }}>
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/40 sm:hidden" />
          {estado !== "procesando" && (
            <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 hover:bg-white/15" aria-label="Cerrar"><X style={{ width: 20, height: 20 }} /></button>
          )}
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70"><Database style={{ width: 14, height: 14 }} /> Catálogo CLUES</p>
          <h3 className="mt-1 text-lg font-bold">Revisión y actualización del archivo</h3>
          <p className="text-xs text-white/80">La DGIS publica el catálogo periódicamente. Carga el nuevo archivo para revisar qué cambió antes de usarlo.</p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {/* Catálogo en uso */}
          <section className="rounded-2xl border border-neutral-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-dorado">En uso</p>
                <p className="text-base font-bold text-neutral-900">Corte {catalogo.corte || "—"} · {fmtN(data.length)} unidades</p>
                <p className="text-xs text-neutral-500">
                  {catalogo.archivo}
                  {catalogo.fuente === "navegador" ? ` · cargado en este navegador el ${new Date(catalogo.cargado).toLocaleDateString("es-MX")}` : " · versión publicada"}
                </p>
              </div>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={catalogo.fuente === "navegador" ? { background: "#fef3c7", color: "#92400e" } : { background: "#dcfce7", color: "#166534" }}>
                {catalogo.fuente === "navegador" ? "Solo en este navegador" : "Versión publicada"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              {NIVELES.map((n, i) => (
                <div key={n} className="rounded-lg bg-fondo py-2"><p className="font-bold tabular-nums text-neutral-900">{fmtN(actual.nv[i])}</p><p className="text-neutral-500">{titleCase(n)}</p></div>
              ))}
            </div>
            <div className="mt-3"><BarraCalidad q={actual.q} total={data.length} /></div>
            {catalogo.fuente === "navegador" && (
              <button onClick={onVolverPublicado} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-guinda underline decoration-dorado underline-offset-2">
                <RotateCcw style={{ width: 13, height: 13 }} /> Volver al catálogo publicado
              </button>
            )}
          </section>

          {/* Carga de un archivo nuevo */}
          {(estado === "inicio" || estado === "error") && (
            <section>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); procesar(e.dataTransfer.files?.[0]); }}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition"
                style={{ borderColor: arrastrando ? C.guinda : "#d6c7b4", background: arrastrando ? "#fbf3ef" : "#fcfaf7" }}
              >
                <span className="grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: C.dorado }}><UploadCloud style={{ width: 24, height: 24 }} /></span>
                <span className="text-sm font-bold text-neutral-900">{arrastrando ? "Suelta el archivo aquí" : "Arrastra aquí el catálogo nuevo o haz clic para elegirlo"}</span>
                <span className="text-xs text-neutral-500">ESTABLECIMIENTO_SALUD_AAAAMM.xlsx · descárgalo de la DGIS</span>
              </button>
              <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { procesar(e.target.files?.[0]); e.target.value = ""; }} />
              {estado === "error" && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-800"><AlertTriangle className="mt-px shrink-0" style={{ width: 15, height: 15 }} /> {error}</p>
              )}
              <p className="mt-3 text-[11px] leading-snug text-neutral-500">
                El archivo se procesa en tu dispositivo; no se envía a ningún servidor. Tarda de 15 a 40 segundos (más en celular).
              </p>
            </section>
          )}

          {/* Progreso */}
          {estado === "procesando" && (
            <section className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-bold text-neutral-900">Procesando el archivo…</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(paso.n / PASOS_CATALOGO.length) * 100}%`, background: C.dorado }} /></div>
              <ol className="mt-3 space-y-1.5 text-xs">
                {PASOS_CATALOGO.map((p, i) => (
                  <li key={p} className="flex items-center gap-2" style={{ color: i + 1 < paso.n ? "#15803d" : i + 1 === paso.n ? C.guinda : "#a3a3a3" }}>
                    {i + 1 < paso.n ? <Check style={{ width: 14, height: 14 }} /> : i + 1 === paso.n ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> : <span className="inline-block h-3.5 w-3.5 rounded-full border border-current" />}
                    <span className={i + 1 === paso.n ? "font-semibold" : ""}>{i + 1 === paso.n ? paso.texto : p}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Revisión del archivo nuevo */}
          {(estado === "revision" || estado === "aplicado") && res && (
            <section className="space-y-3">
              <div className="rounded-2xl border-2 p-4" style={{ borderColor: C.dorado }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-dorado">Archivo nuevo</p>
                    <p className="text-base font-bold text-neutral-900">Corte {res.meta.corte || "sin fecha en el nombre"} · {fmtN(res.meta.total)} unidades</p>
                    <p className="text-xs text-neutral-500">{res.meta.archivo} · procesado en {res.segundos} s</p>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800"><Check style={{ width: 12, height: 12 }} /> Estructura válida</span>
                </div>
                <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-600">
                  <li>Hojas: {res.meta.hojas.clues}{res.meta.hojas.horarios ? `, ${res.meta.hojas.horarios}` : " (sin horarios)"}{res.meta.hojas.subclues ? `, ${res.meta.hojas.subclues}` : " (sin servicios)"}</li>
                  <li>{fmtN(res.meta.filasHoja)} registros en el archivo; {fmtN(res.meta.total)} en operación de primer, segundo o tercer nivel.</li>
                  {res.meta.faltanOpc.length > 0 && <li className="text-amber-700">Columnas opcionales ausentes (la ficha mostrará menos datos): {res.meta.faltanOpc.join(", ")}.</li>}
                  {res.meta.corte && catalogo.corte && res.meta.corte <= catalogo.corte && <li className="font-semibold text-amber-700">El corte del archivo no es más reciente que el catálogo en uso.</li>}
                </ul>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  {NIVELES.map((n, i) => {
                    const d = res.meta.niveles[i] - actual.nv[i];
                    return (
                      <div key={n} className="rounded-lg bg-fondo py-2">
                        <p className="font-bold tabular-nums text-neutral-900">{fmtN(res.meta.niveles[i])}</p>
                        <p className="text-neutral-500">{titleCase(n)}</p>
                        <p className="text-[10.5px] font-semibold tabular-nums" style={{ color: d > 0 ? "#15803d" : d < 0 ? "#b91c1c" : "#a3a3a3" }}>{d > 0 ? `+${fmtN(d)}` : d < 0 ? `−${fmtN(-d)}` : "sin cambio"}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3"><BarraCalidad q={res.meta.calidad} total={res.meta.total} /></div>
              </div>

              <div className="rounded-2xl border border-neutral-200 p-4">
                <p className="text-sm font-bold text-neutral-900">Cambios respecto al catálogo en uso</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[["altas", "Altas", R.altas.length, "#15803d"], ["bajas", "Bajas", R.bajas.length, "#b91c1c"], ["cambios", "Con cambios", R.cambios.length, "#b45309"]].map(([k, t, n, c]) => (
                    <button key={k} onClick={() => setTab(k)} className="rounded-xl border px-2 py-2 text-center transition" style={{ borderColor: tab === k ? c : "#e5e5e5", background: tab === k ? c + "12" : "#fff" }}>
                      <p className="text-lg font-extrabold tabular-nums" style={{ color: c }}>{fmtN(n)}</p>
                      <p className="text-[11px] font-semibold text-neutral-600">{t}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-neutral-500">
                  {tab === "altas" ? "Unidades nuevas en operación (o que cambiaron a un nivel de atención incluido)." : tab === "bajas" ? "Unidades que ya no aparecen en operación (baja, fuera de operación o sin nivel de atención)." : "Unidades con cambios de nombre, institución, municipio, nivel o coordenadas (más de 100 m)."}
                </p>
                <div className="mt-2">
                  <Lista
                    items={R[tab]}
                    render={tab === "cambios" ? (x) => (
                      <ul className="mt-1 space-y-0.5">
                        {x.dif.map(([campo, antes, ahora]) => (
                          <li key={campo} className="text-[11px]"><b className="text-neutral-700">{campo}:</b> <span className="text-red-700 line-through">{antes}</span> → <span className="text-green-700">{ahora}</span></li>
                        ))}
                      </ul>
                    ) : null}
                  />
                </div>
                <button onClick={descargarReporte} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-guinda underline decoration-dorado underline-offset-2">
                  <Download style={{ width: 13, height: 13 }} /> Descargar reporte de cambios (.csv)
                </button>
              </div>
              {msg && <p className="text-xs text-neutral-600">{msg}</p>}
              {estado === "aplicado" && (
                <p className="flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-xs text-green-800">
                  <Check className="mt-px shrink-0" style={{ width: 15, height: 15 }} /> El tablero ya usa el corte {res.meta.corte}. Se guardó en este navegador; para actualizar la versión publicada para tu equipo, comparte el archivo con Claude.
                </p>
              )}
            </section>
          )}
        </div>

        {(estado === "revision" || estado === "aplicado") && (
          <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 bg-white p-3 sm:flex sm:justify-end sm:px-6" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            {estado === "revision" ? (
              <>
                <button onClick={() => { setEstado("inicio"); setRes(null); setMsg(""); }} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">Descartar</button>
                <button onClick={aplicar} className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-105" style={{ background: C.guinda }}>
                  <Check style={{ width: 16, height: 16 }} /> Usar este catálogo
                </button>
              </>
            ) : (
              <button onClick={onClose} className="col-span-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: C.guinda }}>Ver el tablero</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. APP                                                              */
/* ------------------------------------------------------------------ */
export default function App() {
  const { L, status: leafletStatus } = useLeaflet();
  const [data, setData] = useState(null);
  const [dataError, setDataError] = useState("");
  const [catalogo, setCatalogo] = useState(META_PUBLICADO);

  const cargarPublicado = async () => {
    _detallesPromesa = null;
    setData(await cargarBase());
    setCatalogo(META_PUBLICADO);
  };
  useEffect(() => {
    (async () => {
      try {
        const guardado = await idbGet("catalogo");
        if (guardado?.pack && guardado?.det) {
          setData(construirBase(guardado.pack));
          _detallesPromesa = Promise.resolve(guardado.det);
          setCatalogo({ ...guardado.meta, fuente: "navegador" });
        } else await cargarPublicado();
      } catch (e) {
        setDataError(String(e?.message || e));
      }
    })();
    if (!document.querySelector("link[data-clues-font]")) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap";
      l.dataset.cluesFont = "1";
      document.head.appendChild(l);
    }
  }, []);

  const aplicarCatalogo = async ({ pack, det, meta }) => {
    setData(construirBase(pack));
    _detallesPromesa = Promise.resolve(det);
    setCatalogo({ ...meta, fuente: "navegador" });
    try { await idbSet("catalogo", { pack, det, meta }); return true; } catch { return false; }
  };
  const volverPublicado = async () => { await idbDel("catalogo"); setData(null); await cargarPublicado(); };

  if (!data) {
    return (
      <div className="clues-root grid min-h-screen place-items-center bg-fondo">
        <style>{EMBEDDED_CSS}</style>
        <div className="rounded-2xl bg-white px-8 py-7 text-center shadow-lg">
          {dataError ? (
            <p className="flex items-center gap-2 text-sm text-guinda"><AlertTriangle style={{ width: 16, height: 16 }} /> No fue posible leer la base: {dataError}</p>
          ) : (
            <>
              <Loader2 className="mx-auto animate-spin text-dorado" style={{ width: 32, height: 32 }} />
              <p className="mt-3 text-sm font-semibold text-guinda">Cargando catálogo CLUES…</p>
            </>
          )}
        </div>
      </div>
    );
  }
  return (
    <Dashboard
      data={data}
      L={L}
      leafletStatus={leafletStatus}
      catalogo={catalogo}
      onAplicarCatalogo={aplicarCatalogo}
      onVolverPublicado={volverPublicado}
    />
  );
}

function Dashboard({ data, L, leafletStatus, catalogo, onAplicarCatalogo, onVolverPublicado }) {
  // Filtros de selección múltiple (arreglos vacíos = sin filtro)
  const [selEnt, setSelEnt] = useState([]);
  const [selMun, setSelMun] = useState([]); // claves "ENTIDAD||MUNICIPIO"
  const [selInst, setSelInst] = useState([]);
  const [selNiv, setSelNiv] = useState([]);
  const [selCal, setSelCal] = useState([]);
  const [texto, setTexto] = useState("");
  const [cp, setCp] = useState("");
  const [cpMsg, setCpMsg] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(fold(texto.trim())), 250); return () => clearTimeout(t); }, [texto]);

  const [geo, setGeo] = useState({ status: "idle", msg: "" });
  const [userPos, setUserPos] = useState(null);
  const [pickMode, setPickMode] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [ampliado, setAmpliado] = useState(false);
  const [avisoCalles, setAvisoCalles] = useState(true);
  const [sombra, setSombra] = useState(() => {
    const def = { activa: true, color: "#1f2937", opacidad: 0.4 };
    try { return { ...def, ...JSON.parse(localStorage.getItem("clues-sombra") || "{}") }; } catch { return def; }
  });
  useEffect(() => { try { localStorage.setItem("clues-sombra", JSON.stringify(sombra)); } catch { /* sin almacenamiento */ } }, [sombra]);
  const [panelSombra, setPanelSombra] = useState(false);
  const [panelCatalogo, setPanelCatalogo] = useState(false);
  const [popupAbierto, setPopupAbierto] = useState(false);
  // Zona del mapa: los puntos se cargan solo al tocar "Ver CLUES en esta zona"
  const [zona, setZona] = useState(null);
  const [vistaMapa, setVistaMapa] = useState(null);
  const zonaAuto = useRef(false);
  const onVista = useCallback((b) => {
    const v = { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() };
    setVistaMapa(v);
    if (zonaAuto.current) { zonaAuto.current = false; setZona(v); setSeguir(true); }
  }, []);
  const resumenRef = useRef(null);
  const listaRef = useRef(null);
  const filtrosRef = useRef(null);
  useEffect(() => {
    if (!ampliado) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && !document.fullscreenElement && setAmpliado(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [ampliado]);
  // Pantalla completa REAL (API Fullscreen) con respaldo CSS donde el navegador no la permite (p. ej. iPhone)
  useEffect(() => {
    const onFs = () => { if (!(document.fullscreenElement || document.webkitFullscreenElement)) setAmpliado(false); };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => { document.removeEventListener("fullscreenchange", onFs); document.removeEventListener("webkitfullscreenchange", onFs); };
  }, []);
  const alternarPantallaCompleta = () => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { /* */ } setAmpliado(false); return; }
    if (ampliado) { setAmpliado(false); return; }
    setAmpliado(true);
    const el = mapaRef.current;
    const req = el && (el.requestFullscreen || el.webkitRequestFullscreen);
    if (req) { try { const p = req.call(el, { navigationUI: "hide" }); p?.catch?.(() => {}); } catch { /* el visor no lo permite: queda el modo ampliado */ } }
  };
  const mapInst = useRef(null);
  const [focus, setFocus] = useState(null);
  const [tilesOk, setTilesOk] = useState(null); // null: aún no se sabe · true: cargó el mapa de calles · false: no disponible
  const [motivoSinCalles, setMotivoSinCalles] = useState("");
  const onTilesStatus = (ok, motivo = "") => { setTilesOk(ok); setMotivoSinCalles(ok ? "" : motivo); };
  const [exportando, setExportando] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [visibles, setVisibles] = useState(PAGE);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(true);
  // Pestañas: resumen · filtros (solo celular) · mapa · lista
  const [vistaSel, setVistaSel] = useState("resumen");
  const irA = (v) => { setVistaSel(v); window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" }); };
  const mapaRef = useRef(null);
  const cercanaRef = useRef(null);
  const esMovil = () => window.matchMedia?.("(max-width: 1023px)").matches;
  const verMapa = () => { if (!document.querySelector("section.fixed")) irA("mapa"); };

  const munKey = (d) => `${d.ENTIDAD}||${d.MUNICIPIO}`;
  const setE = useMemo(() => new Set(selEnt), [selEnt]);
  const setM = useMemo(() => new Set(selMun), [selMun]);
  const setI = useMemo(() => new Set(selInst), [selInst]);
  const setN = useMemo(() => new Set(selNiv), [selNiv]);
  const calidadesSel = useMemo(() => new Set(selCal.flatMap((k) => FILTRO_CALIDAD[k])), [selCal]);

  const optEntidades = useMemo(() => uniqSorted(data.map((d) => d.ENTIDAD)).map((e) => ({ value: e, label: titleCase(e) })), [data]);
  const optMunicipios = useMemo(() => {
    const m = new Map();
    for (const d of data) if (!setE.size || setE.has(d.ENTIDAD)) m.set(munKey(d), d);
    return [...m.entries()]
      .sort((a, b) => a[1].ENTIDAD.localeCompare(b[1].ENTIDAD, "es") || a[1].MUNICIPIO.localeCompare(b[1].MUNICIPIO, "es"))
      .map(([k, d]) => ({ value: k, label: titleCase(d.MUNICIPIO), sub: setE.size === 1 ? "" : titleCase(d.ENTIDAD) }));
  }, [data, setE]);
  const optInstituciones = useMemo(
    () =>
      uniqSorted(data.filter((d) => (!setE.size || setE.has(d.ENTIDAD)) && (!setM.size || setM.has(munKey(d)))).map((d) => d["NOMBRE DE LA INSTITUCION"]))
        .map((i) => ({ value: i, label: titleCase(i), sub: instInfo(i).sigla })),
    [data, setE, setM]
  );
  const optNiveles = NIVELES.map((n) => ({ value: n, label: titleCase(n) }));
  const optCalidad = [
    { value: "verificada", label: "Verificada (INEGI)" },
    { value: "revisar", label: "Por revisar" },
    { value: "excluida", label: "Fuera de entidad / sin coordenadas" },
  ];
  // Depurar selecciones que dejan de existir al cambiar la entidad
  useEffect(() => {
    if (!selMun.length) return;
    const ok = new Set(optMunicipios.map((o) => o.value));
    const keep = selMun.filter((k) => ok.has(k));
    if (keep.length !== selMun.length) setSelMun(keep);
  }, [optMunicipios]); // eslint-disable-line
  useEffect(() => {
    if (!selInst.length) return;
    const ok = new Set(optInstituciones.map((o) => o.value));
    const keep = selInst.filter((k) => ok.has(k));
    if (keep.length !== selInst.length) setSelInst(keep);
  }, [optInstituciones]); // eslint-disable-line

  const filtrados = useMemo(
    () =>
      data.filter(
        (d) =>
          (!setE.size || setE.has(d.ENTIDAD)) &&
          (!setM.size || setM.has(munKey(d))) &&
          (!setI.size || setI.has(d["NOMBRE DE LA INSTITUCION"])) &&
          (!setN.size || setN.has(d["NIVEL ATENCION"])) &&
          (!calidadesSel.size || calidadesSel.has(d._calidad)) &&
          (!q || (d._q ??= fold(`${d.CLUES} ${d["NOMBRE DE LA UNIDAD"]}`)).includes(q))
      ),
    [data, setE, setM, setI, setN, calidadesSel, q]
  );
  useEffect(() => setVisibles(PAGE), [filtrados]);

  // Distancias (Haversine) desde la ubicación del usuario
  const distancias = useMemo(() => {
    const m = new Map();
    if (!userPos) return m;
    for (const u of data) if (u.LATITUD != null) m.set(u.CLUES, haversineKm(userPos.lat, userPos.lng, u.LATITUD, u.LONGITUD));
    return m;
  }, [userPos, data]);
  // La más cercana SIEMPRE se busca dentro de los filtros activos
  const ranking = useMemo(() => {
    if (!userPos) return [];
    // solo unidades con ubicación confiable (verificada, otro municipio de la misma entidad o corregida)
    const universo = filtrados.filter((u) => u._cercana);
    const top = [];
    for (const u of universo) {
      const km = distancias.get(u.CLUES);
      if (top.length < 4 || km < top[top.length - 1].km) {
        top.push({ u, km });
        top.sort((a, b) => a.km - b.km);
        if (top.length > 4) top.pop();
      }
    }
    return top;
  }, [userPos, filtrados, distancias]);
  const nearest = ranking[0] || null;

  useEffect(() => { origenActual = userPos; }, [userPos]);
  const porClues = useMemo(() => new Map(data.map((u) => [u.CLUES, u])), [data]);
  const abrirFicha = (clues) => { const u = typeof clues === "string" ? porClues.get(clues) : clues; if (u) setDetalle(u); };

  useEffect(() => {
    if (nearest) {
      zonaAuto.current = true;
      const bounds = [[userPos.lat, userPos.lng], ...ranking.map((r) => [r.u.LATITUD, r.u.LONGITUD])];
      setFocus({ u: nearest.u, zoom: 15, nearest: true, bounds, n: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearest?.u.CLUES, userPos]);

  const aplicarUbicacion = (lat, lng, fuente, prec = null) => {
    zonaAuto.current = true;
    setUserPos({ lat, lng, fuente, prec });
    setCpMsg("");
    setGeo({ status: "ok", msg: "" });
    setPickMode(false);
    verMapa();
  };
  const ubicacionNoDisponible = (msg) => {
    setGeo({ status: "error", msg });
    setPickMode(true); // alternativa inmediata: marcar en el mapa
    verMapa();
  };
  const buscarCercana = () => {
    if (!filtrados.some((u) => u._cercana)) {
      setGeo({ status: "error", msg: "No hay unidades con ubicación confiable en los filtros actuales." });
      return;
    }
    setGeo({ status: "loading", msg: "" });
    let permitido = true;
    try { permitido = document.featurePolicy ? document.featurePolicy.allowsFeature("geolocation") : true; } catch { /* navegador sin featurePolicy */ }
    if (!("geolocation" in navigator) || !permitido) {
      ubicacionNoDisponible("Este visor no permite leer la ubicación del dispositivo. Toca el mapa donde estás o usa el centro del mapa.");
      return;
    }
    let resuelto = false;
    const guard = setTimeout(() => { if (!resuelto) { resuelto = true; ubicacionNoDisponible("El navegador no respondió a la solicitud de ubicación. Toca el mapa donde estás o usa el centro del mapa."); } }, 8000);
    navigator.geolocation.getCurrentPosition(
      (p) => { if (resuelto) return; resuelto = true; clearTimeout(guard); aplicarUbicacion(p.coords.latitude, p.coords.longitude, "gps", p.coords.accuracy); },
      (err) => {
        if (resuelto) return;
        resuelto = true; clearTimeout(guard);
        ubicacionNoDisponible(err.code === 1 ? "El permiso de ubicación fue denegado o este visor no lo permite. Toca el mapa donde estás o usa el centro del mapa." : "No fue posible determinar la ubicación. Toca el mapa donde estás o usa el centro del mapa.");
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  };
  // Ubicación aproximada por código postal: centroide de las unidades verificadas con ese C.P.
  const ubicarPorCP = async (e) => {
    e?.preventDefault();
    const v = cp.trim();
    if (!/^\d{5}$/.test(v)) { setCpMsg("Escribe un código postal de 5 dígitos."); return; }
    setCpMsg("Buscando…");
    const pk = await cargarDetalles();
    const cps = pk.C[10];
    // exacto; si no hay unidades con ese C.P., se aproxima con los C.P. vecinos (mismos 4 y luego 3 primeros dígitos)
    for (const largo of [5, 4, 3]) {
      const pre = v.slice(0, largo);
      let sLa = 0, sLo = 0, n = 0;
      for (const u of data) if (u._calidad === 0 && cps[u._i] && cps[u._i].startsWith(pre)) { sLa += u.LATITUD; sLo += u.LONGITUD; n++; }
      if (n) {
        aplicarUbicacion(sLa / n, sLo / n, "cp");
        setCpMsg(largo === 5 ? "" : `Sin unidades con el C.P. ${v}; se usó la zona de los C.P. ${pre}${"x".repeat(5 - largo)}.`);
        return;
      }
    }
    setCpMsg(`No se encontró el C.P. ${v}. Marca tu ubicación en el mapa.`);
  };
  const usarCentroMapa = () => {
    const c = mapInst.current?.getCenter();
    if (c) aplicarUbicacion(c.lat, c.lng, "centro");
  };

  const limpiar = () => { setSelEnt([]); setSelMun([]); setSelInst([]); setSelNiv([]); setSelCal([]); setTexto(""); };
  const enfocar = (u, { popup = true } = {}) => {
    if (u.LATITUD == null) return;
    zonaAuto.current = true;
    setFocus({ u, zoom: tilesOk !== false ? 16 : 15, nearest: nearest?.u.CLUES === u.CLUES, popup, n: Date.now() });
    verMapa();
  };
  // Clic en una tarjeta: abre la ficha y centra el mapa detrás
  const seleccionar = (u) => {
    setDetalle(u);
    if (u.LATITUD != null) zonaAuto.current = true;
    if (u.LATITUD != null) setFocus({ u, zoom: tilesOk !== false ? 16 : 15, nearest: nearest?.u.CLUES === u.CLUES, popup: false, n: Date.now() });
  };
  const activarSeleccion = () => { if (!pickMode) verMapa(); setPickMode((v) => !v); };
  const nFiltros = selEnt.length + selMun.length + selInst.length + selNiv.length + selCal.length + (texto ? 1 : 0);

  const hayFiltros = nFiltros > 0;
  const [esMovilAhora, setEsMovilAhora] = useState(() => esMovil());
  useEffect(() => { const f = () => setEsMovilAhora(esMovil()); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const vista = !esMovilAhora && vistaSel === "filtros" ? "resumen" : vistaSel;
  const vistaMain = vista === "filtros" ? "resumen" : vista;
  const fichaEl = detalle && (
    <FichaUnidad
      u={detalle}
      userPos={userPos}
      km={distancias.get(detalle.CLUES)}
      esCercana={nearest?.u.CLUES === detalle.CLUES}
      onClose={() => setDetalle(null)}
      onVerMapa={() => { const u = detalle; setDetalle(null); enfocar(u); }}
    />
  );

  // ---------- Exportación CSV de los registros filtrados ----------
  const exportarCSV = async () => {
    setExportando(true);
    setExportMsg("");
    try {
      const pk = await cargarDetalles();
      const col = [
        "CLUES", "NOMBRE DE LA INSTITUCION", "NOMBRE DE LA UNIDAD", "ENTIDAD", "MUNICIPIO", "LOCALIDAD", "NIVEL ATENCION",
        "TIPO DE ESTABLECIMIENTO", "TIPOLOGIA", "SUBTIPOLOGIA", "ESTRATO", "JURISDICCION", "DOMICILIO", "CODIGO POSTAL", "TELEFONO",
        "LATITUD", "LONGITUD", "CALIDAD DE LA UBICACION", ...(userPos ? ["DISTANCIA KM"] : []), "GOOGLE MAPS",
      ];
      const q = (v) => { const t = v == null ? "" : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const filas = [col.join(",")];
      for (const u of listaFiltros) {
        const d = detalleDe(pk, u._i);
        const dom = [[d.tipoVialidad, d.vialidad].filter(Boolean).join(" ") + (d.numExt ? ` ${d.numExt}` : "") + (d.numInt ? ` INT. ${d.numInt}` : ""), [d.tipoAsentamiento, d.asentamiento].filter(Boolean).join(" ")].filter((x) => x && x.trim()).join(", ");
        const km = distancias.get(u.CLUES);
        filas.push([
          u.CLUES, u["NOMBRE DE LA INSTITUCION"], u["NOMBRE DE LA UNIDAD"], u.ENTIDAD, u.MUNICIPIO, d.localidad, u["NIVEL ATENCION"],
          u["NOMBRE TIPO ESTABLECIMIENTO"], d.tipologia, d.subtipologia, d.estrato, d.jurisdiccion, dom, d.cp,
          d.telefono ? d.telefono + (d.extension ? ` EXT ${d.extension}` : "") : "",
          u._latReg ?? "", u._lngReg ?? "", CALIDAD[u._calidad].t,
          ...(userPos ? [km != null ? km.toFixed(2) : ""] : []),
          u.LATITUD != null ? urlVerEnMaps(u) : "",
        ].map(q).join(","));
      }
      const csv = "\ufeff" + filas.join("\r\n");
      const nombre = `CLUES_filtrado_${new Date().toISOString().slice(0, 10)}.csv`;
      const r = await guardarArchivo(nombre, csv);
      setExportMsg(r === "cancelado" ? "Descarga cancelada." : `Listo: ${fmtN(listaFiltros.length)} registros en ${nombre}.`);
    } catch (e) {
      setExportMsg(`No se pudo exportar: ${e?.message || e}`);
    } finally {
      setExportando(false);
    }
  };
  const cuenta = useMemo(() => {
    const c = { "PRIMER NIVEL": 0, "SEGUNDO NIVEL": 0, "TERCER NIVEL": 0, sinCoord: 0, q: [0, 0, 0, 0, 0, 0, 0], cercanas: 0 };
    for (const d of filtrados) { c[d["NIVEL ATENCION"]]++; if (d.LATITUD == null) c.sinCoord++; c.q[d._calidad]++; if (d._cercana) c.cercanas++; }
    return c;
  }, [filtrados]);
  const cuentaNivel = useMemo(() => {
    // conteo por nivel sin aplicar el filtro de nivel (para que los atajos muestren cuántas hay de cada uno)
    const c = { "PRIMER NIVEL": 0, "SEGUNDO NIVEL": 0, "TERCER NIVEL": 0 };
    for (const d of data)
      if ((!setE.size || setE.has(d.ENTIDAD)) && (!setM.size || setM.has(munKey(d))) && (!setI.size || setI.has(d["NOMBRE DE LA INSTITUCION"])) && (!calidadesSel.size || calidadesSel.has(d._calidad)) && (!q || (d._q ??= fold(`${d.CLUES} ${d["NOMBRE DE LA UNIDAD"]}`)).includes(q)))
        c[d["NIVEL ATENCION"]]++;
    return c;
  }, [data, setE, setM, setI, calidadesSel, q]); // eslint-disable-line
  const pctConfiable = filtrados.length ? Math.round(((cuenta.q[0] + cuenta.q[3]) / filtrados.length) * 100) : 0;
  const ambito = selMun.length
    ? `en ${resumenSel(selMun.map((k) => titleCase(k.split("||")[1])), "municipios")}${selEnt.length === 1 ? `, ${titleCase(selEnt[0])}` : ""}`
    : selEnt.length
    ? `en ${resumenSel(selEnt.map(titleCase), "entidades")}`
    : "en todo el país";
  const pct = (n) => (filtrados.length ? `${((n / filtrados.length) * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}% del filtro` : "—");

  const dentroDe = (z, u) => u.LATITUD != null && u.LATITUD >= z.s && u.LATITUD <= z.n && u.LONGITUD >= z.w && u.LONGITUD <= z.e;
  const enZona = useMemo(() => (zona ? filtrados.filter((u) => dentroDe(zona, u)) : []), [zona, filtrados]);
  const enVista = useMemo(() => (vistaMapa ? filtrados.reduce((n, u) => n + (dentroDe(vistaMapa, u) ? 1 : 0), 0) : 0), [vistaMapa, filtrados]);
  const zonaVieja = zona && vistaMapa && ["s", "w", "n", "e"].some((k) => Math.abs(zona[k] - vistaMapa[k]) > 1e-6);
  const geoKey = selEnt.join("|") + "#" + selMun.join("|");
  useEffect(() => { setZona(null); setSeguir(false); }, [geoKey]);
  const LIMITE_ZONA = 2500;
  const [seguir, setSeguir] = useState(false); // tras la primera carga, la zona sigue al mapa mientras no haya demasiadas unidades
  const verZona = () => { if (vistaMapa) { setZona(vistaMapa); setSeguir(true); } };
  useEffect(() => { if (seguir && vistaMapa && zonaVieja && enVista <= LIMITE_ZONA) setZona(vistaMapa); }, [seguir, vistaMapa, zonaVieja, enVista]); // eslint-disable-line
  const ocultarZona = () => { setZona(null); setSeguir(false); };
  const ordenar = (arr) => (userPos ? [...arr].sort((a, b) => (distancias.get(a.CLUES) ?? 1e9) - (distancias.get(b.CLUES) ?? 1e9)) : arr);
  const listaFiltros = useMemo(() => ordenar(filtrados), [filtrados, userPos, distancias]); // eslint-disable-line
  const lista = useMemo(() => (zona ? ordenar(enZona) : listaFiltros), [zona, enZona, listaFiltros]); // eslint-disable-line

  const tarjetaUbicacion = (
          <div className="rounded-2xl bg-white p-3 shadow-[0_6px_24px_-8px_rgba(60,20,35,0.18)] sm:p-5">
            <div className="grid grid-cols-[1fr_auto] gap-2 lg:block">
            <button
              onClick={buscarCercana}
              disabled={geo.status === "loading"}
              className="flex w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-dorado px-3 py-3.5 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(188,149,92,0.8)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
            >
              {geo.status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" style={{ width: 20, height: 20 }} /> : <LocateFixed className="h-5 w-5" style={{ width: 20, height: 20 }} />}
              {geo.status === "loading" ? "Obteniendo ubicación…" : "Encontrar CLUES más cercana"}
            </button>
            <button
              onClick={activarSeleccion}
              aria-label="Marcar mi ubicación en el mapa"
              className={`flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition lg:mt-2.5 lg:w-full lg:px-4 ${
                pickMode ? "border-guinda bg-guinda text-white" : "border-guinda/30 text-guinda hover:bg-guinda/5"
              }`}
            >
              <MousePointerClick className="h-4 w-4" style={{ width: 16, height: 16 }} />
              <span className="hidden lg:inline">{pickMode ? "Haz clic en el mapa…" : "Marcar mi ubicación en el mapa"}</span>
            </button>
            </div>
            <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-neutral-500 sm:mt-3">
              <Filter className="mt-px shrink-0 text-dorado" style={{ width: 12, height: 12 }} />
              Busca entre las {fmtN(cuenta.cercanas)} unidades de tus filtros con ubicación confiable.
            </p>
            <form onSubmit={ubicarPorCP} className="mt-2.5 flex gap-2">
              <input
                value={cp}
                onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                placeholder="o tu código postal"
                aria-label="Código postal"
                className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-dorado focus:ring-2 focus:ring-dorado/40"
              />
              <button type="submit" className="rounded-lg border border-guinda/30 px-3 py-2 text-sm font-semibold text-guinda hover:bg-guinda/5">Ubicar</button>
            </form>
            {cpMsg && <p className="mt-1.5 text-[11px] text-neutral-600">{cpMsg}</p>}
            {geo.status === "error" && (
              <div className="mt-3 rounded-xl border-l-4 border-guinda bg-guinda/[0.06] p-3 text-xs text-neutral-700">
                <p className="flex items-center gap-1.5 font-semibold text-guinda"><AlertTriangle style={{ width: 16, height: 16 }} /> Ubicación no disponible</p>
                <p className="mt-1">{geo.msg}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => { setPickMode(true); verMapa(); }} className="rounded-lg bg-guinda px-2.5 py-1.5 font-semibold text-white">Marcar en el mapa</button>
                  <button onClick={usarCentroMapa} className="rounded-lg border border-guinda/30 px-2.5 py-1.5 font-semibold text-guinda">Usar el centro del mapa</button>
                </div>
                <p className="mt-2 text-[11px] text-neutral-500">También puedes escribir tu código postal arriba.</p>
              </div>
            )}
          </div>
  );

  return (
    <div className="clues-root min-h-screen bg-fondo pb-24 text-neutral-800 lg:pb-0">
      <style>{EMBEDDED_CSS}</style>

      {/* ===== HEADER ===== */}
      <header className="bg-guindaDark text-white">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dorado/70 text-dorado sm:h-10 sm:w-10">
            <Hospital className="h-5 w-5" style={{ width: 20, height: 20 }} strokeWidth={1.6} />
          </span>
          <div className="leading-tight">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">Catálogo CLUES</p>
            <p className="text-[15px] font-bold tracking-tight sm:text-lg">Directorio de Establecimientos de Salud</p>
          </div>
          <button onClick={() => setPanelCatalogo(true)} className="ml-auto hidden items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/75 hover:bg-white/10 sm:flex">
            <Database className="h-3.5 w-3.5 text-dorado" style={{ width: 14, height: 14 }} /> Corte {catalogo.corte} · {fmtN(data.length)} unidades · Actualizar
          </button>
        </div>
        <div className="bg-dorado">
          <p className="mx-auto max-w-[1500px] px-4 py-1 text-right text-[11px] font-bold tracking-wide text-white sm:px-5 sm:py-1.5 sm:text-sm">
            Primer, segundo y tercer nivel de atención
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-5">
        {/* ===== SIDEBAR / FILTROS ===== */}
        <aside className={`${vista === "filtros" ? "" : "hidden"} space-y-4 lg:sticky lg:top-4 lg:z-[1100] lg:block lg:self-start`}>
          <div ref={filtrosRef} className="relative scroll-mt-3 rounded-2xl shadow-lg" style={{ background: `linear-gradient(180deg, ${C.guinda} 0%, ${C.guindaDark} 100%)` }}>
            <div className="flex items-center gap-2 rounded-t-2xl px-4 py-3 text-white sm:px-5 sm:py-3.5" style={{ background: "rgba(0,0,0,0.12)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <button onClick={() => setFiltrosAbiertos((v) => !v)} className="flex flex-1 items-center gap-2 text-left lg:pointer-events-none">
                <Filter className="h-4 w-4 text-dorado" style={{ width: 16, height: 16 }} />
                <h2 className="text-sm font-semibold uppercase tracking-[0.08em]">Filtros</h2>
                {nFiltros > 0 && <span className="rounded-full bg-dorado px-1.5 text-[11px] font-bold text-white">{nFiltros}</span>}
                <span className="ml-1 text-xs font-normal normal-case text-white/70 lg:hidden">· {fmtN(filtrados.length)} unidades</span>
              </button>
              {hayFiltros && (
                <button onClick={limpiar} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/80 transition hover:bg-white/10 hover:text-white">
                  <RotateCcw className="h-3.5 w-3.5" style={{ width: 14, height: 14 }} /> Limpiar
                </button>
              )}
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">Buscar CLUES o nombre</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-guinda" style={{ width: 16, height: 16 }} />
                  <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Ej. DFIMS000575, Siglo XXI"
                    className="w-full rounded-lg border border-white/15 bg-white/95 py-2.5 pl-9 pr-8 text-sm font-medium text-neutral-800 shadow-sm outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-dorado/60"
                  />
                  {texto && (
                    <button onClick={() => setTexto("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-guinda" aria-label="Borrar búsqueda">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </label>
              <MultiSelect label="Entidad" options={optEntidades} selected={selEnt} onChange={setSelEnt} placeholder="Todas las entidades" buscar />
              <MultiSelect label="Municipio" options={optMunicipios} selected={selMun} onChange={setSelMun} placeholder={selEnt.length ? "Todos los municipios" : "Todos (elige entidades para acotar)"} buscar />
              <MultiSelect label="Institución" options={optInstituciones} selected={selInst} onChange={setSelInst} placeholder="Todas las instituciones" buscar />
              <MultiSelect label="Nivel de atención" options={optNiveles} selected={selNiv} onChange={setSelNiv} placeholder="Todos los niveles" />
              <MultiSelect label="Calidad de la ubicación" options={optCalidad} selected={selCal} onChange={setSelCal} placeholder="Todas" />
              <p className="border-t border-white/10 pt-3 text-xs text-white/70">
                <span className="font-semibold text-dorado">{fmtN(filtrados.length)}</span> de {fmtN(data.length)} establecimientos coinciden.
              </p>
              <button
                onClick={exportarCSV}
                disabled={!filtrados.length || exportando}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/20 disabled:opacity-50"
              >
                {exportando ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <Download style={{ width: 16, height: 16 }} />}
                Exportar {fmtN(filtrados.length)} registros (.csv)
              </button>
              {exportMsg && <p className="text-[11px] leading-snug text-white/80">{exportMsg}</p>}
            </div>
          </div>

          <div className="hidden lg:block">{tarjetaUbicacion}</div>
          <div className="sticky bottom-24 z-10 grid grid-cols-2 gap-2 lg:hidden">
            <button onClick={() => irA("lista")} className="flex items-center justify-center gap-1.5 rounded-xl border border-guinda/30 bg-white px-3 py-3 text-sm font-bold text-guinda shadow-lg">
              <ListIcon style={{ width: 17, height: 17 }} /> Ver lista
            </button>
            <button onClick={() => irA("mapa")} className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-bold text-white shadow-lg" style={{ background: C.guinda }}>
              <MapIcon style={{ width: 17, height: 17 }} /> Ver en el mapa
            </button>
          </div>
        </aside>

        {/* ===== CONTENIDO PRINCIPAL ===== */}
        <main className={`${vista === "filtros" ? "hidden lg:block" : ""} min-w-0 space-y-5`}>
          {/* --- Pestañas (computadora) --- */}
          <div className="hidden gap-1 rounded-2xl bg-white p-1.5 shadow-[0_6px_24px_-8px_rgba(60,20,35,0.18)] lg:flex" role="tablist">
            {[["resumen", "Resumen", Home, ""], ["mapa", "Mapa", MapIcon, zona ? `${fmtN(enZona.length)} en la zona` : ""], ["lista", "Lista", ListIcon, fmtN(lista.length)]].map(([k, t, Ic, extra]) => (
              <button key={k} role="tab" aria-selected={vistaMain === k} onClick={() => irA(k)} className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition" style={vistaMain === k ? { background: C.guinda, color: "#fff" } : { color: C.guinda }}>
                <Ic style={{ width: 17, height: 17 }} /> {t}
                {extra && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={vistaMain === k ? { background: "rgba(255,255,255,0.2)" } : { background: "#f4ebe7" }}>{extra}</span>}
              </button>
            ))}
          </div>

          <div className={vistaMain === "resumen" ? "space-y-5" : "hidden"}>
          {/* --- Resumen: tu selección de un vistazo --- */}
          <section ref={resumenRef} className="scroll-mt-3 overflow-hidden rounded-3xl p-5 text-white shadow-[0_18px_40px_-18px_rgba(107,28,53,0.75)] sm:p-6" style={{ background: `radial-gradient(120% 140% at 100% 0%, ${C.guinda} 0%, ${C.guindaDark} 70%)` }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-white/85"><Hospital style={{ width: 16, height: 16 }} /> Tu selección de un vistazo</p>
              <button onClick={() => setPanelCatalogo(true)} className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white/90 hover:bg-white/10">
                <Database style={{ width: 13, height: 13 }} /> Corte {catalogo.corte}{catalogo.fuente === "navegador" ? " · cargado aquí" : ""}
              </button>
            </div>
            <p className="mt-3 text-4xl font-extrabold leading-none tracking-tight tabular-nums sm:text-5xl">{fmtN(filtrados.length)}</p>
            <p className="mt-1.5 text-sm text-white/85 sm:text-base">
              establecimientos {ambito}
            </p>

            {/* Meta: ubicación confiable */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-white/85">
                <span className="flex items-center gap-1.5"><ShieldCheck style={{ width: 14, height: 14 }} /> Con ubicación confiable para el mapa</span>
                <span className="text-sm font-extrabold text-white tabular-nums">{pctConfiable}%</span>
              </div>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/15">
                {[0, 3, 1, 6, 2, 4, 5].map((k) => cuenta.q[k] ? <span key={k} title={`${CALIDAD[k].t}: ${fmtN(cuenta.q[k])}`} style={{ width: `${(cuenta.q[k] / Math.max(1, filtrados.length)) * 100}%`, background: k === 0 || k === 3 ? "#ffffff" : k === 4 || k === 5 ? "rgba(255,255,255,0.12)" : C.dorado }} /> : null)}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/70">
                <span><b className="text-white">{fmtN(cuenta.q[0] + cuenta.q[3])}</b> verificadas</span>
                <span><b style={{ color: "#e9cf9f" }}>{fmtN(cuenta.q[1] + cuenta.q[2] + cuenta.q[6])}</b> por revisar</span>
                <span><b className="text-white/90">{fmtN(cuenta.q[4] + cuenta.q[5])}</b> sin ubicación confiable</span>
              </div>
            </div>

            {/* Niveles: atajos de filtro */}
            <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-black/15 p-1" role="group" aria-label="Filtrar por nivel de atención">
              {NIVELES.map((n) => {
                const activo = selNiv.includes(n);
                return (
                  <button
                    key={n}
                    onClick={() => setSelNiv((v) => (v.includes(n) ? v.filter((x) => x !== n) : [...v, n]))}
                    aria-pressed={activo}
                    className="rounded-xl px-2 py-2 text-center transition"
                    style={activo ? { background: "#fff", color: C.guindaDark } : { color: "rgba(255,255,255,0.9)" }}
                  >
                    <span className="block text-lg font-extrabold tabular-nums leading-tight">{fmtN(cuentaNivel[n])}</span>
                    <span className="block text-[11px] font-semibold">{titleCase(n)}</span>
                  </button>
                );
              })}
            </div>

            {/* Acciones contextuales */}
            <div className="mt-4 space-y-2">
              {cuenta.q[4] + cuenta.q[5] > 0 && !selCal.includes("excluida") && (
                <button onClick={() => { setSelCal(["excluida"]); irA("lista"); }} className="flex w-full items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-sm font-semibold hover:bg-white/15">
                  <MapPinOff className="shrink-0" style={{ width: 17, height: 17 }} />
                  <span className="flex-1">{fmtN(cuenta.q[4] + cuenta.q[5])} unidades no aparecen en el mapa. Revisarlas</span>
                  <ChevronRight style={{ width: 17, height: 17 }} />
                </button>
              )}
              <button onClick={() => setPanelCatalogo(true)} className="flex w-full items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-sm font-semibold hover:bg-white/15">
                <UploadCloud className="shrink-0" style={{ width: 17, height: 17 }} />
                <span className="flex-1">¿Hay un catálogo nuevo de la DGIS? Súbelo para revisar los cambios</span>
                <ChevronRight style={{ width: 17, height: 17 }} />
              </button>
            </div>
          </section>

          <div className="lg:hidden">{tarjetaUbicacion}</div>

          {/* --- Tarjeta CLUES más cercana --- */}
          {nearest && (
            <section ref={cercanaRef} className="clues-fadein scroll-mt-3 overflow-hidden rounded-2xl border-2 border-dorado bg-white shadow-[0_10px_30px_-10px_rgba(188,149,92,0.6)]">
              <div className="flex items-center gap-2 bg-dorado px-5 py-2.5 text-sm font-bold text-white">
                <Navigation style={{ width: 16, height: 16 }} /> CLUES más cercana {hayFiltros ? "(según tus filtros)" : "a tu ubicación"}
                <span className="ml-auto hidden text-xs font-medium text-white/85 sm:inline">
                  {({ gps: "Ubicación del dispositivo", centro: "Centro del mapa", cp: `Código postal ${cp}`, mapa: "Ubicación marcada en el mapa" })[userPos.fuente]} · {userPos.lat.toFixed(4)}, {userPos.lng.toFixed(4)}
                </span>
                <button onClick={() => { setUserPos(null); setGeo({ status: "idle", msg: "" }); }} className="ml-auto rounded p-0.5 hover:bg-white/20 sm:ml-0" aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-5 sm:p-5">
                <div className="flex items-start gap-4">
                  <InstBadge nombre={nearest.u["NOMBRE DE LA INSTITUCION"]} size={52} />
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-dorado">{nearest.u.CLUES}</p>
                    <p className="text-base font-bold leading-snug text-neutral-900 sm:text-lg">{titleCase(nearest.u["NOMBRE DE LA UNIDAD"])}</p>
                    <p className="text-sm text-guinda">{titleCase(nearest.u["NOMBRE DE LA INSTITUCION"])}</p>
                    <p className="text-xs text-neutral-500">{titleCase(nearest.u.MUNICIPIO)}, {titleCase(nearest.u.ENTIDAD)} · {titleCase(nearest.u["NIVEL ATENCION"])}</p>
                  </div>
                </div>
                <div className="flex items-baseline justify-center gap-2 rounded-xl bg-fondo px-6 py-2.5 text-center sm:block sm:py-3">
                  <p className="text-3xl font-extrabold tabular-nums text-guinda">{fmtKm(nearest.km)}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">en línea recta</p>
                </div>
              </div>
              {(userPos.fuente === "cp" || (userPos.prec && userPos.prec > 1000)) && (
                <p className="mx-4 mb-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:mx-5">
                  <AlertTriangle className="mt-px shrink-0" style={{ width: 14, height: 14 }} />
                  {userPos.fuente === "cp"
                    ? "Ubicación aproximada (centro de tu código postal). Para mayor exactitud, toca tu ubicación en el mapa."
                    : `Tu dispositivo reporta una precisión baja (± ${fmtKm(userPos.prec / 1000)}). Para mayor exactitud, toca tu ubicación en el mapa.`}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:flex sm:px-5">
                <button onClick={() => abrirFicha(nearest.u)} className="flex items-center justify-center gap-1.5 rounded-xl bg-guinda px-4 py-2.5 text-sm font-bold text-white hover:brightness-110">
                  <FileText style={{ width: 16, height: 16 }} /> Ver ficha
                </button>
                <a href={urlComoLlegar(nearest.u, userPos)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white hover:brightness-105" style={{ background: C.dorado }}>
                  <Route style={{ width: 16, height: 16 }} /> Cómo llegar en Google Maps
                </a>
              </div>
              {ranking.length > 1 && (
                <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-5 py-3 text-xs">
                  <span className="font-semibold text-neutral-500">Siguientes:</span>
                  {ranking.slice(1, 4).map((r) => (
                    <button key={r.u.CLUES} onClick={() => seleccionar(r.u)} className="rounded-full bg-guinda/[0.06] px-2.5 py-1 text-guinda hover:bg-guinda/10" title={titleCase(r.u["NOMBRE DE LA UNIDAD"])}>
                      {r.u.CLUES} · {fmtKm(r.km)}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          </div>

          {/* --- Mapa --- */}
          <section
            ref={mapaRef}
            style={ampliado ? { position: "fixed", inset: 0, width: "100vw", height: "100dvh", zIndex: 2500 } : undefined}
            className={ampliado ? "flex flex-col bg-white" : vistaMain === "mapa" ? "overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_-8px_rgba(60,20,35,0.18)]" : "hidden"}
          >
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-neutral-100 px-4 py-2 text-[11px] text-neutral-600 sm:gap-x-5 sm:px-5 sm:py-3 sm:text-xs">
              <span className={`${ampliado ? "flex w-full" : "hidden sm:flex"} items-center gap-2 text-sm font-semibold text-guinda`}>
                Mapa de establecimientos
                {ampliado && (
                  <button onClick={alternarPantallaCompleta} className="ml-auto flex items-center gap-1 rounded-full bg-guinda px-3 py-1 text-xs font-bold text-white sm:hidden">
                    <X style={{ width: 14, height: 14 }} /> Cerrar
                  </button>
                )}
              </span>
              {NIVELES.map((k) => (
                <span key={k} className="flex items-center gap-1.5 font-medium text-neutral-700"><NivelIcono nivel={k} size={13} /> {titleCase(k)}</span>
              ))}
              <span className="flex items-center gap-1.5"><NivelIcono nivel="PRIMER NIVEL" size={13} hueco /> Coordenada genérica</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-dorado ring-2 ring-guindaDark/40" /> Más cercano</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-white bg-sky-600 ring-1 ring-sky-600" /> Tu ubicación</span>
              
            </div>
            <div className={ampliado ? "relative min-h-0 flex-1" : "relative min-h-[360px]"} style={ampliado ? undefined : { height: esMovilAhora ? "calc(100dvh - 252px)" : "calc(100vh - 210px)" }}>
              {ampliado && (
                <button onClick={alternarPantallaCompleta} className="absolute bottom-8 left-3 z-[650] hidden items-center gap-1 rounded-full bg-guinda px-3 py-1.5 text-xs font-bold text-white shadow-lg sm:flex">
                  <X style={{ width: 14, height: 14 }} /> Salir de pantalla completa
                </button>
              )}
              {L && !pickMode && !popupAbierto && filtrados.length > 0 && (
                <div className="pointer-events-none absolute inset-x-0 z-[655] flex flex-col items-center gap-1 px-3" style={{ bottom: nearest ? 104 : 30 }}>
                  {!zona || (zonaVieja && enVista > LIMITE_ZONA) ? (
                    <>
                      {!zona && enVista > LIMITE_ZONA && (
                        <span className="rounded-full bg-white/95 px-2.5 py-1 text-center text-[11px] font-medium text-neutral-700 shadow-sm">Acércate a tu zona para ver el detalle</span>
                      )}
                      <button
                        onClick={verZona}
                        disabled={!enVista}
                        className="pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_22px_-6px_rgba(107,28,53,0.7)] transition active:scale-95 disabled:opacity-60"
                        style={{ background: C.guinda }}
                      >
                        <Eye style={{ width: 17, height: 17 }} />
                        {zona ? "Cargar esta vista" : "Ver CLUES aquí"}
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs tabular-nums">{fmtN(enVista)}</span>
                      </button>
                    </>
                  ) : (
                    <span className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-guinda shadow-md ring-1 ring-black/5">
                      <Eye style={{ width: 14, height: 14 }} /> {fmtN(enZona.length)} CLUES en esta vista
                      <button onClick={ocultarZona} className="rounded-full p-0.5 text-neutral-400 hover:text-guinda" aria-label="Ocultar CLUES del mapa"><X style={{ width: 14, height: 14 }} /></button>
                    </span>
                  )}
                </div>
              )}
              {L && !popupAbierto && (
                <div className="absolute right-3 z-[650]" style={{ top: 58 }}>
                  <button
                    onClick={() => setPanelSombra((v) => !v)}
                    title="Sombreado fuera de los filtros"
                    aria-expanded={panelSombra}
                    className="ml-auto flex items-center gap-1.5 rounded-[10px] border-2 border-black/20 bg-white px-2.5 py-1.5 text-xs font-bold text-guinda shadow-sm hover:bg-[#fbf3ef]"
                    style={{ backgroundClip: "padding-box" }}
                  >
                    <span className="inline-block h-3.5 w-3.5 rounded-sm border border-black/20" style={{ background: sombra.activa ? sombra.color : "transparent", opacity: sombra.activa ? Math.max(0.35, sombra.opacidad) : 1 }} />
                    Sombreado
                  </button>
                  {panelSombra && (
                    <div className="mt-1.5 w-60 rounded-xl bg-white p-3 text-xs text-neutral-700 shadow-xl ring-1 ring-black/10">
                      <label className="flex cursor-pointer items-center justify-between gap-2 font-semibold text-neutral-800">
                        Sombrear fuera del filtro
                        <input type="checkbox" checked={sombra.activa} onChange={(e) => setSombra((s) => ({ ...s, activa: e.target.checked }))} style={{ accentColor: C.guinda, width: 16, height: 16 }} />
                      </label>
                      {!selEnt.length && !selMun.length && (
                        <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">Elige una o más entidades o municipios para ver el sombreado.</p>
                      )}
                      <p className="mt-3 font-semibold text-neutral-800">Color</p>
                      <div className="mt-1.5 flex gap-2">
                        {[["#1f2937", "Gris oscuro"], ["#000000", "Negro"], ["#ffffff", "Blanco"], [C.guindaDark, "Guinda"], ["#1e3a8a", "Azul"]].map(([c, n]) => (
                          <button
                            key={c}
                            onClick={() => setSombra((s) => ({ ...s, color: c, activa: true }))}
                            title={n}
                            aria-label={n}
                            className="h-7 w-7 rounded-full border"
                            style={{ background: c, borderColor: "#d4d4d4", boxShadow: sombra.color === c ? `0 0 0 2px #fff, 0 0 0 4px ${C.dorado}` : "none" }}
                          />
                        ))}
                      </div>
                      <p className="mt-3 flex items-center justify-between font-semibold text-neutral-800">
                        Opacidad <span className="tabular-nums text-guinda">{Math.round(sombra.opacidad * 100)}%</span>
                      </p>
                      <input
                        type="range" min="5" max="90" step="5"
                        value={Math.round(sombra.opacidad * 100)}
                        onChange={(e) => setSombra((s) => ({ ...s, opacidad: Number(e.target.value) / 100, activa: true }))}
                        className="mt-1 w-full"
                        style={{ accentColor: C.guinda }}
                        aria-label="Opacidad del sombreado"
                      />
                      <button onClick={() => setSombra({ activa: true, color: "#1f2937", opacidad: 0.4 })} className="mt-2 text-[11px] font-semibold text-neutral-500 underline">Restablecer</button>
                    </div>
                  )}
                </div>
              )}
              {nearest && !pickMode && !popupAbierto && (
                <div className="absolute inset-x-3 bottom-7 z-[640] mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-white/97 p-3 shadow-2xl ring-1 ring-black/5" style={{ background: "rgba(255,255,255,0.97)" }}>
                  <InstBadge nombre={nearest.u["NOMBRE DE LA INSTITUCION"]} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-dorado">Más cercana · {fmtKm(nearest.km)}</p>
                    <p className="truncate text-sm font-bold text-neutral-900">{titleCase(nearest.u["NOMBRE DE LA UNIDAD"])}</p>
                  </div>
                  <button onClick={() => abrirFicha(nearest.u)} className="shrink-0 rounded-lg border border-guinda/30 px-2.5 py-2 text-xs font-bold text-guinda">Ficha</button>
                  <a href={urlComoLlegar(nearest.u, userPos)} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-bold text-white" style={{ background: C.dorado }}>Cómo llegar</a>
                </div>
              )}
              {ampliado && fichaEl}
              {tilesOk === false && motivoSinCalles !== "manual" && avisoCalles && !pickMode && !nearest && (
                <div className="pointer-events-none absolute inset-x-0 bottom-8 z-[600] flex justify-center px-3">
                  <div className="pointer-events-auto flex max-w-md items-start gap-2 rounded-xl bg-white/95 px-3 py-2 text-[11.5px] leading-snug text-neutral-700 shadow-lg ring-1 ring-black/5">
                    <MapIcon className="mt-0.5 shrink-0 text-guinda" style={{ width: 16, height: 16 }} />
                    <span>
                      <b className="text-guinda">
                        {motivoSinCalles === "csp" ? "El visor de Claude bloquea las imágenes del mapa de calles." : motivoSinCalles === "offline" ? "Sin conexión a internet: no se pudo cargar el mapa de calles." : "No se pudo cargar el mapa de calles."}
                      </b>{" "}
                      Se muestran carreteras, ciudades y límites del INEGI. Para navegar usa <b>“Cómo llegar”</b> en cada unidad o el botón
                      <span className="mx-1 inline-block rounded border border-neutral-300 px-1 font-bold text-guinda">Google Maps</span>del mapa.
                      {motivoSinCalles === "csp" && " Abierto como archivo HTML en Chrome o Safari sí muestra calles y satélite."}
                    </span>
                    <button onClick={() => setAvisoCalles(false)} className="shrink-0 rounded p-0.5 text-neutral-400 hover:text-guinda" aria-label="Ocultar aviso"><X style={{ width: 14, height: 14 }} /></button>
                  </div>
                </div>
              )}
              {pickMode && (
                <div className="pointer-events-none absolute inset-x-0 bottom-8 z-[600] flex justify-center px-3">
                  <p className="pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-lg sm:text-sm" style={{ background: C.guinda }}>
                    <Crosshair style={{ width: 16, height: 16 }} /> <span>Toca el mapa donde estás</span>
                    <button onClick={usarCentroMapa} className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] hover:bg-white/30 sm:text-xs"><Target className="mr-1 inline" style={{ width: 12, height: 12 }} />Usar centro</button>
                    <button onClick={() => setPickMode(false)} className="rounded-full p-0.5 hover:bg-white/20" aria-label="Cancelar"><X style={{ width: 16, height: 16 }} /></button>
                  </p>
                </div>
              )}
              {L ? (
                <MapaClues
                  L={L}
                  filtrados={filtrados}
                  puntosZona={enZona}
                  geoKey={geoKey}
                  onVista={onVista}
                  visible={ampliado || vistaMain === "mapa"}
                  nearest={nearest}
                  userPos={userPos}
                  distancias={distancias}
                  focus={focus}
                  pickMode={pickMode}
                  onPick={(lat, lng) => aplicarUbicacion(lat, lng, "mapa")}
                  entidades={selEnt}
                  tilesOk={tilesOk}
                  onTilesStatus={onTilesStatus}
                  onDetalle={abrirFicha}
                  onPopup={setPopupAbierto}
                  municipios={selMun}
                  onMapReady={(m) => (mapInst.current = m)}
                  onLocate={buscarCercana}
                  ampliado={ampliado}
                  onAmpliar={alternarPantallaCompleta}
                  sombra={sombra}
                />
              ) : (
                <div className="grid h-full place-items-center bg-fondo text-sm text-neutral-500">
                  {leafletStatus === "error" ? (
                    <p className="flex items-center gap-2 text-guinda"><AlertTriangle className="h-4 w-4" style={{ width: 16, height: 16 }} /> No fue posible cargar la biblioteca del mapa (Leaflet).</p>
                  ) : (
                    <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-dorado" style={{ width: 16, height: 16 }} /> Cargando mapa…</p>
                  )}
                </div>
              )}
              {L && !filtrados.length && (
                <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center">
                  <p className="rounded-xl bg-white/95 px-4 py-3 text-sm font-medium text-neutral-600 shadow">Sin establecimientos para esta combinación de filtros.</p>
                </div>
              )}
            </div>
            <p className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500 sm:px-5">
              {zona ? `${fmtN(enZona.length)} puntos en la zona mostrada` : "Sin puntos: toca «Ver CLUES en esta zona»"}{cuenta.sinCoord ? ` · ${fmtN(cuenta.sinCoord)} unidades sin ubicación confiable (fuera de su entidad o sin coordenadas) aparecen solo en la lista` : ""}. Límites: Marco Geoestadístico INEGI 2025.
              {tilesOk === false && " Sin mapa de calles: se muestran carreteras y lagos (Natural Earth), localidades (CLUES) y límites (INEGI)."}
            </p>
          </section>

          {/* --- Resultados --- */}
          <section ref={listaRef} className={vistaMain === "lista" ? "" : "hidden"}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-base font-bold text-guinda">Resultados</h2>
              <span className="h-[2px] flex-1" style={{ background: `linear-gradient(90deg, ${C.dorado}, transparent)` }} />
              <span className="text-right text-[11px] text-neutral-500 sm:text-xs">
                {fmtN(Math.min(visibles, lista.length))} de {fmtN(lista.length)}{zona ? " en la zona del mapa" : ""} · {userPos ? "ordenados por distancia" : "orden por CLUES"}
                {zona && <button onClick={ocultarZona} className="ml-2 font-semibold text-guinda underline">ver todas</button>}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {lista.slice(0, visibles).map((u) => (
                <UnidadCard key={u.CLUES} u={u} activa={nearest?.u.CLUES === u.CLUES} distancia={distancias.get(u.CLUES)} onClick={() => seleccionar(u)} />
              ))}
            </div>
            {visibles < lista.length && (
              <button
                onClick={() => setVisibles((v) => v + PAGE * 2)}
                className="mx-auto mt-4 flex items-center gap-1.5 rounded-full border border-guinda/30 bg-white px-5 py-2 text-sm font-semibold text-guinda shadow-sm hover:bg-guinda/5"
              >
                <ChevronDown className="h-4 w-4" style={{ width: 16, height: 16 }} /> Mostrar más ({fmtN(lista.length - visibles)} restantes)
              </button>
            )}
          </section>

          <footer className={`${vistaMain === "mapa" ? "hidden" : ""} pb-4 pt-2 text-[11px] leading-relaxed text-neutral-500`}>
            Fuente: <span className="font-medium">ESTABLECIMIENTO_SALUD_202609.xlsx</span>, hoja CLUES_202609. Incluye las {fmtN(data.length)} unidades con estatus “En operación” y nivel de atención primero, segundo o tercero.
            Distancias calculadas con la fórmula de Haversine (línea recta, radio terrestre 6,371 km).
          </footer>
        </main>
      </div>

      {!ampliado && fichaEl}

      {panelCatalogo && (
        <CatalogoPanel
          catalogo={catalogo}
          data={data}
          onAplicar={onAplicarCatalogo}
          onVolverPublicado={async () => { setPanelCatalogo(false); await onVolverPublicado(); }}
          onClose={() => setPanelCatalogo(false)}
        />
      )}

      {/* --- Navegación inferior (celular) --- */}
      {!ampliado && !detalle && !panelCatalogo && (
        <nav className="fixed inset-x-0 bottom-0 z-[1500] border-t border-neutral-200 bg-white/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Navegación principal">
          <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-1.5">
            {[
              ["Resumen", Home, () => irA("resumen"), 0, "resumen"],
              ["Filtros", Filter, () => irA("filtros"), nFiltros, "filtros"],
              null,
              ["Mapa", MapIcon, () => irA("mapa"), 0, "mapa"],
              ["Lista", ListIcon, () => irA("lista"), 0, "lista"],
            ].map((it) => {
              if (it) {
                const [t, Ic, fn, badge, k] = it;
                return (
                  <button key={t} onClick={fn} aria-current={vista === k ? "page" : undefined} className="relative flex flex-col items-center gap-0.5 pb-2 pt-1 text-[10.5px] font-semibold active:text-guinda" style={{ color: vista === k ? C.guinda : "#737373" }}>
                    <Ic style={{ width: 22, height: 22 }} />
                    {t}
                    {badge > 0 && <span className="absolute right-[22%] top-0 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: C.guinda }}>{badge}</span>}
                  </button>
                );
              }
              return (
                <div key="centro" className="flex flex-col items-center pb-2">
                  <button
                    onClick={() => { irA("mapa"); buscarCercana(); }}
                    aria-label="Encontrar la CLUES más cercana"
                    className="-mt-6 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg ring-4 ring-white active:scale-95"
                    style={{ background: C.dorado }}
                  >
                    {geo.status === "loading" ? <Loader2 className="animate-spin" style={{ width: 24, height: 24 }} /> : <LocateFixed style={{ width: 24, height: 24 }} />}
                  </button>
                  <span className="mt-0.5 text-[10.5px] font-semibold text-guinda">Cerca de mí</span>
                </div>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. ESTILOS INCLUIDOS (Tailwind compilado + Leaflet 1.9.4 + propios) */
/* ------------------------------------------------------------------ */
const CUSTOM_CSS = `
.clues-root{font-family:Montserrat,system-ui,sans-serif}
.clues-pin svg{width:100%;height:100%;filter:drop-shadow(0 3px 3px rgba(60,20,35,.35));transition:transform .15s}
.clues-pin:hover svg{transform:translateY(-2px) scale(1.06)}
.clues-pin--pulse{position:relative}
.clues-pin--pulse::before{content:"";position:absolute;left:50%;bottom:-6px;width:34px;height:14px;margin-left:-17px;border-radius:50%;background:rgba(188,149,92,.55);animation:cluesPulse 1.6s ease-out infinite}
@keyframes cluesPulse{0%{transform:scale(.4);opacity:1}100%{transform:scale(2.2);opacity:0}}
.clues-popup .leaflet-popup-content-wrapper{padding:0;border-radius:12px;overflow:hidden;box-shadow:0 12px 30px -8px rgba(60,20,35,.35)}
.clues-popup .leaflet-popup-content{margin:0;font-family:Montserrat,system-ui,sans-serif;line-height:1.35}
.clues-popup .leaflet-popup-content p{margin:0}
.clues-popup a.leaflet-popup-close-button{color:#fff!important;top:4px!important;right:4px!important}
.clues-picking.leaflet-container,.clues-picking .leaflet-interactive{cursor:crosshair!important}
.clues-fadein{animation:cluesFade .45s ease-out}
@keyframes cluesFade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.leaflet-container{font-family:Montserrat,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
.clues-root .leaflet-control-attribution{font-size:10px!important;line-height:1.4!important;padding:0 5px!important}
.clues-root .leaflet-control-attribution a{font-size:10px!important}
.clues-root .leaflet-bar a{width:32px;height:32px;line-height:32px}
.clues-points{position:absolute;left:0;top:0}
.clues-ctrl a{display:flex!important;align-items:center;justify-content:center;width:34px!important;height:34px!important;color:#9F2241!important;background:#fff}
.clues-ctrl a:hover{background:#fbf3ef}
.clues-ctrl .clues-ctrl-gmaps{color:#BC955C!important}
.clues-root .leaflet-control-layers{border-radius:10px;font-size:13px}
.clues-root .leaflet-control-layers-toggle{width:36px!important;height:36px!important;background-size:20px 20px!important;background-position:center!important;background-repeat:no-repeat!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239F2241' stroke-width='2' stroke-linejoin='round'%3E%3Cpath d='m12 2 10 5-10 5L2 7z'/%3E%3Cpath d='m2 12 10 5 10-5M2 17l10 5 10-5'/%3E%3C/svg%3E")!important}
.clues-root .leaflet-control-layers-expanded{padding:8px 12px 8px 8px}
.clues-root .leaflet-control-scale-line{border-color:#6B1C35;color:#6B1C35;background:rgba(255,255,255,.8);font-size:10.5px}
.clues-lbl{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-family:Montserrat,system-ui,sans-serif;pointer-events:none;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 2px #fff}
.clues-lbl-ent{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7a6a5e}
.clues-lbl-mun{font-size:10.5px;font-weight:600;color:#6b5d52}
.clues-lbl-ciudad{font-size:12.5px;font-weight:700;color:#3f3530}
.clues-lbl-loc{font-size:10.5px;font-weight:600;color:#5d5048}
.clues-root svg.lucide{flex-shrink:0}
.clues-gmaps{color:#6B1C35!important;text-decoration:none!important}
.clues-popup button[data-accion]{cursor:pointer;border:0}
.clues-fade{animation:cluesFadeIn .2s ease-out}
.clues-sheet{animation:cluesUp .28s cubic-bezier(.2,.8,.2,1)}
@keyframes cluesFadeIn{from{opacity:0}to{opacity:1}}
@keyframes cluesUp{from{transform:translateY(24px);opacity:.4}to{transform:none;opacity:1}}
.clues-root select,.clues-root input{font-size:16px}
@media (min-width:640px){.clues-root select,.clues-root input{font-size:14px}}
`;
const EMBEDDED_CSS = /*__CSS__*/ + CUSTOM_CSS;

/* Marco Geoestadístico INEGI 2025 (00ent / 00mun), reproyectado a WGS84 y simplificado (~200 m) */
const ENT_CENTROS = [[22.006, -102.362], [30.586, -115.111], [25.936, -112.06], [18.84, -90.36], [27.295, -102.044], [19.141, -103.913], [16.485, -92.473], [28.809, -106.469], [19.278, -99.14], [24.924, -104.913], [20.905, -101.013], [17.668, -99.922], [20.48, -98.887], [20.581, -103.613], [19.356, -99.645], [19.207, -101.878], [18.743, -99.075], [21.804, -104.841], [25.573, -99.969], [16.961, -96.43], [19.006, -97.9], [20.855, -99.846], [19.591, -88.127], [22.585, -100.417], [25.001, -107.509], [29.696, -110.8], [17.938, -92.594], [24.291, -98.641], [19.429, -98.169], [19.393, -96.419], [20.747, -88.921], [23.289, -102.661]];
const ENT_NOMBRES = ["AGUASCALIENTES", "BAJA CALIFORNIA", "BAJA CALIFORNIA SUR", "CAMPECHE", "COAHUILA DE ZARAGOZA", "COLIMA", "CHIAPAS", "CHIHUAHUA", "CIUDAD DE MEXICO", "DURANGO", "GUANAJUATO", "GUERRERO", "HIDALGO", "JALISCO", "MEXICO", "MICHOACAN DE OCAMPO", "MORELOS", "NAYARIT", "NUEVO LEON", "OAXACA", "PUEBLA", "QUERETARO", "QUINTANA ROO", "SAN LUIS POTOSI", "SINALOA", "SONORA", "TABASCO", "TAMAULIPAS", "TLAXCALA", "VERACRUZ DE IGNACIO DE LA LLAVE", "YUCATAN", "ZACATECAS"];
const ENT_GZ_B64 = "/*__ENTB64__*/";
const MUN_GZ_B64 = "/*__MUNB64__*/";

/* Base CLUES empaquetada: JSON {I,E,M,V,T,R} → gzip → base64 (38,526 registros) */
const DATA_GZ_B64 = "/*__DATAB64__*/";
const BASE_GZ_B64 = "/*__BASEB64__*/";

/* Detalles por unidad (columnar, alineado con la base): localidad, jurisdicción, tipología, domicilio, teléfono, horarios, servicios */
const DETALLES_GZ_B64 = "/*__DETB64__*/";
