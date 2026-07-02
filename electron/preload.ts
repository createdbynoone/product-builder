import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('pb', {
  // Electron 32+ removed File.path from the renderer — this resolves the
  // absolute path of files dragged in from Finder
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  polishPrompt: (data: { prompt: string; resources: string[] }) =>
    ipcRenderer.invoke('polish-prompt', data),

  fireBuild: (data: { prompt: string; resources: string[]; aspectRatio: string; resolution: string }) =>
    ipcRenderer.invoke('fire-build', data),

  revealRender: (path: string) =>
    ipcRenderer.invoke('reveal-render', path),

  onProgress: (cb: (line: string) => void) => {
    ipcRenderer.on('pb-progress', (_event, line) => cb(line))
    return () => ipcRenderer.removeAllListeners('pb-progress')
  },

  getVersion: () => ipcRenderer.invoke('get-version'),

  getOutputPath: () => ipcRenderer.invoke('get-output-path'),
  setOutputPath: (path: string) => ipcRenderer.invoke('set-output-path', path),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog') as Promise<string | null>,
})
