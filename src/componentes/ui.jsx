import { useEffect, useMemo, useRef, useState } from "react";
import { X, AlertTriangle, MapPinOff, ChevronDown, ChevronRight } from "lucide-react";
import { CALIDAD } from "../datos";
import { C, InstBadge, InstChip, NivelIcono } from "../instituciones";
import { esc, fmtKm, fmtN, fold, titleCase } from "../util";

/* ------------------------------------------------------------------ */
/* 4. COMPONENTES DE UI                                                */
/* ------------------------------------------------------------------ */
export const resumenSel = (arr, plural) => (!arr.length ? "" : arr.length <= 2 ? arr.join(", ") : `${arr.length} ${plural}`);

/* Selector de opción múltiple con búsqueda, "seleccionar todo" y etiquetas removibles */
export function MultiSelect({ label, options, selected, onChange, placeholder, buscar = false }) {
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

export function SelectFiltro({ label, value, onChange, options, todos, fmt = (o) => o }) {
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

export function KpiCard({ Icon, titulo, valor, detalle, color }) {
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

export function UnidadCard({ u, activa, distancia, onClick }) {
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
