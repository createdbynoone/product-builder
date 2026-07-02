import { app, BrowserWindow, ipcMain, shell, nativeImage, protocol, net, Menu, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, createWriteStream } from 'fs'
import { homedir } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import https from 'https'
import Anthropic from '@anthropic-ai/sdk'
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater

const execFileAsync = promisify(execFile)

const SHELL_PATH = [
  '/usr/local/bin', '/opt/homebrew/bin', '/opt/homebrew/sbin',
  '/usr/bin', '/bin', process.env.PATH ?? '',
].join(':')

function shellEnv(): NodeJS.ProcessEnv { return { ...process.env, PATH: SHELL_PATH } }

// ─── Preferences ──────────────────────────────────────────────────────────────

const ICON_STYLES = ['Default', 'Dark', 'ClearLight', 'ClearDark', 'TintedLight', 'TintedDark'] as const
type IconStyle = typeof ICON_STYLES[number]

interface Prefs {
  iconStyle: IconStyle
  outputPath: string
}

function prefsPath(): string {
  return join(app.getPath('userData'), 'pb-prefs.json')
}

function defaultOutputPath(): string {
  return join(homedir(), 'Desktop')
}

function loadPrefs(): Prefs {
  try {
    const raw = readFileSync(prefsPath(), 'utf-8')
    return { iconStyle: 'Default', outputPath: defaultOutputPath(), ...JSON.parse(raw) }
  } catch {
    return { iconStyle: 'Default', outputPath: defaultOutputPath() }
  }
}

function savePrefs(prefs: Prefs) {
  writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2), 'utf-8')
}

function getIconPath(styleName: string): string {
  const filename = `Icon-macOS-${styleName}-1024@1x.png`
  if (app.isPackaged) return join(process.resourcesPath, 'icons', filename)
  return join(__dirname, '../../build/icons', filename)
}

function applyDockIcon(styleName: string) {
  if (process.platform !== 'darwin') return
  try {
    const icon = nativeImage.createFromPath(getIconPath(styleName))
    if (!icon.isEmpty()) app.dock.setIcon(icon)
  } catch {}
}

function buildAppMenu() {
  const prefs = loadPrefs()

  const iconSubmenu: Electron.MenuItemConstructorOptions[] = ICON_STYLES.map(style => ({
    label: style,
    type: 'radio' as const,
    checked: prefs.iconStyle === style,
    click: () => {
      savePrefs({ ...loadPrefs(), iconStyle: style })
      applyDockIcon(style)
      buildAppMenu()
    },
  }))

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'App Icon', submenu: iconSubmenu },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── Env ──────────────────────────────────────────────────────────────────────

// Load env — own file first, then ~/.bmp.env as fallback (shares POYO/Anthropic keys)
function loadEnv() {
  const candidates = [
    join(homedir(), '.productbuilder.env'),
    join(homedir(), '.bmp.env'),
    app.isPackaged
      ? join(process.resourcesPath, '.env')
      : join(__dirname, '../../.env'),
  ]
  for (const envPath of candidates) {
    try {
      const raw = readFileSync(envPath, 'utf-8')
      for (const line of raw.split('\n')) {
        const [key, ...rest] = line.split('=')
        if (key && rest.length && !process.env[key.trim()]) {
          process.env[key.trim()] = rest.join('=').trim()
        }
      }
    } catch {}
  }
}

loadEnv()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Claude prompt polish (optional) ──────────────────────────────────────────

const POLISH_SYSTEM_PROMPT = `You are a prompt engineer for Nano Banana 2 image generation, specialized in PRODUCT DESIGN visualization — turning rough prototype ideas into polished studio product photography prompts.

The user builds product prototypes by combining reference resources (materials, shapes, logos, textures, existing products) tagged as @Image1, @Image2, etc. Your job is to refine their draft prompt into a precise, buildable image prompt.

Rules:
- PRESERVE every @ImageN tag exactly as written — these map to the user's uploaded resources and their order matters
- Keep the user's construction logic intact: which elements combine, what goes where. You refine language, you do NOT redesign the product
- Target output is STUDIO PRODUCT PHOTOGRAPHY for presentations: seamless background, controlled softbox lighting, sharp focus on materials and construction, professional product-shot framing
- Be specific about: materials, finishes, textures, construction details, proportions, lighting setup, background tone, camera angle
- This is product design visualization — NOT marketing, NOT lifestyle, NO models, NO environments beyond the studio set
- If the draft is in Spanish, output the polished prompt in English (image models perform better in English)
- Output ONLY the polished prompt text, no preamble or explanation

Content safety (violations cause silent generation failure):
- No weapons, drugs, political symbols, real brand names other than Brotherhood/BRHD
- If a graphic contains text, describe its visual style, not flaggable exact words`

const MAX_IMAGE_PX = 1568 // Anthropic recommended max dimension

function resizeAndEncode(p: string): { b64: string; mediaType: Anthropic.Base64ImageSource['media_type'] } | null {
  try {
    const img = nativeImage.createFromPath(p)
    if (!img.isEmpty()) {
      const { width, height } = img.getSize()
      const scale = Math.min(1, MAX_IMAGE_PX / Math.max(width, height))
      const resized = scale < 1
        ? img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'good' })
        : img
      const b64 = resized.toJPEG(85).toString('base64')
      if (b64) return { b64, mediaType: 'image/jpeg' }
    }
    const raw = readFileSync(p)
    const ext = p.split('.').pop()?.toLowerCase() ?? ''
    const mediaType: Anthropic.Base64ImageSource['media_type'] =
      ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    const b64 = raw.toString('base64')
    if (!b64) return null
    return { b64, mediaType }
  } catch {
    return null
  }
}

const POLISH_COOLDOWN_MS = 4000
let lastPolishTime = 0

ipcMain.handle('polish-prompt', async (_event, { prompt, resources }: { prompt: string; resources: string[] }) => {
  const now = Date.now()
  if (now - lastPolishTime < POLISH_COOLDOWN_MS) {
    const wait = Math.ceil((POLISH_COOLDOWN_MS - (now - lastPolishTime)) / 1000)
    throw new Error(`Rate limit: wait ${wait}s before polishing again`)
  }
  lastPolishTime = now

  if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 8000) {
    throw new Error('Invalid prompt')
  }
  if (!Array.isArray(resources) || resources.length > 14) throw new Error('Invalid resources')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set — add it to ~/.productbuilder.env')

  const resourceImages = resources
    .map((p, i) => ({ encoded: resizeAndEncode(p), i }))
    .filter((r): r is { encoded: NonNullable<ReturnType<typeof resizeAndEncode>>; i: number } => r.encoded !== null)

  const userContent: Anthropic.MessageParam['content'] = [
    ...resourceImages.flatMap(({ encoded, i }) => [
      { type: 'text' as const, text: `@Image${i + 1}:` },
      {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: encoded.mediaType, data: encoded.b64 },
      },
    ]),
    { type: 'text', text: `## DRAFT PROMPT:\n${prompt}\n\nPolish it now.` },
  ]

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: POLISH_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return { prompt: block.text }
})

// ─── POYO.ai utilities (shared pattern with BMP) ──────────────────────────────

const MAX_UPLOAD_PX = 1280

async function uploadResourceToPOYO(filePath: string, apiKey: string, index: number): Promise<string> {
  let b64: string
  try {
    const img = nativeImage.createFromPath(filePath)
    if (!img.isEmpty()) {
      const { width, height } = img.getSize()
      const scale = Math.min(1, MAX_UPLOAD_PX / Math.max(width, height))
      const resized = scale < 1
        ? img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' })
        : img
      b64 = resized.toJPEG(90).toString('base64')
    } else {
      b64 = readFileSync(filePath).toString('base64')
    }
  } catch {
    b64 = readFileSync(filePath).toString('base64')
  }

  const fileName = `resource_${index + 1}_${Date.now()}.jpg`
  const res = await fetch('https://api.poyo.ai/api/common/upload/base64', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64_data: b64, file_name: fileName }),
  })
  const data = await res.json() as { success?: boolean; data?: { file_url: string }; error?: { message: string } }
  if (!data.success || !data.data?.file_url) throw new Error(data.error?.message ?? 'Upload failed')
  return data.data.file_url
}

// Parallel upload preserving order — @Image1 = resources[0]
async function uploadResourcesToPOYO(filePaths: string[], apiKey: string, sendProgress: (l: string) => void): Promise<string[]> {
  if (filePaths.length === 0) return []
  sendProgress(`Uploading ${filePaths.length} resource${filePaths.length > 1 ? 's' : ''} to POYO...`)
  const results = await Promise.allSettled(filePaths.map((f, i) => uploadResourceToPOYO(f, apiKey, i)))
  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0) {
    const err = (failures[0] as PromiseRejectedResult).reason
    throw new Error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  sendProgress(`${filePaths.length} resource${filePaths.length > 1 ? 's' : ''} uploaded ✓`)
  return results.map((r) => (r as PromiseFulfilledResult<string>).value)
}

async function pollPOYOTask(
  taskId: string, apiKey: string,
  sendProgress: (l: string) => void
): Promise<Array<{ file_url: string; file_type: string }>> {
  await new Promise((r) => setTimeout(r, 8000))
  let lastStatus = ''; let lastPct = -1
  const startTs = Date.now()
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`https://api.poyo.ai/api/generate/status/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const d = await res.json() as { data?: { status: string; progress?: number; files?: Array<{ file_url: string; file_type: string }>; error_message?: string }; error?: { message: string } }
    const task = d.data
    if (!task) { sendProgress(`Poll error: ${d.error?.message ?? 'no data'}`); await new Promise((r) => setTimeout(r, 5000)); continue }
    const pct = task.progress ?? 0
    const elapsed = Math.round((Date.now() - startTs) / 1000)
    if (task.status !== lastStatus || pct !== lastPct) {
      sendProgress(`${task.status}${pct > 0 ? ` ${pct}%` : ''} · ${elapsed}s`)
      lastStatus = task.status; lastPct = pct
    }
    if (['finished', 'completed', 'succeeded'].includes(task.status)) return task.files ?? []
    if (['failed', 'error'].includes(task.status)) {
      throw new Error(task.error_message ? `POYO: ${task.error_message}` : `Generation ${task.status}`)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error('Timeout — task exceeded 10 minutes')
}

function downloadFile(url: string, destPath: string): Promise<void> {
  if (!url.startsWith('https://')) return Promise.reject(new Error('Only HTTPS downloads are allowed'))
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath)
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', reject)
    }).on('error', reject)
  })
}

// ─── Build (Nano Banana 2) ────────────────────────────────────────────────────

const NB2_RATIOS = ['9:16', '4:5', '3:4', '1:1', '16:9'] as const
const NB2_RESOLUTIONS = ['1k', '2k', '4k'] as const

// Paths generated this session — the only ones reveal-render will act on
const sessionRenders = new Set<string>()

// ─── Higgsfield CLI fallback (same pattern as BMP) ────────────────────────────

const HF_RATIOS = ['9:16', '4:5', '1:1', '16:9', '1:2', '2:1'] as const

async function buildViaHiggsfield(
  prompt: string, resources: string[], size: string, res: string,
  outputDir: string, timestamp: number,
  sendProgress: (l: string) => void,
): Promise<{ success: boolean; outputPath: string; error?: string }> {
  // Higgsfield CLI doesn't support 3:4 or 4K — map to nearest
  const hfRatio = HF_RATIOS.includes(size as typeof HF_RATIOS[number]) ? size : '4:5'
  const hfRes = res === '1K' ? '1k' : '2k'
  sendProgress(`Retrying via Higgsfield nano_banana_2 (${hfRatio} · ${hfRes.toUpperCase()})...`)

  const args = [
    'generate', 'create', 'nano_banana_2',
    '--prompt', prompt,
    '--resolution', hfRes,
    '--aspect_ratio', hfRatio,
    '--wait',
  ]
  for (const p of resources) args.push('--image', p)

  try {
    const { stdout, stderr } = await execFileAsync('higgsfield', args, { timeout: 300_000, env: shellEnv() })
    const combined = (stdout + '\n' + stderr).trim()
    if (combined) sendProgress(combined)

    const cliError = combined.match(/\b(error|failed|failure|rejected|content.?policy|moderat|violat|unsafe|prohibited)\b/i)
    if (cliError) return { success: false, outputPath: '', error: `Higgsfield: ${combined.slice(0, 200)}` }

    const urlMatch = combined.match(/https:\/\/\S+\.(png|jpg|jpeg|webp)/i)
    if (!urlMatch) return { success: false, outputPath: '', error: 'Higgsfield: no image URL in CLI output' }

    const ext = urlMatch[0].split('.').pop()?.split('?')[0] ?? 'jpg'
    const outputName = `pb_${timestamp}.${ext}`
    const outputPath = join(outputDir, outputName)
    sendProgress('Downloading render...')
    await downloadFile(urlMatch[0], outputPath)
    sessionRenders.add(outputPath)
    sendProgress(`Saved: ${outputName} (via Higgsfield)`)
    return { success: true, outputPath }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, outputPath: '', error: `Higgsfield: ${msg}` }
  }
}

ipcMain.handle('fire-build', async (event, { prompt, resources, aspectRatio, resolution }: {
  prompt: string; resources: string[]; aspectRatio: string; resolution: string
}) => {
  if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 12000) {
    throw new Error('Invalid prompt')
  }
  if (!Array.isArray(resources) || resources.length > 14) throw new Error('Invalid resources')

  const apiKey = process.env.POYO_API_KEY
  if (!apiKey) throw new Error('POYO_API_KEY not set — add it to ~/.productbuilder.env')

  const timestamp = Date.now()
  const outputDir = loadPrefs().outputPath
  const sendProgress = (line: string) => event.sender.send('pb-progress', line)
  const safeSize = NB2_RATIOS.includes(aspectRatio as typeof NB2_RATIOS[number]) ? aspectRatio : '1:1'
  const safeRes = NB2_RESOLUTIONS.includes(resolution as typeof NB2_RESOLUTIONS[number]) ? resolution.toUpperCase() : '2K'

  // Diagnose the POYO failure, then automatically retry with the same config via Higgsfield
  const fallbackToHiggsfield = async (poyoError: string) => {
    sendProgress(`POYO failed: ${poyoError}`)
    const r = await buildViaHiggsfield(prompt, resources, safeSize, safeRes, outputDir, timestamp, sendProgress)
    if (!r.success) {
      const msg = `POYO: ${poyoError} · ${r.error}`
      sendProgress(`Error: ${msg}`)
      return { success: false, outputPath: '', error: msg }
    }
    return r
  }

  let imageUrls: string[] = []
  try {
    imageUrls = await uploadResourcesToPOYO(resources, apiKey, sendProgress)
  } catch (err) {
    return fallbackToHiggsfield(err instanceof Error ? err.message : String(err))
  }

  // Edit model when resources provided (adheres to references)
  const model = imageUrls.length > 0 ? 'nano-banana-2-edit' : 'nano-banana-2'
  const input: Record<string, unknown> = { prompt, size: safeSize, resolution: safeRes }
  if (imageUrls.length > 0) input.image_urls = imageUrls

  sendProgress(`Submitting build (${safeSize} · ${safeRes})...`)

  const submitRes = await fetch('https://api.poyo.ai/api/generate/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
  })
  const submitData = await submitRes.json() as { code?: number; data?: { task_id: string }; error?: { message: string } }
  if (!submitRes.ok || !submitData.data?.task_id) {
    return fallbackToHiggsfield(`submit error: ${submitData.error?.message ?? `HTTP ${submitRes.status}`}`)
  }

  sendProgress(`Building... (${submitData.data.task_id})`)

  try {
    const files = await pollPOYOTask(submitData.data.task_id, apiKey, sendProgress)
    const imgFile = files.find((f) => f.file_type === 'image' || f.file_url.match(/\.(jpg|jpeg|png|webp)/i))
    if (!imgFile) return fallbackToHiggsfield('no image in response')
    const ext = imgFile.file_url.split('.').pop()?.split('?')[0] ?? 'jpg'
    const outputName = `pb_${timestamp}.${ext}`
    const outputPath = join(outputDir, outputName)
    sendProgress('Downloading render...')
    await downloadFile(imgFile.file_url, outputPath)
    sessionRenders.add(outputPath)
    sendProgress(`Saved: ${outputName}`)
    return { success: true, outputPath }
  } catch (err) {
    return fallbackToHiggsfield(err instanceof Error ? err.message : String(err))
  }
})

ipcMain.handle('reveal-render', (_event, path: string) => {
  if (typeof path !== 'string' || !sessionRenders.has(path)) throw new Error('Unknown render path')
  shell.showItemInFolder(path)
})

// ─── Misc IPC ─────────────────────────────────────────────────────────────────

ipcMain.handle('get-version', () => app.getVersion())

ipcMain.handle('get-output-path', () => loadPrefs().outputPath)

ipcMain.handle('set-output-path', (_event, path: string) => {
  if (typeof path !== 'string' || path.length === 0) throw new Error('Invalid path')
  savePrefs({ ...loadPrefs(), outputPath: path })
})

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose output folder',
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// ─── Auto-update (silent DMG swap) ─────────────────────────────────────────────

function downloadDmgWithProgress(url: string, destPath: string, onProgress: (pct: number) => void): Promise<void> {
  if (!url.startsWith('https://')) return Promise.reject(new Error('Only HTTPS downloads are allowed'))
  return new Promise((resolve, reject) => {
    const attempt = (attemptUrl: string) => {
      if (!attemptUrl.startsWith('https://')) { reject(new Error('Redirect to non-HTTPS blocked')); return }
      const parsed = new URL(attemptUrl)
      https.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          attempt(res.headers.location); return
        }
        const total = parseInt(res.headers['content-length'] ?? '0', 10)
        let received = 0
        const file = createWriteStream(destPath)
        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          if (total > 0) onProgress(Math.round((received / total) * 100))
        })
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
        file.on('error', reject)
      }).on('error', reject)
    }
    attempt(url)
  })
}

async function installFromDmg(dmgPath: string): Promise<void> {
  const { stdout } = await execFileAsync('hdiutil', ['attach', dmgPath, '-nobrowse', '-plist'], { env: shellEnv() })
  const mountMatch = stdout.match(/<key>mount-point<\/key>\s*<string>([^<]+)<\/string>/)
  if (!mountMatch) throw new Error('DMG mount point not found')
  const mountPoint = mountMatch[1].trim()
  try {
    await execFileAsync('ditto', [`${mountPoint}/Product Builder.app`, '/Applications/Product Builder.app'], { env: shellEnv() })
    // Note: the .app bundle keeps the real productName with a space — only
    // release *filenames* get sanitized (spaces → dots) by electron-builder
  } finally {
    await execFileAsync('hdiutil', ['detach', mountPoint, '-quiet', '-force'], { env: shellEnv() }).catch(() => {})
  }
}

function setupAutoUpdater(win: BrowserWindow) {
  // Only run in packaged app — skip in dev
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  const notify = (payload: object) => win.webContents.send('update-status', payload)

  autoUpdater.on('update-available', (info) => {
    notify({ phase: 'available', version: info.version })

    const arch = process.arch === 'arm64' ? '-arm64' : ''
    const filename = `Product.Builder-${info.version}${arch}.dmg`
    const dmgUrl = `https://github.com/createdbynoone/product-builder/releases/download/v${info.version}/${filename}`
    const tmpPath = join(app.getPath('temp'), filename)

    downloadDmgWithProgress(dmgUrl, tmpPath, (percent) => {
      notify({ phase: 'downloading', percent, version: info.version })
    })
      .then(async () => {
        notify({ phase: 'installing', version: info.version })
        await installFromDmg(tmpPath)
        notify({ phase: 'ready', version: info.version })
        setTimeout(() => { app.relaunch(); app.quit() }, 1500)
      })
      .catch(async (err: Error) => {
        notify({ phase: 'error', error: `Auto-install fallido, abriendo DMG: ${err.message}` })
        const desktopPath = join(homedir(), 'Desktop', filename)
        try { await downloadFile(dmgUrl, desktopPath); await shell.openPath(desktopPath) } catch {}
      })
  })

  autoUpdater.on('error', (err) => notify({ phase: 'error', error: err.message }))

  win.webContents.once('did-finish-load', () => autoUpdater.checkForUpdates())
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#0c0c0c',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1.1,
    },
  })

  // webPreferences zoomFactor is unreliable on first load — enforce it
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1.1)
  })

  win.webContents.on('will-navigate', e => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true } },
])

app.whenReady().then(() => {
  protocol.handle('localfile', (request) => {
    const filePath = decodeURIComponent(request.url.slice('localfile://'.length))
    return net.fetch(`file://${filePath}`)
  })
  buildAppMenu()
  const win = createWindow()
  setupAutoUpdater(win)
  applyDockIcon(loadPrefs().iconStyle)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
