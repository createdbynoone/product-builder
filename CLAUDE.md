# Product Builder — CLAUDE.md

Electron app para **creación de producto** (no marketing): combina recursos etiquetados (`@Image1…@Image14`) en un prompt para construir prototipos que terminan en fotografía de estudio para presentaciones. Solo POYO Nano Banana 2; Claude (opcional) pule prompts — el usuario los redacta principalmente.

**Dev:** `npm run dev` (puerto 5275)
**Typecheck:** `npm run typecheck`
**Versión actual:** 1.0.0 (sin release aún — sin repo GitHub, sin auto-update, sin íconos)

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

## Pendiente

- Íconos de app (build/icon.icns + variantes Dock)
- Repo GitHub + electron-updater + publish.sh cuando haya release (seguir workflow de BMP: tag primero, `latest-mac.yml` verificado)
