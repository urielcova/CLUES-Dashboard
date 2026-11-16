import { Hospital, Activity, HeartPulse, Building, Building2, Stethoscope, Shield, Anchor, Fuel, Cross, Users, GraduationCap, Landmark } from "lucide-react";
import LOGOS from "./logos.json";

/* ------------------------------------------------------------------ */
/* 1. PALETA, CONSTANTES E ÍCONOS POR INSTITUCIÓN                      */
/* ------------------------------------------------------------------ */
export const C = { guinda: "#9F2241", guindaDark: "#6B1C35", dorado: "#BC955C", fondo: "#F4F6F8" };
export const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
export const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const PAGE = 40;

export const INSTITUCIONES = {
  "INSTITUTO MEXICANO DEL SEGURO SOCIAL": { sigla: "IMSS", Icon: Hospital },
  "SERVICIOS DE SALUD IMSS BIENESTAR": { sigla: "IMSS-BIENESTAR", Icon: HeartPulse },
  "INSTITUTO DE SEGURIDAD Y SERVICIOS SOCIALES DE LOS TRABAJADORES DEL ESTADO": { sigla: "ISSSTE", Icon: Building },
  "SECRETARIA DE SALUD": { sigla: "SSA", Icon: Stethoscope },
  "SECRETARIA DE LA DEFENSA NACIONAL": { sigla: "SEDENA", Icon: Shield },
  "SECRETARIA DE MARINA": { sigla: "SEMAR", Icon: Anchor },
  "PETROLEOS MEXICANOS": { sigla: "PEMEX", Icon: Fuel },
  "SERVICIOS MEDICOS PRIVADOS": { sigla: "PRIVADO", Icon: Building2 },
  "CRUZ ROJA MEXICANA": { sigla: "CRUZ ROJA", Icon: Cross },
  "SISTEMA NACIONAL PARA EL DESARROLLO INTEGRAL DE LA FAMILIA": { sigla: "DIF", Icon: Users },
  "SERVICIOS MEDICOS ESTATALES": { sigla: "ESTATAL", Icon: Landmark },
  "SERVICIOS MEDICOS MUNICIPALES": { sigla: "MUNICIPAL", Icon: Landmark },
  "SERVICIOS MEDICOS UNIVERSITARIOS": { sigla: "UNIVERSITARIO", Icon: GraduationCap },
  "CENTROS DE INTEGRACION JUVENIL": { sigla: "CIJ", Icon: Users },
};
export const instInfo = (nombre) => INSTITUCIONES[nombre] || { sigla: nombre.split(/\s+/).filter((w) => w.length > 2).map((w) => w[0]).join(""), Icon: Activity };

/* Color de la insignia por institución (código visual del tablero, no son colores oficiales) */
export const INST_COLOR = {
  IMSS: "#11694F", "IMSS-BIENESTAR": "#9F2241", ISSSTE: "#1F5E8C", SSA: "#6B1C35", SEDENA: "#4B5E2A", SEMAR: "#1B2A4A",
  PEMEX: "#B45309", PRIVADO: "#57534E", "CRUZ ROJA": "#C8102E", DIF: "#7C3AED", ESTATAL: "#475569", MUNICIPAL: "#64748B",
  UNIVERSITARIO: "#1D4ED8", CIJ: "#0E7490",
};
export const instColor = (sigla) => INST_COLOR[sigla] || "#6B7280";

/* LOGOS INSTITUCIONALES — recortados de la imagen proporcionada por el usuario.
   full: logotipo completo · mark: emblema compacto para tamaños pequeños (opcional) */
export const logoDe = (sigla, size) => { const l = LOGOS[sigla]; return l ? (size < 60 && l.mark) || l.full : null; };

export function InstBadge({ nombre, size = 40, activa = false }) {
  const { sigla, Icon } = instInfo(nombre);
  const color = instColor(sigla);
  const logo = logoDe(sigla, size);
  const s = { width: size, height: size, minWidth: size };
  if (logo) {
    return (
      <span className="grid place-items-center overflow-hidden rounded-lg bg-white" style={{ ...s, padding: Math.round(size * 0.08), border: `1.5px solid ${activa ? C.dorado : "#e5e5e5"}` }} title={sigla}>
        <img src={logo} alt={sigla} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
      </span>
    );
  }
  return (
    <span className="grid place-items-center rounded-lg text-white" style={{ ...s, background: activa ? C.dorado : color }} title={sigla}>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} />
    </span>
  );
}
export function InstChip({ nombre }) {
  const { sigla } = instInfo(nombre);
  const color = instColor(sigla);
  return (
    <span className="truncate rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color, background: color + "14" }}>
      {sigla}
    </span>
  );
}
/* Niveles de atención: tres tonos distinguibles (validados para daltonismo) + forma distinta.
   Primer = círculo verde azulado · Segundo = cuadro naranja · Tercer = rombo guinda */
export const NIVEL_COLOR = { "PRIMER NIVEL": "#0A8F84", "SEGUNDO NIVEL": "#C96A00", "TERCER NIVEL": "#9F2241" };
export const NIVEL_FORMA = { "PRIMER NIVEL": "circulo", "SEGUNDO NIVEL": "cuadro", "TERCER NIVEL": "rombo" };
// Traza la forma del nivel nv (0,1,2) centrada en x,y con "radio" r
export function trazarForma(ctx, nv, x, y, r) {
  if (nv === 0) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); }
  else if (nv === 1) { const h = r * 0.9; ctx.rect(x - h, y - h, h * 2, h * 2); }
  else { const d = r * 1.4; ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath(); }
}
export function NivelIcono({ nivel, size = 12, hueco = false }) {
  const c = NIVEL_COLOR[nivel], f = NIVEL_FORMA[nivel];
  const p = hueco ? { fill: "none", stroke: c, strokeWidth: 2 } : { fill: c, stroke: "#fff", strokeWidth: 1.2 };
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" style={{ flexShrink: 0, display: "inline-block", verticalAlign: "-1px" }}>
      {f === "circulo" ? <circle cx="7" cy="7" r="5.6" {...p} /> : f === "cuadro" ? <rect x="1.8" y="1.8" width="10.4" height="10.4" rx="1" {...p} /> : <path d="M7 0.6 13.4 7 7 13.4 0.6 7Z" {...p} />}
    </svg>
  );
}
