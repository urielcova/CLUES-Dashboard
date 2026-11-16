import WORKER_SRC from "./catalogo.worker.js";
import { C } from "./instituciones";
import { parseHorario } from "./util";

/* Decodifica la base empaquetada (gzip + base64) → arreglo de registros con las columnas originales */
// Los bloques de datos pueden venir en <script type="text/plain" id="..."> (versión HTML: no se analizan como JS)
// En GitHub Pages, index.html define window.__cluesDatos(id) → Promise<Uint8Array> (gzip binario, descarga bajo demanda)
export const blob = (id) => window.__cluesDatos?.(id) || document.getElementById(id)?.textContent.trim() || "";
export const aBytes = (b64) => {
  const s = atob(b64);
  const bin = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
  return bin;
};
export async function gunzipB64(entrada) {
  const v = await entrada;
  const bin = typeof v === "string" ? aBytes(v) : v;
  return JSON.parse(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
}

/* Calidad de la coordenada, validada contra el Marco Geoestadístico INEGI 2025 (entidad y municipio declarados) */
export const CALIDAD = {
  0: { t: "Verificada", d: "La coordenada cae dentro de su municipio declarado.", c: "#15803d", mapa: true, cercana: true },
  1: { t: "Otro municipio", d: "La coordenada cae en otro municipio de la misma entidad.", c: "#b45309", mapa: true, cercana: true },
  2: { t: "Coordenada genérica", d: "Varias unidades comparten exactamente esta coordenada; probablemente es un punto de referencia, no el domicilio.", c: "#b45309", mapa: true, cercana: false },
  3: { t: "Corregida", d: "Se corrigió el signo de la longitud registrada (venía positiva).", c: "#1d4ed8", mapa: true, cercana: true },
  4: { t: "Fuera de su entidad", d: "La coordenada registrada cae fuera de la entidad declarada.", c: "#b91c1c", mapa: false, cercana: false },
  5: { t: "Sin coordenadas", d: "La unidad no tiene coordenadas registradas.", c: "#6b7280", mapa: false, cercana: false },
  6: { t: "Entidad registrada inconsistente", d: "La coordenada y el código postal del domicilio coinciden entre sí, pero no con la entidad registrada en el catálogo.", c: "#b45309", mapa: true, cercana: true },
};
export const FILTRO_CALIDAD = { verificada: [0, 3], revisar: [1, 2, 6], excluida: [4, 5] };

export let _packActual = null; // empaque del catálogo en uso (para comparar contra uno nuevo)
export const cargarBase = async () => construirBase(await gunzipB64(blob("d-base")));
export function construirBase(pack) {
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
export const decodeRings = (rings, q) =>
  rings.map((f) => {
    const out = [];
    let x = f[0], y = f[1];
    out.push([x / q, y / q]);
    for (let i = 2; i < f.length; i += 2) { x += f[i]; y += f[i + 1]; out.push([x / q, y / q]); }
    return [out];
  });
export let _entGeo = null, _munGeo = null, _ref = null;
export const decodeLines = (lines, q) =>
  lines.map((f) => {
    const out = [];
    let x = f[0], y = f[1];
    out.push([x / q, y / q]);
    for (let i = 2; i < f.length; i += 2) { x += f[i]; y += f[i + 1]; out.push([x / q, y / q]); }
    return out;
  });
/* Capa de referencia (Natural Earth 1:10m, dominio público) + localidades a partir de la base CLUES */
export const capaReferencia = () =>
  (_ref ??= gunzipB64(blob("d-ref")).then((B) => {
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
export const entidadesGeo = () =>
  (_entGeo ??= gunzipB64(blob("d-ent")).then((E) => ({
    type: "FeatureCollection",
    features: E.g.map((r, i) => ({ type: "Feature", properties: { ent: E.n[i] }, geometry: { type: "MultiPolygon", coordinates: decodeRings(r, E.q) } })),
  })));
export const municipiosGeo = () =>
  (_munGeo ??= gunzipB64(blob("d-mun")).then((Mg) => ({
    type: "FeatureCollection",
    features: Mg.g.map((r, i) => ({
      type: "Feature",
      properties: { key: Mg.k[i], mun: Mg.nm[i], ent: ENT_NOMBRES[Mg.e[i] - 1], lat: Mg.c[i][0] / 1e3, lng: Mg.c[i][1] / 1e3 },
      geometry: { type: "MultiPolygon", coordinates: decodeRings(r, Mg.q) },
    })),
  })));

/* Detalles (dirección, teléfono, tipología, horarios, servicios): se descomprimen la primera vez que se abre una ficha */
export let _detallesPromesa = null;
export const fijarDetalles = (p) => { _detallesPromesa = p; };
export const cargarDetalles = () => (_detallesPromesa ??= gunzipB64(blob("d-detalles")));
export const noEsp = (v) => (v && !/^NO ESPECIFICADO$/i.test(v) ? v : "");
export function detalleDe(pk, i) {
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
export const META_PUBLICADO = { archivo: "ESTABLECIMIENTO_SALUD_202609.xlsx", corte: "2026-09", fuente: "publicado" };
export const XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
export async function crearWorkerCatalogo() {
  // Lector de Excel (SheetJS): incluido comprimido en la versión HTML (funciona sin internet); si no, desde cdnjs
  const gz = window.__cluesDatos ? await window.__cluesDatos("w-xlsx-gz").catch(() => null) : document.getElementById("w-xlsx-gz")?.textContent.trim();
  let pre = `importScripts(${JSON.stringify(XLSX_CDN)});`;
  if (gz && (gz.byteLength || gz.length) > 1000) {
    const bin = typeof gz === "string" ? aBytes(gz) : gz;
    pre = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  return new Worker(URL.createObjectURL(new Blob([pre, "\n;\n", WORKER_SRC], { type: "text/javascript" })));
}
export async function geometriaParaValidar() {
  const [ent, mun] = await Promise.all([entidadesGeo(), municipiosGeo()]);
  const conv = (f) => {
    const r = f.geometry.coordinates.map((p) => p[0]);
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    for (const ring of r) for (const [x, y] of ring) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
    return { b: [a, b, c, d], r };
  };
  return { ent: ent.features.map(conv), mun: mun.features.map((f) => ({ ...conv(f), k: f.properties.key })) };
}
/* Marco Geoestadístico INEGI 2025 (00ent / 00mun), reproyectado a WGS84 y simplificado (~200 m) */
export const ENT_CENTROS = [[22.006, -102.362], [30.586, -115.111], [25.936, -112.06], [18.84, -90.36], [27.295, -102.044], [19.141, -103.913], [16.485, -92.473], [28.809, -106.469], [19.278, -99.14], [24.924, -104.913], [20.905, -101.013], [17.668, -99.922], [20.48, -98.887], [20.581, -103.613], [19.356, -99.645], [19.207, -101.878], [18.743, -99.075], [21.804, -104.841], [25.573, -99.969], [16.961, -96.43], [19.006, -97.9], [20.855, -99.846], [19.591, -88.127], [22.585, -100.417], [25.001, -107.509], [29.696, -110.8], [17.938, -92.594], [24.291, -98.641], [19.429, -98.169], [19.393, -96.419], [20.747, -88.921], [23.289, -102.661]];
export const ENT_NOMBRES = ["AGUASCALIENTES", "BAJA CALIFORNIA", "BAJA CALIFORNIA SUR", "CAMPECHE", "COAHUILA DE ZARAGOZA", "COLIMA", "CHIAPAS", "CHIHUAHUA", "CIUDAD DE MEXICO", "DURANGO", "GUANAJUATO", "GUERRERO", "HIDALGO", "JALISCO", "MEXICO", "MICHOACAN DE OCAMPO", "MORELOS", "NAYARIT", "NUEVO LEON", "OAXACA", "PUEBLA", "QUERETARO", "QUINTANA ROO", "SAN LUIS POTOSI", "SINALOA", "SONORA", "TABASCO", "TAMAULIPAS", "TLAXCALA", "VERACRUZ DE IGNACIO DE LA LLAVE", "YUCATAN", "ZACATECAS"];
