#!/usr/bin/env bash
# Procesa el Marco Geoestadístico completo de una entidad (ZIP de INEGI) y deja en datos/marco/ent/NN/:
#   manzanas.json.gz, calles.json.gz, servicios.json.gz
# Uso: scripts/marco/por_entidad.sh <archivo.zip> <NN> [carpeta_temporal]
# Requiere mapshaper (npm i -g mapshaper) y python3.
set -euo pipefail
ZIP=$1; NN=$2; TMP=${3:-$(mktemp -d)}
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
MS=${MAPSHAPER:-mapshaper}
rm -rf "$TMP/shp" "$TMP/gj"; mkdir -p "$TMP/shp" "$TMP/gj"
unzip -q -o "$ZIP" "conjunto_de_datos/${NN}m.*" "conjunto_de_datos/${NN}e.*" "conjunto_de_datos/${NN}sil.*" "conjunto_de_datos/${NN}sia.*" "conjunto_de_datos/${NN}sip.*" -d "$TMP/shp" 2>/dev/null || true
D="$TMP/shp/conjunto_de_datos"
# INEGI declara la codificación como «88591» (ISO-8859-1) o «UTF-8» en el .cpg
cod() { if grep -qi 8859 "$D/$1.cpg" 2>/dev/null; then echo latin1; else echo utf8; fi; }
dbf() { ls "$D/$1".dbf "$D/$1".DBF 2>/dev/null | head -1; }
ms() { local n=$1; shift; [ -f "$D/$n.shp" ] || return 0; "$MS" -i "$D/$n.shp" encoding="$(cod "$n")" -proj wgs84 "$@" 2>&1 | grep -v "^\[o\]" || true; }
ms "${NN}m"   -simplify interval=4 keep-shapes -filter-fields CVE_MUN,AMBITO -o "$TMP/gj/m.json" format=geojson precision=0.000001
ms "${NN}e"   -simplify interval=4 -filter-fields CVE_MUN,TIPOVIAL,NOMVIAL -o "$TMP/gj/e.json" format=geojson precision=0.000001
ms "${NN}sil" -filter '["Carretera","Camino","Corriente de Agua","Canal","Vía Férrea"].indexOf(GEOGRAFICO)>=0' -simplify interval=4 -filter-fields CVE_MUN,GEOGRAFICO -o "$TMP/gj/sil.json" format=geojson precision=0.000001
ms "${NN}sia" -filter 'GEOGRAFICO=="Cuerpo de Agua"' -simplify interval=4 keep-shapes -filter-fields CVE_MUN -o "$TMP/gj/sia.json" format=geojson precision=0.000001
ms "${NN}sip" -filter 'GEOGRAFICO=="Centro de Asistencia Médica"' -filter-fields CVE_MUN,NOMSERV,TIPO -o "$TMP/gj/sip.json" format=geojson precision=0.000001
# se escribe en una carpeta temporal y se mueve al final, para no dejar archivos a medias en el repositorio
python3 "$RAIZ/scripts/marco/codificar_entidad.py" "$TMP/gj" "$TMP/sal" "$NN"
rm -rf "$RAIZ/datos/marco/ent/$NN"; mkdir -p "$RAIZ/datos/marco/ent"; mv "$TMP/sal" "$RAIZ/datos/marco/ent/$NN"
rm -rf "$TMP/shp" "$TMP/gj"
