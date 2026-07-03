import React, { useState, useCallback } from 'react'

const VIEWS = ['FRONT', 'BACK'] as const
export type TechnicalView = typeof VIEWS[number]

interface TechnicalPanelProps {
  reference: string | null
  onReference: (path: string | null) => void
  notes: string
  onNotes: (n: string) => void
  view: TechnicalView
  onView: (v: TechnicalView) => void
  drawing: boolean
  onDraw: () => void
}

export function TechnicalPanel({ reference, onReference, notes, onNotes, view, onView, drawing, onDraw }: TechnicalPanelProps) {
  const [draggingOver, setDraggingOver] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDraggingOver(false)
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (!file) return
    try {
      const path = window.pb.getPathForFile(file)
      if (path) onReference(path)
    } catch {}
  }, [onReference])

  const canDraw = (reference !== null || notes.trim().length > 0) && !drawing

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
        <div className="flex items-center justify-between flex-shrink-0">
          <label className="text-[11.7px] font-heading font-semibold uppercase tracking-widest text-text-secondary">
            Technical Flat
          </label>
          <div className="flex items-center bg-surface border border-border rounded-md p-0.5 gap-0.5">
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => onView(v)}
                disabled={drawing}
                className={`px-2 py-1 rounded text-[11.7px] font-mono transition-colors ${
                  view === v ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'
                } ${drawing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                referencia — Claude analiza proporciones y construcción
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-center px-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-text-muted">
                <path d="M8 3l-5 3.5v4L7 12v9h10v-9l4-1.5v-4L16 3l-2 2h-4L8 3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              <span className="text-[11.7px] text-text-muted font-heading uppercase tracking-widest">
                Drop garment reference
              </span>
              <span className="text-[11px] text-text-muted/70 leading-relaxed">
                foto real o mockup — el dibujo respeta sus proporciones
              </span>
            </div>
          )}
        </div>

        <textarea
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder={reference
            ? 'Notas opcionales: fit, detalles de construcción a destacar, correcciones...'
            : 'Sin referencia: describe la prenda (tipo, fit, cuello, mangas, costuras, hem...)'}
          className="w-full flex-1 min-h-0 bg-surface border border-border rounded-lg p-3 text-[13.7px] text-text-primary placeholder:text-text-muted font-sans leading-relaxed focus:border-white/20 selectable"
          spellCheck={false}
        />
      </div>

      {/* Draw bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border flex-shrink-0">
        <span className="text-[11px] font-mono text-text-muted">
          4:5 · SVG vector · 2pt uniforme · costuras discontinuas
        </span>
        <button
          onClick={onDraw}
          disabled={!canDraw}
          className={`px-5 py-1.5 rounded-md font-heading font-semibold text-[12.7px] uppercase tracking-widest transition-colors ${
            drawing
              ? 'bg-accent/20 text-accent animate-build-pulse cursor-wait'
              : canDraw
                ? 'bg-accent text-black hover:bg-accent/90'
                : 'bg-surface border border-border text-text-muted cursor-not-allowed'
          }`}
        >
          {drawing ? 'Drawing...' : 'Draw'}
        </button>
      </div>
    </div>
  )
}
