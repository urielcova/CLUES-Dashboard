# Dashboard CLUES MX

Tablero interactivo del Catálogo de Clave Única de Establecimientos de Salud (CLUES, DGIS) con mapa OpenStreetMap: 38,526 unidades **en operación** de primer, segundo y tercer nivel de atención.

**Sitio:** https://urielcova.github.io/CLUES-Dashboard/

## Qué incluye
- Filtros múltiples (entidad, municipio, institución, nivel, calidad de coordenada) y exportación a CSV.
- Mapa con botón «Ver CLUES en esta zona», sombreado fuera del filtro y «Encontrar CLUES más cercana».
- Ficha por unidad con indicaciones en Google Maps.
- Panel **Catálogo** para revisar y cargar un archivo nuevo (clic o arrastrar).

## Estructura
| Ruta | Contenido |
|---|---|
| `index.html` | Cargador (aquí se cambia `V` para renovar la caché) |
| `assets/` | `app.js` (aplicación compilada) y `leaflet.js` |
| `data/` | Catálogo, detalles, límites INEGI y referencia, comprimidos (gzip + base64) |
| `herramientas/` | Código fuente y script de compilación |
| `Dashboard_CLUES_archivo_unico.html` | Versión de un solo archivo, para uso sin internet |

## Actualizar el catálogo
1. Abre el sitio → pestaña **Catálogo** → carga el nuevo `ESTABLECIMIENTO_SALUD_*.xlsx` y revisa altas, bajas y cambios (solo queda en tu navegador).
2. Para publicarlo a todos, genera los archivos de `data/` con el mismo proceso y sube los cambios; después cambia `V` en `index.html`.

## Fuentes
- DGIS, Catálogo CLUES (Secretaría de Salud).
- INEGI, Marco Geoestadístico 2025 (límites estatales y municipales).
- Natural Earth (referencia cartográfica).
- © colaboradores de OpenStreetMap; CARTO.
