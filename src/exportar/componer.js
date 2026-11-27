/* Composición del mapa para presentaciones: el mismo dibujo sirve para la vista previa (canvas),
   el PNG de alta resolución y el SVG (vía SvgCtx). Proyección: equirectangular con corrección
   cos(latitud central) — coordenadas WGS 84 (EPSG:4326). */
import { C, INST_COLOR, NIVEL_COLOR, instInfo, trazarForma } from "../instituciones";
import { fold, titleCase, fmtN } from "../util";
import { claseDe, clasificar } from "./clasificar";
import { esOscuro, paletaCat, paletaSec, rampa } from "./paletas";

/* Fuentes disponibles (Google Fonts, licencia libre; las de sistema no se descargan) */
export const FUENTES = [
  { id: "montserrat", nombre: "Montserrat", css: "Montserrat", google: "Montserrat:wght@400;500;600;700;800" },
  { id: "noto", nombre: "Noto Sans", css: "Noto Sans", google: "Noto+Sans:wght@400;500;600;700;800" },
  { id: "open", nombre: "Open Sans", css: "Open Sans", google: "Open+Sans:wght@400;500;600;700;800" },
  { id: "roboto", nombre: "Roboto", css: "Roboto", google: "Roboto:wght@400;500;700;900" },
  { id: "lato", nombre: "Lato", css: "Lato", google: "Lato:wght@400;700;900" },
  { id: "source", nombre: "Source Sans 3", css: "Source Sans 3", google: "Source+Sans+3:wght@400;500;600;700;800" },
  { id: "inter", nombre: "Inter", css: "Inter", google: "Inter:wght@400;500;600;700;800" },
  { id: "poppins", nombre: "Poppins", css: "Poppins", google: "Poppins:wght@400;500;600;700;800" },
  { id: "nunito", nombre: "Nunito Sans", css: "Nunito Sans", google: "Nunito+Sans:wght@400;600;700;800" },
  { id: "plex", nombre: "IBM Plex Sans", css: "IBM Plex Sans", google: "IBM+Plex+Sans:wght@400;500;600;700" },
  { id: "barlow", nombre: "Barlow", css: "Barlow", google: "Barlow:wght@400;500;600;700;800" },
  { id: "oswald", nombre: "Oswald (condensada)", css: "Oswald", google: "Oswald:wght@400;500;600;700" },
  { id: "merriweather", nombre: "Merriweather (serif)", css: "Merriweather", google: "Merriweather:wght@400;700;900" },
  { id: "lora", nombre: "Lora (serif)", css: "Lora", google: "Lora:wght@400;500;600;700" },
  { id: "playfair", nombre: "Playfair Display (serif)", css: "Playfair Display", google: "Playfair+Display:wght@400;600;700;800" },
  { id: "robotoslab", nombre: "Roboto Slab", css: "Roboto Slab", google: "Roboto+Slab:wght@400;500;700;800" },
  { id: "arial", nombre: "Arial / Helvetica (sistema)", css: "Arial", google: null },
  { id: "georgia", nombre: "Georgia (sistema)", css: "Georgia", google: null },
  { id: "verdana", nombre: "Verdana (sistema)", css: "Verdana", google: null },
];
export const fuentePorId = (id) => FUENTES.find((f) => f.id === id) || FUENTES[0];
const pila = (f) => `"${f.css}", ${/serif\)|Georgia|Slab/.test(f.nombre) ? "Georgia, serif" : "system-ui, sans-serif"}`;
// Se fijan al inicio de cada composición (la composición es síncrona)
let FAM_T = pila(FUENTES[0]), FAM_X = pila(FUENTES[0]), ESC_T = 1, COLOR_T = "#111827";
const fuente = (px, peso = 400) => `${peso} ${Math.round(px * ESC_T * 10) / 10}px ${FAM_X}`;
const fuenteT = (px, peso = 800) => `${peso} ${Math.round(px * ESC_T * 10) / 10}px ${FAM_T}`;
export const MEXICO_BBOX = [-118.6, 14.3, -86.5, 32.9];
const GRIS_FUERA = "#d3d5d7";
const CREMA = "#f7f4ef";

export const FORMATOS = [
  { id: "16x9", nombre: "Diapositiva 16:9", w: 1920, h: 1080 },
  { id: "4x3", nombre: "Diapositiva 4:3", w: 1600, h: 1200 },
  { id: "1x1", nombre: "Cuadrado 1:1", w: 1500, h: 1500 },
  { id: "4x5", nombre: "Vertical 4:5", w: 1200, h: 1500 },
  { id: "9x16", nombre: "Vertical 9:16", w: 1080, h: 1920 },
  { id: "carta-h", nombre: "Carta horizontal", w: 2200, h: 1700 },
  { id: "carta-v", nombre: "Carta vertical", w: 1700, h: 2200 },
];

/* ---------------- Preparación (pesada; se memoriza fuera del dibujo) ---------------- */
const bboxDe = (features) => {
  let a = 180, b = 90, c = -180, d = -90;
  for (const f of features) for (const p of f.geometry.coordinates) for (const r of p) for (const [x, y] of r) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return a <= c ? [a, b, c, d] : MEXICO_BBOX;
};
const areaKm2 = (f) => {
  let t = 0;
  for (const p of f.geometry.coordinates)
    for (const r of p) {
      let s = 0, lat = 0;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) { s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); lat += r[i][1]; }
      t += Math.abs(s / 2) * 111.32 * 111.32 * Math.cos(((lat / r.length) * Math.PI) / 180);
    }
  return t;
};
export const claveMun = (ent, mun) => fold(`${ent}||${mun}`);

export function preparar(g, o) {
  const { entFC, munFC, unidades, selEnt, selMun, jurPorMun, seleccion } = g;
  const setEnt = new Set(selEnt.map((e) => fold(e)));
  const setMun = new Set(selMun.map((k) => fold(k)));
  const munsEstudio = munFC.features.filter((f) =>
    setMun.size ? setMun.has(claveMun(f.properties.ent, f.properties.mun)) : setEnt.size ? setEnt.has(fold(f.properties.ent)) : true
  );
  const entsConMun = new Set(munsEstudio.map((f) => fold(f.properties.ent)));
  const entEstudio = entFC.features.filter((f) => (setEnt.size || setMun.size ? entsConMun.has(fold(f.properties.ent)) : true));
  const nacional = !setEnt.size && !setMun.size;

  // puntos dibujables
  const conCoord = unidades.filter((u) => u.LATITUD != null);
  const claveSel = new Set(seleccion.map((u) => u.CLUES));
  const puntos = o.soloSeleccion ? conCoord.filter((u) => claveSel.has(u.CLUES)) : conCoord;

  // encuadre
  let bbox;
  if (o.encuadre === "puntos" && puntos.length) {
    let a = 180, b = 90, c = -180, d = -90;
    for (const u of puntos) { if (u.LONGITUD < a) a = u.LONGITUD; if (u.LATITUD < b) b = u.LATITUD; if (u.LONGITUD > c) c = u.LONGITUD; if (u.LATITUD > d) d = u.LATITUD; }
    const m = Math.max(0.05, (c - a) * 0.04, (d - b) * 0.04);
    bbox = [a - m, b - m, c + m, d + m];
  } else bbox = nacional ? MEXICO_BBOX : bboxDe(munsEstudio);

  // conteo por municipio (con todas las unidades filtradas, tengan o no coordenadas)
  const conteo = new Map();
  for (const u of unidades) { const k = claveMun(u.ENTIDAD, u.MUNICIPIO); conteo.set(k, (conteo.get(k) || 0) + 1); }

  const relleno = new Map(); // clave municipio → color
  const leyendaMun = [];
  let tituloMun = "";
  if (o.municipios === "concentracion") {
    const valor = new Map();
    for (const f of munsEstudio) {
      const k = claveMun(f.properties.ent, f.properties.mun);
      const n = conteo.get(k) || 0;
      valor.set(k, o.medida === "densidad" ? (n ? (n / Math.max(areaKm2(f), 1)) * 1000 : 0) : n);
    }
    const positivos = [...valor.values()].filter((v) => v > 0);
    const cortes = clasificar(positivos, o.clases, o.metodo);
    const colores = rampa(paletaSec(o.paleta, o.paletaPersonal, o.invertir).c, Math.max(1, cortes.length - 1));
    for (const [k, v] of valor) relleno.set(k, v > 0 && cortes.length ? colores[claseDe(v, cortes)] : "#f2f2f2");
    const dec = o.medida === "densidad" ? (cortes[cortes.length - 1] < 10 ? 2 : 1) : 0;
    const fmt = (x) => x.toLocaleString("es-MX", { maximumFractionDigits: dec, minimumFractionDigits: dec });
    for (let i = 0; i < cortes.length - 1; i++) {
      const lo = i === 0 ? cortes[0] : o.medida === "densidad" ? cortes[i] : Math.floor(cortes[i]) + 1;
      const hi = cortes[i + 1];
      leyendaMun.push({ color: colores[i], texto: lo >= hi ? fmt(hi) : `${fmt(lo)} – ${fmt(hi)}` });
    }
    if (positivos.length < valor.size) leyendaMun.push({ color: "#f2f2f2", texto: "Sin unidades", borde: true });
    tituloMun = o.medida === "densidad" ? "Unidades por 1,000 km²" : "Unidades por municipio";
  }
  const jurs = [];
  if (o.municipios === "jurisdiccion") {
    const orden = new Map();
    for (const f of munsEstudio) {
      const j = jurPorMun?.get(claveMun(f.properties.ent, f.properties.mun));
      if (j && !orden.has(j.clave)) orden.set(j.clave, { ...j, lat: 0, lng: 0, n: 0 });
      if (j) { const r = orden.get(j.clave); r.lat += f.properties.lat; r.lng += f.properties.lng; r.n++; }
    }
    const lista = [...orden.values()].sort((a, b) => a.ent.localeCompare(b.ent, "es") || a.nombre.localeCompare(b.nombre, "es"));
    const pal = paletaCat(o.paletaCat).c;
    lista.forEach((j, i) => { j.color = pal[i % pal.length]; j.lat /= j.n; j.lng /= j.n; jurs.push(j); });
    const color = new Map(lista.map((j) => [j.clave, j.color]));
    for (const f of munsEstudio) {
      const k = claveMun(f.properties.ent, f.properties.mun);
      const j = jurPorMun?.get(k);
      relleno.set(k, j ? color.get(j.clave) : "#e5e5e5");
    }
    const variasEnt = new Set(lista.map((j) => j.ent)).size > 1;
    for (const j of lista) leyendaMun.push({ color: j.color, texto: titleCase(j.nombre) + (variasEnt ? ` (${titleCase(j.entCorta)})` : "") });
    tituloMun = "Jurisdicción sanitaria";
  }

  // Contorno de jurisdicciones: segmentos que separan municipios de jurisdicciones distintas
  // (los límites INEGI comparten vértices exactos, así que los segmentos internos se repiten)
  let segJur = null;
  if (o.contornoJur?.ver && jurPorMun) {
    const vistos = new Map(); // clave del segmento → jurisdicción (o null si ya es interno)
    const borde = new Map();
    for (const f of munsEstudio) {
      const j = jurPorMun.get(claveMun(f.properties.ent, f.properties.mun))?.clave || "?";
      for (const p of f.geometry.coordinates)
        for (const r of p)
          for (let i = 0; i < r.length; i++) {
            const a = r[i], b = r[(i + 1) % r.length];
            if (a[0] === b[0] && a[1] === b[1]) continue;
            const ka = `${a[0]},${a[1]}`, kb = `${b[0]},${b[1]}`;
            const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
            if (!vistos.has(k)) { vistos.set(k, j); borde.set(k, [a, b]); }
            else if (vistos.get(k) === j) borde.delete(k); // interno a la misma jurisdicción
          }
    }
    segJur = [...borde.values()];
  }

  return { munsEstudio, entEstudio, nacional, puntos, bbox, relleno, leyendaMun, tituloMun, jurs, conteo, setEnt, setMun, segJur };
}

/* ---------------- Utilidades de dibujo ---------------- */
function envolver(ctx, texto, ancho) {
  const out = [];
  for (const parrafo of String(texto).split("\n")) {
    let linea = "";
    for (const p of parrafo.split(/\s+/)) {
      const prueba = linea ? `${linea} ${p}` : p;
      if (ctx.measureText(prueba).width > ancho && linea) { out.push(linea); linea = p; } else linea = prueba;
    }
    out.push(linea);
  }
  return out;
}
function textoHalo(ctx, t, x, y, px, color = "#1f2937", halo = "rgba(255,255,255,0.9)") {
  ctx.lineWidth = Math.max(2, px * 0.28);
  ctx.strokeStyle = halo;
  ctx.lineJoin = "round";
  ctx.strokeText(t, x, y);
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
}
function trazarFeatures(ctx, features, pr) {
  ctx.beginPath();
  for (const f of features)
    for (const p of f.geometry.coordinates)
      for (const r of p) {
        for (let i = 0; i < r.length; i++) { const [x, y] = pr(r[i][0], r[i][1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.closePath();
      }
}
/* Encuadre manual: desplazamiento (grados) y acercamiento sobre el encuadre automático */
export function aplicarVista(bbox, v) {
  if (!v || (!v.dLon && !v.dLat && (v.z || 1) === 1)) return bbox;
  const [a, b, c, d] = bbox, z = v.z || 1;
  const cx = (a + c) / 2 + (v.dLon || 0), cy = (b + d) / 2 + (v.dLat || 0);
  const hw = (c - a) / 2 / z, hh = (d - b) / 2 / z;
  return [cx - hw, cy - hh, cx + hw, cy + hh];
}
function proyector(bbox, rect, ajustar = true) {
  const [a, b, c, d] = bbox;
  const k = Math.cos((((b + d) / 2) * Math.PI) / 180);
  const bw = (c - a) * k, bh = d - b;
  const s = ajustar ? Math.min(rect.w / bw, rect.h / bh) : rect.w / bw;
  const ox = rect.x + (rect.w - bw * s) / 2, oy = rect.y + (rect.h - bh * s) / 2;
  const pr = (lon, lat) => [ox + (lon - a) * k * s, oy + (d - lat) * s];
  pr.s = s; pr.k = k;
  pr.inv = (x, y) => [a + (x - ox) / (k * s), d - (y - oy) / s];
  return pr;
}
const nivelIdx = (u) => u._nv ?? ["PRIMER NIVEL", "SEGUNDO NIVEL", "TERCER NIVEL"].indexOf(u["NIVEL ATENCION"]);
const colorPunto = (u, o) =>
  o.puntos.color === "nivel" ? NIVEL_COLOR[u["NIVEL ATENCION"]] || "#6b7280" : o.puntos.color === "institucion" ? INST_COLOR[instInfo(u["NOMBRE DE LA INSTITUCION"]).sigla] || "#6B7280" : o.puntos.colorUnico;

/* ---------------- Composición ---------------- */
export function componer(ctx, W, H, g, o, prep) {
  FAM_T = pila(fuentePorId(o.fuenteTitulos));
  FAM_X = pila(fuentePorId(o.fuenteTexto));
  ESC_T = o.escalaTexto || 1;
  COLOR_T = o.colorTitulo || "#111827";
  const u = Math.min(W, H) / 100; // unidad de diseño
  const m = 2.4 * u;
  const horizontal = W / H >= 1.15;
  ctx.save();
  ctx.fillStyle = o.colorFondo || "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Logo propio (esquina del lienzo)
  let logo = null;
  if (g.logo && o.logo?.pos) {
    const lh = (o.logo.tam || 8) * u, lw = (lh * g.logo.w) / g.logo.h;
    const der = o.logo.pos.endsWith("der"), arriba = o.logo.pos.startsWith("sup");
    logo = { x: der ? W - m - lw : m, y: arriba ? m : H - m - lh, w: lw, h: lh, der, arriba };
  }
  const xl = m + (logo && logo.arriba && !logo.der ? logo.w + 2 * u : 0);
  const xr = W - m - (logo && logo.arriba && logo.der ? logo.w + 2 * u : 0);
  const pie = logo && !logo.arriba ? logo.h + 1.5 * u : 0;

  // Título
  let top = m;
  if (o.titulo) {
    ctx.font = fuenteT(4.4 * u, o.pesoTitulo || 800);
    ctx.textBaseline = "top";
    ctx.textAlign = o.alinearTitulo === "centro" ? "center" : "left";
    ctx.fillStyle = COLOR_T;
    const lt = envolver(ctx, o.titulo, xr - xl);
    const xt = o.alinearTitulo === "centro" ? (xl + xr) / 2 : xl;
    lt.forEach((l, i) => ctx.fillText(l, xt, top + i * 5.2 * u * ESC_T));
    top += lt.length * 5.2 * u * ESC_T + 0.6 * u;
  }
  if (o.subtitulo) {
    ctx.font = fuente(2.4 * u, 500);
    ctx.fillStyle = "#4b5563";
    ctx.textBaseline = "top";
    ctx.textAlign = o.alinearTitulo === "centro" ? "center" : "left";
    const ls = envolver(ctx, o.subtitulo, xr - xl);
    ls.forEach((l, i) => ctx.fillText(l, o.alinearTitulo === "centro" ? (xl + xr) / 2 : xl, top + i * 3 * u * ESC_T));
    top += ls.length * 3 * u * ESC_T;
    ctx.textAlign = "left";
  }
  if (o.titulo || o.subtitulo) top += 1.6 * u;
  if (logo && logo.arriba) top = Math.max(top, logo.y + logo.h + 1.6 * u);
  const bottom = H - m - pie;

  const leyendaEnMapa = o.elementos.leyenda && o.posLeyenda && o.posLeyenda !== "panel";
  const hayPanel = (o.elementos.leyenda && !leyendaEnMapa) || (o.elementos.inset && !prep.nacional) || o.elementos.notas;
  let mapa, panel;
  if (!hayPanel) mapa = { x: m, y: top, w: W - 2 * m, h: bottom - top };
  else if (horizontal) {
    const pw = Math.max(W * 0.28, 36 * u);
    mapa = { x: m, y: top, w: W - pw - 3 * m, h: bottom - top };
    panel = { x: W - pw - m, y: top, w: pw, h: bottom - top, tipo: "lateral" };
  } else {
    const ph = Math.max(H * (W / H > 0.9 ? 0.27 : 0.3), 30 * u);
    mapa = { x: m, y: top, w: W - 2 * m, h: bottom - top - ph - m };
    panel = { x: m, y: bottom - ph, w: W - 2 * m, h: ph, tipo: "inferior" };
  }

  const pr = dibujarMapa(ctx, mapa, u, g, o, prep, leyendaEnMapa ? o.posLeyenda : null);
  if (leyendaEnMapa) dibujarLeyendaEnMapa(ctx, mapa, u, g, o, prep);
  if (panel) dibujarPanel(ctx, panel, u, g, o, prep, !leyendaEnMapa);
  if (logo) {
    if (ctx.drawImage) ctx.drawImage(g.logo.img, logo.x, logo.y, logo.w, logo.h);
    else if (ctx.imagen) ctx.imagen(g.logo.src, logo.x, logo.y, logo.w, logo.h);
  }
  ctx.restore();
  return { mapa, pr };
}

function dibujarMapa(ctx, R, u, g, o, prep, esquinaLeyenda) {
  const bbox = aplicarVista(prep.bbox, o.vista);
  const pr = proyector(bbox, { x: R.x + R.w * 0.02, y: R.y + R.h * 0.02, w: R.w * 0.96, h: R.h * 0.96 });
  ctx.save();
  ctx.beginPath();
  ctx.rect(R.x, R.y, R.w, R.h);
  ctx.clip();
  ctx.fillStyle = o.colorMar;
  ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.lineJoin = "round";

  // 1) México fuera del área de estudio (gris)
  trazarFeatures(ctx, g.entFC.features, pr);
  ctx.fillStyle = prep.nacional ? CREMA : GRIS_FUERA;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.18 * u;
  ctx.stroke();

  // 2) Municipios del área de estudio
  const lw = Math.max(0.35, (prep.nacional ? 0.05 : 0.1) * u);
  if (o.municipios === "ninguno") {
    trazarFeatures(ctx, prep.munsEstudio, pr);
    ctx.fillStyle = CREMA;
    ctx.fill();
    if (o.bordesMun) { ctx.strokeStyle = "#d8cdbf"; ctx.lineWidth = lw; ctx.stroke(); }
  } else {
    const porColor = new Map();
    for (const f of prep.munsEstudio) {
      const c = prep.relleno.get(claveMun(f.properties.ent, f.properties.mun)) || "#f2f2f2";
      if (!porColor.has(c)) porColor.set(c, []);
      porColor.get(c).push(f);
    }
    for (const [c, fs] of porColor) { trazarFeatures(ctx, fs, pr); ctx.fillStyle = c; ctx.fill(); }
    if (o.bordesMun) { trazarFeatures(ctx, prep.munsEstudio, pr); ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = lw; ctx.stroke(); }
  }

  // 2b) Capas de referencia (Natural Earth): zonas urbanas, agua y carreteras
  const ref = o.ref || {};
  if (g.ref) {
    if (ref.urbano) {
      trazarFeatures(ctx, g.ref.urbano.features, pr);
      ctx.globalAlpha = 0.55; ctx.fillStyle = "#8b7f73"; ctx.fill(); ctx.globalAlpha = 1;
    }
    if (ref.agua) {
      trazarFeatures(ctx, g.ref.lagos.features, pr);
      ctx.fillStyle = "#a9cde3"; ctx.fill();
      trazarLineas(ctx, g.ref.rios.features, pr);
      ctx.strokeStyle = "#7fb3d5"; ctx.lineWidth = 0.16 * u; ctx.lineCap = "round"; ctx.stroke();
    }
    if (ref.carreteras && ref.carreteras !== "no") {
      const tipos = ref.carreteras === "todas" ? [2, 1, 0] : [0];
      for (const t of tipos) {
        trazarLineas(ctx, g.ref.carreteras[t].features, pr);
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = [0.5, 0.36, 0.26][t] * u; ctx.stroke();
        ctx.strokeStyle = ["#d9622b", "#e6a23c", "#b9a58f"][t]; ctx.lineWidth = [0.28, 0.18, 0.12][t] * u; ctx.stroke();
      }
    }
  }

  // 3) Límites estatales y contorno del área de estudio
  if (!prep.nacional) {
    trazarFeatures(ctx, prep.entEstudio, pr);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 0.35 * u;
    ctx.stroke();
    const contorno = prep.setMun.size ? prep.munsEstudio : prep.entEstudio;
    trazarFeatures(ctx, contorno, pr);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 0.22 * u;
    ctx.stroke();
  } else {
    trazarFeatures(ctx, g.entFC.features, pr);
    ctx.strokeStyle = o.municipios === "ninguno" ? "#b9ab9b" : "#4b5563";
    ctx.lineWidth = 0.12 * u;
    ctx.stroke();
  }

  // 3b) Contorno de jurisdicciones sanitarias
  if (prep.segJur && o.contornoJur?.ver) {
    ctx.beginPath();
    for (const [a, b] of prep.segJur) { const p = pr(a[0], a[1]), q = pr(b[0], b[1]); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
    ctx.lineCap = "round";
    ctx.strokeStyle = o.contornoJur.color || "#111827";
    ctx.lineWidth = (o.contornoJur.grosor || 3) * 0.1 * u;
    ctx.stroke();
  }

  // 3c) Mapa de calor (densidad de unidades), recortado al área de estudio
  if (o.calor?.ver && prep.puntos.length) dibujarCalor(ctx, R, u, g, o, prep, pr);

  // 3d) Áreas de cobertura (círculos de X km alrededor de las unidades)
  if (o.cobertura?.ver) {
    const base = o.cobertura.de === "seleccion" ? g.seleccion.filter((p) => p.LATITUD != null) : o.cobertura.de === "nivel23" ? prep.puntos.filter((p) => nivelIdx(p) >= 1) : prep.puntos;
    const rpx = (o.cobertura.km * pr.s) / 111.32;
    ctx.beginPath();
    for (const p of base) { const [x, y] = pr(p.LONGITUD, p.LATITUD); ctx.moveTo(x + rpx, y); ctx.arc(x, y, rpx, 0, Math.PI * 2); }
    ctx.globalAlpha = o.cobertura.opacidad ?? 0.3;
    ctx.fillStyle = o.cobertura.color || "#0284c7";
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 4) Puntos
  const seleccion = g.seleccion;
  const claveSel = new Set(seleccion.map((x) => x.CLUES));
  if (o.puntos.ver) {
    const r = o.puntos.tam * u * 0.11;
    const grupos = new Map();
    for (const p of prep.puntos) {
      if (claveSel.has(p.CLUES)) continue;
      const nv = o.puntos.formas && o.puntos.color === "nivel" ? nivelIdx(p) : 0;
      const k = `${colorPunto(p, o)}|${nv}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(p);
    }
    // orden: primer nivel abajo, tercer nivel arriba
    const orden = [...grupos.keys()].sort((a, b) => a.split("|")[1] - b.split("|")[1]);
    ctx.globalAlpha = o.puntos.opacidad;
    for (const k of orden) {
      const [color, nv] = k.split("|");
      ctx.beginPath();
      for (const p of grupos.get(k)) { const [x, y] = pr(p.LONGITUD, p.LATITUD); trazarForma(ctx, +nv, x, y, nv === "0" ? r : r * 0.92); }
      if (o.puntos.contorno) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(0.5, r * 0.55); ctx.stroke(); }
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 5) Etiquetas
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (o.etiquetas.municipios && prep.munsEstudio.length <= 160) {
    ctx.font = fuente(1.25 * u, 500);
    for (const f of prep.munsEstudio) { const [x, y] = pr(f.properties.lng, f.properties.lat); textoHalo(ctx, titleCase(f.properties.mun), x, y, 1.25 * u, "#374151"); }
  }
  if (o.etiquetas.jurisdicciones && prep.jurs.length) {
    ctx.font = fuente(1.6 * u, 700);
    for (const j of prep.jurs) { const [x, y] = pr(j.lng, j.lat); textoHalo(ctx, titleCase(j.nombre), x, y, 1.6 * u, "#111827"); }
  }
  if (o.etiquetas.entidades) {
    ctx.font = fuente((prep.nacional ? 1.45 : 2) * u, 700);
    for (const f of g.entFC.features) {
      const c = g.entCentros.get(fold(f.properties.ent));
      if (!c) continue;
      const [x, y] = pr(c[1], c[0]);
      if (x < R.x || x > R.x + R.w || y < R.y || y > R.y + R.h) continue;
      textoHalo(ctx, titleCase(f.properties.ent).toUpperCase(), x, y, 2 * u, "#4b5563");
    }
  }

  // 5b) Localidades principales (por número de unidades en el catálogo)
  if (g.ref && ref.localidades) {
    const [a, b, c, d] = bbox;
    const ents = prep.nacional ? null : new Set(prep.munsEstudio.map((f) => fold(f.properties.ent)));
    const locs = g.ref.localidades.filter(([la, lo, , , e]) => lo >= a && lo <= c && la >= b && la <= d && (!ents || ents.has(fold(e)))).sort((x, y) => y[2] - x[2]).slice(0, ref.localidadesN || 12);
    ctx.font = fuente(1.45 * u, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const [la, lo, , nombre] of locs) {
      const [x, y] = pr(lo, la);
      ctx.beginPath(); ctx.arc(x, y, 0.5 * u, 0, Math.PI * 2);
      ctx.fillStyle = "#111827"; ctx.fill(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.18 * u; ctx.stroke();
      textoHalo(ctx, titleCase(nombre), x + 0.9 * u, y, 1.45 * u, "#111827");
    }
  }

  // 6) Establecimientos seleccionados (encima de todo)
  if (seleccion.length) {
    const rs = Math.max(1.7 * u, o.puntos.tam * u * 0.24);
    seleccion.forEach((p, i) => {
      if (p.LATITUD == null) return;
      const [x, y] = pr(p.LONGITUD, p.LATITUD);
      ctx.beginPath();
      ctx.arc(x, y, rs, 0, Math.PI * 2);
      ctx.fillStyle = o.colorSel;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = rs * 0.28;
      ctx.stroke();
      ctx.textBaseline = "middle";
      if (o.etiquetaSel === "numero") {
        ctx.font = fuente(rs * 1.15, 800);
        ctx.textAlign = "center";
        ctx.fillStyle = esOscuro(o.colorSel) ? "#ffffff" : "#111827";
        ctx.fillText(String(i + 1), x, y + rs * 0.05);
      } else {
        ctx.font = fuente(1.55 * u, 700);
        ctx.textAlign = "left";
        textoHalo(ctx, o.etiquetaSel === "clues" ? p.CLUES : titleCase(p["NOMBRE DE LA UNIDAD"]), x + rs * 1.5, y, 1.55 * u, "#111827");
      }
    });
  }
  ctx.restore();

  // 7) Marco, norte y escala
  if (o.elementos.marco) { ctx.strokeStyle = "#111827"; ctx.lineWidth = 0.14 * u; ctx.strokeRect(R.x, R.y, R.w, R.h); }
  // norte y escala se apartan de la esquina donde va la leyenda
  const norteIzq = esquinaLeyenda === "sup-der";
  if (o.elementos.norte) dibujarNorte(ctx, norteIzq ? R.x + 4 * u : R.x + R.w - 5.5 * u, R.y + 2.2 * u, u);
  if (o.elementos.escala) dibujarEscala(ctx, R, u, pr, esquinaLeyenda === "inf-izq");
  return pr;
}

function trazarLineas(ctx, features, pr) {
  ctx.beginPath();
  for (const f of features)
    for (const l of f.geometry.coordinates)
      for (let i = 0; i < l.length; i++) { const [x, y] = pr(l[i][0], l[i][1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
}

/* Densidad de kernel gaussiano sobre una cuadrícula en pantalla; se dibuja como celdas (vector en el SVG) */
function dibujarCalor(ctx, R, u, g, o, prep, pr) {
  const cel = Math.max(2, R.w / (o.calor.resolucion || 200));
  const nx = Math.ceil(R.w / cel), ny = Math.ceil(R.h / cel);
  let grid = new Float32Array(nx * ny);
  for (const p of prep.puntos) {
    const [x, y] = pr(p.LONGITUD, p.LATITUD);
    const i = Math.floor((x - R.x) / cel), j = Math.floor((y - R.y) / cel);
    if (i >= 0 && j >= 0 && i < nx && j < ny) grid[j * nx + i]++;
  }
  const sigma = Math.max(0.7, ((o.calor.radioKm || 10) * pr.s) / 111.32 / cel);
  const rad = Math.ceil(sigma * 3), ker = [];
  for (let k = -rad; k <= rad; k++) ker.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const borrar = (src, horiz) => {
    const out = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        let s = 0;
        for (let k = -rad; k <= rad; k++) {
          const ii = horiz ? i + k : i, jj = horiz ? j : j + k;
          if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) s += src[jj * nx + ii] * ker[k + rad];
        }
        out[j * nx + i] = s;
      }
    return out;
  };
  grid = borrar(borrar(grid, true), false);
  let max = 0;
  for (const v of grid) if (v > max) max = v;
  if (!max) return;
  const niveles = 9;
  const colores = rampa(paletaSec(o.calor.paleta || "ylorrd").c, niveles);
  const porNivel = Array.from({ length: niveles }, () => []);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const t = Math.sqrt(grid[j * nx + i] / max); // raíz: resalta también densidades medias
      if (t < 0.12) continue;
      porNivel[Math.min(niveles - 1, Math.floor(t * niveles))].push([i, j]);
    }
  ctx.save();
  trazarFeatures(ctx, prep.nacional ? g.entFC.features : prep.munsEstudio, pr);
  ctx.clip();
  ctx.globalAlpha = o.calor.opacidad ?? 0.8;
  porNivel.forEach((celdas, n) => {
    if (!celdas.length) return;
    ctx.beginPath();
    for (const [i, j] of celdas) ctx.rect(R.x + i * cel, R.y + j * cel, cel + 0.4, cel + 0.4);
    ctx.fillStyle = colores[n];
    ctx.fill();
  });
  ctx.restore();
}

function dibujarNorte(ctx, x, y, u) {
  const h = 6.5 * u, w = 2.2 * u;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = fuente(2.6 * u, 600);
  textoHalo(ctx, "N", x, y, 2.6 * u, "#111827");
  const t = y + 3.2 * u;
  ctx.beginPath(); ctx.moveTo(x, t); ctx.lineTo(x - w, t + h); ctx.lineTo(x, t + h * 0.72); ctx.closePath();
  ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.strokeStyle = "#111827"; ctx.lineWidth = 0.15 * u; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, t); ctx.lineTo(x + w, t + h); ctx.lineTo(x, t + h * 0.72); ctx.closePath();
  ctx.fillStyle = "#111827"; ctx.fill(); ctx.stroke();
}

function dibujarEscala(ctx, R, u, pr, derecha = false) {
  const kmPorPx = 111.32 / pr.s;
  const objetivo = R.w * 0.24 * kmPorPx;
  const p10 = 10 ** Math.floor(Math.log10(objetivo));
  const total = [1, 2, 2.5, 5, 10].map((f) => f * p10).filter((v) => v <= objetivo).pop() || p10;
  const tramos = total / p10 === 2.5 || total / p10 === 5 ? 5 : 4;
  const ancho = total / kmPorPx;
  const x0 = derecha ? R.x + R.w - ancho - 7 * u : R.x + 2.5 * u, y0 = R.y + R.h - 3 * u, alto = 0.75 * u;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillRect(x0 - 1.2 * u, y0 - 4.2 * u, ancho + 2.4 * u + 4 * u, 5.8 * u);
  for (let i = 0; i < tramos; i++) {
    ctx.fillStyle = i % 2 ? "#ffffff" : "#111827";
    ctx.fillRect(x0 + (ancho / tramos) * i, y0, ancho / tramos, alto);
  }
  ctx.strokeStyle = "#111827"; ctx.lineWidth = 0.12 * u; ctx.strokeRect(x0, y0, ancho, alto);
  ctx.font = fuente(1.5 * u, 500); ctx.fillStyle = "#111827"; ctx.textBaseline = "bottom"; ctx.textAlign = "center";
  const fmtKm = (v) => v.toLocaleString("es-MX", { maximumFractionDigits: 1 });
  [0, tramos / 2, tramos].forEach((i) => { if (Number.isInteger(i)) ctx.fillText(i === tramos ? `${fmtKm((total * i) / tramos)} km` : fmtKm((total * i) / tramos), x0 + (ancho / tramos) * i + (i === tramos ? 1.8 * u : 0), y0 - 0.5 * u); });
}

function dibujarInset(ctx, R, u, g, o, prep) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(R.x, R.y, R.w, R.h);
  const pr = proyector(MEXICO_BBOX, { x: R.x + u, y: R.y + u, w: R.w - 2 * u, h: R.h - 2 * u });
  trazarFeatures(ctx, g.entFC.features, pr);
  ctx.fillStyle = GRIS_FUERA; ctx.fill();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.08 * u; ctx.stroke();
  if (!prep.nacional) {
    trazarFeatures(ctx, prep.setMun.size ? prep.munsEstudio : prep.entEstudio, pr);
    ctx.fillStyle = o.colorInset; ctx.fill();
  }
  const [a, b, c, d] = aplicarVista(prep.bbox, o.vista);
  const [x0, y0] = pr(a, d), [x1, y1] = pr(c, b);
  if (o.encuadre === "puntos" || prep.nacional === false || o.vista) {
    ctx.strokeStyle = "#111827"; ctx.lineWidth = 0.14 * u;
    ctx.strokeRect(x0, y0, Math.max(x1 - x0, 2), Math.max(y1 - y0, 2));
  }
  ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 0.1 * u; ctx.strokeRect(R.x, R.y, R.w, R.h);
  ctx.restore();
}

/* Leyenda + mapa de ubicación + notas */
function dibujarPanel(ctx, P, u, g, o, prep, conLeyenda) {
  const lateral = P.tipo === "lateral";
  let colL, colR;
  if (lateral) colL = colR = { x: P.x, w: P.w };
  else { colL = { x: P.x, w: P.w * 0.56 }; colR = { x: P.x + P.w * 0.6, w: P.w * 0.4 }; }

  // Mapa de ubicación
  let yR = P.y;
  if (o.elementos.inset && !prep.nacional) {
    const h = colR.w * (lateral ? 0.5 : 0.62);
    dibujarInset(ctx, { x: colR.x, y: yR, w: colR.w, h }, u, g, o, prep);
    yR += h + 2.2 * u;
  }
  let y = lateral ? yR : P.y;
  const limite = P.y + P.h;

  // Notas (abajo de la columna derecha / del panel lateral): se miden primero para reservar espacio
  const fs = 1.6 * u;
  ctx.font = fuente(fs, 400);
  const notas = o.elementos.notas ? notasTexto(g, o, prep) : [];
  const lineasNotas = [];
  for (const [t, negrita] of notas) {
    ctx.font = fuente(negrita ? fs * 1.15 : fs, negrita ? 700 : 400);
    for (const l of envolver(ctx, t, colR.w)) lineasNotas.push([l, negrita]);
    lineasNotas.push(["", false, true]);
  }
  const altoLinea = (l) => (l[2] ? fs * 0.55 : fs * 1.35) * ESC_T;
  const altoNotas = lineasNotas.reduce((t, l) => t + altoLinea(l), 0);
  const limiteLeyenda = lateral ? limite - altoNotas - u : limite;

  if (o.elementos.leyenda && conLeyenda) dibujarLeyenda(ctx, colL, y, limiteLeyenda, u, g, o, prep, lateral ? (colL.w > 30 * u ? 2 : 1) : 3);

  if (lineasNotas.length) {
    let yn = lateral ? limite - altoNotas : yR;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (const ln of lineasNotas) {
      const [l, negrita] = ln;
      ctx.font = fuente(negrita ? fs * 1.15 : fs, negrita ? 700 : 400);
      ctx.fillStyle = negrita ? "#111827" : "#374151";
      if (yn + fs * ESC_T > limite) break;
      if (l) ctx.fillText(l, colR.x, yn);
      yn += altoLinea(ln);
    }
  }
}

/* Leyenda en una columna (x, w) desde y hasta limite; devuelve la altura final */
function dibujarLeyenda(ctx, colL, y, limiteLeyenda, u, g, o, prep, maxCols) {
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = fuenteT(3.4 * u, 800);
  ctx.fillStyle = COLOR_T;
  if (o.tituloLeyenda !== "") { ctx.fillText(o.tituloLeyenda ?? "Leyenda", colL.x, y); y += 5 * u * ESC_T; }
  const secciones = seccionesLeyenda(g, o, prep, true);
  const fl = 2 * u, paso = 3.1 * u * ESC_T, cuadro = 2.3 * u * Math.min(ESC_T, 1.2);
  // ¿cabe todo en una columna? si no, las secciones largas usan las columnas disponibles
  const altoSec = (s, c) => fl * 1.4 * ESC_T + 0.4 * u + Math.ceil(s.items.length / c) * paso + 1.6 * u;
  const unaCol = secciones.reduce((t, s) => t + altoSec(s, 1), 0) <= limiteLeyenda - y;
  for (const s of secciones) {
    if (y + paso * 2 > limiteLeyenda) break;
    ctx.font = fuente(fl * 1.12, 700);
    ctx.fillStyle = "#1f2937";
    ctx.textBaseline = "top";
    for (const l of envolver(ctx, s.titulo, colL.w)) { ctx.fillText(l, colL.x, y); y += fl * 1.4 * ESC_T; }
    y += 0.4 * u;
    const filas = Math.max(1, Math.floor((limiteLeyenda - y) / paso));
    const cols = Math.min(maxCols, Math.max(unaCol || s.items.length <= 3 ? 1 : maxCols, Math.ceil(s.items.length / filas)));
    const cabe = filas * cols;
    const items = s.items.length > cabe && cabe > 1 ? [...s.items.slice(0, cabe - 1), { texto: `… y ${s.items.length - cabe + 1} más`, sinMarca: true }] : s.items;
    const porCol = Math.ceil(items.length / cols), anchoCol = colL.w / cols;
    items.forEach((it, i) => {
      const cx = colL.x + Math.floor(i / porCol) * anchoCol, cy = y + (i % porCol) * paso;
      if (!it.sinMarca) dibujarMarca(ctx, it, cx, cy, cuadro, u);
      ctx.font = fuente(fl, 400);
      ctx.fillStyle = "#1f2937";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      let t = it.texto;
      const maxW = anchoCol - cuadro - 2 * u;
      while (ctx.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -2);
      if (t !== it.texto) t = t.replace(/\s*\S?$/, "") + "…";
      ctx.fillText(t, cx + (it.sinMarca ? 0 : cuadro * (it.gradiente ? 2.4 : 1) + 1 * u), cy + cuadro / 2);
      ctx.textBaseline = "top";
    });
    y += porCol * paso + 1.6 * u;
  }
  return y;
}

/* Contexto que solo mide (para calcular la altura de la leyenda antes de dibujarla) */
function medidor(real) {
  const st = { font: real.font };
  return new Proxy({}, {
    get(_, k) {
      if (k === "measureText") return (t) => { const f = real.font; real.font = st.font; const r = real.measureText(t); real.font = f; return r; };
      if (k in st) return st[k];
      return () => {};
    },
    set(_, k, v) { st[k] = v; return true; },
  });
}

function dibujarLeyendaEnMapa(ctx, R, u, g, o, prep) {
  const w = Math.min(Math.max(R.w * 0.34, 36 * u), R.w * 0.6), pad = 1.6 * u;
  const alto = dibujarLeyenda(medidor(ctx), { x: 0, w: w - 2 * pad }, 0, R.h * 0.92, u, g, o, prep, 1) + pad;
  const h = Math.min(alto + pad, R.h - 2 * u);
  const pos = o.posLeyenda;
  const x = pos.endsWith("izq") ? R.x + 1.2 * u : R.x + R.w - w - 1.2 * u;
  const y = pos.startsWith("sup") ? R.y + 1.2 * u : R.y + R.h - h - 1.2 * u;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#d1d5db"; ctx.lineWidth = 0.1 * u; ctx.strokeRect(x, y, w, h);
  dibujarLeyenda(ctx, { x: x + pad, w: w - 2 * pad }, y + pad, y + h - pad * 0.5, u, g, o, prep, 1);
  ctx.restore();
}

function dibujarMarca(ctx, it, x, y, s, u) {
  if (it.linea) {
    ctx.beginPath(); ctx.moveTo(x, y + s / 2); ctx.lineTo(x + s * 1.15, y + s / 2);
    ctx.lineCap = "round";
    if (it.casco) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = it.grosor * 1.8; ctx.stroke(); }
    ctx.strokeStyle = it.linea; ctx.lineWidth = it.grosor; ctx.stroke();
    return;
  }
  if (it.gradiente) {
    const n = it.gradiente.length, cw = (s * 2.4) / n;
    it.gradiente.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + i * cw, y + s * 0.15, cw + 0.3, s * 0.7); });
    return;
  }
  if (it.punto) {
    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = it.punto; ctx.fill(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.1 * u; ctx.stroke();
    return;
  }
  if (it.alpha != null) {
    ctx.globalAlpha = it.alpha; ctx.fillStyle = it.color; ctx.fillRect(x, y + s * 0.1, s * 1.15, s * 0.8); ctx.globalAlpha = 1;
    return;
  }
  if (it.forma != null) {
    ctx.beginPath();
    const r = s * 0.34;
    trazarForma(ctx, it.forma, x + s / 2, y + s / 2, it.forma === 0 ? r : r * 0.92);
    ctx.fillStyle = it.color; ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.12 * u; ctx.stroke();
    return;
  }
  if (it.numero != null) {
    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = it.color; ctx.fill();
    ctx.font = fuente(s * 0.6, 800); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = esOscuro(it.color) ? "#ffffff" : "#111827";
    ctx.fillText(String(it.numero), x + s / 2, y + s / 2 + s * 0.03);
    ctx.textAlign = "left";
    return;
  }
  ctx.fillStyle = it.color;
  ctx.fillRect(x, y + s * 0.1, s * 1.15, s * 0.8);
  if (it.borde) { ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 0.1 * u; ctx.strokeRect(x, y + s * 0.1, s * 1.15, s * 0.8); }
}

export function seccionesLeyenda(g, o, prep, conTextos = false) {
  const sec = [];
  if (prep.leyendaMun.length) sec.push({ titulo: prep.tituloMun, items: prep.leyendaMun });
  const u = 1;
  const extra = [];
  if (prep.segJur && o.contornoJur?.ver) extra.push({ linea: o.contornoJur.color || "#111827", grosor: Math.max(1, (o.contornoJur.grosor || 3) * 0.6), texto: "Límite de jurisdicción sanitaria" });
  if (g.ref && o.ref) {
    if (o.ref.carreteras === "principales" || o.ref.carreteras === "todas") extra.push({ linea: "#d9622b", grosor: 3, casco: true, texto: o.ref.carreteras === "todas" ? "Carreteras" : "Carreteras principales" });
    if (o.ref.agua) extra.push({ linea: "#7fb3d5", grosor: 2.5, texto: "Ríos y cuerpos de agua" });
    if (o.ref.urbano) extra.push({ color: "#8b7f73", alpha: 0.55, texto: "Zonas urbanas" });
    if (o.ref.localidades) extra.push({ punto: "#111827", texto: "Localidades principales" });
  }
  if (o.calor?.ver && prep.puntos.length) extra.push({ gradiente: rampa(paletaSec(o.calor.paleta || "ylorrd").c, 6).slice(1), texto: "Densidad de unidades (baja → alta)" });
  if (o.cobertura?.ver) extra.push({ color: o.cobertura.color || "#0284c7", alpha: Math.max(0.25, o.cobertura.opacidad ?? 0.3), texto: `A ${o.cobertura.km} km o menos de ${o.cobertura.de === "seleccion" ? "un establecimiento de interés" : o.cobertura.de === "nivel23" ? "una unidad de 2.º o 3.er nivel" : "una unidad"}` });
  void u;
  if (extra.length) sec.push({ titulo: "Otras capas", items: extra });
  if (o.puntos.ver && prep.puntos.length) {
    const n = (f) => fmtN(prep.puntos.filter(f).length);
    if (o.puntos.color === "nivel") {
      sec.push({
        titulo: "Establecimientos por nivel de atención",
        items: ["PRIMER NIVEL", "SEGUNDO NIVEL", "TERCER NIVEL"]
          .map((nv, i) => ({ nv, i, c: prep.puntos.filter((p) => p["NIVEL ATENCION"] === nv).length }))
          .filter((x) => x.c)
          .map(({ nv, i, c }) => ({ color: NIVEL_COLOR[nv], forma: o.puntos.formas ? i : 0, texto: `${titleCase(nv)} (${fmtN(c)})` })),
      });
    } else if (o.puntos.color === "institucion") {
      const cuenta = new Map();
      for (const p of prep.puntos) { const s = instInfo(p["NOMBRE DE LA INSTITUCION"]).sigla; cuenta.set(s, (cuenta.get(s) || 0) + 1); }
      sec.push({
        titulo: "Establecimientos por institución",
        items: [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([s, c]) => ({ color: INST_COLOR[s] || "#6B7280", forma: 0, texto: `${s} (${fmtN(c)})` })),
      });
    } else {
      sec.push({ titulo: "Establecimientos de salud", items: [{ color: o.puntos.colorUnico, forma: 0, texto: `Unidades en operación (${n(() => true)})` }] });
    }
  }
  if (g.seleccion.length) {
    sec.push({
      titulo: "Establecimientos de interés",
      items: g.seleccion.map((p, i) => ({
        color: o.colorSel,
        numero: o.etiquetaSel === "numero" ? i + 1 : null,
        forma: o.etiquetaSel === "numero" ? null : 0,
        texto: `${titleCase(p["NOMBRE DE LA UNIDAD"])} · ${p.CLUES}`,
      })),
    });
  }
  if (!conTextos || !o.textosLeyenda) return sec;
  const tx = (t) => (o.textosLeyenda[t] != null && o.textosLeyenda[t] !== "" ? o.textosLeyenda[t] : t);
  return sec.map((s) => ({ ...s, titulo: tx(s.titulo), items: s.items.map((it) => ({ ...it, texto: tx(it.texto) })) }));
}

function notasTexto(g, o, prep) {
  const out = [];
  const ents = [...new Set(prep.munsEstudio.map((f) => titleCase(f.properties.ent)))].sort((a, b) => a.localeCompare(b, "es"));
  const nMun = `${fmtN(prep.munsEstudio.length)} municipio${prep.munsEstudio.length === 1 ? "" : "s"}`;
  out.push([`Área de estudio: ${prep.nacional ? "República Mexicana" : `${ents.length === 1 ? ents[0] : `${ents.length} entidades`} · ${nMun}`}`, true]);
  out.push([`Establecimientos mostrados: ${fmtN(prep.puntos.length)}${g.unidades.length > prep.puntos.length && !o.soloSeleccion ? ` (${fmtN(g.unidades.length - prep.puntos.length)} sin ubicación confiable)` : ""}`, false]);
  if (!prep.nacional && ents.length > 1 && ents.length <= 12) out.push([`Entidades: ${ents.join(", ")}`, false]);
  if (g.filtrosTexto) out.push([`Filtros: ${g.filtrosTexto}`, false]);
  if (o.notas) out.push([o.notas, false]);
  out.push([`Fuente: DGIS, Catálogo CLUES (corte ${g.corte}); INEGI, Marco Geoestadístico 2025. SRC: EPSG:4326 – WGS 84.`, false]);
  return out;
}

export { C };
