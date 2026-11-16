import { NIVEL_COLOR, trazarForma } from "../instituciones";

/* ------------------------------------------------------------------ */
/* 3. MAPA (Leaflet + OpenStreetMap)                                   */
/*    Los puntos se dibujan en UNA sola capa canvas (rápida en celular) */
/* ------------------------------------------------------------------ */
export const NIVELES = ["PRIMER NIVEL", "SEGUNDO NIVEL", "TERCER NIVEL"];
export const PAD = 0.25; // margen del canvas alrededor de la vista (evita bordes vacíos al arrastrar)
export const radioPorZoom = (z) => (z <= 5 ? 1.8 : z <= 7 ? 2.4 : z <= 9 ? 3.2 : z <= 12 ? 4.2 : z <= 14 ? 5.2 : 6.5);
export const ZOOM_SIN_GRUPOS = 14; // a partir de este zoom se ven todas las unidades sin agrupar
export const TAM_CELDA = 64; // px de pantalla por grupo

/* Capa de puntos en canvas: proyección precalculada (zoom 0) + dibujo por lotes + búsqueda de clic */
export function crearCapaPuntos(L) {
  return L.Layer.extend({
    initialize() { this._rows = []; this._sx = new Float32Array(0); this._sy = new Float32Array(0); this._vis = new Int32Array(0); this._nvis = 0; },
    setRows(rows) {
      this._rows = rows.filter((u) => u._px != null);
      this._redraw();
    },
    onAdd(map) {
      this._map = map;
      const c = (this._canvas = L.DomUtil.create("canvas", "leaflet-zoom-animated clues-points"));
      c.style.pointerEvents = "none";
      map.getPanes().overlayPane.appendChild(c);
      map.on("moveend zoomend resize viewreset", this._reset, this);
      map.on("zoomanim", this._animateZoom, this);
      this._reset();
    },
    onRemove(map) {
      L.DomUtil.remove(this._canvas);
      map.off("moveend zoomend resize viewreset", this._reset, this);
      map.off("zoomanim", this._animateZoom, this);
    },
    _animateZoom(e) {
      // misma fórmula que L.Renderer: escala el canvas durante la animación de zoom
      const map = this._map;
      const scale = map.getZoomScale(e.zoom, this._zoom);
      const viewHalf = map.getSize().multiplyBy(0.5 + PAD);
      const topLeft = viewHalf.multiplyBy(-scale).add(map.project(this._center, e.zoom)).subtract(map._getNewPixelOrigin(e.center, e.zoom));
      L.DomUtil.setTransform(this._canvas, topLeft, scale);
    },
    _reset() {
      const map = this._map;
      if (!map) return;
      const size = map.getSize();
      const pad = (this._pad = size.multiplyBy(PAD).round());
      const W = size.x + pad.x * 2, H = size.y + pad.y * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = this._canvas;
      L.DomUtil.setPosition(c, map.containerPointToLayerPoint([-pad.x, -pad.y]));
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
        c.style.width = W + "px";
        c.style.height = H + "px";
      }
      this._dpr = dpr;
      this._W = W; this._H = H;
      this._center = map.getCenter();
      this._zoom = map.getZoom();
      this._redraw();
    },
    _redraw() {
      const map = this._map;
      if (!map || !this._canvas || !this._pad) return;
      const ctx = this._canvas.getContext("2d");
      const dpr = this._dpr || 1;
      const pad = this._pad;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this._W, this._H);
      const z = map.getZoom();
      const k = Math.pow(2, z);
      const o = map.getPixelBounds().min;
      const ox = o.x - pad.x, oy = o.y - pad.y;
      const r = radioPorZoom(z);
      const rows = this._rows;
      const n = rows.length;
      const W = this._W + 30, H = this._H + 30;
      // 1) proyectar y quedarnos con lo visible
      const vis = [];
      for (let i = 0; i < n; i++) {
        const u = rows[i];
        const x = u._px * k - ox, y = u._py * k - oy;
        if (x < -30 || y < -30 || x > W || y > H) continue;
        vis.push(i, x, y);
      }
      // 2) agrupar en celdas de pantalla si hay muchos puntos y el zoom es bajo
      const agrupar = z < ZOOM_SIN_GRUPOS && vis.length / 3 > 60;
      const puntos = []; // [i, x, y]
      const grupos = []; // {x, y, n, r, s, w, nN, e, nivel:[3], rows:[]}
      if (agrupar) {
        const cel = TAM_CELDA;
        const celdas = new Map();
        for (let j = 0; j < vis.length; j += 3) {
          const i = vis[j], x = vis[j + 1], y = vis[j + 2];
          const key = Math.floor(x / cel) * 100000 + Math.floor(y / cel);
          let c = celdas.get(key);
          if (!c) celdas.set(key, (c = { sx: 0, sy: 0, n: 0, idx: [] }));
          c.sx += x; c.sy += y; c.n++; c.idx.push(i);
        }
        for (const c of celdas.values()) {
          if (c.n < 3) { for (const i of c.idx) puntos.push(i, rows[i]._px * k - ox, rows[i]._py * k - oy); continue; }
          let s = 90, w = 180, nN = -90, e = -180;
          const nivel = [0, 0, 0];
          for (const i of c.idx) {
            const u = rows[i];
            nivel[u._nv]++;
            if (u.LATITUD < s) s = u.LATITUD; if (u.LATITUD > nN) nN = u.LATITUD;
            if (u.LONGITUD < w) w = u.LONGITUD; if (u.LONGITUD > e) e = u.LONGITUD;
          }
          grupos.push({ x: c.sx / c.n, y: c.sy / c.n, n: c.n, r: Math.min(22, 10 + 2.4 * Math.log2(c.n)), s, w, nN, e, nivel, idx: c.idx });
        }
      } else {
        for (let j = 0; j < vis.length; j += 3) puntos.push(vis[j], vis[j + 1], vis[j + 2]);
      }
      this._puntos = puntos;
      this._grupos = grupos;
      this._r = r;
      // 3) puntos sueltos: forma y color por nivel (primer → tercer, el más alto queda encima);
      //    coordenadas genéricas: la misma forma, sin relleno
      const borde = z >= 7;
      const porNivel = [[], [], []], genericas = [[], [], []];
      for (let j = 0; j < puntos.length; j += 3) {
        const u = rows[puntos[j]];
        (u._calidad === 2 ? genericas : porNivel)[u._nv].push(puntos[j + 1], puntos[j + 2]);
      }
      for (let nv = 0; nv < 3; nv++) {
        const g = porNivel[nv];
        const rn = nv === 0 ? r : r * 1.12;
        if (g.length) {
          ctx.beginPath();
          for (let j = 0; j < g.length; j += 2) trazarForma(ctx, nv, g[j], g[j + 1], rn);
          ctx.fillStyle = NIVEL_COLOR[NIVELES[nv]];
          ctx.fill();
          if (borde) { ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.stroke(); }
        }
        const h = genericas[nv];
        if (h.length) {
          ctx.beginPath();
          for (let j = 0; j < h.length; j += 2) trazarForma(ctx, nv, h[j], h[j + 1], Math.max(rn, 2.8));
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = NIVEL_COLOR[NIVELES[nv]];
          ctx.stroke();
        }
      }
      // 4) grupos: número al centro y anillo con la proporción de cada nivel; un rombo guinda avisa que hay tercer nivel
      if (grupos.length) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const g of grupos) {
          ctx.beginPath();
          ctx.arc(g.x, g.y, g.r + 1.5, 0, 6.2832);
          ctx.fillStyle = "#fff";
          ctx.shadowColor = "rgba(40,20,25,0.35)";
          ctx.shadowBlur = 5;
          ctx.fill();
          ctx.shadowBlur = 0;
          let ang = -Math.PI / 2;
          ctx.lineWidth = 5;
          for (let nv = 0; nv < 3; nv++) {
            if (!g.nivel[nv]) continue;
            const da = (g.nivel[nv] / g.n) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(g.x, g.y, g.r - 2.5, ang, ang + Math.max(da, 0.12));
            ctx.strokeStyle = NIVEL_COLOR[NIVELES[nv]];
            ctx.stroke();
            ang += da;
          }
          ctx.fillStyle = "#2b2023";
          ctx.font = `700 ${g.n >= 1000 ? 10.5 : 11.5}px Montserrat, system-ui, sans-serif`;
          ctx.fillText(g.n >= 1000 ? `${(g.n / 1000).toFixed(g.n >= 10000 ? 0 : 1)}k` : String(g.n), g.x, g.y + 0.5);
          if (g.nivel[2]) {
            const bx = g.x + g.r * 0.72, by = g.y - g.r * 0.72;
            ctx.beginPath();
            trazarForma(ctx, 2, bx, by, 4.2);
            ctx.fillStyle = NIVEL_COLOR["TERCER NIVEL"];
            ctx.fill();
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = "#fff";
            ctx.stroke();
          }
        }
      }
    },
    // Devuelve {tipo:"grupo", g} o {tipo:"punto", u} bajo el punto de pantalla (o null)
    hit(cp, tol) {
      if (!this._pad) return null;
      const px = cp.x + this._pad.x, py = cp.y + this._pad.y;
      for (const g of this._grupos || []) {
        const dx = g.x - px, dy = g.y - py;
        if (dx * dx + dy * dy <= (g.r + tol) * (g.r + tol)) return { tipo: "grupo", g, rows: g.idx.map((i) => this._rows[i]) };
      }
      const t = (this._r || 3) + tol;
      let best = null, bd = t * t;
      const p = this._puntos || [];
      for (let j = 0; j < p.length; j += 3) {
        const dx = p[j + 1] - px, dy = p[j + 2] - py;
        const d = dx * dx + dy * dy;
        if (d <= bd) { bd = d; best = this._rows[p[j]]; }
      }
      return best ? { tipo: "punto", u: best } : null;
    },
  });
}
