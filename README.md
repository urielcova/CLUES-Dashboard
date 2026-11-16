# Dashboard CLUES MX

Tablero interactivo del Catálogo de Clave Única de Establecimientos de Salud (CLUES, DGIS) con mapa OpenStreetMap: 38,526 unidades **en operación** de primer, segundo y tercer nivel de atención.

**Sitio:** https://urielcova.github.io/CLUES-Dashboard/

## Qué incluye
- Filtros múltiples (entidad, municipio, institución, nivel, calidad de coordenada) y exportación a CSV.
- Mapa con botón «Ver CLUES en esta zona», sombreado fuera del filtro y «Encontrar CLUES más cercana».
- Ficha por unidad con indicaciones en Google Maps.
- Panel **Catálogo** para revisar y cargar un archivo nuevo (clic o arrastrar).

## Archivos
| Archivo | Contenido |
|---|---|
| `index.html` | Cargador: descarga datos y código en paralelo; `detalles` y `xlsx` solo bajo demanda (aquí se cambia `V` para renovar la caché) |
| `app.js`, `leaflet.js` | Aplicación compilada y librería de mapas |
| `datos-*.gz` | Catálogo, detalles, límites INEGI, referencia y lector de Excel (gzip binario) |
| `fuente-*` | Código fuente y script de compilación |
| `Dashboard_CLUES_archivo_unico.html` | Versión de un solo archivo, para uso sin internet |

## Fuentes
- DGIS, Catálogo CLUES (Secretaría de Salud).
- INEGI, Marco Geoestadístico 2025 (límites estatales y municipales).
- Natural Earth (referencia cartográfica).
- © colaboradores de OpenStreetMap; CARTO.
