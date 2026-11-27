/* Contexto "tipo canvas" que escribe SVG: permite dibujar el mismo mapa en pantalla (canvas)
   y exportarlo como vector (SVG) con una sola función de dibujo.
   Implementa solo lo que usa componer.js. */

const n = (v) => (Math.round(v * 100) / 100).toString();
const escXml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export class SvgCtx {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.partes = [];
    this.defs = [];
    this.pila = [];
    this.abiertos = 0; // <g> abiertos por clip
    this.st = { fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, globalAlpha: 1, font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic", lineJoin: "miter", lineCap: "butt", dash: [], gAbiertos: 0 };
    this.d = "";
    this._medidor = document.createElement("canvas").getContext("2d");
  }
  // --- estado ---
  get fillStyle() { return this.st.fillStyle; } set fillStyle(v) { this.st.fillStyle = v; }
  get strokeStyle() { return this.st.strokeStyle; } set strokeStyle(v) { this.st.strokeStyle = v; }
  get lineWidth() { return this.st.lineWidth; } set lineWidth(v) { this.st.lineWidth = v; }
  get globalAlpha() { return this.st.globalAlpha; } set globalAlpha(v) { this.st.globalAlpha = v; }
  get font() { return this.st.font; } set font(v) { this.st.font = v; }
  get textAlign() { return this.st.textAlign; } set textAlign(v) { this.st.textAlign = v; }
  get textBaseline() { return this.st.textBaseline; } set textBaseline(v) { this.st.textBaseline = v; }
  get lineJoin() { return this.st.lineJoin; } set lineJoin(v) { this.st.lineJoin = v; }
  get lineCap() { return this.st.lineCap; } set lineCap(v) { this.st.lineCap = v; }
  setLineDash(a) { this.st.dash = a; }
  save() { this.pila.push({ ...this.st }); this.st = { ...this.st, gAbiertos: 0 }; }
  restore() {
    for (let i = 0; i < this.st.gAbiertos; i++) this.partes.push("</g>");
    const s = this.pila.pop();
    if (s) this.st = s;
  }
  measureText(t) { this._medidor.font = this.st.font; return this._medidor.measureText(t); }
  // --- trazos ---
  beginPath() { this.d = ""; }
  moveTo(x, y) { this.d += `M${n(x)} ${n(y)}`; }
  lineTo(x, y) { this.d += `L${n(x)} ${n(y)}`; }
  closePath() { this.d += "Z"; }
  rect(x, y, w, h) { this.d += `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`; }
  arc(x, y, r, a0, a1) {
    // círculos completos (lo único que usa el mapa); arcos parciales aproximados con dos semicírculos
    if (Math.abs(a1 - a0) >= 6.28) {
      this.d += `M${n(x + r)} ${n(y)}A${n(r)} ${n(r)} 0 1 1 ${n(x - r)} ${n(y)}A${n(r)} ${n(r)} 0 1 1 ${n(x + r)} ${n(y)}`;
    } else {
      const ex = x + r * Math.cos(a1), ey = y + r * Math.sin(a1);
      if (!this.d) this.d += `M${n(x + r * Math.cos(a0))} ${n(y + r * Math.sin(a0))}`;
      this.d += `A${n(r)} ${n(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${n(ex)} ${n(ey)}`;
    }
  }
  _alpha() { return this.st.globalAlpha < 1 ? ` opacity="${n(this.st.globalAlpha)}"` : ""; }
  fill(regla) {
    if (!this.d) return;
    this.partes.push(`<path d="${this.d}" fill="${this.st.fillStyle}"${regla === "evenodd" ? ' fill-rule="evenodd"' : ""}${this._alpha()}/>`);
  }
  stroke() {
    if (!this.d) return;
    const dash = this.st.dash.length ? ` stroke-dasharray="${this.st.dash.map(n).join(" ")}"` : "";
    this.partes.push(`<path d="${this.d}" fill="none" stroke="${this.st.strokeStyle}" stroke-width="${n(this.st.lineWidth)}" stroke-linejoin="${this.st.lineJoin}" stroke-linecap="${this.st.lineCap}"${dash}${this._alpha()}/>`);
  }
  fillRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.fill(); }
  strokeRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.stroke(); }
  clip() {
    const id = `c${this.defs.length}`;
    this.defs.push(`<clipPath id="${id}"><path d="${this.d}"/></clipPath>`);
    this.partes.push(`<g clip-path="url(#${id})">`);
    this.st.gAbiertos++;
  }
  _texto(t, x, y, extra) {
    const m = /(?:(bold|\d{3})\s+)?(?:italic\s+)?([\d.]+)px\s+(.*)/.exec(this.st.font) || [];
    const peso = m[1] ? ` font-weight="${m[1] === "bold" ? 700 : m[1]}"` : "";
    const anc = { left: "start", start: "start", center: "middle", right: "end", end: "end" }[this.st.textAlign] || "start";
    const base = { top: "text-before-edge", middle: "central", bottom: "text-after-edge", alphabetic: "auto", hanging: "hanging" }[this.st.textBaseline] || "auto";
    this.partes.push(`<text x="${n(x)}" y="${n(y)}" font-size="${m[2] || 10}" font-family="${escXml(m[3] || "sans-serif")}"${peso} text-anchor="${anc}" dominant-baseline="${base}"${extra}${this._alpha()}>${escXml(t)}</text>`);
  }
  fillText(t, x, y) { this._texto(t, x, y, ` fill="${this.st.fillStyle}"`); }
  strokeText(t, x, y) { this._texto(t, x, y, ` fill="none" stroke="${this.st.strokeStyle}" stroke-width="${n(this.st.lineWidth)}" stroke-linejoin="round"`); }
  aTexto() {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}"><defs>${this.defs.join("")}</defs>${this.partes.join("\n")}</svg>`;
  }
}
