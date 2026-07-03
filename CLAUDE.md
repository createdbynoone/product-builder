# Product Builder — CLAUDE.md

Electron app para **creación de producto** (no marketing): combina recursos etiquetados (`@Image1…@Image14`) en un prompt para construir prototipos que terminan en fotografía de estudio para presentaciones. Solo POYO Nano Banana 2; Claude (opcional) pule prompts — el usuario los redacta principalmente.

**Dev:** `npm run dev` (puerto 5275)
**Typecheck:** `npm run typecheck`
**Versión actual:** 1.1.0
**GitHub:** `createdbynoone/product-builder`

## Stack

- Electron 43 + electron-vite 5 + vite 7 + React 18 + TypeScript + Tailwind
- @anthropic-ai/sdk 0.109+ — `claude-opus-4-8` para pulir prompts
- **Electron 32+ eliminó `File.path`** — drag & drop via `webUtils.getPathForFile` (`window.pb.getPathForFile`)
- zoomFactor 1.1 (+10% UI, webPreferences + did-finish-load); will-navigate prevented + setWindowOpenHandler deny
- Preload MUST ser CommonJS (`.cjs`) — `sandbox:true` + ES module preload falla silenciosamente
- Design tokens compartidos: bg `#0c0c0c`, surface `#141414`, border `#242424`, accent `#E8B547`; contraste #9A9A9A/#666666
- Titlebar h-11 + paddingLeft 92px (semáforos macOS) + translate-y-[1px]

## Layout (3 paneles)

- **Izquierda (228px)** — `ResourcePanel`: drop de recursos (max 14), grid 2 col, cada uno con tag `@ImageN`; click inserta el tag en el cursor del textarea; borde accent si el tag está en uso
- **Centro** — `PromptPanel` (textarea + botón Polish + warning de tags faltantes) + `BuildBar` (ratios 9:16/4:5/3:4/1:1/16:9, resoluciones 1K/2K/4K, botón Build)
- **Derecha (340px)** — `PreviewPanel`: render en grande (spinner + status mientras construye), log de progreso, strip de historial de sesión, botón "Finder ↗"

## Flujo de build

1. Recursos suben a POYO en paralelo preservando orden (`@Image1` = resources[0]) — `uploadResourcesToPOYO`
2. Modelo: `nano-banana-2-edit` si hay recursos, `nano-banana-2` si no
3. Poll cada 5s (`pollPOYOTask`, 8s inicial, timeout 10 min), progreso via canal IPC `pb-progress`
4. Descarga a outputPath (default Desktop, configurable desde el titlebar) como `pb_<timestamp>.<ext>`
5. El render se registra en `sessionRenders` (Set) — `reveal-render` solo actúa sobre paths de esa sesión
6. **Fallback Higgsfield (v1.1.0):** si POYO falla en cualquier punto (upload, submit, poll o sin imagen), `fallbackToHiggsfield` muestra el diagnóstico (`POYO failed: <error_message>`) y reintenta automáticamente via CLI `higgsfield generate create nano_banana_2` con la misma config y los recursos locales como `--image`. Mapeos (el CLI no soporta todo): `3:4 → 4:5`, `4K → 2k`. El render del fallback se guarda igual (`pb_<timestamp>.<ext>`, sessionRenders)

## Modo Technical (Recraft V4.1 Vector)

Toggle `BUILD | TECHNICAL` en el titlebar. Genera dibujos técnicos planos de prendas (flat drawings) como **SVG vectorial editable**, siempre en lienzo **4:5**.

- **Pipeline de 2 etapas:** (1) el usuario suelta una imagen de referencia (foto real o mockup) → Claude (`claude-opus-4-8`) la analiza y escribe la descripción con proporciones coherentes a la imagen, ignorando gráficos/arrugas; (2) `composeTechnicalPrompt` arma el prompt final con el bloque JSON fijo de estilo y dispara a Recraft. Sin referencia, las notas del usuario actúan como descripción directa
- **Contrato de estilo fijo (JSON en el prompt):** trazos 2pt negros uniformes (todas las líneas idénticas), costuras/topstitch como línea discontinua, ribs (cuello/puños) con líneas verticales equiespaciadas, sin arrugas ni trazos extra, sin fills/sombras/texto/gráficos, ghost flat centrado, fondo blanco
- **API Recraft:** `POST https://external.api.recraft.ai/v1/images/generations` con `model: recraftv4_1_vector`, `style: vector_illustration`, `size: "4:5"`, `response_format: url`. OJO: V4.1 Vector NO soporta `substyle`, `negative_prompt`, `controls.no_text` ni tamaños en píxeles tipo `1024x1280` — solo aspect strings (`"4:5"`). Devuelve URL a SVG (~80 créditos/gen)
- **i2i descartado:** `/v1/images/imageToImage` con el modelo vector alucina (strength 0.35 convirtió un tee en puffer) — por eso el análisis Claude + text-to-image
- Output: `pb_tech_<timestamp>.svg` en outputPath, registrado en `sessionRenders`

## Claude polish (opcional)

- IPC `polish-prompt` — envía draft + recursos (como `@ImageN:` + imagen) a `claude-opus-4-8`
- System prompt: visualización de diseño de producto, fotografía de estudio (seamless bg, softbox), PRESERVA los tags `@ImageN` exactos, español→inglés, NO marketing/lifestyle/modelos
- Cooldown 4s; max 8000 chars

## Claves de entorno

Lee `~/.productbuilder.env` primero, luego `~/.bmp.env` como fallback (comparte keys con BMP):
```
POYO_API_KEY=...
ANTHROPIC_API_KEY=...
RECRAFT_API_KEY=...   # modo Technical — vive en ~/.productbuilder.env, NUNCA en el repo
```

## POYO API (mismo patrón que BMP)

```
POST /api/common/upload/base64   → { success, data: { file_url } }
POST /api/generate/submit        → { data: { task_id } }
GET  /api/generate/status/{id}   → { data: { status, progress, files } }
```
Finish: `finished | completed | succeeded` · Error: `failed | error`

## Íconos (Dock, 6 variantes)

`build/icons/Icon-macOS-{Default,Dark,ClearLight,ClearDark,TintedLight,TintedDark}-1024@1x.png` — pack compartido con BMP (mismo artwork). Selector en menú app → "App Icon" (radio), persiste en `pb-prefs.json` como `iconStyle`, aplicado via `applyDockIcon()`. `build/icon.icns` es el ícono del bundle/DMG; `build/background.png` el fondo del instalador.

## Auto-update (silencioso, mismo patrón que BMP/Sorter/Canvas)

`electron-updater` revisa `latest-mac.yml` del último release de GitHub; si hay versión nueva, descarga el DMG manualmente (con progreso), monta con `hdiutil`, reemplaza `/Applications/Product Builder.app` con `ditto`, y relanza. Fallback: si el swap falla, descarga el DMG al Desktop y lo abre para instalación manual. UI: `UpdateBar` arriba del titlebar, estados available/downloading/installing/ready/error.

**Nota de nombres:** el bundle se llama `Product Builder.app` (con espacio), pero electron-builder sanitiza espacios → puntos en los *nombres de archivo* de release (`Product.Builder-1.0.0-arm64.dmg`). El código de auto-update usa el nombre sanitizado para construir la URL de descarga.

## Release workflow

1. Bump `version` en `package.json`
2. Commit + push a `master` (la rama es `master`, no main)
3. `git tag vX.Y.Z && git push origin vX.Y.Z`
4. `bash scripts/publish.sh` — construye con `electron-builder --mac --publish never` (una sola invocación, ambas arquitecturas), auto-verifica sha512 del `latest-mac.yml` vs zips locales, y sube los 9 assets con `gh release upload --clobber`. **NO usar el publisher de GitHub de electron-builder** (`--publish always`): corre tasks de publish duplicados que se sobreescriben entre sí y dejan los assets inconsistentes con el yml. Tampoco correr el builder una vez por arch: `package.json` declara `arch:["arm64","x64"]` en los targets, así que `--arm64`/`--x64` no filtran — dos pasadas = dos builds con firma ad-hoc distinta mezclados en GitHub
5. Verificar el release: `gh api repos/createdbynoone/product-builder/releases/tags/vX.Y.Z --jq '.assets[] | "\(.name) \(.digest)"'` vs `openssl dgst -sha256` local — deben coincidir los 9 assets
6. Si el publish falla a medias: borrar TODOS los assets del release (`gh release delete-asset ... --yes`) y re-correr publish.sh limpio

## Historial de sesiones

### 2026-07-02/03 — v1.0.1 + v1.1.0
- **v1.0.1:** `pollPOYOTask` muestra el `error_message` real de POYO en generaciones fallidas (antes solo "Generation failed" genérico). Diagnóstico de outage: POYO cayó ~6h con `"Server exception, please try again later"` en TODAS las generaciones (incluso prompts triviales) — no era bug de la app. Se recuperó solo; ambos modelos (`nano-banana-2` y `-edit`) verificados OK después
- **v1.1.0:** (1) UpdateBar con inset izquierdo 92px — antes los semáforos de macOS chocaban con su contenido (la barra se monta ARRIBA del titlebar, así que los semáforos caen sobre esa fila); (2) fallback automático a Higgsfield cuando POYO falla (ver Flujo de build #6). Comando fallback probado end-to-end contra Higgsfield real
- **Release workflow reescrito** tras 3 publishes inconsistentes de v1.1.0: el publisher GitHub de electron-builder corre tasks duplicados que se pisan entre sí. Ahora `publish.sh` = build `--publish never` + verificación sha512 + `gh release upload`. Además el disco Sandisk se desconectó a mitad de un publish (ENOENT en todo, `release/` desapareció) — si pasan cosas imposibles a mitad de build, verificar que el volumen siga montado
- v1.1.0 publicado y verificado: los 9 assets con sha256 idéntico local vs GitHub

### 2026-07-03 — Modo Technical (dev)
- Nuevo modo Technical: dibujos técnicos de prendas via Recraft V4.1 Vector (ver sección arriba). Probado end-to-end contra la API real: text-to-image con el bloque de estilo produce flats limpios (rib con líneas, costuras discontinuas, trazo uniforme); imageToImage con el modelo vector descartado por alucinar. En dev, sin release aún

## Pendiente

- Ninguno crítico
