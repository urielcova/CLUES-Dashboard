import TAILWIND_CSS from "virtual:tailwind";

/* ------------------------------------------------------------------ */
/* 6. ESTILOS INCLUIDOS (Tailwind compilado + Leaflet 1.9.4 + propios) */
/* ------------------------------------------------------------------ */
export const CUSTOM_CSS = `
.clues-root{font-family:Montserrat,system-ui,sans-serif}
.clues-pin svg{width:100%;height:100%;filter:drop-shadow(0 3px 3px rgba(60,20,35,.35));transition:transform .15s}
.clues-pin:hover svg{transform:translateY(-2px) scale(1.06)}
.clues-pin--pulse{position:relative}
.clues-pin--pulse::before{content:"";position:absolute;left:50%;bottom:-6px;width:34px;height:14px;margin-left:-17px;border-radius:50%;background:rgba(188,149,92,.55);animation:cluesPulse 1.6s ease-out infinite}
@keyframes cluesPulse{0%{transform:scale(.4);opacity:1}100%{transform:scale(2.2);opacity:0}}
.clues-popup .leaflet-popup-content-wrapper{padding:0;border-radius:12px;overflow:hidden;box-shadow:0 12px 30px -8px rgba(60,20,35,.35)}
.clues-popup .leaflet-popup-content{margin:0;font-family:Montserrat,system-ui,sans-serif;line-height:1.35}
.clues-popup .leaflet-popup-content p{margin:0}
.clues-popup a.leaflet-popup-close-button{color:#fff!important;top:4px!important;right:4px!important}
.clues-picking.leaflet-container,.clues-picking .leaflet-interactive{cursor:crosshair!important}
.clues-fadein{animation:cluesFade .45s ease-out}
@keyframes cluesFade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.leaflet-container{font-family:Montserrat,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
.clues-root .leaflet-control-attribution{font-size:10px!important;line-height:1.4!important;padding:0 5px!important}
.clues-root .leaflet-control-attribution a{font-size:10px!important}
.clues-root .leaflet-bar a{width:32px;height:32px;line-height:32px}
.clues-points{position:absolute;left:0;top:0}
.clues-ctrl a{display:flex!important;align-items:center;justify-content:center;width:34px!important;height:34px!important;color:#9F2241!important;background:#fff}
.clues-ctrl a:hover{background:#fbf3ef}
.clues-ctrl .clues-ctrl-gmaps{color:#BC955C!important}
.clues-root .leaflet-control-layers{border-radius:10px;font-size:13px}
.clues-root .leaflet-control-layers-toggle{width:36px!important;height:36px!important;background-size:20px 20px!important;background-position:center!important;background-repeat:no-repeat!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239F2241' stroke-width='2' stroke-linejoin='round'%3E%3Cpath d='m12 2 10 5-10 5L2 7z'/%3E%3Cpath d='m2 12 10 5 10-5M2 17l10 5 10-5'/%3E%3C/svg%3E")!important}
.clues-root .leaflet-control-layers-expanded{padding:8px 12px 8px 8px}
.clues-root .leaflet-control-scale-line{border-color:#6B1C35;color:#6B1C35;background:rgba(255,255,255,.8);font-size:10.5px}
.clues-lbl{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-family:Montserrat,system-ui,sans-serif;pointer-events:none;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 2px #fff}
.clues-lbl-ent{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7a6a5e}
.clues-lbl-mun{font-size:10.5px;font-weight:600;color:#6b5d52}
.clues-lbl-ciudad{font-size:12.5px;font-weight:700;color:#3f3530}
.clues-lbl-loc{font-size:10.5px;font-weight:600;color:#5d5048}
.clues-root svg.lucide{flex-shrink:0}
.clues-gmaps{color:#6B1C35!important;text-decoration:none!important}
.clues-popup button[data-accion]{cursor:pointer;border:0}
.clues-fade{animation:cluesFadeIn .2s ease-out}
.clues-sheet{animation:cluesUp .28s cubic-bezier(.2,.8,.2,1)}
@keyframes cluesFadeIn{from{opacity:0}to{opacity:1}}
@keyframes cluesUp{from{transform:translateY(24px);opacity:.4}to{transform:none;opacity:1}}
.clues-root select,.clues-root input{font-size:16px}
@media (min-width:640px){.clues-root select,.clues-root input{font-size:14px}}
`;
export const EMBEDDED_CSS = TAILWIND_CSS + CUSTOM_CSS;
