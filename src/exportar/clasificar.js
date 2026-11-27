/* Clasificación de valores para mapas coropléticos.
   Devuelve los cortes [min, c1, ..., max] (n clases → n+1 valores). */

function cuantiles(v, n) {
  const s = [...v].sort((a, b) => a - b);
  const cortes = [s[0]];
  for (let i = 1; i < n; i++) cortes.push(s[Math.min(s.length - 1, Math.floor((i / n) * s.length))]);
  cortes.push(s[s.length - 1]);
  return cortes;
}

function iguales(v, n) {
  const min = Math.min(...v), max = Math.max(...v);
  return Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n);
}

/* Cortes naturales de Jenks (programación dinámica; O(k·m²) sobre los valores distintos) */
function jenks(v, n) {
  const s = [...v].sort((a, b) => a - b);
  // compacta valores repetidos con su frecuencia para acelerar
  const val = [], peso = [];
  for (const x of s) { if (val.length && val[val.length - 1] === x) peso[peso.length - 1]++; else { val.push(x); peso.push(1); } }
  const m = val.length;
  if (m <= n) return [val[0], ...val.slice(1), val[m - 1]].slice(0, n + 1);
  const P = [0], P2 = [0], W = [0];
  for (let i = 0; i < m; i++) { W.push(W[i] + peso[i]); P.push(P[i] + val[i] * peso[i]); P2.push(P2[i] + val[i] * val[i] * peso[i]); }
  const ssd = (i, j) => { const w = W[j + 1] - W[i], s1 = P[j + 1] - P[i]; return P2[j + 1] - P2[i] - (s1 * s1) / w; };
  const D = Array.from({ length: n }, () => new Float64Array(m).fill(Infinity));
  const B = Array.from({ length: n }, () => new Int32Array(m));
  for (let j = 0; j < m; j++) D[0][j] = ssd(0, j);
  for (let k = 1; k < n; k++)
    for (let j = k; j < m; j++)
      for (let i = k; i <= j; i++) {
        const c = D[k - 1][i - 1] + ssd(i, j);
        if (c < D[k][j]) { D[k][j] = c; B[k][j] = i; }
      }
  const cortes = [val[m - 1]];
  let j = m - 1;
  for (let k = n - 1; k > 0; k--) { const i = B[k][j]; cortes.unshift(val[i - 1]); j = i - 1; }
  cortes.unshift(val[0]);
  return cortes;
}

export const METODOS = [
  { id: "cuantiles", nombre: "Cuantiles (mismo número de municipios por clase)" },
  { id: "jenks", nombre: "Cortes naturales (Jenks)" },
  { id: "iguales", nombre: "Intervalos iguales" },
];

export function clasificar(valores, n, metodo) {
  const v = valores.filter((x) => Number.isFinite(x));
  if (!v.length) return [];
  const f = metodo === "cuantiles" ? cuantiles : metodo === "iguales" ? iguales : jenks;
  // sin cortes repetidos (con pocos valores distintos salen menos clases)
  const c = f(v, n);
  const u = [c[0]];
  for (let i = 1; i < c.length; i++) if (c[i] > u[u.length - 1]) u.push(c[i]);
  if (u.length === 1) u.push(u[0]);
  return u;
}

/* Índice de clase de x (0..n-1) */
export function claseDe(x, cortes) {
  for (let i = 1; i < cortes.length - 1; i++) if (x <= cortes[i]) return i - 1;
  return cortes.length - 2;
}
