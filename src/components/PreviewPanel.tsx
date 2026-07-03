import React from 'react'

// Internal drag payload — lets renders be dropped into ResourcePanel as resources
export const RENDER_DRAG_MIME = 'application/x-pb-render'

export interface Render {
  path: string
  timestamp: number
  aspectRatio: string
  resolution: string
}

interface PreviewPanelProps {
  renders: Render[]
  selected: Render | null
  onSelect: (r: Render) => void
  building: boolean
  progress: string[]
}

export function PreviewPanel({ renders, selected, onSelect, building, progress }: PreviewPanelProps) {
  const lastLine = progress.length > 0 ? progress[progress.length - 1] : ''

  return (
    <div className="flex flex-col h-full border-l border-border">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
        <label className="text-[11.7px] font-heading font-semibold uppercase tracking-widest text-text-secondary">
          Preview
        </label>
        {selected && !building && (
          <button
            onClick={() => window.pb.revealRender(selected.path).catch(() => {})}
            title="Reveal in Finder"
            className="text-[11px] font-mono text-text-muted hover:text-accent transition-colors"
          >
            Finder ↗
          </button>
        )}
      </div>

      {/* Main preview area */}
      <div className="flex-1 min-h-0 px-4 flex items-center justify-center">
        {building ? (
          <div className="flex flex-col items-center gap-3 text-center animate-fade-in">
            <div className="w-10 h-10 rounded-lg border-2 border-accent/30 border-t-accent animate-spin" style={{ animationDuration: '1.1s' }} />
            <span className="text-[12.7px] font-heading uppercase tracking-widest text-accent/80 animate-build-pulse">
              Building
            </span>
            {lastLine && (
              <span className="text-[11px] font-mono text-text-secondary max-w-[240px] leading-relaxed">{lastLine}</span>
            )}
          </div>
        ) : selected ? (
          <img
            key={selected.path}
            src={`localfile://${selected.path}`}
            alt="Render"
            draggable
            onDragStart={(e) => e.dataTransfer.setData(RENDER_DRAG_MIME, selected.path)}
            title="Arrastra a Resources para usarlo como recurso"
            className="max-w-full max-h-full object-contain rounded-lg border border-border animate-fade-in"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center px-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-text-muted">
              <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M12 2v9m0 0l8-4.5M12 11l-8-4.5M12 20v-9" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" opacity="0.5"/>
            </svg>
            <span className="text-[11.7px] text-text-muted font-heading uppercase tracking-widest">
              No renders yet
            </span>
            <span className="text-[11px] text-text-muted/70 leading-relaxed">
              El prototipo construido aparecerá aquí
            </span>
          </div>
        )}
      </div>

      {/* Progress log */}
      {progress.length > 0 && (
        <div className="mx-4 mt-2 bg-[#0f0f0f] border border-border rounded-lg px-3 py-2 max-h-[72px] overflow-y-auto flex-shrink-0">
          {progress.map((line, i) => (
            <p key={i} className="text-[11px] font-mono text-text-secondary leading-relaxed">{line}</p>
          ))}
        </div>
      )}

      {/* Session history strip */}
      <div className="p-4 pt-3 flex-shrink-0">
        {renders.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10.5px] font-heading uppercase tracking-widest text-text-muted">Session</span>
              <span className="text-[10.5px] font-mono text-text-muted">{renders.length}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[...renders].reverse().map((r) => (
                <button
                  key={r.path}
                  onClick={() => onSelect(r)}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(RENDER_DRAG_MIME, r.path)}
                  title={`${r.aspectRatio} · ${r.resolution.toUpperCase()} — arrastra a Resources`}
                  className={`flex-shrink-0 rounded-md overflow-hidden border transition-all duration-150 ${
                    selected?.path === r.path ? 'border-accent/70 ring-1 ring-accent/30' : 'border-border hover:border-white/30'
                  }`}
                >
                  <img src={`localfile://${r.path}`} alt="" className="w-14 h-14 object-cover block" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
