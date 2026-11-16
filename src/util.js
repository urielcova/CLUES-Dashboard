/* ------------------------------------------------------------------ */
/* 2. UTILIDADES                                                       */
/* ------------------------------------------------------------------ */
// Fórmula de Haversine: distancia en km sobre la superficie terrestre
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0088;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
export const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000).toLocaleString("es-MX")} m` : `${km.toLocaleString("es-MX", { maximumFractionDigits: km < 10 ? 2 : 1 })} km`);
export const fmtN = (n) => n.toLocaleString("es-MX");
export const titleCase = (s) => s.toLowerCase().replace(/(^|\s|\(|"|\.)([a-záéíóúñü])/g, (m) => m.toUpperCase());
export const uniqSorted = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, "es"));
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fold = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
export const normEntidad = (s = "") => fold(s).replace(/ DE IGNACIO DE LA LLAVE| DE OCAMPO| DE ZARAGOZA/g, "").trim();
/* Horario: grupos "1111100|08:00|16:00" (DOM..SÁB) → 7 días (lunes primero) */
export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export function parseHorario(str) {
  const porDia = DIAS.map(() => []);
  if (!str) return null;
  for (const grp of str.split(";")) {
    const [mask, ini, fin] = grp.split("|");
    if (!ini || !fin) continue;
    [...mask].forEach((b, d) => { if (b === "1") porDia[d].push([ini, fin]); });
  }
  return porDia.some((x) => x.length) ? porDia : null;
}
export const rango = ([a, b]) => (a === "00:00" && (b === "23:59" || b === "24:00") ? "24 horas" : `${a} – ${b}`);
export function abiertoAhora(porDia) {
  if (!porDia) return null;
  const now = new Date();
  const hm = now.toTimeString().slice(0, 5);
  return porDia[now.getDay()].some(([a, b]) => (a <= b ? hm >= a && hm <= b : hm >= a || hm <= b));
}

/* Guardar un archivo generado: en Claude usa la capacidad "downloads" (pide confirmación); en un navegador normal, descarga directa */
export async function guardarArchivo(nombre, contenido, tipo = "text/csv") {
  try {
    const dl = window.claude?.use ? await Promise.race([window.claude.use("downloads"), new Promise((r) => setTimeout(() => r(null), 4000))]) : null;
    if (dl) { await dl.save({ filename: nombre, data: new Blob([contenido], { type: tipo }) }); return "guardado"; }
  } catch (e) {
    if (e?.code === "declined") return "cancelado";
  }
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "guardado";
}
export const csvCelda = (v) => { const t = v == null ? "" : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

/* Catálogo cargado por el usuario: se guarda SOLO en este navegador (IndexedDB) */
export const idb = (modo, fn) =>
  new Promise((ok, mal) => {
    let req;
    try { req = indexedDB.open("clues-dashboard", 1); } catch (e) { mal(e); return; }
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onerror = () => mal(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction("kv", modo);
      const r = fn(tx.objectStore("kv"));
      tx.oncomplete = () => ok(r?.result);
      tx.onerror = () => mal(tx.error);
    };
  });
export const idbGet = (k) => idb("readonly", (s) => s.get(k)).catch(() => null);
export const idbSet = (k, v) => idb("readwrite", (s) => s.put(v, k));
export const idbDel = (k) => idb("readwrite", (s) => s.delete(k)).catch(() => null);
