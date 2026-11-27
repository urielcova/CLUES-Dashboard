import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hospital, LocateFixed, Filter, RotateCcw, X, Crosshair, Database, Search, AlertTriangle, Loader2, Navigation, MousePointerClick, MapPinOff, ChevronDown, ChevronRight, Route, Map as MapIcon, Target, FileText, ShieldCheck, Download, UploadCloud, Home, List as ListIcon, Eye, Presentation } from "lucide-react";
import { ExportarMapa } from "./exportar/ExportarMapa";
import { CatalogoPanel } from "./componentes/CatalogoPanel";
import { FichaUnidad } from "./componentes/FichaUnidad";
import { MultiSelect, UnidadCard, resumenSel } from "./componentes/ui";
import { CALIDAD, FILTRO_CALIDAD, cargarDetalles, detalleDe } from "./datos";
import { EMBEDDED_CSS } from "./estilos";
import { C, InstBadge, NivelIcono, PAGE, instInfo } from "./instituciones";
import { MapaClues } from "./mapa/MapaClues";
import { NIVELES } from "./mapa/capaPuntos";
import { fijarOrigen, urlComoLlegar, urlVerEnMaps } from "./mapa/leaflet";
import { fmtKm, fmtN, fold, guardarArchivo, haversineKm, titleCase, uniqSorted } from "./util";

export function Dashboard({ data, L, leafletStatus, catalogo, onAplicarCatalogo, onVolverPublicado }) {
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
  const filtrosTexto = [
    selInst.length ? (selInst.length <= 3 ? selInst.map((i) => instInfo(i).sigla).join(", ") : `${selInst.length} instituciones`) : "",
    selNiv.length && selNiv.length < 3 ? selNiv.map((n) => titleCase(n)).join(" y ") : "",
    texto.trim() ? `búsqueda «${texto.trim()}»` : "",
  ].filter(Boolean).join(" · ");

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

  useEffect(() => { fijarOrigen(userPos); }, [userPos]);
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
            {[["resumen", "Resumen", Home, ""], ["mapa", "Mapa", MapIcon, zona ? `${fmtN(enZona.length)} en la zona` : ""], ["lista", "Lista", ListIcon, fmtN(lista.length)], ["exportar", "Exportar mapa", Presentation, ""]].map(([k, t, Ic, extra]) => (
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
              <button onClick={() => irA("exportar")} className="flex w-full items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-sm font-semibold hover:bg-white/15">
                <Presentation className="shrink-0" style={{ width: 17, height: 17 }} />
                <span className="flex-1">Exportar un mapa para presentación con esta selección</span>
                <ChevronRight style={{ width: 17, height: 17 }} />
              </button>
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

          <section className={vistaMain === "exportar" ? "" : "hidden"} aria-label="Exportar mapa para presentación">
            <ExportarMapa data={data} filtrados={filtrados} selEnt={selEnt} selMun={selMun} corte={catalogo.corte} filtrosTexto={filtrosTexto} activa={vistaMain === "exportar"} />
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
