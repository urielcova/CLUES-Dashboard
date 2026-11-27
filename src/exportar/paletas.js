/* Paletas para los mapas de presentación.
   Secuenciales: de claro a oscuro (gradiente de concentración por municipio).
   Temáticas: colores de los listones de concientización más usados en salud pública en México.
   Categóricas: para distinguir jurisdicciones sanitarias. */

export const PALETAS_SECUENCIALES = [
  { id: "azul", grupo: "General", nombre: "Verde-azul", c: ["#f0f9e8", "#bae4bc", "#7bccc4", "#43a2ca", "#0868ac"] },
  { id: "guinda", grupo: "Institucional", nombre: "Guinda", c: ["#f7eef0", "#e4c3cb", "#c47e90", "#9F2241", "#5a1329"] },
  { id: "dorado", grupo: "Institucional", nombre: "Dorado", c: ["#fbf6ee", "#eedfc4", "#d8bc8e", "#BC955C", "#7d5e30"] },
  { id: "verdeinst", grupo: "Institucional", nombre: "Verde", c: ["#eef5f2", "#c2dbd2", "#7fae9f", "#235B4E", "#10312B"] },
  { id: "verde", grupo: "General", nombre: "Amarillo-verde", c: ["#ffffcc", "#c2e699", "#78c679", "#31a354", "#006837"] },
  { id: "morado", grupo: "General", nombre: "Morado", c: ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"] },
  { id: "naranja", grupo: "General", nombre: "Naranja", c: ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"] },
  { id: "rojo", grupo: "General", nombre: "Rojo", c: ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"] },
  { id: "gris", grupo: "General", nombre: "Gris", c: ["#f5f5f5", "#d4d4d4", "#a3a3a3", "#636363", "#262626"] },
  { id: "cancer-mama", grupo: "Padecimiento", nombre: "Cáncer de mama (rosa)", c: ["#fde7f1", "#f9b4d4", "#ec5c9f", "#be185d", "#701a43"] },
  { id: "vih", grupo: "Padecimiento", nombre: "VIH (rojo)", c: ["#fde8e8", "#f6a5a5", "#e5484d", "#b91c1c", "#6f1010"] },
  { id: "diabetes", grupo: "Padecimiento", nombre: "Diabetes (azul)", c: ["#e6f2fd", "#a8d1f7", "#4f9be8", "#1d5fc0", "#123a78"] },
  { id: "salud-mental", grupo: "Padecimiento", nombre: "Salud mental (verde)", c: ["#e9f7ef", "#a8e0c0", "#4dbb84", "#15803d", "#0b4d25"] },
  { id: "materna", grupo: "Padecimiento", nombre: "Salud materna (rosa-morado)", c: ["#f8ecf6", "#e3b7dc", "#c26bb6", "#8e2e85", "#541b50"] },
  { id: "cancer-infantil", grupo: "Padecimiento", nombre: "Cáncer infantil (dorado)", c: ["#fff8db", "#fde68a", "#f6c23a", "#c88a04", "#7a5304"] },
  { id: "dengue", grupo: "Padecimiento", nombre: "Dengue y vectores (naranja)", c: ["#fff1e6", "#fdc89a", "#f78b3d", "#c2560c", "#7a3306"] },
  { id: "tuberculosis", grupo: "Padecimiento", nombre: "Tuberculosis (rojo-gris)", c: ["#f4f1f1", "#d9c3c3", "#b07777", "#7f2d2d", "#4a1a1a"] },
  { id: "adicciones", grupo: "Padecimiento", nombre: "Adicciones (turquesa)", c: ["#e6f7f7", "#9fdcdc", "#3fb3b6", "#0e7490", "#0b4557"] },
];

export const PALETAS_CATEGORICAS = [
  { id: "institucional", nombre: "Institucional", c: ["#9F2241", "#BC955C", "#235B4E", "#6F7271", "#DDC9A3", "#1F5E8C", "#691C32", "#B38E5D", "#10312B", "#98989A", "#C96A00", "#7C3AED"] },
  { id: "contraste", nombre: "Contrastante", c: ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac", "#1b9e77", "#d95f02"] },
  { id: "pastel", nombre: "Pastel", c: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd", "#ccebc5", "#ffed6f"] },
  { id: "tierra", nombre: "Tierra", c: ["#a6611a", "#dfc27d", "#80cdc1", "#018571", "#8c510a", "#c7eae5", "#bf812d", "#35978f", "#f6e8c3", "#01665e", "#543005", "#003c30"] },
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const aHex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/* n colores interpolados a lo largo de la paleta (n ≥ 1) */
export function rampa(colores, n) {
  if (n <= 1) return [colores[colores.length - 1]];
  const rgb = colores.map(hex);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (rgb.length - 1);
    const k = Math.min(Math.floor(t), rgb.length - 2), f = t - k;
    return aHex(rgb[k].map((v, j) => v + (rgb[k + 1][j] - v) * f));
  });
}

/* Luminancia relativa (para elegir texto claro u oscuro sobre un color) */
export const esOscuro = (h) => { const [r, g, b] = hex(h); return 0.299 * r + 0.587 * g + 0.114 * b < 140; };

export const paletaSec = (id) => PALETAS_SECUENCIALES.find((p) => p.id === id) || PALETAS_SECUENCIALES[0];
export const paletaCat = (id) => PALETAS_CATEGORICAS.find((p) => p.id === id) || PALETAS_CATEGORICAS[0];
