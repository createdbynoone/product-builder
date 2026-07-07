import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('pb', {
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    unlock: (key: string) => ipcRenderer.invoke('auth:unlock', key),
  },

  // Electron 32+ removed File.path from the renderer — this resolves the
  // absolute path of files dragged in from Finder. Also registers the path
  // with the main process so the localfile:// protocol is allowed to serve it.
  getPathForFile: (file: File) => {
    const path = webUtils.getPathForFile(file)
    ipcRenderer.sendSync('register-known-path', path)
    return path
  },

  polishPrompt: (data: { prompt: string; resources: string[] }) =>
    ipcRenderer.invoke('polish-prompt', data),

  fireBuild: (data: { prompt: string; resources: string[]; aspectRatio: string; resolution: string }) =>
    ipcRenderer.invoke('fire-build', data),

  fireTechnical: (data: { imagePath: string | null; notes: string; view: string }) =>
    ipcRenderer.invoke('fire-technical', data),

  fireEnhance: (data: { frontPath: string | null; backPath: string | null; notes: string }) =>
    ipcRenderer.invoke('fire-enhance', data),

  revealRender: (path: string) =>
    ipcRenderer.invoke('reveal-render', path),

  trashRender: (path: string) =>
    ipcRenderer.invoke('trash-render', path),

  onProgress: (cb: (line: string) => void) => {
    ipcRenderer.on('pb-progress', (_event, line) => cb(line))
    return () => ipcRenderer.removeAllListeners('pb-progress')
  },

  getVersion: () => ipcRenderer.invoke('get-version'),

  getOutputPath: () => ipcRenderer.invoke('get-output-path'),
  setOutputPath: (path: string) => ipcRenderer.invoke('set-output-path', path),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog') as Promise<string | null>,

  onUpdateStatus: (cb: (s: unknown) => void) => {
    ipcRenderer.on('update-status', (_e, s) => cb(s))
    return () => ipcRenderer.removeAllListeners('update-status')
  },
})
