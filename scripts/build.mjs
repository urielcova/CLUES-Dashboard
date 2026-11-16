// Compila el tablero.  Uso:  npm install && npm run build
//
// Entradas (todo en el repositorio):
//   src/App.template.jsx     código de la aplicación (con marcadores /*__CSS__*/, /*__LOGOS__*/, /*__WORKER__*/)
//   src/catalogo.worker.js   procesador de catálogos nuevos (Web Worker)
//   src/logos.json           logotipos institucionales (data URI)
//   src/estilos.css          entrada de Tailwind (tailwind.config.js)
//   src/index.template.html  cargador de GitHub Pages
//   datos/*.gz               datos comprimidos (gzip binario)
//
// Salidas:
//   app.js, leaflet.js, index.html                  → publicados por GitHub Pages desde la raíz
//   dist/Dashboard_CLUES_archivo_unico.html         → versión de un solo archivo (sin internet); no se versiona
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = (...p) => join(raiz, ...p);
const leer = (...p) => readFileSync(ruta(...p), "utf8");
const require = createRequire(import.meta.url);
const bin = (pkg) => ruta("node_modules", ".bin", pkg);
mkdirSync(ruta("dist"), { recursive: true });

// 1) CSS: Tailwind (solo las clases usadas en src/*.jsx) + estilos de Leaflet
execFileSync(bin("tailwindcss"), ["-c", "tailwind.config.js", "-i", "src/estilos.css", "-o", "dist/tw.css", "--minify"], { cwd: raiz, stdio: "pipe" });
const leafletDir = dirname(require.resolve("leaflet/package.json"));
const css = leer("dist", "tw.css") + readFileSync(join(leafletDir, "dist", "leaflet.css"), "utf8");

// 2) Código: se insertan CSS, logos y worker; los marcadores de datos quedan vacíos
//    (los datos se leen de datos/*.gz en GitHub Pages o de <script type="text/plain"> en el archivo único)
const sustituir = (t, buscar, poner) => {
  if (!t.includes(buscar)) throw new Error(`No se encontró el marcador ${buscar}`);
  return t.split(buscar).join(poner);
};
let jsx = leer("src", "App.template.jsx");
jsx = sustituir(jsx, "/*__CSS__*/", JSON.stringify(css));
jsx = sustituir(jsx, "/*__LOGOS__*/", leer("src", "logos.json"));
jsx = sustituir(jsx, "/*__WORKER__*/", JSON.stringify(leer("src", "catalogo.worker.js")));
for (const m of ["ENTB64", "MUNB64", "DATAB64", "BASEB64", "DETB64"]) jsx = sustituir(jsx, `/*__${m}__*/`, "");
writeFileSync(ruta("dist", "_app.jsx"), jsx);
writeFileSync(
  ruta("dist", "_entrada.jsx"),
  'import React from "react";import {createRoot} from "react-dom/client";import App from "./_app.jsx";createRoot(document.getElementById("root")).render(<App/>);',
);
execFileSync(
  bin("esbuild"),
  ["dist/_entrada.jsx", "--bundle", "--minify", "--format=iife", "--jsx=automatic", "--define:process.env.NODE_ENV=\"production\"", "--outfile=app.js", "--log-level=warning"],
  { cwd: raiz, stdio: "inherit" },
);
const appJs = leer("app.js");
const leafletJs = readFileSync(join(leafletDir, "dist", "leaflet.js"), "utf8");
writeFileSync(ruta("leaflet.js"), leafletJs);

// 3) Cargador: la versión de caché es la huella del código y los datos, así cambia sola
const datos = { "d-base": "catalogo.json", "d-ent": "entidades.json", "d-mun": "municipios.json", "d-ref": "referencia.json", "d-detalles": "detalles.json", "w-xlsx-gz": "xlsx.js" };
const gz = Object.fromEntries(Object.entries(datos).map(([id, f]) => [id, readFileSync(ruta("datos", f + ".gz"))]));
const huella = createHash("sha256");
for (const b of [appJs, leafletJs, ...Object.values(gz)]) huella.update(b);
const V = huella.digest("hex").slice(0, 10);
const inicio = ["d-base", "d-ent", "d-mun", "d-ref"].reduce((s, id) => s + gz[id].length, 0);
const tamJs = [Buffer.byteLength(leafletJs), Buffer.byteLength(appJs)];
let index = leer("src", "index.template.html");
index = sustituir(index, "__V__", V);
index = sustituir(index, "__TOTAL__", String(inicio + tamJs[0] + tamJs[1]));
index = sustituir(index, "__TAM_JS__", JSON.stringify(tamJs));
writeFileSync(ruta("index.html"), index);

// 4) Archivo único: datos en base64 dentro de <script type="text/plain"> (no se analizan como JavaScript)
const esc = (s) => s.replace(/<\/script/gi, "<\\/script");
const bloques = Object.entries(gz).map(([id, b]) => `<script type="text/plain" id="${id}">${b.toString("base64")}</script>\n`).join("");
const unico = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard CLUES · Establecimientos de Salud</title>
<style>html,body{margin:0;background:#F4F6F8}#carga{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;color:#6B1C35}</style></head>
<body><div id="root"><div id="carga">Cargando catálogo CLUES…</div></div>
${bloques}<script>${esc(leafletJs)}</script><script>${esc(appJs)}</script></body></html>`;
writeFileSync(ruta("dist", "Dashboard_CLUES_archivo_unico.html"), unico);

const kb = (n) => `${Math.round(n / 1024).toLocaleString("es-MX")} KB`;
console.log(`app.js ${kb(tamJs[1])} · descarga inicial ${kb(inicio + tamJs[0] + tamJs[1])} · versión ${V}`);
console.log(`dist/Dashboard_CLUES_archivo_unico.html ${kb(Buffer.byteLength(unico))}`);
