import React, { useState, useCallback } from 'react'

const MAX_RESOURCES = 14

interface ResourcePanelProps {
  resources: string[]
  onResources: (r: string[]) => void
  usedIndices: Set<number>
  onInsertTag: (index: number) => void
}

export function ResourcePanel({ resources, onResources, usedIndices, onInsertTag }: ResourcePanelProps) {
  const [draggingOver, setDraggingOver] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDraggingOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    const paths = files.map((f) => { try { return window.pb.getPathForFile(f) } catch { return '' } }).filter(Boolean)
    onResources([...resources, ...paths].slice(0, MAX_RESOURCES))
  }, [resources, onResources])

  const removeResource = (i: number) => {
    onResources(resources.filter((_, idx) => idx !== i))
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDraggingOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingOver(false) }}
      onDrop={handleDrop}
      className={`flex flex-col h-full border-r transition-colors duration-150 ${draggingOver ? 'border-accent/40 bg-accent/[0.03]' : 'border-border'}`}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
        <label className="text-[11.7px] font-heading font-semibold uppercase tracking-widest text-text-secondary">
          Resources
        </label>
        <span className="text-[11px] text-text-muted font-mono">{resources.length}/{MAX_RESOURCES}</span>
      </div>

      {resources.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-text-muted">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
            <path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[11.7px] text-text-muted font-heading uppercase tracking-widest leading-relaxed">
            Drop resources here
          </span>
          <span className="text-[11px] text-text-muted/70 leading-relaxed">
            materiales, formas, logos, texturas, productos base
          </span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {resources.map((r, i) => {
              const used = usedIndices.has(i)
              return (
                <button
                  key={`${r}-${i}`}
                  onClick={() => onInsertTag(i)}
                  title={`Insert @Image${i + 1} at cursor`}
                  className={`relative group rounded-md overflow-hidden border transition-all duration-150 ${used ? 'border-accent/60 ring-1 ring-accent/30' : 'border-border hover:border-white/30'}`}
                >
                  <img
                    src={`localfile://${r}`}
                    alt={`Resource ${i + 1}`}
                    className="w-full aspect-square object-cover block"
                  />
                  <div className={`absolute bottom-0 left-0 right-0 text-[10px] font-mono font-bold text-center py-0.5 transition-colors ${used ? 'bg-accent/85 text-black' : 'bg-black/70 text-white/70'}`}>
                    @Image{i + 1}
                  </div>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); removeResource(i) }}
                    className="absolute top-1 right-1 w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full bg-black/80 border border-white/20 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[11px] leading-none cursor-pointer"
                  >
                    ×
                  </span>
                </button>
              )
            })}
            {resources.length < MAX_RESOURCES && (
              <div className="aspect-square border border-dashed border-border rounded-md flex items-center justify-center text-text-muted text-[22px]">
                +
              </div>
            )}
          </div>
          <p className="text-[10.5px] text-text-muted/70 mt-3 leading-relaxed px-1">
            Click en un recurso para insertar su tag en el prompt.
          </p>
        </div>
      )}
    </div>
  )
}
