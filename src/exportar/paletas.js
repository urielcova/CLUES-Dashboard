/* Paletas para los mapas de presentación.
   Secuenciales: de claro a oscuro (gradiente de concentración por municipio).
   Temáticas: colores de los listones de concientización más usados en salud pública en México.
   Categóricas: para distinguir jurisdicciones sanitarias. */

export const PALETAS_SECUENCIALES = [
  { id: "azul", grupo: "General", nombre: "Verde-azul", c: ["#f0f9e8", "#bae4bc", "#7bccc4", "#43a2ca", "#0868ac"] },
  { id: "guinda", grupo: "Institucional", nombre: "Guinda", c: ["#f7eef0", "#e4c3cb", "#c47e90", "#9F2241", "#5a1329"] },
  { id: "dorado", grupo: "Institucional", nombre: "Dorado", c: ["#fbf6ee", "#eedfc4", "#d8bc8e", "#BC955C", "#7d5e30"] },
  { id: "verdeinst", grupo: "Institucional", nombre: "Verde", c: ["#eef5f2", "#c2dbd2", "#7fae9f", "#235B4E", "#10312B"] },
  { id: "guinda-dorado", grupo: "Institucional", nombre: "Dorado a guinda", c: ["#f6efe2", "#DDC9A3", "#BC955C", "#9F2241", "#691C32"] },
  { id: "gris-inst", grupo: "Institucional", nombre: "Gris institucional", c: ["#f4f4f4", "#cfcfcf", "#98989A", "#6F7271", "#3b3d3c"] },
  { id: "verde", grupo: "General", nombre: "Amarillo-verde", c: ["#ffffcc", "#c2e699", "#78c679", "#31a354", "#006837"] },
  { id: "morado", grupo: "General", nombre: "Morado", c: ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"] },
  { id: "naranja", grupo: "General", nombre: "Naranja", c: ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"] },
  { id: "rojo", grupo: "General", nombre: "Rojo", c: ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"] },
  { id: "gris", grupo: "General", nombre: "Gris", c: ["#f5f5f5", "#d4d4d4", "#a3a3a3", "#636363", "#262626"] },
  { id: "azules", grupo: "General", nombre: "Azul", c: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"] },
  { id: "verdes", grupo: "General", nombre: "Verde", c: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"] },
  { id: "pubu", grupo: "General", nombre: "Morado-azul", c: ["#f1eef6", "#bdc9e1", "#74a9cf", "#2b8cbe", "#045a8d"] },
  { id: "ylorrd", grupo: "General", nombre: "Amarillo-rojo", c: ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"] },
  { id: "ylorbr", grupo: "General", nombre: "Amarillo-café", c: ["#ffffd4", "#fed98e", "#fe9929", "#d95f0e", "#993404"] },
  { id: "rdpu", grupo: "General", nombre: "Rosa-morado", c: ["#feebe2", "#fbb4b9", "#f768a1", "#c51b8a", "#7a0177"] },
  { id: "bugn", grupo: "General", nombre: "Azul-verde", c: ["#edf8fb", "#b2e2e2", "#66c2a4", "#2ca25f", "#006d2c"] },
  { id: "arena", grupo: "General", nombre: "Arena-terracota", c: ["#fbf3e4", "#f0d3a8", "#dc9f6a", "#b5643c", "#6e3420"] },
  { id: "viridis", grupo: "Daltonismo", nombre: "Viridis", c: ["#fde725", "#5ec962", "#21918c", "#3b528b", "#440154"] },
  { id: "cividis", grupo: "Daltonismo", nombre: "Cividis", c: ["#fee838", "#c3b369", "#7f7c75", "#3c4d6e", "#00204d"] },
  { id: "magma", grupo: "Daltonismo", nombre: "Magma", c: ["#fcfdbf", "#fc8961", "#b73779", "#51127c", "#000004"] },
  { id: "inferno", grupo: "Daltonismo", nombre: "Inferno", c: ["#fcffa4", "#f98e09", "#bc3754", "#57106e", "#000004"] },
  { id: "mako", grupo: "Daltonismo", nombre: "Mako", c: ["#def5e5", "#60ceac", "#3497a9", "#395d9c", "#0b0405"] },
  { id: "cancer-mama", grupo: "Padecimiento", nombre: "Cáncer de mama (rosa)", c: ["#fde7f1", "#f9b4d4", "#ec5c9f", "#be185d", "#701a43"] },
  { id: "vih", grupo: "Padecimiento", nombre: "VIH (rojo)", c: ["#fde8e8", "#f6a5a5", "#e5484d", "#b91c1c", "#6f1010"] },
  { id: "diabetes", grupo: "Padecimiento", nombre: "Diabetes (azul)", c: ["#e6f2fd", "#a8d1f7", "#4f9be8", "#1d5fc0", "#123a78"] },
  { id: "salud-mental", grupo: "Padecimiento", nombre: "Salud mental (verde)", c: ["#e9f7ef", "#a8e0c0", "#4dbb84", "#15803d", "#0b4d25"] },
  { id: "materna", grupo: "Padecimiento", nombre: "Salud materna (rosa-morado)", c: ["#f8ecf6", "#e3b7dc", "#c26bb6", "#8e2e85", "#541b50"] },
  { id: "cancer-infantil", grupo: "Padecimiento", nombre: "Cáncer infantil (dorado)", c: ["#fff8db", "#fde68a", "#f6c23a", "#c88a04", "#7a5304"] },
  { id: "dengue", grupo: "Padecimiento", nombre: "Dengue y vectores (naranja)", c: ["#fff1e6", "#fdc89a", "#f78b3d", "#c2560c", "#7a3306"] },
  { id: "tuberculosis", grupo: "Padecimiento", nombre: "Tuberculosis (rojo-gris)", c: ["#f4f1f1", "#d9c3c3", "#b07777", "#7f2d2d", "#4a1a1a"] },
  { id: "adicciones", grupo: "Padecimiento", nombre: "Adicciones (turquesa)", c: ["#e6f7f7", "#9fdcdc", "#3fb3b6", "#0e7490", "#0b4557"] },
  { id: "cervicouterino", grupo: "Padecimiento", nombre: "Cáncer cervicouterino (verde azulado)", c: ["#e8f6f3", "#a7ddd2", "#4fb3a2", "#17806f", "#0b4a40"] },
  { id: "prostata", grupo: "Padecimiento", nombre: "Cáncer de próstata (azul claro)", c: ["#eef7fd", "#bfe1f6", "#7cc0ea", "#3591cc", "#1b5a85"] },
  { id: "cardio", grupo: "Padecimiento", nombre: "Enfermedad cardiovascular (rojo)", c: ["#fdecec", "#f5b3b3", "#e46767", "#c22a2a", "#781414"] },
  { id: "renal", grupo: "Padecimiento", nombre: "Enfermedad renal (verde)", c: ["#eef8e8", "#c4e6ad", "#86c55e", "#4b8f2a", "#2a5516"] },
  { id: "alzheimer", grupo: "Padecimiento", nombre: "Alzheimer (morado)", c: ["#f3eefa", "#d2c1ee", "#a184d8", "#6d46b3", "#3f2470"] },
  { id: "obesidad", grupo: "Padecimiento", nombre: "Obesidad y nutrición (naranja-verde)", c: ["#fff4e0", "#fdd49e", "#f8a95c", "#9bbf4a", "#3f7a2a"] },
];

export const PALETAS_CATEGORICAS = [
  { id: "institucional", nombre: "Institucional", c: ["#9F2241", "#BC955C", "#235B4E", "#6F7271", "#DDC9A3", "#1F5E8C", "#691C32", "#B38E5D", "#10312B", "#98989A", "#C96A00", "#7C3AED"] },
  { id: "contraste", nombre: "Contrastante", c: ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac", "#1b9e77", "#d95f02"] },
  { id: "pastel", nombre: "Pastel", c: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd", "#ccebc5", "#ffed6f"] },
  { id: "okabe", nombre: "Okabe-Ito (apta para daltonismo)", c: ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7", "#999999", "#000000", "#88CCEE", "#117733", "#882255"] },
  { id: "tol", nombre: "Tol brillante (apta para daltonismo)", c: ["#4477AA", "#EE6677", "#228833", "#CCBB44", "#66CCEE", "#AA3377", "#BBBBBB", "#332288", "#DDCC77", "#117733", "#882255", "#44AA99"] },
  { id: "gobmx", nombre: "Guinda, dorado y verde", c: ["#691C32", "#BC955C", "#10312B", "#DDC9A3", "#235B4E", "#9D2449", "#6F7271", "#B38E5D", "#98989A", "#4A1525", "#7C9A87", "#D4C19C"] },
  { id: "vivo", nombre: "Vivo", c: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999", "#66c2a5", "#fc8d62", "#8da0cb"] },
  { id: "pares", nombre: "Pares claro-oscuro", c: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#ffff99", "#b15928"] },
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

export const GRUPOS_PALETA = ["General", "Institucional", "Padecimiento", "Daltonismo", "Personalizada"];
/* id "personal" = paleta personalizada (colores elegidos por la persona); inv = invertir el orden */
export const paletaSec = (id, personal, inv) => {
  const p = id === "personal" && personal?.length >= 2 ? { id, nombre: "Personalizada", c: personal } : PALETAS_SECUENCIALES.find((x) => x.id === id) || PALETAS_SECUENCIALES[0];
  return inv ? { ...p, c: [...p.c].reverse() } : p;
};
export const paletaCat = (id) => PALETAS_CATEGORICAS.find((p) => p.id === id) || PALETAS_CATEGORICAS[0];
