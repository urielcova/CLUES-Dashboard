import { useEffect, useState } from "react";
import { MapPin, X, Layers, AlertTriangle, Loader2, Navigation, Check, Copy, Clock, ExternalLink, Route, Map as MapIcon, ShieldCheck } from "lucide-react";
import LOGOS from "../logos.json";
import { CALIDAD, ENT_NOMBRES, cargarDetalles, detalleDe } from "../datos";
import { C, InstBadge, NivelIcono, instColor, instInfo } from "../instituciones";
import { urlComoLlegar, urlVerEnMaps } from "../mapa/leaflet";
import { DIAS, abiertoAhora, fmtKm, fold, rango, titleCase } from "../util";

/* ------------------------------------------------------------------ */
/* 4b. FICHA DE LA UNIDAD (ventana emergente con pestañas)              */
/* ------------------------------------------------------------------ */
export function Dato({ label, children }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-neutral-100 py-2 text-sm last:border-0 sm:grid-cols-[160px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-neutral-800">{children}</dd>
    </div>
  );
}

export function FichaUnidad({ u, userPos, km, esCercana, onClose, onVerMapa }) {
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
