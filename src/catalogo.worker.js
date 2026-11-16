/* Procesador de un catálogo CLUES nuevo (ESTABLECIMIENTO_SALUD_AAAAMM.xlsx).
   Corre en un Web Worker para no congelar la página. Requiere SheetJS (XLSX) cargado antes.
   Entrada:  { buf: ArrayBuffer, nombre, geo: {mun:[{k,b,r}], ent:[{b,r}]}, entNombres, actual: {...} }
   Salida:   mensajes {tipo:"paso"} y al final {tipo:"listo", pack, det, meta, reporte} o {tipo:"error"} */
const NIVELES = ["PRIMER NIVEL", "SEGUNDO NIVEL", "TERCER NIVEL"];
const REQUERIDAS = [
  "CLUES", "NOMBRE DE LA INSTITUCION", "NOMBRE DE LA UNIDAD", "ENTIDAD", "CLAVE DE LA ENTIDAD", "MUNICIPIO", "CLAVE DEL MUNICIPIO",
  "NOMBRE TIPO ESTABLECIMIENTO", "ESTATUS DE OPERACION", "NIVEL ATENCION", "LATITUD", "LONGITUD",
];
const OPCIONALES = [
  "LOCALIDAD", "JURISDICCION", "NOMBRE DE TIPOLOGIA", "NOMBRE DE SUBTIPOLOGIA", "TIPO DE VIALIDAD", "VIALIDAD", "NUMERO EXTERIOR", "NUMERO INTERIOR",
  "TIPO DE ASENTAMIENTO", "ASENTAMIENTO", "CODIGO POSTAL", "TELEFONO 1 DEL ESTABLECIMIENTO", "EXTENSION TELEFONICA 1 DEL ESTABLECIMIENTO",
  "FECHA DE INICIO DE OPERACION", "ESTRATO UNIDAD", "NOMBRE DE LA INS ADM",
];
const paso = (n, texto) => self.postMessage({ tipo: "paso", n, texto });
const txt = (v) => (v == null ? "" : v instanceof Date ? fecha(v) : String(v).trim());
const fecha = (d) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
const num = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(",", ".").replace(/[°º\s]/g, "");
  const n = Number(s);
  return s && Number.isFinite(n) ? n : null;
};
const clave = (v, n) => { const s = txt(v).replace(/\.0+$/, ""); return /^\d+$/.test(s) ? s.padStart(n, "0") : s; };

/* ---------- geometría ---------- */
function pip(x, y, ring) {
  let dentro = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  const cx = ax + t * dx - px, cy = ay + t * dy - py;
  return Math.sqrt(cx * cx + cy * cy);
}
// ¿(x,y) cae dentro del elemento, o a menos de `tol` grados de su borde?
function dentro(f, x, y, tol) {
  if (x < f.b[0] - tol || x > f.b[2] + tol || y < f.b[1] - tol || y > f.b[3] + tol) return false;
  for (const r of f.r) if (pip(x, y, r)) return true;
  if (!tol) return false;
  for (const r of f.r) for (let i = 1; i < r.length; i++) if (distSeg(x, y, r[i - 1][0], r[i - 1][1], r[i][0], r[i][1]) <= tol) return true;
  return false;
}
function candidatos(la, lo) {
  const c = [];
  for (const [a, b] of [[la, lo], [lo, la]]) for (const sb of [b, -Math.abs(b)]) for (const sa of [a, Math.abs(a)]) c.push([sa, sb]);
  const out = [];
  const F = [10, 100, 1000, 1e4, 1e5, 1e6, 1e7];
  for (const [a, b] of c) {
    out.push([a, b]);
    for (const f of F) {
      if (Math.abs(a) > 40 && Math.abs(a) / f > 14 && Math.abs(a) / f < 33) out.push([a / f, b]);
      if (Math.abs(b) > 120 && Math.abs(b) / f > 86 && Math.abs(b) / f < 118) out.push([a, b / f]);
      if (Math.abs(a) > 40 && Math.abs(b) > 120 && Math.abs(a) / f > 14 && Math.abs(a) / f < 33)
        for (const f2 of F) if (Math.abs(b) / f2 > 86 && Math.abs(b) / f2 < 118) out.push([a / f, b / f2]);
    }
  }
  return out;
}

self.onmessage = (ev) => {
  try {
    procesar(ev.data);
  } catch (e) {
    self.postMessage({ tipo: "error", texto: String((e && e.message) || e) });
  }
};

function procesar({ buf, nombre, geo, entNombres, actual }) {
  /* 1. Leer el libro */
  paso(1, "Leyendo el archivo de Excel…");
  const nombres = XLSX.read(buf, { type: "array", bookSheets: true }).SheetNames;
  const hoja = (pref) => nombres.find((n) => n.toUpperCase().replace(/\s/g, "").startsWith(pref));
  const sC = hoja("CLUES"), sH = hoja("HORARIOS"), sS = hoja("SUBCLUES");
  if (!sC) throw new Error(`No se encontró la hoja de establecimientos (CLUES_AAAAMM). Hojas del archivo: ${nombres.join(", ")}`);
  const wb = XLSX.read(buf, { type: "array", dense: true, cellDates: true, sheets: [sC, sH, sS].filter(Boolean) });
  const filas = (n) => (n ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }) : []);

  /* 2. Validar estructura */
  paso(2, "Revisando la estructura del archivo…");
  const tabla = filas(sC);
  const enc = (tabla[0] || []).map((h) => txt(h).toUpperCase());
  const ix = Object.fromEntries(enc.map((h, i) => [h, i]));
  const faltan = REQUERIDAS.filter((c) => !(c in ix));
  if (faltan.length) throw new Error(`Al archivo le faltan columnas obligatorias: ${faltan.join(", ")}.`);
  const faltanOpc = OPCIONALES.filter((c) => !(c in ix));
  const g = (r, c) => (c in ix ? r[ix[c]] : null);
  const corte = ((nombre.match(/(20\d{2})(0[1-9]|1[0-2])/) || sC.match(/(20\d{2})(0[1-9]|1[0-2])/) || [])[0] || "").replace(/(\d{4})(\d{2})/, "$1-$2");
  const estatus = {};
  const sel = [];
  for (let i = 1; i < tabla.length; i++) {
    const r = tabla[i];
    const cl = txt(g(r, "CLUES"));
    if (!cl) continue;
    const st = txt(g(r, "ESTATUS DE OPERACION")).toUpperCase();
    estatus[st] = (estatus[st] || 0) + 1;
    const nv = txt(g(r, "NIVEL ATENCION")).toUpperCase();
    if (st !== "EN OPERACION" || !NIVELES.includes(nv)) continue;
    sel.push(r);
  }
  if (!sel.length) throw new Error("No hay unidades “EN OPERACION” de primer, segundo o tercer nivel en el archivo.");
  sel.sort((a, b) => (txt(g(a, "CLUES")) < txt(g(b, "CLUES")) ? -1 : 1));

  /* 3. Validar coordenadas contra el Marco Geoestadístico INEGI */
  paso(3, `Validando las coordenadas de ${sel.length.toLocaleString("es-MX")} unidades contra el INEGI…`);
  const munPorClave = new Map();
  for (const f of geo.mun) if (f.k) (munPorClave.get(f.k) || munPorClave.set(f.k, []).get(f.k)).push(f);
  const enMun = (k, x, y, tol) => (munPorClave.get(k) || []).some((f) => dentro(f, x, y, tol));
  const entDe = (x, y) => { for (let i = 0; i < geo.ent.length; i++) if (dentro(geo.ent[i], x, y, 0)) return i; return -1; };
  const TOL_MUN = 0.0045, TOL_ENT = 0.009; // ≈ 500 m y 1 km
  const res = sel.map((r) => {
    const ce = clave(g(r, "CLAVE DE LA ENTIDAD"), 2), cm = clave(g(r, "CLAVE DEL MUNICIPIO"), 3);
    const la = num(g(r, "LATITUD")), lo = num(g(r, "LONGITUD"));
    const key = ce + cm, ei = parseInt(ce, 10) - 1;
    if (la == null || lo == null || (la === 0 && lo === 0)) return { q: 5, la: null, lo: null, ce };
    if (enMun(key, lo, la, TOL_MUN)) return { q: 0, la, lo, ce };
    if (geo.ent[ei] && dentro(geo.ent[ei], lo, la, TOL_ENT)) return { q: 1, la, lo, ce };
    for (const [a, b] of candidatos(la, lo)) if ((a !== la || b !== lo) && enMun(key, b, a, TOL_MUN)) return { q: 3, la: a, lo: b, ce };
    return { q: 4, la, lo, ce };
  });
  // coordenadas genéricas: el mismo punto exacto en 5 o más unidades
  const cuenta = new Map();
  const kc = (x) => `${x.la.toFixed(5)},${x.lo.toFixed(5)}`;
  for (const x of res) if (x.q <= 1) cuenta.set(kc(x), (cuenta.get(kc(x)) || 0) + 1);
  for (const x of res) if (x.q <= 1 && cuenta.get(kc(x)) >= 5) x.q = 2;
  for (const x of res) x.cae = x.la == null ? -1 : entDe(x.lo, x.la);
  // código postal → entidad (aprendido de las verificadas); si domicilio y coordenada coinciden, la entidad registrada es la inconsistente
  const pad = (c) => (/^\d{1,4}$/.test(c) ? c.padStart(5, "0") : c);
  const cps = sel.map((r) => pad(txt(g(r, "CODIGO POSTAL")).replace(/\.0+$/, "")));
  const votos = {};
  res.forEach((x, i) => { if (x.q === 0 && cps[i]) { const p = cps[i].slice(0, 2); (votos[p] ||= {})[x.ce] = ((votos[p] || {})[x.ce] || 0) + 1; } });
  const cpEnt = Object.fromEntries(Object.entries(votos).map(([p, v]) => [p, Object.entries(v).sort((a, b) => b[1] - a[1])[0][0]]));
  res.forEach((x, i) => { if (x.q === 4 && cps[i] && x.cae >= 0 && cpEnt[cps[i].slice(0, 2)] === String(x.cae + 1).padStart(2, "0")) x.q = 6; });

  /* 4. Empaquetar en el mismo formato que usa el tablero */
  paso(4, "Preparando el catálogo para el tablero…");
  const dict = () => { const m = new Map(); return { m, ix: (v) => (m.has(v) ? m.get(v) : (m.set(v, m.size), m.size - 1)) }; };
  const uniq = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, "es"));
  const instL = uniq(sel.map((r) => txt(g(r, "NOMBRE DE LA INSTITUCION"))));
  const entL = uniq(sel.map((r) => txt(g(r, "ENTIDAD"))));
  const munL = uniq(sel.map((r) => `${txt(g(r, "ENTIDAD"))}\u0001${txt(g(r, "MUNICIPIO"))}`));
  const tipoL = uniq(sel.map((r) => txt(g(r, "NOMBRE TIPO ESTABLECIMIENTO"))));
  const iI = new Map(instL.map((v, i) => [v, i])), iE = new Map(entL.map((v, i) => [v, i])), iM = new Map(munL.map((v, i) => [v, i])), iT = new Map(tipoL.map((v, i) => [v, i]));
  const C = [[], [], [], [], [], [], [], [], [], []];
  sel.forEach((r, k) => {
    const x = res[k];
    C[0].push(txt(g(r, "CLUES")));
    C[1].push(txt(g(r, "NOMBRE DE LA UNIDAD")));
    C[2].push(iI.get(txt(g(r, "NOMBRE DE LA INSTITUCION"))));
    C[3].push(iM.get(`${txt(g(r, "ENTIDAD"))}\u0001${txt(g(r, "MUNICIPIO"))}`));
    C[4].push(NIVELES.indexOf(txt(g(r, "NIVEL ATENCION")).toUpperCase()));
    C[5].push(iT.get(txt(g(r, "NOMBRE TIPO ESTABLECIMIENTO"))));
    C[6].push(x.la == null ? null : Math.round(x.la * 1e5));
    C[7].push(x.lo == null ? null : Math.round(x.lo * 1e5));
    C[8].push(x.q);
    C[9].push(x.cae);
  });
  const pack = { I: instL, E: entL, M: munL.map((s) => { const [e, m] = s.split("\u0001"); return [iE.get(e), m]; }), V: NIVELES, T: tipoL, C };

  // detalles: domicilio, teléfono, tipología, horarios y servicios
  const hor = new Map();
  for (const r of filas(sH).slice(1)) {
    const cl = txt(r[0]);
    if (!cl) continue;
    const grupos = [];
    for (let k = 1; k + 8 < r.length + 1; k += 9) {
      if (r[k] == null || r[k] === "") continue;
      const mask = [0, 1, 2, 3, 4, 5, 6].map((d) => (txt(r[k + d]).toUpperCase() === "SI" ? "1" : "0")).join("");
      grupos.push(`${mask}|${txt(r[k + 7])}|${txt(r[k + 8])}`);
    }
    hor.set(cl, grupos.join(";"));
  }
  const srv = new Map();
  for (const r of filas(sS).slice(1)) {
    const cl = txt(r[0]);
    if (!cl) continue;
    const s = [];
    for (let k = 1; k < r.length; k += 7) if (r[k] != null && r[k] !== "") s.push(`${txt(r[k + 2])}|${txt(r[k + 4])}|${txt(r[k + 6])}`);
    srv.set(cl, s);
  }
  const D = { loc: dict(), jur: dict(), tip: dict(), sub: dict(), vt: dict(), at: dict(), est: dict(), adm: dict(), hor: dict(), srv: dict() };
  const noEsp = (v) => (/^NO ESPECIFICADO$/i.test(v) ? "" : v);
  const DC = Array.from({ length: 18 }, () => []);
  sel.forEach((r, k) => {
    const cl = C[0][k];
    const fila = [
      D.loc.ix(txt(g(r, "LOCALIDAD"))), D.jur.ix(txt(g(r, "JURISDICCION"))), D.tip.ix(noEsp(txt(g(r, "NOMBRE DE TIPOLOGIA")))), D.sub.ix(noEsp(txt(g(r, "NOMBRE DE SUBTIPOLOGIA")))),
      D.vt.ix(txt(g(r, "TIPO DE VIALIDAD"))), txt(g(r, "VIALIDAD")), txt(g(r, "NUMERO EXTERIOR")), txt(g(r, "NUMERO INTERIOR")),
      D.at.ix(txt(g(r, "TIPO DE ASENTAMIENTO"))), txt(g(r, "ASENTAMIENTO")), cps[k], txt(g(r, "TELEFONO 1 DEL ESTABLECIMIENTO")).replace(/\.0+$/, ""),
      txt(g(r, "EXTENSION TELEFONICA 1 DEL ESTABLECIMIENTO")).replace(/\.0+$/, ""), txt(g(r, "FECHA DE INICIO DE OPERACION")), D.est.ix(txt(g(r, "ESTRATO UNIDAD"))), D.adm.ix(txt(g(r, "NOMBRE DE LA INS ADM"))),
      D.hor.ix(hor.get(cl) || ""), (srv.get(cl) || []).map((s) => D.srv.ix(s)),
    ];
    fila.forEach((v, c) => DC[c].push(v));
  });
  const det = { ...Object.fromEntries(Object.entries(D).map(([k, d]) => [k, [...d.m.keys()]])), C: DC };

  /* 5. Comparar con el catálogo en uso */
  paso(5, "Comparando con el catálogo en uso…");
  const previo = new Map();
  actual.cl.forEach((c, i) => previo.set(c, i));
  const nuevos = new Set(C[0]);
  const NV = ["Primer nivel", "Segundo nivel", "Tercer nivel"];
  const altas = [], bajas = [], cambios = [];
  const fila = (k) => ({ clues: C[0][k], unidad: C[1][k], inst: instL[C[2][k]], ent: entL[pack.M[C[3][k]][0]], mun: pack.M[C[3][k]][1], nivel: NV[C[4][k]] });
  for (let k = 0; k < C[0].length; k++) {
    const i = previo.get(C[0][k]);
    const f = fila(k);
    if (i == null) { altas.push(f); continue; }
    const dif = [];
    if (actual.nom[i] !== f.unidad) dif.push(["Nombre", actual.nom[i], f.unidad]);
    if (actual.inst[i] !== f.inst) dif.push(["Institución", actual.inst[i], f.inst]);
    if (actual.ent[i] !== f.ent || actual.mun[i] !== f.mun) dif.push(["Ubicación administrativa", `${actual.mun[i]}, ${actual.ent[i]}`, `${f.mun}, ${f.ent}`]);
    if (actual.niv[i] !== C[4][k]) dif.push(["Nivel de atención", NV[actual.niv[i]], f.nivel]);
    const la0 = actual.la[i], lo0 = actual.lo[i], la1 = C[6][k], lo1 = C[7][k];
    if ((la0 == null) !== (la1 == null)) dif.push(["Coordenadas", la0 == null ? "sin coordenadas" : `${la0 / 1e5}, ${lo0 / 1e5}`, la1 == null ? "sin coordenadas" : `${la1 / 1e5}, ${lo1 / 1e5}`]);
    else if (la0 != null) {
      const dy = (la1 - la0) / 1e5 * 111.32, dx = ((lo1 - lo0) / 1e5) * 111.32 * Math.cos((la1 / 1e5) * Math.PI / 180);
      const km = Math.hypot(dx, dy);
      if (km > 0.1) dif.push(["Coordenadas", `${la0 / 1e5}, ${lo0 / 1e5}`, `${la1 / 1e5}, ${lo1 / 1e5} (se movió ${km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km"})`]);
    }
    if (dif.length) cambios.push({ ...f, dif });
  }
  actual.cl.forEach((c, i) => {
    if (!nuevos.has(c)) bajas.push({ clues: c, unidad: actual.nom[i], inst: actual.inst[i], ent: actual.ent[i], mun: actual.mun[i], nivel: NV[actual.niv[i]] });
  });
  const calidad = [0, 0, 0, 0, 0, 0, 0];
  res.forEach((x) => calidad[x.q]++);
  const niveles = [0, 0, 0];
  C[4].forEach((v) => niveles[v]++);

  self.postMessage({
    tipo: "listo",
    pack,
    det,
    meta: { archivo: nombre, corte, total: C[0].length, filasHoja: tabla.length - 1, hojas: { clues: sC, horarios: sH || null, subclues: sS || null }, faltanOpc, estatus, niveles, calidad, cargado: new Date().toISOString() },
    reporte: { altas, bajas, cambios },
  });
}
