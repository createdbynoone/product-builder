import React, { useState, useCallback } from 'react'
import { RENDER_DRAG_MIME } from './PreviewPanel'

interface RefDropProps {
  label: string
  hint: string
  path: string | null
  onPath: (p: string | null) => void
}

function RefDrop({ label, hint, path, onPath }: RefDropProps) {
  const [draggingOver, setDraggingOver] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggingOver(false)
    const renderPath = e.dataTransfer.getData(RENDER_DRAG_MIME)
    if (renderPath) { onPath(renderPath); return }
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (!file) return
    try {
      const p = window.pb.getPathForFile(file)
      if (p) onPath(p)
    } catch {}
  }, [onPath])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDraggingOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingOver(false) }}
      onDrop={handleDrop}
      className={`h-44 rounded-lg border border-dashed transition-colors duration-150 flex items-center justify-center overflow-hidden ${
        draggingOver ? 'border-accent/50 bg-accent/[0.03]' : 'border-border bg-surface'
      }`}
    >
      {path ? (
        <div className="relative h-full w-full flex items-center justify-center group">
          <img src={`localfile://${path}`} alt={label} className="max-h-full max-w-full object-contain" />
          <button
            onClick={() => onPath(null)}
            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/80 border border-white/20 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[12px] leading-none"
          >
            ×
          </button>
          <span className="absolute bottom-2 left-2 text-[10px] font-mono bg-black/70 text-white/70 rounded px-1.5 py-0.5">
            {label}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 text-center px-4">
          <span className="text-[11.7px] text-text-muted font-heading uppercase tracking-widest">
            {label}
          </span>
          <span className="text-[11px] text-text-muted/70 leading-relaxed">
            {hint}
          </span>
        </div>
      )}
    </div>
  )
}

interface EnhancePanelProps {
  frontRef: string | null
  onFrontRef: (path: string | null) => void
  backRef: string | null
  onBackRef: (path: string | null) => void
  notes: string
  onNotes: (n: string) => void
  enhancing: boolean
  onEnhance: () => void
}

export function EnhancePanel({ frontRef, onFrontRef, backRef, onBackRef, notes, onNotes, enhancing, onEnhance }: EnhancePanelProps) {
  const canEnhance = (frontRef !== null || backRef !== null) && !enhancing

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
        <div className="flex items-center justify-between flex-shrink-0">
          <label className="text-[11.7px] font-heading font-semibold uppercase tracking-widest text-text-secondary">
            Enhance
          </label>
          {frontRef !== null && backRef !== null && (
            <span className="text-[10.5px] font-mono text-accent/80">front + back en paralelo</span>
          )}
        </div>

        {/* FRONT + BACK reference drop zones */}
        <div className="grid grid-cols-2 gap-3 flex-shrink-0">
          <RefDrop
            label="Front"
            hint="mockup o flat frontal"
            path={frontRef}
            onPath={onFrontRef}
          />
          <RefDrop
            label="Back"
            hint="opcional — misma prenda, prompts coordinados"
            path={backRef}
            onPath={onBackRef}
          />
        </div>

        <textarea
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder={'Materiales y técnicas básicas — Claude las expande. Ej: "320gsm algodón, serigrafía relieve mostaza en el pecho, golpes de costura leves verdes, gorra en twill lavado..."'}
          className="w-full flex-1 min-h-0 bg-surface border border-border rounded-lg p-3 text-[13.7px] text-text-primary placeholder:text-text-muted font-sans leading-relaxed focus:border-white/20 selectable"
          spellCheck={false}
        />
      </div>

      {/* Enhance bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border flex-shrink-0">
        <span className="text-[11px] font-mono text-text-muted">
          4:5 · 2K · fotoreal e-commerce · fondo #ededed · sin arrugas
        </span>
        <button
          onClick={onEnhance}
          disabled={!canEnhance}
          className={`px-5 py-1.5 rounded-md font-heading font-semibold text-[12.7px] uppercase tracking-widest transition-colors ${
            enhancing
              ? 'bg-accent/20 text-accent animate-build-pulse cursor-wait'
              : canEnhance
                ? 'bg-accent text-black hover:bg-accent/90'
                : 'bg-surface border border-border text-text-muted cursor-not-allowed'
          }`}
        >
          {enhancing ? 'Enhancing...' : 'Enhance'}
        </button>
      </div>
    </div>
  )
}
