import React, { forwardRef } from 'react'

interface PromptPanelProps {
  prompt: string
  onPrompt: (p: string) => void
  missingTags: number[]
  polishing: boolean
  canPolish: boolean
  onPolish: () => void
  resourceCount: number
}

export const PromptPanel = forwardRef<HTMLTextAreaElement, PromptPanelProps>(function PromptPanel(
  { prompt, onPrompt, missingTags, polishing, canPolish, onPolish, resourceCount }, ref
) {
  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-2">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <label className="text-[11.7px] font-heading font-semibold uppercase tracking-widest text-text-secondary">
            Build Prompt
          </label>
          {missingTags.length > 0 && (
            <span className="text-[11px] font-mono text-orange-400/80">
              ⚠ @Image{missingTags[0]}{missingTags.length > 1 ? `–${missingTags[missingTags.length - 1]}` : ''} not in resources
            </span>
          )}
        </div>
        <button
          onClick={onPolish}
          disabled={!canPolish || polishing}
          title="Pulir el prompt con Claude (opcional) — respeta tus @Image tags"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11.7px] font-heading uppercase tracking-wider transition-colors ${
            polishing
              ? 'border-accent/40 text-accent/70 animate-build-pulse'
              : canPolish
                ? 'border-border text-text-secondary hover:text-accent hover:border-accent/40'
                : 'border-border/50 text-text-muted cursor-not-allowed'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" fill="currentColor"/>
          </svg>
          {polishing ? 'Polishing...' : 'Polish'}
        </button>
      </div>

      <textarea
        ref={ref}
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
        placeholder={resourceCount > 0
          ? `Describe el prototipo usando @Image1${resourceCount > 1 ? `...@Image${resourceCount}` : ''}. Ej: "Construct a prototype cap combining the panel shape of @Image1 with the fabric texture of @Image2, embroidered logo from @Image3 on the front. Studio product photography, seamless gray background, softbox lighting."`
          : 'Suelta recursos a la izquierda y descríbe cómo construir el prototipo. El resultado: fotografía de estudio del producto para presentaciones.'
        }
        className="w-full flex-1 bg-surface border border-border rounded-lg p-3 text-[13.7px] text-text-primary placeholder:text-text-muted font-sans leading-relaxed focus:border-white/20 selectable"
        spellCheck={false}
      />
    </div>
  )
})
