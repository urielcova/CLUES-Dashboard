import { useEffect, useState } from "react";
import { CALIDAD } from "../datos";
import { LEAFLET_JS, instInfo, logoDe } from "../instituciones";
import { esc, fmtKm, titleCase } from "../util";

/* Google Maps: cómo llegar (con origen si se conoce la ubicación del usuario) */
export const urlComoLlegar = (u, origen) =>
  `https://www.google.com/maps/dir/?api=1&destination=${u.LATITUD},${u.LONGITUD}${origen ? `&origin=${origen.lat},${origen.lng}` : ""}`;
export const urlVerEnMaps = (u) => `https://www.google.com/maps/search/?api=1&query=${u.LATITUD},${u.LONGITUD}`;



export const pinSvg = (fill, stroke) =>
  `<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="12" cy="12" r="4.6" fill="#fff"/><path d="M12 9.2v5.6M9.2 12h5.6" stroke="${fill}" stroke-width="1.8" stroke-linecap="round"/></svg>`;
export const makePin = (L, fill, stroke, w, pulse = false) =>
  L.divIcon({
    className: "",
    html: `<div class="clues-pin${pulse ? " clues-pin--pulse" : ""}" style="width:${w}px;height:${w * 1.33}px">${pinSvg(fill, stroke)}</div>`,
    iconSize: [w, w * 1.33],
    iconAnchor: [w / 2, w * 1.33],
    popupAnchor: [0, -w * 1.2],
  });

export const popupHtml = (u, km, destacado) => {
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
export const fijarOrigen = (p) => { origenActual = p; };
export let origenActual = null; // ubicación del usuario para los enlaces de Google Maps en los popups del mapa
export const svgI = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICO_LOCATE = svgI('<circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>');
export const ICO_EXPAND = svgI('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>');
export const ICO_GMAPS = svgI('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>') ;
export const popupOpts = () => { const w = Math.min(290, (window.innerWidth || 400) - 70); return { className: "clues-popup", minWidth: Math.min(240, w), maxWidth: w, autoPanPaddingTopLeft: [56, 112], autoPanPaddingBottomRight: [16, 120] }; };

/* Carga Leaflet (UMD) una sola vez desde cdnjs */
export function useLeaflet() {
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
