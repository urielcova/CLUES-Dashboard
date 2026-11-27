/* ZIP mínimo sin compresión (los PNG ya vienen comprimidos): suficiente para descargar varias imágenes juntas */
const TABLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/* archivos: [{ nombre, datos: Uint8Array }] → Blob application/zip */
export function crearZip(archivos) {
  const enc = new TextEncoder();
  const partes = [], central = [];
  let off = 0;
  const ahora = new Date();
  const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
  const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
  for (const { nombre, datos } of archivos) {
    const nb = enc.encode(nombre), crc = crc32(datos);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true);
    loc.setUint16(10, hora, true); loc.setUint16(12, fecha, true); loc.setUint32(14, crc, true);
    loc.setUint32(18, datos.length, true); loc.setUint32(22, datos.length, true); loc.setUint16(26, nb.length, true); loc.setUint16(28, 0, true);
    partes.push(new Uint8Array(loc.buffer), nb, datos);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
    cen.setUint16(12, hora, true); cen.setUint16(14, fecha, true); cen.setUint32(16, crc, true); cen.setUint32(20, datos.length, true); cen.setUint32(24, datos.length, true);
    cen.setUint16(28, nb.length, true); cen.setUint32(42, off, true);
    central.push(new Uint8Array(cen.buffer), nb);
    off += 30 + nb.length + datos.length;
  }
  const tamCentral = central.reduce((t, p) => t + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, off, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: "application/zip" });
}
