"""Codifica las capas de detalle del Marco Geoestadístico por entidad (manzanas, calles, agua, carreteras locales
y servicios de salud) al formato compacto del tablero. Lo invoca scripts/marco/por_entidad.sh.

Uso: python3 codificar_entidad.py <carpeta_geojson> <carpeta_salida> <NN>
Coordenadas: enteros (grados × 1e5 ≈ 1 m) en deltas; un anillo exterior por polígono.
"""
import gzip
import json
import os
import sys

src, dst, ent = sys.argv[1], sys.argv[2], sys.argv[3]
Q = 100000
os.makedirs(dst, exist_ok=True)


def leer(n):
    ruta = os.path.join(src, n)
    return json.load(open(ruta, encoding="utf-8"))["features"] if os.path.exists(ruta) else []


def delta(pts, cerrar):
    out, prev = [], None
    for x, y in pts:
        p = (round(x * Q), round(y * Q))
        if p != prev:
            out.append(p)
            prev = p
    if cerrar and len(out) > 1 and out[0] == out[-1]:
        out.pop()
    if len(out) < (3 if cerrar else 2):
        return None
    plano = [out[0][0], out[0][1]]
    for (a, b), (c, d) in zip(out, out[1:]):
        plano += [c - a, d - b]
    return plano


def poligonos(geom):
    if not geom:
        return []
    ps = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return [r for r in (delta(p[0], True) for p in ps if p) if r]


def lineas(geom):
    if not geom:
        return []
    ls = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
    return [r for r in (delta(l, False) for l in ls) if r]


def guardar(nombre, obj):
    ruta = os.path.join(dst, nombre)
    with gzip.open(ruta, "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(ruta)


tam = {}
# Manzanas
mz = {"q": Q, "g": [], "m": [], "u": []}
for f in leer("m.json"):
    g = poligonos(f["geometry"])
    if g:
        mz["g"].append(g)
        mz["m"].append(int(f["properties"]["CVE_MUN"]))
        mz["u"].append(1 if str(f["properties"].get("AMBITO", "")).startswith("U") else 0)
tam["manzanas"] = guardar("manzanas.json.gz", mz)

# Calles (ejes de vialidad): tipo por índice; nombre solo para vialidades principales
PRINCIPALES = {"Avenida", "Boulevard", "Calzada", "Carretera", "Periférico", "Viaducto", "Eje Vial", "Circunvalación", "Libramiento", "Autopista"}
tipos, ca = [], {"q": Q, "g": [], "t": [], "m": [], "n": []}
for f in leer("e.json"):
    p = f["properties"]
    g = lineas(f["geometry"])
    if not g:
        continue
    t = p.get("TIPOVIAL") or "Otro"
    if t not in tipos:
        tipos.append(t)
    ca["g"].append(g)
    ca["t"].append(tipos.index(t))
    ca["m"].append(int(p["CVE_MUN"]))
    nom = (p.get("NOMVIAL") or "").strip()
    ca["n"].append(nom if t in PRINCIPALES and nom and nom not in ("Ninguno", "N/A", "Sin Nombre") else "")
ca["tipos"] = tipos
tam["calles"] = guardar("calles.json.gz", ca)

# Líneas de servicios (carreteras locales, caminos, ríos, canales, vías férreas) y cuerpos de agua
CLASES = ["Carretera", "Camino", "Corriente de Agua", "Canal", "Vía Férrea"]
li = {"q": Q, "g": [], "c": [], "m": []}
for f in leer("sil.json"):
    c = f["properties"].get("GEOGRAFICO")
    g = lineas(f["geometry"])
    if c in CLASES and g:
        li["g"].append(g)
        li["c"].append(CLASES.index(c))
        li["m"].append(int(f["properties"]["CVE_MUN"]))
li["clases"] = CLASES
ag = {"q": Q, "g": [], "m": []}
for f in leer("sia.json"):
    g = poligonos(f["geometry"])
    if g:
        ag["g"].append(g)
        ag["m"].append(int(f["properties"]["CVE_MUN"]))
# Servicios de salud (puntos) para comparar con CLUES
sa = {"q": Q, "p": [], "n": [], "t": [], "m": []}
for f in leer("sip.json"):
    x, y = f["geometry"]["coordinates"]
    pr = f["properties"]
    sa["p"].append([round(y * Q), round(x * Q)])
    nom = (pr.get("NOMSERV") or "").strip()
    sa["n"].append("" if nom in ("Ninguno", "No Aplica", "N/A") else nom)
    sa["t"].append(pr.get("TIPO") or "")
    sa["m"].append(int(pr["CVE_MUN"]))
tam["servicios"] = guardar("servicios.json.gz", {"lineas": li, "agua": ag, "salud": sa})
print(ent, " ".join(f"{k}={v / 1024:.0f}KB" for k, v in tam.items()), f"manzanas={len(mz['g'])} calles={len(ca['g'])} salud={len(sa['p'])}")
