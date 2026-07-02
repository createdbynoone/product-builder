import React from 'react'

const RATIOS = ['9:16', '4:5', '3:4', '1:1', '16:9'] as const
const RESOLUTIONS = ['1k', '2k', '4k'] as const

export type Ratio = typeof RATIOS[number]
export type Resolution = typeof RESOLUTIONS[number]

interface BuildBarProps {
  ratio: Ratio
  onRatio: (r: Ratio) => void
  resolution: Resolution
  onResolution: (r: Resolution) => void
  building: boolean
  canBuild: boolean
  onBuild: () => void
}

function Segmented<T extends string>({ options, value, onChange, disabled }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; disabled: boolean
}) {
  return (
    <div className="flex items-center bg-surface border border-border rounded-md p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          disabled={disabled}
          className={`px-2 py-1 rounded text-[11.7px] font-mono transition-colors ${
            value === opt
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:text-text-primary'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {opt.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export function BuildBar({ ratio, onRatio, resolution, onResolution, building, canBuild, onBuild }: BuildBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border flex-shrink-0">
      <div className="flex items-center gap-2">
        <Segmented options={RATIOS} value={ratio} onChange={onRatio} disabled={building} />
        <Segmented options={RESOLUTIONS} value={resolution} onChange={onResolution} disabled={building} />
      </div>

      <button
        onClick={onBuild}
        disabled={!canBuild || building}
        className={`px-5 py-1.5 rounded-md font-heading font-semibold text-[12.7px] uppercase tracking-widest transition-colors ${
          building
            ? 'bg-accent/20 text-accent animate-build-pulse cursor-wait'
            : canBuild
              ? 'bg-accent text-black hover:bg-accent/90'
              : 'bg-surface border border-border text-text-muted cursor-not-allowed'
        }`}
      >
        {building ? 'Building...' : 'Build'}
      </button>
    </div>
  )
}
