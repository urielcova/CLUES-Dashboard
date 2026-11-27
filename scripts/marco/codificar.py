"""Codifica el Marco Geoestadístico Integrado, Encuesta Intercensal 2025 (INEGI) al formato del tablero.

Fuente: https://www.inegi.org.mx/ (mg_integrado_encuesta_intercensal_2025.zip), proyección CCL → WGS 84.
Pasos previos (mapshaper 0.6, ver scripts/marco/LEEME.md):
  mun.json  00mun  simplify interval=150 keep-shapes -clean
  ent.json  mun.json -dissolve CVE_ENT          (los límites estatales coinciden con los municipales)
  loc.json  00l    simplify interval=40 keep-shapes
  lpr.json  00lpr  (puntos)
  ageb/NN.json  00a simplify interval=25 keep-shapes -split CVE_ENT
  mundet/NN.json 00mun simplify interval=35 keep-shapes -clean -split CVE_ENT  (detalle para mapas estatales y municipales)

Uso: python3 scripts/marco/codificar.py <carpeta_con_los_json> <carpeta_datos_del_repo>
Formato de anillos: [x0, y0, dx1, dy1, ...] enteros (grados × q), un anillo exterior por polígono.
"""
import gzip
import json
import math
import os
import sys

ent_dir, datos = sys.argv[1], sys.argv[2]


def leer(n):
    return json.load(open(os.path.join(ent_dir, n), encoding="utf-8"))


def anillos(geom):
    if geom is None:
        return []
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return [p[0] for p in polys if p and len(p[0]) >= 4]  # solo el anillo exterior


def codificar(ring, q):
    pts = []
    for x, y in ring[:-1] if ring[0] == ring[-1] else ring:
        p = (round(x * q), round(y * q))
        if not pts or pts[-1] != p:
            pts.append(p)
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    if len(pts) < 3:
        return None
    out = [pts[0][0], pts[0][1]]
    for (a, b), (c, d) in zip(pts, pts[1:]):
        out += [c - a, d - b]
    return out


def area_km2(ring):
    s = 0
    lat = sum(p[1] for p in ring) / len(ring)
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        s += (x2 + x1) * (y2 - y1)
    return abs(s / 2) * 111.32 * 111.32 * math.cos(math.radians(lat))


def guardar(nombre, obj):
    ruta = os.path.join(datos, nombre)
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with gzip.open(ruta, "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{nombre:28} {os.path.getsize(ruta) / 1024:8.0f} KB")


# --- Municipios y entidades: se conservan claves, nombres (los del catálogo CLUES) y centros ---
viejo_mun = json.load(gzip.open(os.path.join(datos, "municipios.json.gz")))
viejo_ent = json.load(gzip.open(os.path.join(datos, "entidades.json.gz")))
Q = 1000
import unicodedata
mayus = lambda t: unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode().upper()
feats = sorted(leer("mun.json")["features"], key=lambda f: f["properties"]["CVEGEO"])
previo = {k: i for i, k in enumerate(viejo_mun["k"]) if k}
mun = {"q": Q, "k": [], "e": [], "nm": [], "en": [], "c": [], "g": []}
for f in feats:
    p = f["properties"]
    k = p["CVEGEO"]
    rs = anillos(f["geometry"])
    mun["k"].append(k)
    mun["e"].append(int(p["CVE_ENT"]))
    if k in previo:  # nombre tal como aparece en el catálogo CLUES (para empatar) y centro ya calculado
        i = previo[k]
        mun["nm"].append(viejo_mun["nm"][i]); mun["en"].append(viejo_mun["en"][i]); mun["c"].append(viejo_mun["c"][i])
    else:
        mayor = max(rs, key=lambda r: area_km2(r[:-1]))
        mun["nm"].append(mayus(p["NOMGEO"])); mun["en"].append(viejo_ent["n"][int(p["CVE_ENT"]) - 1])
        mun["c"].append([round(sum(y for _, y in mayor[:-1]) / (len(mayor) - 1) * Q), round(sum(x for x, _ in mayor[:-1]) / (len(mayor) - 1) * Q)])
    mun["g"].append([r for r in (codificar(a, Q) for a in rs) if r])
mun["fuente"] = "INEGI, Marco Geoestadístico Integrado, Encuesta Intercensal 2025"
guardar("municipios.json.gz", mun)

geo_ent = {f["properties"]["CVE_ENT"]: f["geometry"] for f in leer("ent.json")["features"]}
ent = dict(viejo_ent)
ent["q"] = Q
ent["g"] = [[r for r in (codificar(a, Q) for a in anillos(geo_ent[f"{i + 1:02d}"])) if r] for i in range(32)]
ent["fuente"] = mun["fuente"]
guardar("entidades.json.gz", ent)

# --- Localidades urbanas y rurales amanzanadas (polígonos) ---
QL = 10000
loc = {"q": QL, "g": [], "n": [], "a": [], "e": [], "m": [], "ar": [], "c": []}
for f in leer("loc.json")["features"]:
    p = f["properties"]
    rs = anillos(f["geometry"])
    cod = [r for r in (codificar(a, QL) for a in rs) if r]
    if not cod:
        continue
    mayor = max(rs, key=lambda r: area_km2(r[:-1]))
    cx = sum(x for x, _ in mayor[:-1]) / (len(mayor) - 1)
    cy = sum(y for _, y in mayor[:-1]) / (len(mayor) - 1)
    loc["g"].append(cod)
    loc["n"].append(p["NOMGEO"])
    loc["a"].append(1 if p["AMBITO"].startswith("U") else 0)
    loc["e"].append(int(p["CVE_ENT"]))
    loc["m"].append(int(p["CVE_MUN"]))
    loc["ar"].append(round(sum(area_km2(r[:-1]) for r in rs) * 100))
    loc["c"].append([round(cy * QL), round(cx * QL)])
guardar("marco/localidades.json.gz", loc)

# --- Localidades rurales puntuales: agrupadas por entidad, coordenadas en deltas ---
por_ent = {}
for f in leer("lpr.json")["features"]:
    x, y = f["geometry"]["coordinates"]
    por_ent.setdefault(int(f["properties"]["CVE_ENT"]), []).append((round(y * QL), round(x * QL), int(f["properties"]["CVE_MUN"])))
rur = {"q": QL, "e": [], "p": [], "m": []}
for e in sorted(por_ent):
    pts = sorted(por_ent[e])
    plano = [pts[0][0], pts[0][1]]
    for (a, b, _), (c, d, _) in zip(pts, pts[1:]):
        plano += [c - a, d - b]
    rur["e"].append([e, len(pts)])
    rur["p"] += plano
    rur["m"] += [m for _, _, m in pts]
guardar("marco/rurales.json.gz", rur)

# --- AGEB urbanas y rurales, un archivo por entidad ---
for n in sorted(os.listdir(os.path.join(ent_dir, "ageb"))):
    fc = json.load(open(os.path.join(ent_dir, "ageb", n), encoding="utf-8"))
    ag = {"q": QL, "g": [], "u": [], "m": []}
    for f in fc["features"]:
        cod = [r for r in (codificar(a, QL) for a in anillos(f["geometry"])) if r]
        if not cod:
            continue
        ag["g"].append(cod)
        ag["u"].append(1 if str(f["properties"].get("ambito", "")).startswith("U") else 0)
        ag["m"].append(int(f["properties"]["CVE_MUN"]))
    guardar(f"marco/ageb/{n[:2]}.json.gz", ag)

# --- Municipios con más detalle (≈35 m), un archivo por entidad ---
for n in sorted(os.listdir(os.path.join(ent_dir, "mundet"))):
    fc = json.load(open(os.path.join(ent_dir, "mundet", n), encoding="utf-8"))
    md = {"q": QL, "k": [], "g": []}
    for f in fc["features"]:
        md["k"].append(f["properties"]["CVEGEO"])
        md["g"].append([r for r in (codificar(a, QL) for a in anillos(f["geometry"])) if r])
    guardar(f"marco/mun/{n[:2]}.json.gz", md)
