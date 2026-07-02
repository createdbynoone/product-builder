# Product Builder — CLAUDE.md

Electron app para **creación de producto** (no marketing): combina recursos etiquetados (`@Image1…@Image14`) en un prompt para construir prototipos que terminan en fotografía de estudio para presentaciones. Solo POYO Nano Banana 2; Claude (opcional) pule prompts — el usuario los redacta principalmente.

**Dev:** `npm run dev` (puerto 5275)
**Typecheck:** `npm run typecheck`
**Versión actual:** 1.0.1
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

## Claude polish (opcional)

- IPC `polish-prompt` — envía draft + recursos (como `@ImageN:` + imagen) a `claude-opus-4-8`
- System prompt: visualización de diseño de producto, fotografía de estudio (seamless bg, softbox), PRESERVA los tags `@ImageN` exactos, español→inglés, NO marketing/lifestyle/modelos
- Cooldown 4s; max 8000 chars

## Claves de entorno

Lee `~/.productbuilder.env` primero, luego `~/.bmp.env` como fallback (comparte keys con BMP):
```
POYO_API_KEY=...
ANTHROPIC_API_KEY=...
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
2. Commit + push a `main`
3. `git tag vX.Y.Z && git push origin vX.Y.Z` (el tag debe existir en el remoto antes de publicar — electron-builder 26 lo exige)
4. `GH_TOKEN=$(gh auth token) bash scripts/publish.sh` — build arm64 y x64 **secuencial** (evita mismatch de sha512 por firma paralela)
5. Verificar `latest-mac.yml` del release: version correcta, sha512 coincide con el zip local, tamaños coinciden con los assets subidos

## Pendiente

- Ninguno crítico — listo para primer release
