interface Window {
  pb: {
    getPathForFile: (file: File) => string
    polishPrompt: (data: { prompt: string; resources: string[] }) => Promise<{ prompt: string }>
    fireBuild: (data: { prompt: string; resources: string[]; aspectRatio: string; resolution: string }) => Promise<{ success: boolean; outputPath: string; error?: string }>
    fireTechnical: (data: { imagePath: string | null; notes: string; view: string }) => Promise<{ success: boolean; outputPath: string; error?: string }>
    fireEnhance: (data: { frontPath: string | null; backPath: string | null; notes: string }) => Promise<{ success: boolean; outputs: Array<{ view: string; outputPath: string }>; error?: string }>
    revealRender: (path: string) => Promise<void>
    trashRender: (path: string) => Promise<void>
    onProgress: (cb: (line: string) => void) => () => void
    getVersion: () => Promise<string>
    getOutputPath: () => Promise<string>
    setOutputPath: (path: string) => Promise<void>
    openFolderDialog: () => Promise<string | null>
    onUpdateStatus: (cb: (s: { phase: string; version?: string; percent?: number; error?: string }) => void) => () => void
  }
}
