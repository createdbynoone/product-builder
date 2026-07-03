import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { ResourcePanel } from './components/ResourcePanel'
import { PromptPanel } from './components/PromptPanel'
import { PreviewPanel, Render } from './components/PreviewPanel'
import { BuildBar, Ratio, Resolution } from './components/BuildBar'
import { TechnicalPanel, TechnicalView } from './components/TechnicalPanel'
import { EnhancePanel, EnhanceView } from './components/EnhancePanel'
import { UpdateBar } from './components/UpdateBar'

type Mode = 'product' | 'technical' | 'enhance'

export default function App() {
  const [mode, setMode] = useState<Mode>('product')
  const [resources, setResources] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [techReference, setTechReference] = useState<string | null>(null)
  const [techNotes, setTechNotes] = useState('')
  const [techView, setTechView] = useState<TechnicalView>('FRONT')
  const [enhReference, setEnhReference] = useState<string | null>(null)
  const [enhNotes, setEnhNotes] = useState('')
  const [enhView, setEnhView] = useState<EnhanceView>('FRONT')
  const [ratio, setRatio] = useState<Ratio>('1:1')
  const [resolution, setResolution] = useState<Resolution>('2k')
  const [building, setBuilding] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [renders, setRenders] = useState<Render[]>([])
  const [selected, setSelected] = useState<Render | null>(null)
  const [version, setVersion] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [error, setError] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.pb.getVersion().then(setVersion).catch(() => {})
    window.pb.getOutputPath().then(setOutputPath).catch(() => {})
    const off = window.pb.onProgress((line) => {
      setProgress((prev) => [...prev.slice(-40), line])
    })
    return off
  }, [])

  // @Image indices referenced in the prompt (0-based)
  const usedIndices = useMemo(() => {
    const matches = [...prompt.matchAll(/@Image(\d+)/gi)]
    return new Set(matches.map((m) => parseInt(m[1]) - 1))
  }, [prompt])

  const missingTags = useMemo(() => {
    const matches = [...prompt.matchAll(/@Image(\d+)/gi)]
    return [...new Set(matches.map((m) => parseInt(m[1])).filter((n) => n > resources.length))].sort((a, b) => a - b)
  }, [prompt, resources.length])

  const insertTag = useCallback((index: number) => {
    const tag = `@Image${index + 1}`
    const el = textareaRef.current
    if (!el) { setPrompt((p) => p + (p.endsWith(' ') || p.length === 0 ? '' : ' ') + tag + ' '); return }
    const start = el.selectionStart ?? prompt.length
    const end = el.selectionEnd ?? prompt.length
    const before = prompt.slice(0, start)
    const after = prompt.slice(end)
    const spaceBefore = before.length > 0 && !before.endsWith(' ') ? ' ' : ''
    const spaceAfter = after.length > 0 && !after.startsWith(' ') ? ' ' : ''
    const next = before + spaceBefore + tag + spaceAfter + after
    setPrompt(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + spaceBefore.length + tag.length + spaceAfter.length
      el.setSelectionRange(pos, pos)
    })
  }, [prompt])

  const handlePolish = useCallback(async () => {
    if (polishing || prompt.trim().length === 0) return
    setPolishing(true)
    setError('')
    try {
      const { prompt: polished } = await window.pb.polishPrompt({ prompt, resources })
      setPrompt(polished)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPolishing(false)
    }
  }, [polishing, prompt, resources])

  const handleBuild = useCallback(async () => {
    if (building || prompt.trim().length === 0) return
    setBuilding(true)
    setProgress([])
    setError('')
    try {
      const res = await window.pb.fireBuild({ prompt, resources, aspectRatio: ratio, resolution })
      if (res.success && res.outputPath) {
        const render: Render = { path: res.outputPath, timestamp: Date.now(), aspectRatio: ratio, resolution }
        setRenders((prev) => [...prev, render])
        setSelected(render)
      } else if (res.error) {
        setError(res.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBuilding(false)
    }
  }, [building, prompt, resources, ratio, resolution])

  const handleDrawTechnical = useCallback(async () => {
    if (building || (techReference === null && techNotes.trim().length === 0)) return
    setBuilding(true)
    setProgress([])
    setError('')
    try {
      const res = await window.pb.fireTechnical({ imagePath: techReference, notes: techNotes, view: techView })
      if (res.success && res.outputPath) {
        const render: Render = { path: res.outputPath, timestamp: Date.now(), aspectRatio: '4:5', resolution: '2k' }
        setRenders((prev) => [...prev, render])
        setSelected(render)
      } else if (res.error) {
        setError(res.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBuilding(false)
    }
  }, [building, techReference, techNotes, techView])

  const handleEnhance = useCallback(async () => {
    if (building || enhReference === null) return
    setBuilding(true)
    setProgress([])
    setError('')
    try {
      const res = await window.pb.fireEnhance({ imagePath: enhReference, notes: enhNotes, view: enhView })
      if (res.success && res.outputPath) {
        const render: Render = { path: res.outputPath, timestamp: Date.now(), aspectRatio: '4:5', resolution: '2k' }
        setRenders((prev) => [...prev, render])
        setSelected(render)
      } else if (res.error) {
        setError(res.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBuilding(false)
    }
  }, [building, enhReference, enhNotes, enhView])

  const deleteRender = useCallback(async (r: Render) => {
    try {
      await window.pb.trashRender(r.path)
      setRenders((prev) => prev.filter((x) => x.path !== r.path))
      setSelected((prev) => (prev?.path === r.path ? null : prev))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const chooseOutputFolder = useCallback(async () => {
    const folder = await window.pb.openFolderDialog()
    if (folder) {
      await window.pb.setOutputPath(folder)
      setOutputPath(folder)
    }
  }, [])

  const outputLabel = outputPath.split('/').filter(Boolean).pop() ?? ''

  return (
    <div className="flex flex-col h-full">
      <UpdateBar />
      {/* Titlebar — h-11 + 92px left inset clears macOS traffic lights */}
      <div className="titlebar-drag flex items-center justify-between h-11 border-b border-border flex-shrink-0 pr-4" style={{ paddingLeft: '92px' }}>
        <div className="flex items-baseline gap-2 translate-y-[1px]">
          <span className="text-[12.7px] font-heading font-bold uppercase tracking-widest text-text-primary">
            Product Builder
          </span>
          {version && <span className="text-[10.5px] font-mono text-text-muted">v{version}</span>}
        </div>
        <div className="titlebar-nodrag flex items-center bg-surface border border-border rounded-md p-0.5 gap-0.5 translate-y-[1px]">
          {(['product', 'technical', 'enhance'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={building}
              className={`px-2.5 py-0.5 rounded text-[10.5px] font-heading font-semibold uppercase tracking-widest transition-colors ${
                mode === m ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'
              } ${building ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={chooseOutputFolder}
          title={`Output: ${outputPath} — click para cambiar`}
          className="titlebar-nodrag flex items-center gap-1.5 text-[11px] font-mono text-text-muted hover:text-text-secondary transition-colors translate-y-[1px]"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6"/>
          </svg>
          {outputLabel}
        </button>
      </div>

      {/* Main 3-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left — resources (product mode only) */}
        {mode === 'product' && (
          <div className="w-[228px] flex-shrink-0">
            <ResourcePanel
              resources={resources}
              onResources={setResources}
              usedIndices={usedIndices}
              onInsertTag={insertTag}
            />
          </div>
        )}

        {/* Center — prompt + controls */}
        <div className="flex flex-col flex-1 min-w-0">
          {mode === 'product' ? (
            <>
              <PromptPanel
                ref={textareaRef}
                prompt={prompt}
                onPrompt={setPrompt}
                missingTags={missingTags}
                polishing={polishing}
                canPolish={prompt.trim().length > 0 && !building}
                onPolish={handlePolish}
                resourceCount={resources.length}
              />
              {error && (
                <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg animate-fade-in">
                  <p className="text-[11.7px] font-mono text-red-400/90 leading-relaxed selectable">{error}</p>
                </div>
              )}
              <BuildBar
                ratio={ratio}
                onRatio={setRatio}
                resolution={resolution}
                onResolution={setResolution}
                building={building}
                canBuild={prompt.trim().length > 0}
                onBuild={handleBuild}
              />
            </>
          ) : mode === 'technical' ? (
            <>
              <TechnicalPanel
                reference={techReference}
                onReference={setTechReference}
                notes={techNotes}
                onNotes={setTechNotes}
                view={techView}
                onView={setTechView}
                drawing={building}
                onDraw={handleDrawTechnical}
              />
              {error && (
                <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg animate-fade-in">
                  <p className="text-[11.7px] font-mono text-red-400/90 leading-relaxed selectable">{error}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <EnhancePanel
                reference={enhReference}
                onReference={setEnhReference}
                notes={enhNotes}
                onNotes={setEnhNotes}
                view={enhView}
                onView={setEnhView}
                enhancing={building}
                onEnhance={handleEnhance}
              />
              {error && (
                <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg animate-fade-in">
                  <p className="text-[11.7px] font-mono text-red-400/90 leading-relaxed selectable">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right — preview + session history */}
        <div className="w-[340px] flex-shrink-0">
          <PreviewPanel
            renders={renders}
            selected={selected}
            onSelect={setSelected}
            onDelete={deleteRender}
            building={building}
            progress={progress}
          />
        </div>
      </div>
    </div>
  )
}
