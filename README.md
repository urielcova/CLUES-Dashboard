# Dashboard CLUES MX

Tablero interactivo del Catálogo de Clave Única de Establecimientos de Salud (CLUES, DGIS) con mapa OpenStreetMap: 38,526 unidades **en operación** de primer, segundo y tercer nivel de atención.

**Sitio:** https://urielcova.github.io/CLUES-Dashboard/

## Qué incluye
- Filtros múltiples (entidad, municipio, institución, nivel, calidad de coordenada) y exportación a CSV.
- Mapa con botón «Ver CLUES en esta zona», sombreado fuera del filtro y «Encontrar CLUES más cercana».
- Ficha por unidad con indicaciones en Google Maps.
- Panel **Catálogo** para revisar y cargar un archivo nuevo (clic o arrastrar).

## Archivos
| Ruta | Contenido |
|---|---|
| `src/App.template.jsx` | Código de la aplicación (React + Leaflet) |
| `src/catalogo.worker.js` | Procesador de catálogos nuevos (Web Worker) |
| `src/index.template.html` | Plantilla del cargador: descarga datos y código en paralelo; `detalles` y `xlsx` solo bajo demanda |
| `src/logos.json`, `src/estilos.css`, `tailwind.config.js` | Logotipos institucionales y estilos (Tailwind CSS 3) |
| `datos/*.gz` | Catálogo, detalles, límites INEGI, referencia y lector de Excel (gzip binario) |
| `scripts/build.mjs` | Compilación |
| `index.html`, `app.js`, `leaflet.js` | **Generados** por la compilación; GitHub Pages los publica desde la raíz |

La versión de un solo archivo (sin internet) se publica automáticamente en [Releases → ultima](https://github.com/urielcova/CLUES-Dashboard/releases/tag/ultima) en cada cambio a `main`.

## Compilar
Requiere Node.js 18 o posterior.

```bash
npm install
npm run build     # genera app.js, leaflet.js, index.html y dist/Dashboard_CLUES_archivo_unico.html
npm run serve     # http://localhost:8080
```

- Sube siempre `app.js`, `leaflet.js` e `index.html` junto con tus cambios en `src/` o `datos/`; GitHub Actions comprueba que estén al día.
- La versión de caché (`V` en `index.html`) se calcula sola a partir del contenido; ya no hay que cambiarla a mano.

## Fuentes
- DGIS, Catálogo CLUES (Secretaría de Salud).
- INEGI, Marco Geoestadístico 2025 (límites estatales y municipales).
- Natural Earth (referencia cartográfica).
- © colaboradores de OpenStreetMap; CARTO.
