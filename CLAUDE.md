# Product Builder — CLAUDE.md

Electron app para **creación de producto** (no marketing): combina recursos etiquetados (`@Image1…@Image14`) en un prompt para construir prototipos que terminan en fotografía de estudio para presentaciones. Solo POYO Nano Banana 2; Claude (opcional) pule prompts — el usuario los redacta principalmente.

**Dev:** `npm run dev` (puerto 5275)
**Typecheck:** `npm run typecheck`
**Versión actual:** 1.3.0
**GitHub:** `createdbynoone/product-builder`

## Lock screen + seguridad (v1.3.0, 2026-07-07)
- Primer arranque en una máquina pide passphrase (`brother*1998_hood`, mismo patrón que Brotherhood Canvas/Sorter) antes de tocar filesystem/API keys — scrypt hash+salt propios en `main.ts`, nunca el texto plano; `timingSafeEqual`; backoff exponencial persistido en `pb-prefs.json`
- `handleWhenUnlocked()` gatea todos los IPC (`polish-prompt`, `fire-build`, `fire-technical`, `fire-enhance`, `reveal-render`, `trash-render`, `get-output-path`, etc.) — el backend rechaza aunque alguien salte el `LockScreen.tsx` de la UI
- **Vulnerabilidad real corregida**: el protocolo `localfile://` hacía `net.fetch('file://' + path)` con CUALQUIER path, sin restricción. Ahora `knownLocalPaths` (Set poblado por el wrapper de `getPathForFile` en preload — cada path que el renderer resuelve de un drag de Finder se registra ahí) + `sessionRenders` son los únicos paths servibles, y solo si `unlocked`
- CSP agregado a `index.html` (no existía)
- Para regenerar el hash si cambia la clave: `node -e "const c=require('crypto');const s=c.randomBytes(16);console.log(s.toString('hex'), c.scryptSync('NUEVA_CLAVE',s,64).toString('hex'))"` y reemplazar `LOCK_SALT_HEX`/`LOCK_HASH_HEX`

## Stack

- Electron 43 + electron-vite 5 + vite 7 + React 18 + TypeScript + Tailwind
- @anthropic-ai/sdk 0.109+ — `claude-sonnet-5` para pulir prompts
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

## Modo Technical (Nano Banana 2 via POYO)

Toggle `PRODUCT | TECHNICAL` en el titlebar. Genera dibujos técnicos planos de prendas (flat drawings) en PNG, siempre lienzo **4:5 · 2K**.

- **Pipeline:** referencia (foto real o mockup) → sube a POYO → `nano-banana-2-edit` con `composeTechnicalPrompt` (sin referencia: `nano-banana-2` con las notas como descripción). NB2 ve la imagen directamente, por eso las proporciones y costuras salen fieles. Fallback automático a Higgsfield CLI `nano_banana_2` si POYO falla (mismo patrón que Product, prefix `pb_tech`)
- **Contrato de estilo fijo (bloque JSON en el prompt):** trazos 2pt negros uniformes (todas las líneas idénticas), costuras/topstitch como línea discontinua, ribs (cuello/puños) con líneas verticales equiespaciadas, sin arrugas ni trazos extra, sin fills/sombras/texto/gráficos, ghost flat centrado, fondo blanco
- **Geometría CAD estricta:** bloque LINE GEOMETRY — bordes rectos perfectamente rectos (a regla, esquinas crisp, hems horizontales), NO líneas onduladas ni curvas orgánicas; curvas SOLO donde el patrón realmente curva (escotes, sisas, copa de gorra, visera). Añadido tras feedback: los primeros flats salían con trazos "en rizo"
- **Regla NB2 (de la skill Technical-Brotherhood):** el prompt ABRE con el bloque de style-override ("Technical fashion flat drawing. Vector illustration style… NOT a photograph…") — el modelo ancla en los primeros tokens; enterrarlo después no funciona. Prompt corto + framing "like a mockup template" para limpiar gráficos
- **Historia:** primero se implementó con Recraft V4.1 Vector (SVG editable) — text-to-image daba flats limpios pero proporciones inventadas (dependía de descripción textual de Claude), y su imageToImage alucinaba (tee→puffer). NB2-edit resolvió ambas cosas; Recraft descartado. Si se retoma: V4.1 Vector NO soporta substyle/negative_prompt/controls/tamaños en píxeles, solo aspect strings (`"4:5"`), ~80 créditos/gen, `RECRAFT_API_KEY` sigue en `~/.productbuilder.env`
- **Cualquier producto, no solo tees:** el prompt cubre pantalones, shorts, gorras, accesorios — vocabulario de construcción por categoría (waistband, drawcords, fly/placket, paneles de gorra, eyelets, visera, bolsillos, belt loops, hardware en outline) y vistas FRONT/BACK/SIDE/DETAIL
- Output: `pb_tech_<timestamp>.png` en outputPath, registrado en `sessionRenders`
- Los renders (Product y Technical) se pueden **arrastrar** al panel Resources (mime interno `application/x-pb-render`) y a la zona de referencia de Technical

## Modo Enhance (mockup → fotoreal, Nano Banana 2 via POYO)

Tercer modo del toggle (`PRODUCT | TECHNICAL | ENHANCE`). Convierte un mockup/flat en un shot fotoreal e-commerce con tacto y textura final, siempre **4:5 · 2K**. Destilado de la skill **Enhance-Brotherhood**.

- **Pipeline:** dos drop zones — FRONT + BACK (opcional, cualquiera de las dos basta) + notas básicas de materiales → UNA llamada a Claude (`claude-sonnet-5`, `ENHANCE_SYSTEM_PROMPT`) compone el/los prompts; con ambas vistas escribe **dos prompts coordinados** con bloque de cuerpo IDÉNTICO (delimitador `=====BACK=====`, patrón de la skill) → ambas generaciones `nano-banana-2-edit` disparadas **en paralelo** (progreso con tags `[FRONT]`/`[BACK]`) → `pb_enh_front_<ts>.png` / `pb_enh_back_<ts>.png`. Sin ANTHROPIC key o si Claude falla: `composeEnhanceFallbackPrompt` por vista. Fallback Higgsfield por vista (prefix `pb_enh_front`/`pb_enh_back`)
- **Vocabulario de técnicas (en el system prompt):** serigrafía relieve/puff (2–3mm), alta densidad (1.5–2mm bordes 90°), plana, sublimado (default tone-on-tone), laser, trazo, bordado acolchado, vintage, golpes de costura FUERTES (halo 3–5cm) / LEVES (≤6–8mm), foto PANEL/BLEED
- **Estándares globales no negociables (de la skill):** sin sombra de contacto, fondo seamless `#ededed` perfectamente uniforme, arrugas casi cero (pressed crisp), lenguaje ultra-premium (haute-couture), softbox ~5500K, materiales legibles como superficies distintas
- **Reglas:** NUNCA añadir componentes no visibles en la referencia; vista BACK sin el tag lateral metálico; presentación por categoría (ghost mannequin tops / flat-lay pants / head-form gorras); materiales por categoría (tees 280–320gsm jersey, hoodies 380–450gsm fleece, jeans 12–14oz, gorras twill)
- Output: `pb_enh_<timestamp>.png` en outputPath, registrado en `sessionRenders`. Probado end-to-end con el tee Aurora Borealis: texturas fieles, gráficos preservados, bleed disolviéndose correcto

## Claude polish (opcional)

- IPC `polish-prompt` — envía draft + recursos (como `@ImageN:` + imagen) a `claude-sonnet-5`
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

### 2026-07-03 — Modos Technical + Enhance (dev, pendiente release)
- **Modo Technical**: dibujos técnicos de prendas. v1: Recraft V4.1 Vector (SVG) — descartado, resultados no esperados (proporciones inventadas, i2i alucinaba). v2: **Nano Banana 2 edit via POYO** — probado contra la API real con un tee oversized: proporciones fieles, costuras de panel presentes, rib con líneas, topstitch discontinuo. Ver sección "Modo Technical" arriba
- Toggle renombrado BUILD → PRODUCT (3 modos: PRODUCT | TECHNICAL | ENHANCE); renders arrastrables a Resources y a las referencias de Technical/Enhance
- Geometría del Technical iterada 2 veces por feedback ("trazos en rizo" → "wiggle"): la solución final fue **IDEALIZE THE GEOMETRY — DO NOT TRACE THE PHOTO** (NB2 calca la ondulación de la tela de la referencia; hay que ordenar enderezar cada borde a su forma ideal de patrón, un segmento vectorial por borde). Pedir solo "líneas rectas" NO basta
- **Modo Enhance añadido** (destilado de la skill Enhance-Brotherhood, ver sección arriba) — probado end-to-end con el tee Aurora Borealis via POYO real
- Enhance iterado por feedback: NB2 deformaba textos pequeños ("SIGNATURE"→"SKEHATURE"). Fix validado: Claude transcribe cada texto del mockup **verbatim** en el prompt + TEXT FIDELITY absolute + DESIGN/SILHOUETTE LOCK (el edit solo toca materiales/textura/luz)
- Claude de la app (Polish + Enhance compose) cambiado de `claude-opus-4-8` a **`claude-sonnet-5`**
- Renders de prueba de la sesión en Desktop: `pb_tech_test_back/straight/vector.png`, `pb_enh_test_aurora(_strict).png`
- **Shift+hover en el strip de sesión** → overlay oscuro + ícono papelera; shift+click mueve el archivo a la Papelera de macOS via `shell.trashItem` (IPC `trash-render`, solo paths de `sessionRenders`, sin diálogos de permiso) y lo quita de la sesión
- **Handle de resize** (puntos de agarre) entre el panel central y el Preview: drag redimensiona por DOM directo (cero re-renders durante el drag), clamp 280px–60vw, persiste en `localStorage` (`pb-preview-width`), doble click resetea a 340px. Etiqueta del toggle: PRODUCT → BUILD (el modo interno sigue siendo `product`)
- **v1.2.0 publicada y verificada** (mismo día): silhouette lock estricto en Enhance + los 3 modos + trash shift+hover + resize handle + enhance dual paralelo. Los 9 assets con sha256 idéntico local vs GitHub

## Pendiente

- Ninguno crítico
