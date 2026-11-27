/* Composición del mapa para presentaciones: el mismo dibujo sirve para la vista previa (canvas),
   el PNG de alta resolución y el SVG (vía SvgCtx). Proyección: equirectangular con corrección
   cos(latitud central) — coordenadas WGS 84 (EPSG:4326). */
import { C, INST_COLOR, NIVEL_COLOR, instInfo, trazarForma } from "../instituciones";
import { fold, titleCase, fmtN } from "../util";
import { claseDe, clasificar } from "./clasificar";
import { esOscuro, paletaCat, paletaSec, rampa } from "./paletas";

export const FUENTE = "Montserrat, system-ui, sans-serif";
const fuente = (px, peso = 400) => `${peso} ${Math.round(px * 10) / 10}px ${FUENTE}`;
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
    const colores = rampa(paletaSec(o.paleta).c, Math.max(1, cortes.length - 1));
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

  return { munsEstudio, entEstudio, nacional, puntos, bbox, relleno, leyendaMun, tituloMun, jurs, conteo, setEnt, setMun };
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
  const u = Math.min(W, H) / 100; // unidad de diseño
  const m = 2.4 * u;
  const horizontal = W / H >= 1.15;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Título
  let top = m;
  if (o.titulo) {
    ctx.font = fuente(4.4 * u, 800);
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillStyle = "#111827";
    const lt = envolver(ctx, o.titulo, W - 2 * m);
    lt.forEach((l, i) => ctx.fillText(l, m, top + i * 5.2 * u));
    top += lt.length * 5.2 * u + 0.6 * u;
  }
  if (o.subtitulo) {
    ctx.font = fuente(2.4 * u, 500);
    ctx.fillStyle = "#4b5563";
    ctx.textBaseline = "top";
    const ls = envolver(ctx, o.subtitulo, W - 2 * m);
    ls.forEach((l, i) => ctx.fillText(l, m, top + i * 3 * u));
    top += ls.length * 3 * u;
  }
  if (o.titulo || o.subtitulo) top += 1.6 * u;

  const hayPanel = o.elementos.leyenda || o.elementos.inset || o.elementos.notas;
  let mapa, panel;
  if (!hayPanel) mapa = { x: m, y: top, w: W - 2 * m, h: H - top - m };
  else if (horizontal) {
    const pw = Math.max(W * 0.28, 36 * u);
    mapa = { x: m, y: top, w: W - pw - 3 * m, h: H - top - m };
    panel = { x: W - pw - m, y: top, w: pw, h: H - top - m, tipo: "lateral" };
  } else {
    const ph = Math.max(H * (W / H > 0.9 ? 0.27 : 0.3), 30 * u);
    mapa = { x: m, y: top, w: W - 2 * m, h: H - top - ph - 2 * m };
    panel = { x: m, y: H - ph - m, w: W - 2 * m, h: ph, tipo: "inferior" };
  }

  dibujarMapa(ctx, mapa, u, g, o, prep);
  if (panel) dibujarPanel(ctx, panel, u, g, o, prep);
  ctx.restore();
}

function dibujarMapa(ctx, R, u, g, o, prep) {
  const pr = proyector(prep.bbox, { x: R.x + R.w * 0.02, y: R.y + R.h * 0.02, w: R.w * 0.96, h: R.h * 0.96 });
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
  if (o.elementos.norte) dibujarNorte(ctx, R.x + R.w - 5.5 * u, R.y + 2.2 * u, u);
  if (o.elementos.escala) dibujarEscala(ctx, R, u, pr);
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

function dibujarEscala(ctx, R, u, pr) {
  const kmPorPx = 111.32 / pr.s;
  const objetivo = R.w * 0.24 * kmPorPx;
  const p10 = 10 ** Math.floor(Math.log10(objetivo));
  const total = [1, 2, 2.5, 5, 10].map((f) => f * p10).filter((v) => v <= objetivo).pop() || p10;
  const tramos = total / p10 === 2.5 || total / p10 === 5 ? 5 : 4;
  const ancho = total / kmPorPx;
  const x0 = R.x + 2.5 * u, y0 = R.y + R.h - 3 * u, alto = 0.75 * u;
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
  const [a, b, c, d] = prep.bbox;
  const [x0, y0] = pr(a, d), [x1, y1] = pr(c, b);
  if (o.encuadre === "puntos" || prep.nacional === false) {
    ctx.strokeStyle = "#111827"; ctx.lineWidth = 0.14 * u;
    ctx.strokeRect(x0, y0, Math.max(x1 - x0, 2), Math.max(y1 - y0, 2));
  }
  ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 0.1 * u; ctx.strokeRect(R.x, R.y, R.w, R.h);
  ctx.restore();
}

/* Leyenda + mapa de ubicación + notas */
function dibujarPanel(ctx, P, u, g, o, prep) {
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
  const altoLinea = (l) => (l[2] ? fs * 0.55 : fs * 1.35);
  const altoNotas = lineasNotas.reduce((t, l) => t + altoLinea(l), 0);
  const limiteLeyenda = lateral ? limite - altoNotas - u : limite;

  if (o.elementos.leyenda) {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#111827";
    ctx.font = fuente(3.4 * u, 800);
    ctx.fillText("Leyenda", colL.x, y);
    y += 5 * u;
    const secciones = seccionesLeyenda(g, o, prep);
    const fl = 2 * u, paso = 3.1 * u, cuadro = 2.3 * u;
    // ¿cabe todo en una columna? si no, las secciones largas usan las columnas disponibles
    const maxCols = lateral ? (colL.w > 30 * u ? 2 : 1) : 3;
    const altoSec = (s, c) => fl * 1.4 + 0.4 * u + Math.ceil(s.items.length / c) * paso + 1.6 * u;
    const unaCol = secciones.reduce((t, s) => t + altoSec(s, 1), 0) <= limiteLeyenda - y;
    for (const s of secciones) {
      if (y + paso * 2 > limiteLeyenda) break;
      ctx.font = fuente(fl * 1.12, 700);
      ctx.fillStyle = "#1f2937";
      for (const l of envolver(ctx, s.titulo, colL.w)) { ctx.fillText(l, colL.x, y); y += fl * 1.4; }
      y += 0.4 * u;
      // columnas: las necesarias para que quepan (hasta 2 en el panel lateral, 3 abajo)
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
        let t = it.texto;
        const maxW = anchoCol - cuadro - 2 * u;
        while (ctx.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -2);
        if (t !== it.texto) t = t.replace(/\s*\S?$/, "") + "…";
        ctx.fillText(t, cx + (it.sinMarca ? 0 : cuadro + 1 * u), cy + cuadro / 2);
        ctx.textBaseline = "top";
      });
      y += porCol * paso + 1.6 * u;
    }
  }

  if (lineasNotas.length) {
    let yn = lateral ? limite - altoNotas : yR;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (const ln of lineasNotas) {
      const [l, negrita] = ln;
      ctx.font = fuente(negrita ? fs * 1.15 : fs, negrita ? 700 : 400);
      ctx.fillStyle = negrita ? "#111827" : "#374151";
      if (yn + fs > limite) break;
      if (l) ctx.fillText(l, colR.x, yn);
      yn += altoLinea(ln);
    }
  }
}

function dibujarMarca(ctx, it, x, y, s, u) {
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

function seccionesLeyenda(g, o, prep) {
  const sec = [];
  if (prep.leyendaMun.length) sec.push({ titulo: prep.tituloMun, items: prep.leyendaMun });
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
  return sec;
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
