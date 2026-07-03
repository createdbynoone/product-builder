import React, { useState, useCallback } from 'react'
import { RENDER_DRAG_MIME } from './PreviewPanel'

const VIEWS = ['FRONT', 'BACK'] as const
export type EnhanceView = typeof VIEWS[number]

interface EnhancePanelProps {
  reference: string | null
  onReference: (path: string | null) => void
  notes: string
  onNotes: (n: string) => void
  view: EnhanceView
  onView: (v: EnhanceView) => void
  enhancing: boolean
  onEnhance: () => void
}

export function EnhancePanel({ reference, onReference, notes, onNotes, view, onView, enhancing, onEnhance }: EnhancePanelProps) {
  const [draggingOver, setDraggingOver] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDraggingOver(false)
    const renderPath = e.dataTransfer.getData(RENDER_DRAG_MIME)
    if (renderPath) { onReference(renderPath); return }
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (!file) return
    try {
      const path = window.pb.getPathForFile(file)
      if (path) onReference(path)
    } catch {}
  }, [onReference])

  const canEnhance = reference !== null && !enhancing

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
        <div className="flex items-center justify-between flex-shrink-0">
          <label className="text-[11.7px] font-heading font-semibold uppercase tracking-widest text-text-secondary">
            Enhance
          </label>
          <div className="flex items-center bg-surface border border-border rounded-md p-0.5 gap-0.5">
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => onView(v)}
                disabled={enhancing}
                className={`px-2 py-1 rounded text-[11.7px] font-mono transition-colors ${
                  view === v ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'
                } ${enhancing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Reference drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDraggingOver(true) }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingOver(false) }}
          onDrop={handleDrop}
          className={`flex-shrink-0 h-44 rounded-lg border border-dashed transition-colors duration-150 flex items-center justify-center overflow-hidden ${
            draggingOver ? 'border-accent/50 bg-accent/[0.03]' : 'border-border bg-surface'
          }`}
        >
          {reference ? (
            <div className="relative h-full w-full flex items-center justify-center group">
              <img src={`localfile://${reference}`} alt="Reference" className="max-h-full max-w-full object-contain" />
              <button
                onClick={() => onReference(null)}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/80 border border-white/20 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[12px] leading-none"
              >
                ×
              </button>
              <span className="absolute bottom-2 left-2 text-[10px] font-mono bg-black/70 text-white/70 rounded px-1.5 py-0.5">
                mockup — se preserva silueta, gráficos y componentes
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-center px-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-text-muted">
                <path d="M12 3l2 4.1 4.5.65-3.25 3.17.77 4.48L12 13.27 7.98 15.4l.77-4.48L5.5 7.75l4.5-.65L12 3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              <span className="text-[11.7px] text-text-muted font-heading uppercase tracking-widest">
                Drop product to enhance
              </span>
              <span className="text-[11px] text-text-muted/70 leading-relaxed">
                mockup o flat → shot fotoreal e-commerce con textura final
              </span>
            </div>
          )}
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
