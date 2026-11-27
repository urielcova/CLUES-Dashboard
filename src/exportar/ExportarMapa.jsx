/* Pestaña «Exportar mapa»: compone un mapa listo para diapositivas con los filtros activos
   y lo descarga como PNG (alta resolución) o SVG (vector editable). */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Copy, Download, ImageDown, Loader2, Plus, Search, Star, Trash2, X, ArrowUp, Minus, Maximize, Move, Images, Upload } from "lucide-react";
import { C, NIVEL_COLOR } from "../instituciones";
import { ENT_CENTROS, ENT_NOMBRES, capaReferencia, cargarDetalles, entidadesGeo, municipiosGeo } from "../datos";
import { fmtN, fold, guardarArchivo, titleCase } from "../util";
import { FORMATOS, FUENTES, aplicarVista, claveMun, componer, fuentePorId, preparar, seccionesLeyenda } from "./componer";
import { crearZip } from "./zip";
import { METODOS } from "./clasificar";
import { GRUPOS_PALETA, PALETAS_CATEGORICAS, PALETAS_SECUENCIALES, paletaSec, rampa } from "./paletas";
import { SvgCtx } from "./svgCtx";

const DEF = {
  formato: "16x9",
  titulo: null, // null = automático
  subtitulo: null,
  notas: "",
  encuadre: "estudio",
  municipios: "concentracion",
  medida: "conteo",
  metodo: "cuantiles",
  clases: 5,
  paleta: "azul",
  paletaCat: "institucional",
  bordesMun: true,
  colorMar: "#ffffff",
  colorInset: C.guinda,
  puntos: { ver: false, tam: 3, opacidad: 0.85, color: "nivel", colorUnico: C.guindaDark, formas: true, contorno: true },
  soloSeleccion: false,
  etiquetaSel: "numero",
  colorSel: C.dorado,
  etiquetas: { entidades: false, municipios: false, jurisdicciones: false },
  elementos: { leyenda: true, inset: true, notas: true, norte: true, escala: true, marco: true },
  fuenteTitulos: "montserrat",
  fuenteTexto: "montserrat",
  escalaTexto: 1,
  colorTitulo: "#111827",
  alinearTitulo: "izquierda",
  pesoTitulo: 800,
  tituloLeyenda: "Leyenda",
  paletaPersonal: ["#f7fbff", "#6baed6", "#08306b"],
  invertir: false,
  ref: { carreteras: "no", agua: false, urbano: false, localidades: false, localidadesN: 12 },
  contornoJur: { ver: false, color: "#111827", grosor: 3 },
  cobertura: { ver: false, km: 10, de: "todas", color: "#0284c7", opacidad: 0.3 },
  calor: { ver: false, radioKm: 15, paleta: "ylorrd", opacidad: 0.8, resolucion: 200 },
  logo: { pos: "sup-der", tam: 8 },
  posLeyenda: "panel",
  textosLeyenda: {},
  colorFondo: "#ffffff",
};
const ANIDADOS = ["puntos", "etiquetas", "elementos", "ref", "contornoJur", "cobertura", "calor", "logo"];

/* Carga una fuente de Google Fonts (una sola vez) y espera a que esté lista para el canvas */
const fuentesPedidas = new Set();
function cargarFuente(f) {
  if (!f.google) return Promise.resolve();
  if (!fuentesPedidas.has(f.id)) {
    fuentesPedidas.add(f.id);
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
    document.head.appendChild(l);
  }
  const esperar = () => Promise.all([400, 500, 700, 800].map((w) => document.fonts.load(`${w} 40px "${f.css}"`)));
  // la hoja de estilos tarda un momento en registrar las @font-face
  return new Promise((ok) => setTimeout(ok, 150)).then(esperar).then(() => new Promise((ok) => setTimeout(ok, 300))).then(esperar).catch(() => {});
}
const CLAVE_LS = "clues-exportar-v4";
const leerLS = () => {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_LS) || "{}");
    const r = { ...DEF, ...v, titulo: null, subtitulo: null, notas: "", textosLeyenda: {} };
    for (const k of ANIDADOS) r[k] = { ...DEF[k], ...v[k] };
    return r;
  } catch { return DEF; }
};
const CLAVE_LOGO = "clues-exportar-logo";
const imagenDe = (src) => new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok({ src, img: im, w: im.naturalWidth || 400, h: im.naturalHeight || 200 }); im.onerror = ko; im.src = src; });

function Seccion({ titulo, abierta = false, children }) {
  return (
    <details open={abierta} className="group rounded-2xl border border-neutral-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-guindaDark">
        {titulo}
        <ChevronDown className="transition group-open:rotate-180" style={{ width: 16, height: 16 }} />
      </summary>
      <div className="space-y-3 border-t border-neutral-100 px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
const Etq = ({ children }) => <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">{children}</span>;
function Opciones({ value, onChange, opciones }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {opciones.map(([v, t]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${value === v ? "border-guinda bg-guinda text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-guinda/30"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}
function Interruptor({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-neutral-700">
      <span>{children}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#9F2241]" />
    </label>
  );
}
function Deslizador({ label, value, min, max, step, onChange, fmt = (v) => v }) {
  return (
    <label className="block text-sm text-neutral-700">
      <span className="flex justify-between"><span>{label}</span><span className="tabular-nums text-neutral-500">{fmt(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="mt-1 w-full accent-[#9F2241]" />
    </label>
  );
}
const Muestra = ({ colores }) => (
  <span className="flex h-3.5 overflow-hidden rounded-sm ring-1 ring-black/10">{colores.map((c) => <span key={c} className="w-3.5" style={{ background: c }} />)}</span>
);
const inputCls = "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-dorado focus:ring-2 focus:ring-dorado/40";

export function ExportarMapa({ data, filtrados, selEnt, selMun, corte, filtrosTexto, activa }) {
  const [o, setO] = useState(leerLS);
  useEffect(() => { try { const { titulo, subtitulo, notas, ...resto } = o; localStorage.setItem(CLAVE_LS, JSON.stringify(resto)); } catch { /* sin almacenamiento */ } }, [o]);
  const cambia = (k, v) => setO((p) => ({ ...p, [k]: v }));
  const cambiaEn = (grupo, k, v) => setO((p) => ({ ...p, [grupo]: { ...p[grupo], [k]: v } }));

  // Geometrías (se cargan al abrir la pestaña)
  const [geo, setGeo] = useState(null);
  useEffect(() => {
    if (!activa || geo) return;
    Promise.all([entidadesGeo(), municipiosGeo()]).then(([entFC, munFC]) => setGeo({ entFC, munFC }));
  }, [activa, geo]);
  const entCentros = useMemo(() => new Map(ENT_NOMBRES.map((n, i) => [fold(n), ENT_CENTROS[i]])), []);

  // Jurisdicción de cada municipio (la más frecuente entre sus unidades); requiere los detalles
  const necesitaJur = o.municipios === "jurisdiccion" || o.etiquetas.jurisdicciones || o.contornoJur.ver;

  // Capas de referencia (se cargan solo si se piden)
  const necesitaRef = o.ref.carreteras !== "no" || o.ref.agua || o.ref.urbano || o.ref.localidades;
  const [ref, setRef] = useState(null);
  useEffect(() => { if (activa && necesitaRef && !ref) capaReferencia().then(setRef); }, [activa, necesitaRef, ref]);

  // Logo propio (se recuerda en este navegador)
  const [logo, setLogo] = useState(null);
  useEffect(() => { try { const src = localStorage.getItem(CLAVE_LOGO); if (src) imagenDe(src).then(setLogo).catch(() => {}); } catch { /* sin almacenamiento */ } }, []);
  const subirLogo = (file) => {
    if (!file) return;
    const lector = new FileReader();
    lector.onload = () => imagenDe(lector.result).then((l) => { setLogo(l); try { localStorage.setItem(CLAVE_LOGO, l.src); } catch { /* muy grande para guardarse */ } }).catch(() => aviso("No se pudo leer la imagen"));
    lector.readAsDataURL(file);
  };
  const quitarLogo = () => { setLogo(null); try { localStorage.removeItem(CLAVE_LOGO); } catch { /* */ } };
  const [jurPorMun, setJurPorMun] = useState(null);
  const [cargandoJur, setCargandoJur] = useState(false);
  useEffect(() => {
    if (!activa || !necesitaJur || jurPorMun || cargandoJur) return;
    setCargandoJur(true);
    cargarDetalles().then((pk) => {
      const votos = new Map();
      const colJur = pk.C[1];
      for (const u of data) {
        const nombre = pk.jur[colJur[u._i]];
        if (!nombre) continue;
        const k = claveMun(u.ENTIDAD, u.MUNICIPIO);
        if (!votos.has(k)) votos.set(k, new Map());
        const v = votos.get(k);
        const cj = `${u.ENTIDAD}||${nombre}`;
        v.set(cj, (v.get(cj) || 0) + 1);
      }
      const m = new Map();
      for (const [k, v] of votos) {
        const [cj] = [...v.entries()].sort((a, b) => b[1] - a[1])[0];
        const [ent, nombre] = cj.split("||");
        m.set(k, { clave: cj, nombre, ent, entCorta: ent.replace(/ DE (ZARAGOZA|OCAMPO|IGNACIO DE LA LLAVE)$/, "") });
      }
      setJurPorMun(m);
    }).finally(() => setCargandoJur(false));
  }, [activa, necesitaJur, jurPorMun, cargandoJur, data]);

  // Establecimientos de interés
  const [selClues, setSelClues] = useState([]);
  const porClues = useMemo(() => new Map(data.map((u) => [u.CLUES, u])), [data]);
  const seleccion = useMemo(() => selClues.map((c) => porClues.get(c)).filter(Boolean), [selClues, porClues]);
  const [busca, setBusca] = useState("");
  const resultados = useMemo(() => {
    const q = fold(busca.trim());
    if (q.length < 2) return [];
    const out = [];
    for (const u of filtrados) {
      if (out.length >= 8) break;
      if (!selClues.includes(u.CLUES) && (u._q ??= fold(`${u.CLUES} ${u["NOMBRE DE LA UNIDAD"]}`)).includes(q)) out.push(u);
    }
    return out;
  }, [busca, filtrados, selClues]);

  // Títulos automáticos
  const ents = useMemo(() => [...new Set(filtrados.map((u) => u.ENTIDAD))], [filtrados]);
  const que = o.municipios === "jurisdiccion" ? "Jurisdicciones sanitarias y establecimientos de salud" : o.municipios === "concentracion" ? "Concentración de establecimientos de salud" : o.calor.ver ? "Densidad de establecimientos de salud" : "Establecimientos de salud";
  const tituloPara = (lugar) => (o.titulo === null ? `${que} · ${lugar}` : `${o.titulo} · ${lugar}`);
  const subtituloPara = (n) => o.subtitulo ?? `${fmtN(n)} unidades en operación${filtrosTexto ? ` · ${filtrosTexto}` : ""} · CLUES, corte ${corte}`;
  const lugarActual = selMun.length === 1 ? `${titleCase(selMun[0].split("||")[1])}, ${titleCase(selMun[0].split("||")[0])}` : selEnt.length === 1 ? titleCase(selEnt[0]) : selEnt.length > 1 ? `${selEnt.length} entidades` : "México";
  const tituloAuto = `${que} · ${lugarActual}`;
  const subtituloAuto = subtituloPara(filtrados.length);

  // Encuadre manual (arrastrar y acercar en la vista previa); se reinicia al cambiar el área
  const [vista, setVista] = useState(null);
  useEffect(() => setVista(null), [selEnt, selMun, o.encuadre]);
  // Fuentes: al cambiar, se descargan y se vuelve a dibujar
  const [fuentesV, setFuentesV] = useState(0);
  useEffect(() => {
    let vivo = true;
    Promise.all([cargarFuente(fuentePorId(o.fuenteTitulos)), cargarFuente(fuentePorId(o.fuenteTexto))]).then(() => vivo && setFuentesV((v) => v + 1));
    return () => { vivo = false; };
  }, [o.fuenteTitulos, o.fuenteTexto]);
  const opc = useMemo(() => ({ ...o, titulo: o.titulo ?? tituloAuto, subtitulo: o.subtitulo ?? subtituloAuto, vista }), [o, tituloAuto, subtituloAuto, vista]);

  const g = useMemo(
    () => (geo ? { ...geo, unidades: filtrados, selEnt, selMun, jurPorMun, seleccion, entCentros, corte, filtrosTexto, ref, logo } : null),
    [geo, filtrados, selEnt, selMun, jurPorMun, seleccion, entCentros, corte, filtrosTexto, ref, logo]
  );
  const claves = [o.encuadre, o.municipios, o.medida, o.metodo, o.clases, o.paleta, o.paletaCat, o.soloSeleccion, o.invertir, o.paletaPersonal, o.contornoJur.ver];
  const prep = useMemo(() => (g ? preparar(g, opc) : null), [g, ...claves]); // eslint-disable-line react-hooks/exhaustive-deps
  const formato = FORMATOS.find((f) => f.id === o.formato) || FORMATOS[0];

  // Vista previa
  const cajaRef = useRef(null);
  const canvasRef = useRef(null);
  const infoRef = useRef(null);
  const [anchoCaja, setAnchoCaja] = useState(800);
  useEffect(() => {
    const el = cajaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAnchoCaja(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [activa]);
  const altoMax = typeof window !== "undefined" ? window.innerHeight * 0.78 : 800;
  const esc = Math.min(anchoCaja / formato.w, altoMax / formato.h);
  const cssW = Math.round(formato.w * esc), cssH = Math.round(formato.h * esc);
  useEffect(() => {
    if (!activa || !g || !prep || !canvasRef.current) return;
    const id = requestAnimationFrame(() => {
      const cv = canvasRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(cssW * dpr);
      cv.height = Math.round(cssH * dpr);
      const ctx = cv.getContext("2d");
      ctx.setTransform((cssW * dpr) / formato.w, 0, 0, (cssH * dpr) / formato.h, 0, 0);
      infoRef.current = componer(ctx, formato.w, formato.h, g, opc, prep);
    });
    return () => cancelAnimationFrame(id);
  }, [activa, g, prep, opc, cssW, cssH, formato, fuentesV]);

  // Exportación
  const [escala, setEscala] = useState(2);
  const [estado, setEstado] = useState("");
  const nombreArchivo = (ext) => `${fold(opc.titulo || "mapa").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "mapa"}.${ext}`;
  const aPng = () =>
    new Promise((ok, ko) => {
      const cv = document.createElement("canvas");
      cv.width = formato.w * escala;
      cv.height = formato.h * escala;
      const ctx = cv.getContext("2d");
      ctx.scale(escala, escala);
      componer(ctx, formato.w, formato.h, g, opc, prep);
      cv.toBlob((b) => (b ? ok(b) : ko(new Error("No se pudo generar la imagen"))), "image/png");
    });
  const aviso = (t) => { setEstado(t); setTimeout(() => setEstado(""), 2600); };
  const descargarPng = async () => { setEstado("Generando…"); try { await guardarArchivo(nombreArchivo("png"), await aPng(), "image/png"); aviso("PNG descargado"); } catch (e) { aviso(String(e.message || e)); } };
  const descargarSvg = async () => {
    setEstado("Generando…");
    const s = new SvgCtx(formato.w, formato.h);
    componer(s, formato.w, formato.h, g, opc, prep);
    await guardarArchivo(nombreArchivo("svg"), s.aTexto(), "image/svg+xml");
    aviso("SVG descargado");
  };
  const copiar = async () => {
    try {
      setEstado("Copiando…");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": aPng() })]);
      aviso("Imagen copiada: pégala en tu presentación");
    } catch { aviso("Tu navegador no permite copiar imágenes; usa «Descargar PNG»"); }
  };

  // --- Arrastrar para mover y rueda para acercar ---
  const arrastre = useRef(null);
  const aDiseno = (e) => { const r = canvasRef.current.getBoundingClientRect(); return [((e.clientX - r.left) * formato.w) / r.width, ((e.clientY - r.top) * formato.h) / r.height]; };
  const enMapa = ([x, y]) => { const m = infoRef.current?.mapa; return m && x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h; };
  const onPointerDown = (e) => {
    const p = aDiseno(e);
    if (!enMapa(p)) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    arrastre.current = { p, v: vista || { dLon: 0, dLat: 0, z: 1 }, pr: infoRef.current.pr };
  };
  const onPointerMove = (e) => {
    const a = arrastre.current;
    if (!a) return;
    const [x, y] = aDiseno(e);
    setVista({ ...a.v, dLon: a.v.dLon - (x - a.p[0]) / (a.pr.k * a.pr.s), dLat: a.v.dLat + (y - a.p[1]) / a.pr.s });
  };
  const onPointerUp = () => { arrastre.current = null; };
  const zoom = (f, punto) => {
    if (!prep || !infoRef.current) return;
    const v = vista || { dLon: 0, dLat: 0, z: 1 };
    const z = Math.min(60, Math.max(0.5, v.z * f));
    const [a, b, c, d] = prep.bbox, bx = (a + c) / 2, by = (b + d) / 2;
    let cx = bx + v.dLon, cy = by + v.dLat;
    if (punto) { const [lon, lat] = infoRef.current.pr.inv(punto[0], punto[1]); cx = lon + (cx - lon) * (v.z / z); cy = lat + (cy - lat) * (v.z / z); }
    setVista({ dLon: cx - bx, dLat: cy - by, z });
  };
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rueda = (e) => {
      const r = cv.getBoundingClientRect();
      const p = [((e.clientX - r.left) * formato.w) / r.width, ((e.clientY - r.top) * formato.h) / r.height];
      const m = infoRef.current?.mapa;
      if (!m || p[0] < m.x || p[0] > m.x + m.w || p[1] < m.y || p[1] > m.y + m.h) return;
      e.preventDefault();
      zoomRef.current(e.deltaY < 0 ? 1.2 : 1 / 1.2, p);
    };
    cv.addEventListener("wheel", rueda, { passive: false });
    return () => cv.removeEventListener("wheel", rueda);
  });

  // --- Varias diapositivas (ZIP) ---
  const [lote, setLote] = useState(null);
  const cancelarLote = useRef(false);
  const generarLote = async (tipo) => {
    if (!g) return;
    let grupos = [];
    if (tipo === "entidad") {
      const lista = selEnt.length ? selEnt : [...new Set(filtrados.map((u) => u.ENTIDAD))].sort((a, b) => a.localeCompare(b, "es"));
      grupos = lista.map((e) => ({ lugar: titleCase(e), selEnt: [e], selMun: [], unidades: filtrados.filter((u) => u.ENTIDAD === e) }));
    } else {
      if (!jurPorMun) { aviso("Espera a que carguen las jurisdicciones"); return; }
      const porJur = new Map();
      for (const u of filtrados) {
        const j = jurPorMun.get(claveMun(u.ENTIDAD, u.MUNICIPIO));
        if (!j) continue;
        if (!porJur.has(j.clave)) porJur.set(j.clave, { j, muns: new Set(), unidades: [] });
        const r = porJur.get(j.clave);
        r.muns.add(`${u.ENTIDAD}||${u.MUNICIPIO}`);
        r.unidades.push(u);
      }
      grupos = [...porJur.values()]
        .sort((a, b) => a.j.ent.localeCompare(b.j.ent, "es") || a.j.nombre.localeCompare(b.j.nombre, "es"))
        .map(({ j, muns, unidades }) => ({ lugar: `Jurisdicción ${titleCase(j.nombre)}, ${titleCase(j.entCorta)}`, selEnt: [], selMun: [...muns], unidades }));
    }
    grupos = grupos.filter((x) => x.unidades.length);
    if (!grupos.length) return;
    cancelarLote.current = false;
    setLote({ hechos: 0, total: grupos.length });
    const archivos = [];
    for (let i = 0; i < grupos.length; i++) {
      if (cancelarLote.current) { setLote(null); aviso("Cancelado"); return; }
      const x = grupos[i];
      const cl = new Set(x.unidades.map((u) => u.CLUES));
      const g2 = { ...g, unidades: x.unidades, selEnt: x.selEnt, selMun: x.selMun, seleccion: seleccion.filter((u) => cl.has(u.CLUES)) };
      const o2 = { ...opc, titulo: tituloPara(x.lugar), subtitulo: subtituloPara(x.unidades.length), vista: null };
      const p2 = preparar(g2, o2);
      const cv = document.createElement("canvas");
      cv.width = formato.w * escala; cv.height = formato.h * escala;
      const ctx = cv.getContext("2d");
      ctx.scale(escala, escala);
      componer(ctx, formato.w, formato.h, g2, o2, p2);
      const b = await new Promise((ok) => cv.toBlob(ok, "image/png"));
      const nombre = `${String(i + 1).padStart(2, "0")}-${fold(x.lugar).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
      archivos.push({ nombre, datos: new Uint8Array(await b.arrayBuffer()) });
      setLote({ hechos: i + 1, total: grupos.length });
      await new Promise((ok) => setTimeout(ok, 0));
    }
    await guardarArchivo(`mapas-por-${tipo === "entidad" ? "entidad" : "jurisdiccion"}.zip`, crearZip(archivos), "application/zip");
    setLote(null);
    aviso(`${archivos.length} mapas descargados en un ZIP`);
  };

  // Textos de la leyenda (para editarlos)
  const textosLeyenda = useMemo(() => {
    if (!g || !prep) return [];
    const out = [];
    for (const sct of seccionesLeyenda(g, opc, prep)) { out.push({ t: sct.titulo, titulo: true }); for (const it of sct.items.slice(0, 30)) out.push({ t: it.texto }); }
    return out;
  }, [g, prep, opc]);

  const listo = g && prep;
  const pSec = paletaSec(o.paleta, o.paletaPersonal, o.invertir);
  const [grupoPal, setGrupoPal] = useState(() => (o.paleta === "personal" ? "Personalizada" : PALETAS_SECUENCIALES.find((p) => p.id === o.paleta)?.grupo || "General"));

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* ----- Controles ----- */}
      <div className="space-y-3 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
        <Seccion titulo="Formato y textos" abierta>
          <label className="block"><Etq>Tamaño</Etq>
            <select value={o.formato} onChange={(e) => cambia("formato", e.target.value)} className={inputCls}>
              {FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.nombre} ({f.w}×{f.h})</option>)}
            </select>
          </label>
          <label className="block"><Etq>Título</Etq>
            <input value={opc.titulo} onChange={(e) => cambia("titulo", e.target.value)} className={inputCls} />
          </label>
          <label className="block"><Etq>Subtítulo</Etq>
            <input value={opc.subtitulo} onChange={(e) => cambia("subtitulo", e.target.value)} className={inputCls} />
          </label>
          {(o.titulo !== null || o.subtitulo !== null) && (
            <button type="button" onClick={() => setO((p) => ({ ...p, titulo: null, subtitulo: null }))} className="text-xs font-semibold text-guinda hover:underline">Volver a los textos automáticos</button>
          )}
          <label className="block"><Etq>Nota adicional</Etq>
            <textarea rows={2} value={o.notas} onChange={(e) => cambia("notas", e.target.value)} placeholder="Ej. Elaboración propia con datos de…" className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {[["leyenda", "Leyenda"], ["inset", "Mapa de ubicación"], ["notas", "Notas y fuente"], ["norte", "Norte"], ["escala", "Escala"], ["marco", "Marco"]].map(([k, t]) => (
              <Interruptor key={k} checked={o.elementos[k]} onChange={(v) => cambiaEn("elementos", k, v)}>{t}</Interruptor>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Tipografía">
          <label className="block"><Etq>Fuente de títulos</Etq>
            <select value={o.fuenteTitulos} onChange={(e) => cambia("fuenteTitulos", e.target.value)} className={inputCls} style={{ fontFamily: `"${fuentePorId(o.fuenteTitulos).css}"` }}>
              {FUENTES.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </label>
          <label className="block"><Etq>Fuente del texto (leyenda, notas, etiquetas)</Etq>
            <select value={o.fuenteTexto} onChange={(e) => cambia("fuenteTexto", e.target.value)} className={inputCls} style={{ fontFamily: `"${fuentePorId(o.fuenteTexto).css}"` }}>
              {FUENTES.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </label>
          <Deslizador label="Tamaño del texto" value={o.escalaTexto} min={0.7} max={1.5} step={0.05} onChange={(v) => cambia("escalaTexto", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
          <div><Etq>Título</Etq><Opciones value={o.alinearTitulo} onChange={(v) => cambia("alinearTitulo", v)} opciones={[["izquierda", "A la izquierda"], ["centro", "Centrado"]]} /></div>
          <div><Etq>Grosor del título</Etq><Opciones value={o.pesoTitulo} onChange={(v) => cambia("pesoTitulo", v)} opciones={[[500, "Normal"], [700, "Negrita"], [800, "Extra negrita"]]} /></div>
          <div className="flex items-center justify-between gap-3 text-sm text-neutral-700">
            <span>Color de títulos</span>
            <span className="flex items-center gap-1.5">
              {["#111827", C.guindaDark, C.guinda, "#10312B", "#1F5E8C"].map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => cambia("colorTitulo", c)} className={`h-6 w-6 rounded-full ring-2 ${o.colorTitulo === c ? "ring-guinda" : "ring-transparent"}`} style={{ background: c, boxShadow: "inset 0 0 0 2px #fff" }} />)}
              <input type="color" value={o.colorTitulo} onChange={(e) => cambia("colorTitulo", e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-neutral-200" aria-label="Otro color" />
            </span>
          </div>
          <label className="block"><Etq>Encabezado de la leyenda</Etq>
            <input value={o.tituloLeyenda} onChange={(e) => cambia("tituloLeyenda", e.target.value)} className={inputCls} />
          </label>
          <p className="text-[11px] leading-snug text-neutral-500">El PNG incluye la fuente. El SVG solo guarda su nombre: para editarlo, instala la fuente (gratuita en Google Fonts).</p>
        </Seccion>

        <Seccion titulo="Municipios" abierta>
          <Opciones value={o.municipios} onChange={(v) => cambia("municipios", v)} opciones={[["ninguno", "Sin relleno"], ["concentracion", "Concentración"], ["jurisdiccion", "Jurisdicciones"]]} />
          {o.municipios === "concentracion" && (
            <>
              <div><Etq>Medida</Etq><Opciones value={o.medida} onChange={(v) => cambia("medida", v)} opciones={[["conteo", "Número de unidades"], ["densidad", "Unidades por 1,000 km²"]]} /></div>
              <label className="block"><Etq>Clasificación</Etq>
                <select value={o.metodo} onChange={(e) => cambia("metodo", e.target.value)} className={inputCls}>{METODOS.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
              </label>
              <Deslizador label="Número de clases" value={o.clases} min={3} max={7} step={1} onChange={(v) => cambia("clases", v)} />
              <div>
                <Etq>Paleta</Etq>
                <div className="mb-2 flex flex-wrap gap-1">
                  {GRUPOS_PALETA.map((gr) => (
                    <button key={gr} type="button" onClick={() => setGrupoPal(gr)} aria-pressed={grupoPal === gr}
                      className={`rounded-md px-2 py-1 text-[11px] font-bold ${grupoPal === gr ? "bg-guindaDark text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>{gr}</button>
                  ))}
                </div>
                {grupoPal === "Padecimiento" && <p className="mb-1.5 text-[11px] leading-snug text-neutral-500">Colores de los listones de concientización más usados; no son colores oficiales.</p>}
                {grupoPal === "Daltonismo" && <p className="mb-1.5 text-[11px] leading-snug text-neutral-500">Se distinguen con daltonismo y al imprimir en escala de grises.</p>}
                {grupoPal === "Personalizada" ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {o.paletaPersonal.map((c, i) => (
                        <span key={i} className="relative">
                          <input type="color" value={c} aria-label={`Color ${i + 1}`} onChange={(e) => setO((p) => ({ ...p, paleta: "personal", paletaPersonal: p.paletaPersonal.map((x, k) => (k === i ? e.target.value : x)) }))} className="h-9 w-10 cursor-pointer rounded border border-neutral-200" />
                          {o.paletaPersonal.length > 2 && <button type="button" aria-label="Quitar color" onClick={() => setO((p) => ({ ...p, paletaPersonal: p.paletaPersonal.filter((_, k) => k !== i) }))} className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-neutral-700 text-white"><X style={{ width: 10, height: 10 }} /></button>}
                        </span>
                      ))}
                      {o.paletaPersonal.length < 6 && <button type="button" onClick={() => setO((p) => ({ ...p, paletaPersonal: [...p.paletaPersonal, p.paletaPersonal[p.paletaPersonal.length - 1]] }))} className="grid h-9 w-10 place-items-center rounded border border-dashed border-neutral-300 text-neutral-500 hover:border-guinda hover:text-guinda" aria-label="Agregar color"><Plus style={{ width: 15, height: 15 }} /></button>}
                    </div>
                    <p className="text-[11px] text-neutral-500">Del valor más bajo (izquierda) al más alto (derecha); los tonos intermedios se calculan solos.</p>
                    <button type="button" onClick={() => cambia("paleta", "personal")} aria-pressed={o.paleta === "personal"}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs ${o.paleta === "personal" ? "border-guinda bg-guinda/5 font-bold text-guindaDark" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}>
                      {o.paleta === "personal" ? "Usando paleta personalizada" : "Usar paleta personalizada"}<Muestra colores={rampa(o.invertir ? [...o.paletaPersonal].reverse() : o.paletaPersonal, o.clases)} />
                    </button>
                  </div>
                ) : (
                  <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto pr-1">
                    {PALETAS_SECUENCIALES.filter((p) => p.grupo === grupoPal).map((p) => (
                      <button key={p.id} type="button" onClick={() => cambia("paleta", p.id)} aria-pressed={o.paleta === p.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs ${o.paleta === p.id ? "border-guinda bg-guinda/5 font-bold text-guindaDark" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}>
                        {p.nombre}<Muestra colores={rampa(o.invertir ? [...p.c].reverse() : p.c, o.clases)} />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2"><Interruptor checked={o.invertir} onChange={(v) => cambia("invertir", v)}>Invertir paleta (oscuro = menos)</Interruptor></div>
              </div>
            </>
          )}
          {o.municipios === "jurisdiccion" && (
            <div>
              <Etq>Colores de las jurisdicciones</Etq>
              <div className="grid grid-cols-1 gap-1">
                {PALETAS_CATEGORICAS.map((p) => (
                  <button key={p.id} type="button" onClick={() => cambia("paletaCat", p.id)} aria-pressed={o.paletaCat === p.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${o.paletaCat === p.id ? "border-guinda bg-guinda/5 font-bold text-guindaDark" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}>
                    {p.nombre}<Muestra colores={p.c.slice(0, 8)} />
                  </button>
                ))}
              </div>
              {cargandoJur && <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500"><Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> Cargando jurisdicciones…</p>}
              <p className="mt-2 text-[11px] leading-snug text-neutral-500">Cada municipio toma la jurisdicción de la mayoría de sus unidades en el catálogo CLUES.</p>
            </div>
          )}
          <Interruptor checked={o.bordesMun} onChange={(v) => cambia("bordesMun", v)}>Límites municipales</Interruptor>
          <Interruptor checked={o.contornoJur.ver} onChange={(v) => cambiaEn("contornoJur", "ver", v)}>Contorno de jurisdicciones sanitarias</Interruptor>
          {o.contornoJur.ver && (
            <div className="space-y-2 rounded-xl bg-neutral-50 p-2.5">
              <Deslizador label="Grosor" value={o.contornoJur.grosor} min={1} max={8} step={0.5} onChange={(v) => cambiaEn("contornoJur", "grosor", v)} />
              <div className="flex items-center justify-between gap-3 text-sm text-neutral-700"><span>Color</span>
                <span className="flex items-center gap-1.5">{["#111827", "#ffffff", C.guindaDark, C.dorado].map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => cambiaEn("contornoJur", "color", c)} className={`h-6 w-6 rounded-full ring-2 ${o.contornoJur.color === c ? "ring-guinda" : "ring-transparent"}`} style={{ background: c, boxShadow: "inset 0 0 0 2px #fff, 0 0 0 1px #d4d4d4" }} />)}</span>
              </div>
              {cargandoJur && <p className="flex items-center gap-1.5 text-xs text-neutral-500"><Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> Cargando jurisdicciones…</p>}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2">
            <Etq>Etiquetas</Etq>
            <Interruptor checked={o.etiquetas.entidades} onChange={(v) => cambiaEn("etiquetas", "entidades", v)}>Nombres de entidades</Interruptor>
            <Interruptor checked={o.etiquetas.municipios} onChange={(v) => cambiaEn("etiquetas", "municipios", v)}>Nombres de municipios {prep && prep.munsEstudio.length > 160 && <span className="text-[11px] text-neutral-400">(solo con ≤160)</span>}</Interruptor>
            <Interruptor checked={o.etiquetas.jurisdicciones} onChange={(v) => cambiaEn("etiquetas", "jurisdicciones", v)}>Nombres de jurisdicciones</Interruptor>
          </div>
        </Seccion>

        <Seccion titulo="Puntos de las unidades" abierta={o.puntos.ver}>
          <Interruptor checked={o.puntos.ver} onChange={(v) => cambiaEn("puntos", "ver", v)}>Mostrar unidades</Interruptor>
          {o.puntos.ver && (
            <>
              <Deslizador label="Tamaño" value={o.puntos.tam} min={1} max={12} step={0.5} onChange={(v) => cambiaEn("puntos", "tam", v)} />
              <Deslizador label="Opacidad" value={o.puntos.opacidad} min={0.2} max={1} step={0.05} onChange={(v) => cambiaEn("puntos", "opacidad", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
              <div><Etq>Color</Etq><Opciones value={o.puntos.color} onChange={(v) => cambiaEn("puntos", "color", v)} opciones={[["nivel", "Por nivel"], ["institucion", "Por institución"], ["unico", "Un solo color"]]} /></div>
              {o.puntos.color === "unico" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {[...new Set([C.guindaDark, C.guinda, C.dorado, "#235B4E", "#111827", ...pSec.c.slice(-2)])].map((c) => (
                    <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => cambiaEn("puntos", "colorUnico", c)} className={`h-7 w-7 rounded-full ring-2 ${o.puntos.colorUnico === c ? "ring-guinda" : "ring-transparent"}`} style={{ background: c, boxShadow: "inset 0 0 0 2px #fff" }} />
                  ))}
                  <input type="color" value={o.puntos.colorUnico} onChange={(e) => cambiaEn("puntos", "colorUnico", e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-neutral-200" aria-label="Elegir otro color" />
                </div>
              )}
              {o.puntos.color === "nivel" && <Interruptor checked={o.puntos.formas} onChange={(v) => cambiaEn("puntos", "formas", v)}>Forma por nivel (● ■ ◆)</Interruptor>}
              <Interruptor checked={o.puntos.contorno} onChange={(v) => cambiaEn("puntos", "contorno", v)}>Contorno blanco</Interruptor>
            </>
          )}
        </Seccion>

        <Seccion titulo={`Establecimientos de interés${seleccion.length ? ` (${seleccion.length})` : ""}`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" style={{ width: 15, height: 15 }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca por CLUES o nombre" className={`${inputCls} pl-9`} />
          </div>
          {resultados.length > 0 && (
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
              {resultados.map((u) => (
                <li key={u.CLUES}>
                  <button type="button" onClick={() => { setSelClues((s) => [...s, u.CLUES]); setBusca(""); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-neutral-50">
                    <Plus className="text-guinda" style={{ width: 14, height: 14, flexShrink: 0 }} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-neutral-800">{titleCase(u["NOMBRE DE LA UNIDAD"])}</span><span className="text-neutral-500">{u.CLUES} · {titleCase(u.MUNICIPIO)}</span></span>
                    {u.LATITUD == null && <span className="text-[10px] text-neutral-400">sin ubicación</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {busca.trim().length >= 2 && !resultados.length && <p className="text-xs text-neutral-500">Sin coincidencias dentro de los filtros activos.</p>}
          {seleccion.length > 0 && (
            <>
              <ol className="space-y-1">
                {seleccion.map((u, i) => (
                  <li key={u.CLUES} className="flex items-center gap-2 rounded-lg bg-neutral-50 px-2 py-1.5 text-xs">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: o.colorSel }}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{titleCase(u["NOMBRE DE LA UNIDAD"])}</span>
                    {i > 0 && <button type="button" aria-label="Subir" onClick={() => setSelClues((s) => { const c = [...s]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })} className="text-neutral-400 hover:text-guinda"><ArrowUp style={{ width: 14, height: 14 }} /></button>}
                    <button type="button" aria-label="Quitar" onClick={() => setSelClues((s) => s.filter((c) => c !== u.CLUES))} className="text-neutral-400 hover:text-guinda"><X style={{ width: 14, height: 14 }} /></button>
                  </li>
                ))}
              </ol>
              <button type="button" onClick={() => setSelClues([])} className="flex items-center gap-1 text-xs font-semibold text-guinda hover:underline"><Trash2 style={{ width: 13, height: 13 }} /> Quitar todos</button>
              <div><Etq>Etiqueta en el mapa</Etq><Opciones value={o.etiquetaSel} onChange={(v) => cambia("etiquetaSel", v)} opciones={[["numero", "Número"], ["nombre", "Nombre"], ["clues", "CLUES"]]} /></div>
              <div className="flex items-center justify-between gap-3 text-sm text-neutral-700">
                <span>Color de resaltado</span>
                <span className="flex items-center gap-1.5">
                  {[C.dorado, C.guinda, "#111827", "#0284c7"].map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => cambia("colorSel", c)} className={`h-6 w-6 rounded-full ring-2 ${o.colorSel === c ? "ring-guinda" : "ring-transparent"}`} style={{ background: c, boxShadow: "inset 0 0 0 2px #fff" }} />)}
                </span>
              </div>
              <Interruptor checked={o.soloSeleccion} onChange={(v) => cambia("soloSeleccion", v)}>Mostrar solo estos establecimientos</Interruptor>
            </>
          )}
          {!seleccion.length && <p className="text-[11px] leading-snug text-neutral-500"><Star className="mr-1 inline text-dorado" style={{ width: 12, height: 12 }} />Se marcan con número y aparecen en la leyenda.</p>}
        </Seccion>

        <Seccion titulo="Capas de referencia">
          <div><Etq>Carreteras</Etq><Opciones value={o.ref.carreteras} onChange={(v) => cambiaEn("ref", "carreteras", v)} opciones={[["no", "No"], ["principales", "Principales"], ["todas", "Todas"]]} /></div>
          <Interruptor checked={o.ref.agua} onChange={(v) => cambiaEn("ref", "agua", v)}>Ríos y cuerpos de agua</Interruptor>
          <Interruptor checked={o.ref.urbano} onChange={(v) => cambiaEn("ref", "urbano", v)}>Zonas urbanas</Interruptor>
          <Interruptor checked={o.ref.localidades} onChange={(v) => cambiaEn("ref", "localidades", v)}>Localidades principales</Interruptor>
          {o.ref.localidades && <Deslizador label="Número de localidades" value={o.ref.localidadesN} min={3} max={40} step={1} onChange={(v) => cambiaEn("ref", "localidadesN", v)} />}
          {necesitaRef && !ref && <p className="flex items-center gap-1.5 text-xs text-neutral-500"><Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> Cargando capas…</p>}
          <p className="text-[11px] leading-snug text-neutral-500">Natural Earth (dominio público). Las localidades se ordenan por número de unidades en el catálogo.</p>
        </Seccion>

        <Seccion titulo="Cobertura y mapa de calor">
          <Interruptor checked={o.cobertura.ver} onChange={(v) => cambiaEn("cobertura", "ver", v)}>Áreas de cobertura</Interruptor>
          {o.cobertura.ver && (
            <>
              <Deslizador label="Radio" value={o.cobertura.km} min={1} max={60} step={1} onChange={(v) => cambiaEn("cobertura", "km", v)} fmt={(v) => `${v} km`} />
              <div><Etq>Alrededor de</Etq><Opciones value={o.cobertura.de} onChange={(v) => cambiaEn("cobertura", "de", v)} opciones={[["todas", "Todas las unidades"], ["nivel23", "2.º y 3.er nivel"], ["seleccion", "Establecimientos de interés"]]} /></div>
              <Deslizador label="Opacidad" value={o.cobertura.opacidad} min={0.1} max={0.8} step={0.05} onChange={(v) => cambiaEn("cobertura", "opacidad", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
              <div className="flex items-center justify-between gap-3 text-sm text-neutral-700"><span>Color</span>
                <span className="flex items-center gap-1.5">{["#0284c7", "#16a34a", C.dorado, C.guinda, "#7c3aed"].map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => cambiaEn("cobertura", "color", c)} className={`h-6 w-6 rounded-full ring-2 ${o.cobertura.color === c ? "ring-guinda" : "ring-transparent"}`} style={{ background: c, boxShadow: "inset 0 0 0 2px #fff" }} />)}</span>
              </div>
              <p className="text-[11px] leading-snug text-neutral-500">Distancia en línea recta; lo que queda sin color está a más de {o.cobertura.km} km.</p>
            </>
          )}
          <div className="border-t border-neutral-100 pt-3"><Interruptor checked={o.calor.ver} onChange={(v) => cambiaEn("calor", "ver", v)}>Mapa de calor (densidad)</Interruptor></div>
          {o.calor.ver && (
            <>
              <Deslizador label="Radio de suavizado" value={o.calor.radioKm} min={2} max={80} step={1} onChange={(v) => cambiaEn("calor", "radioKm", v)} fmt={(v) => `${v} km`} />
              <Deslizador label="Detalle" value={o.calor.resolucion} min={60} max={300} step={10} onChange={(v) => cambiaEn("calor", "resolucion", v)} />
              <Deslizador label="Opacidad" value={o.calor.opacidad} min={0.2} max={1} step={0.05} onChange={(v) => cambiaEn("calor", "opacidad", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
              <label className="block"><Etq>Paleta</Etq>
                <select value={o.calor.paleta} onChange={(e) => cambiaEn("calor", "paleta", e.target.value)} className={inputCls}>
                  {GRUPOS_PALETA.filter((x) => x !== "Personalizada").map((gr) => <optgroup key={gr} label={gr}>{PALETAS_SECUENCIALES.filter((p) => p.grupo === gr).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</optgroup>)}
                </select>
              </label>
              <p className="text-[11px] leading-snug text-neutral-500">Consejo: con el mapa de calor, usa «Sin relleno» en municipios y oculta los puntos.</p>
            </>
          )}
        </Seccion>

        <Seccion titulo="Leyenda">
          <div><Etq>Posición</Etq><Opciones value={o.posLeyenda} onChange={(v) => cambia("posLeyenda", v)} opciones={[["panel", "Al lado"], ["sup-izq", "Mapa ↖"], ["sup-der", "Mapa ↗"], ["inf-izq", "Mapa ↙"], ["inf-der", "Mapa ↘"]]} /></div>
          <div>
            <Etq>Textos (deja vacío para el automático)</Etq>
            <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {textosLeyenda.map(({ t, titulo }, i) => (
                <input key={`${i}-${t}`} value={o.textosLeyenda[t] ?? ""} placeholder={t} onChange={(e) => setO((p) => ({ ...p, textosLeyenda: { ...p.textosLeyenda, [t]: e.target.value } }))}
                  className={`${inputCls} ${titulo ? "font-bold" : "ml-3 w-[calc(100%-0.75rem)] text-xs"}`} />
              ))}
            </div>
            {Object.values(o.textosLeyenda).some(Boolean) && <button type="button" onClick={() => cambia("textosLeyenda", {})} className="mt-2 text-xs font-semibold text-guinda hover:underline">Volver a los textos automáticos</button>}
          </div>
        </Seccion>

        <Seccion titulo="Logo">
          {logo ? (
            <>
              <div className="flex items-center gap-3"><img src={logo.src} alt="Logo cargado" className="h-12 max-w-[140px] rounded border border-neutral-200 bg-white object-contain p-1" /><button type="button" onClick={quitarLogo} className="flex items-center gap-1 text-xs font-semibold text-guinda hover:underline"><Trash2 style={{ width: 13, height: 13 }} /> Quitar</button></div>
              <div><Etq>Posición</Etq><Opciones value={o.logo.pos} onChange={(v) => cambiaEn("logo", "pos", v)} opciones={[["sup-izq", "↖ Arriba izq."], ["sup-der", "↗ Arriba der."], ["inf-izq", "↙ Abajo izq."], ["inf-der", "↘ Abajo der."]]} /></div>
              <Deslizador label="Tamaño" value={o.logo.tam} min={4} max={18} step={0.5} onChange={(v) => cambiaEn("logo", "tam", v)} />
            </>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 px-3 py-4 text-sm font-semibold text-guinda hover:border-guinda">
              <Upload style={{ width: 16, height: 16 }} /> Subir logo (PNG, JPG o SVG)
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={(e) => subirLogo(e.target.files?.[0])} />
            </label>
          )}
          <p className="text-[11px] leading-snug text-neutral-500">Usa una imagen con fondo transparente. Se guarda solo en este navegador.</p>
        </Seccion>

        <Seccion titulo="Varias diapositivas">
          <p className="text-xs leading-snug text-neutral-600">Genera un mapa por cada área con el mismo estilo y los descarga juntos en un ZIP de imágenes PNG.</p>
          <div className="grid grid-cols-1 gap-2">
            <button type="button" disabled={!listo || !!lote} onClick={() => generarLote("entidad")} className="flex items-center justify-center gap-2 rounded-xl border border-guinda/30 px-3 py-2 text-sm font-bold text-guinda hover:bg-guinda/5 disabled:opacity-40"><Images style={{ width: 15, height: 15 }} /> Uno por entidad ({fmtN(selEnt.length || ents.length)})</button>
            <button type="button" disabled={!listo || !!lote || !jurPorMun} onClick={() => generarLote("jurisdiccion")} className="flex items-center justify-center gap-2 rounded-xl border border-guinda/30 px-3 py-2 text-sm font-bold text-guinda hover:bg-guinda/5 disabled:opacity-40"><Images style={{ width: 15, height: 15 }} /> Uno por jurisdicción</button>
            {!jurPorMun && <p className="text-[11px] text-neutral-500">Para «uno por jurisdicción», activa antes el relleno o el contorno de jurisdicciones.</p>}
          </div>
          {lote && (
            <div className="space-y-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full bg-guinda transition-all" style={{ width: `${(100 * lote.hechos) / lote.total}%` }} /></div>
              <p className="flex items-center justify-between text-xs text-neutral-600"><span>{lote.hechos} de {lote.total} mapas</span><button type="button" onClick={() => { cancelarLote.current = true; }} className="font-semibold text-guinda hover:underline">Cancelar</button></p>
            </div>
          )}
          <p className="text-[11px] leading-snug text-neutral-500">Usa el formato y la resolución elegidos ({formato.w * escala}×{formato.h * escala} px); el encuadre se ajusta a cada área.</p>
        </Seccion>

        <Seccion titulo="Encuadre y fondo">
          <div><Etq>Encuadre</Etq><Opciones value={o.encuadre} onChange={(v) => cambia("encuadre", v)} opciones={[["estudio", "Área filtrada"], ["puntos", "Ajustar a los puntos"]]} /></div>
          <div><Etq>Fondo del lienzo</Etq><Opciones value={o.colorFondo} onChange={(v) => cambia("colorFondo", v)} opciones={[["#ffffff", "Blanco"], ["#faf7f2", "Crema"], ["#f3f4f6", "Gris claro"]]} /></div>
          <div><Etq>Mar</Etq><Opciones value={o.colorMar} onChange={(v) => cambia("colorMar", v)} opciones={[["#ffffff", "Blanco"], ["#e4eff5", "Azul claro"], ["#f3f4f6", "Gris claro"]]} /></div>
          <div className="flex items-center justify-between gap-3 text-sm text-neutral-700">
            <span>Área en el mapa de ubicación</span>
            <span className="flex items-center gap-1.5">
              {[C.guinda, C.dorado, "#235B4E", "#0868ac"].map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => cambia("colorInset", c)} className={`h-6 w-6 rounded-full ring-2 ${o.colorInset === c ? "ring-guinda" : "ring-transparent"}`} style={{ background: c, boxShadow: "inset 0 0 0 2px #fff" }} />)}
            </span>
          </div>
          <button type="button" onClick={() => setO({ ...DEF })} className="text-xs font-semibold text-guinda hover:underline">Restablecer todas las opciones</button>
        </Seccion>
      </div>

      {/* ----- Vista previa y descarga ----- */}
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-[0_6px_24px_-8px_rgba(60,20,35,0.18)]">
          <span className="text-xs font-semibold text-neutral-500">Resolución</span>
          <Opciones value={escala} onChange={setEscala} opciones={[[1, "1×"], [2, "2×"], [3, "3×"]]} />
          <span className="text-xs tabular-nums text-neutral-400">{formato.w * escala}×{formato.h * escala} px</span>
          <span className="flex-1" />
          <button type="button" disabled={!listo} onClick={copiar} className="flex items-center gap-1.5 rounded-xl border border-guinda/30 px-3 py-2 text-sm font-bold text-guinda hover:bg-guinda/5 disabled:opacity-40"><Copy style={{ width: 15, height: 15 }} /> Copiar</button>
          <button type="button" disabled={!listo} onClick={descargarSvg} className="flex items-center gap-1.5 rounded-xl border border-guinda/30 px-3 py-2 text-sm font-bold text-guinda hover:bg-guinda/5 disabled:opacity-40"><Download style={{ width: 15, height: 15 }} /> SVG</button>
          <button type="button" disabled={!listo} onClick={descargarPng} className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white shadow disabled:opacity-40" style={{ background: C.guinda }}><ImageDown style={{ width: 15, height: 15 }} /> Descargar PNG</button>
        </div>
        {estado && <p role="status" className="text-right text-xs font-semibold text-guinda">{estado}</p>}
        <div ref={cajaRef} className="rounded-2xl bg-neutral-200/60 p-3 sm:p-5">
          {listo ? (
            <div className="relative mx-auto" style={{ width: cssW }}>
              <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                style={{ width: cssW, height: cssH, display: "block", touchAction: "none", cursor: arrastre.current ? "grabbing" : "grab" }} className="rounded-sm bg-white shadow-lg" aria-label={`Vista previa: ${opc.titulo}`} role="img" />
              <div className="mx-auto mt-3 flex w-fit flex-wrap items-center justify-center gap-1 rounded-full bg-white p-1 shadow ring-1 ring-black/5">
                <button type="button" onClick={() => zoom(1.25)} aria-label="Acercar" className="grid h-7 w-7 place-items-center rounded-full text-guindaDark hover:bg-neutral-100"><Plus style={{ width: 15, height: 15 }} /></button>
                <button type="button" onClick={() => zoom(1 / 1.25)} aria-label="Alejar" className="grid h-7 w-7 place-items-center rounded-full text-guindaDark hover:bg-neutral-100"><Minus style={{ width: 15, height: 15 }} /></button>
                <button type="button" onClick={() => setVista(null)} disabled={!vista} aria-label="Restablecer encuadre" className="flex h-7 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-semibold text-guindaDark hover:bg-neutral-100 disabled:text-neutral-400"><Maximize style={{ width: 13, height: 13 }} /> Encuadre automático</button>
                <span className="hidden items-center gap-1 whitespace-nowrap px-2 text-[11px] text-neutral-500 sm:flex"><Move style={{ width: 12, height: 12 }} /> Arrastra para mover · rueda para acercar</span>
              </div>
            </div>
          ) : (
            <div className="grid h-72 place-items-center text-sm text-neutral-500"><span className="flex items-center gap-2"><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Preparando el mapa…</span></div>
          )}
        </div>
        <p className="text-xs leading-relaxed text-neutral-500">
          El mapa usa los filtros activos ({fmtN(filtrados.length)} unidades{ents.length && ents.length <= 3 ? ` en ${ents.map(titleCase).join(", ")}` : ""}). El PNG es ideal para PowerPoint, Google Slides o Keynote; el SVG se puede editar en Illustrator, Inkscape o Figma.
          {o.puntos.color === "nivel" && o.puntos.ver && <> Colores por nivel: {Object.entries(NIVEL_COLOR).map(([k, c]) => <span key={k} className="ml-1 inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />{titleCase(k)}</span>)}</>}
        </p>
      </div>
    </div>
  );
}
