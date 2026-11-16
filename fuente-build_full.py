import subprocess,json
open('tw3.config.js','w').write(open('tailwind.config.js').read().replace('./src/**/*.jsx','./src/Full.template.jsx'))
subprocess.run("npx tailwindcss -c tw3.config.js -i src/in.css -o dist/tw3.css --minify",shell=True,check=True,capture_output=True)
css=open('dist/tw3.css').read()+open('node_modules/leaflet/dist/leaflet.css').read()
t=open('src/Full.template.jsx').read()
t=t.replace('/*__CSS__*/',json.dumps(css,ensure_ascii=False)).replace('/*__LOGOS__*/',open('/home/claude/logos/logos.json').read()).replace('/*__WORKER__*/',json.dumps(open('src/catalogo.worker.js').read(),ensure_ascii=False))
datos={'DATAB64':('d-base','src/data3.b64'),'DETB64':('d-detalles','src/det.b64'),'ENTB64':('d-ent','src/ent.b64'),'MUNB64':('d-mun','src/mun.b64'),'BASEB64':('d-ref','src/base.b64')}
# 1) JSX de un solo archivo: datos dentro del código
jsx=t
for k,(i,f) in datos.items(): jsx=jsx.replace(f'/*__{k}__*/',open(f).read())
open('/home/claude/CluesDashboard.jsx','w').write(jsx)
# 2) HTML: datos en <script type="text/plain"> (el navegador no los analiza como JavaScript)
src=t
for k in datos: src=src.replace(f'/*__{k}__*/','')
open('src/_full.jsx','w').write(src)
open('src/_entry.jsx','w').write('import React from "react";import {createRoot} from "react-dom/client";import App from "./_full.jsx";createRoot(document.getElementById("root")).render(<App/>);')
subprocess.run("npx esbuild src/_entry.jsx --bundle --minify --format=iife --jsx=automatic --define:process.env.NODE_ENV='\"production\"' --outfile=dist/full.js --log-level=warning",shell=True,check=True)
js=open('dist/full.js').read().replace('</script','<\\/script')
ljs=open('node_modules/leaflet/dist/leaflet.js').read().replace('</script','<\\/script')
bloques=f'<script type="text/plain" id="w-xlsx-gz">{open("src/xlsx.b64").read()}</script>\n'+''.join(f'<script type="text/plain" id="{i}">{open(f).read()}</script>\n' for k,(i,f) in datos.items())
html=f'''<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard CLUES · Establecimientos de Salud</title>
<link rel="preconnect" href="https://a.basemaps.cartocdn.com" crossorigin>
<style>html,body{{margin:0;background:#F4F6F8}}#carga{{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;color:#6B1C35}}</style></head>
<body><div id="root"><div id="carga">Cargando catálogo CLUES…</div></div>
{bloques}<script>{ljs}</script><script>{js}</script></body></html>'''
open('dist/index.html','w').write(html)
print('jsx',len(jsx),'html',len(html))
