import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, X, Database, AlertTriangle, Loader2, Check, Download, UploadCloud } from "lucide-react";
import { CALIDAD, ENT_NOMBRES, _packActual, crearWorkerCatalogo, geometriaParaValidar } from "../datos";
import { C, instInfo } from "../instituciones";
import { NIVELES } from "../mapa/capaPuntos";
import { csvCelda, fmtN, guardarArchivo, titleCase } from "../util";

/* ------------------------------------------------------------------ */
/* 4c. CATÁLOGO: revisión del archivo vigente y carga de uno nuevo      */
/* ------------------------------------------------------------------ */
export const PASOS_CATALOGO = ["Leer el archivo", "Revisar estructura", "Validar coordenadas (INEGI)", "Preparar catálogo", "Comparar con el actual"];

export function CatalogoPanel({ catalogo, data, onAplicar, onVolverPublicado, onClose }) {
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
