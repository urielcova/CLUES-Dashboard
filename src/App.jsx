/**
 * Dashboard CLUES — Establecimientos de Salud en México (base completa)
 * Fuente: ESTABLECIMIENTO_SALUD_202609.xlsx, hoja CLUES_202609
 * Criterio: ESTATUS DE OPERACION = "EN OPERACION" y NIVEL ATENCION ∈ {PRIMER, SEGUNDO, TERCER}
 *
 * Compilación: scripts/build.mjs (inserta CSS, logos y worker). Datos: datos/*.gz.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dashboard } from "./Dashboard";
import { META_PUBLICADO, cargarBase, construirBase, fijarDetalles } from "./datos";
import { EMBEDDED_CSS } from "./estilos";
import { useLeaflet } from "./mapa/leaflet";
import { idbDel, idbGet, idbSet } from "./util";

/* ------------------------------------------------------------------ */
/* 5. APP                                                              */
/* ------------------------------------------------------------------ */
export default function App() {
  const { L, status: leafletStatus } = useLeaflet();
  const [data, setData] = useState(null);
  const [dataError, setDataError] = useState("");
  const [catalogo, setCatalogo] = useState(META_PUBLICADO);

  const cargarPublicado = async () => {
    fijarDetalles(null);
    setData(await cargarBase());
    setCatalogo(META_PUBLICADO);
  };
  useEffect(() => {
    (async () => {
      try {
        const guardado = await idbGet("catalogo");
        if (guardado?.pack && guardado?.det) {
          setData(construirBase(guardado.pack));
          fijarDetalles(Promise.resolve(guardado.det));
          setCatalogo({ ...guardado.meta, fuente: "navegador" });
        } else await cargarPublicado();
      } catch (e) {
        setDataError(String(e?.message || e));
      }
    })();
    if (!document.querySelector("link[data-clues-font]")) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap";
      l.dataset.cluesFont = "1";
      document.head.appendChild(l);
    }
  }, []);

  const aplicarCatalogo = async ({ pack, det, meta }) => {
    setData(construirBase(pack));
    fijarDetalles(Promise.resolve(det));
    setCatalogo({ ...meta, fuente: "navegador" });
    try { await idbSet("catalogo", { pack, det, meta }); return true; } catch { return false; }
  };
  const volverPublicado = async () => { await idbDel("catalogo"); setData(null); await cargarPublicado(); };

  if (!data) {
    return (
      <div className="clues-root grid min-h-screen place-items-center bg-fondo">
        <style>{EMBEDDED_CSS}</style>
        <div className="rounded-2xl bg-white px-8 py-7 text-center shadow-lg">
          {dataError ? (
            <p className="flex items-center gap-2 text-sm text-guinda"><AlertTriangle style={{ width: 16, height: 16 }} /> No fue posible leer la base: {dataError}</p>
          ) : (
            <>
              <Loader2 className="mx-auto animate-spin text-dorado" style={{ width: 32, height: 32 }} />
              <p className="mt-3 text-sm font-semibold text-guinda">Cargando catálogo CLUES…</p>
            </>
          )}
        </div>
      </div>
    );
  }
  return (
    <Dashboard
      data={data}
      L={L}
      leafletStatus={leafletStatus}
      catalogo={catalogo}
      onAplicarCatalogo={aplicarCatalogo}
      onVolverPublicado={volverPublicado}
    />
  );
}
