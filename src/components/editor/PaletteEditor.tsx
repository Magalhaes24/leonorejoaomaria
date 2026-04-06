import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HexColorPicker } from 'react-colorful'
import { useEditor } from '../../contexts/EditorContext'

export const PALETTE_COLORS = [
  { key: 'palette.accent',       label: 'Principal',  description: 'Cor de destaque principal',  cssVar: '--color-accent',       defaultValue: '#3A9E8F' },
  { key: 'palette.accent_dark',  label: 'Escuro',     description: 'Hover e estados activos',    cssVar: '--color-accent-dark',  defaultValue: '#267A6C' },
  { key: 'palette.accent_mid',   label: 'Médio',      description: 'Bordas e separadores',       cssVar: '--color-accent-mid',   defaultValue: '#A8D8D2' },
  { key: 'palette.accent_light', label: 'Claro',      description: 'Fundos suaves',              cssVar: '--color-accent-light', defaultValue: '#E2F4F1' },
  { key: 'palette.forest',       label: 'Floresta',   description: 'Fundos escuros e navbar',    cssVar: '--color-forest',       defaultValue: '#0C3D35' },
  { key: 'palette.sage',         label: 'Sage',       description: 'Texto secundário',           cssVar: '--color-sage',         defaultValue: '#6BB5AD' },
]

interface PaletteEditorProps {
  onClose: () => void
}

function isValidHex(v: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(v)
}

export function PaletteEditor({ onClose }: PaletteEditorProps) {
  const { getContent, updateContent } = useEditor()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [hexDraft, setHexDraft] = useState('')

  const toggle = (key: string, currentValue: string) => {
    if (openKey === key) {
      setOpenKey(null)
    } else {
      setOpenKey(key)
      setHexDraft(currentValue)
    }
  }

  const handlePickerChange = (key: string, color: string) => {
    updateContent(key, color)
    setHexDraft(color)
  }

  const handleHexDraft = (key: string, raw: string) => {
    const v = raw.startsWith('#') ? raw : `#${raw}`
    setHexDraft(v)
    if (isValidHex(v)) updateContent(key, v)
  }

  const handleReset = () => {
    for (const c of PALETTE_COLORS) updateContent(c.key, c.defaultValue)
    setOpenKey(null)
  }

  return (
    <motion.div
      key="palette-editor"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="bg-[#0a2e28] rounded-t-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          {/* mini preview swatches */}
          <div className="flex -space-x-1">
            {PALETTE_COLORS.slice(0, 4).map((c) => (
              <div
                key={c.key}
                className="w-3.5 h-3.5 rounded-full border border-black/20"
                style={{ backgroundColor: getContent(c.key, c.defaultValue) }}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-sage uppercase tracking-wide">Paleta de Cores</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] text-white/40 hover:text-white/80 transition-colors px-2 py-1 rounded hover:bg-white/8"
          >
            Repor tudo
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors p-1 rounded hover:bg-white/8"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Color list */}
      <div className="divide-y divide-white/6">
        {PALETTE_COLORS.map((color) => {
          const value = getContent(color.key, color.defaultValue)
          const isOpen = openKey === color.key
          const isDefault = value === color.defaultValue

          return (
            <div key={color.key}>
              {/* Row */}
              <button
                type="button"
                onClick={() => toggle(color.key, value)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                  isOpen ? 'bg-white/8' : 'hover:bg-white/5'
                }`}
              >
                {/* Swatch */}
                <div
                  className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm ring-1 ring-black/20 transition-transform"
                  style={{ backgroundColor: value }}
                />
                {/* Labels */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/90">{color.label}</span>
                    {!isDefault && (
                      <span className="text-[9px] bg-accent/30 text-accent px-1.5 py-0.5 rounded-full uppercase tracking-wide font-medium">
                        editado
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-white/35 truncate">{color.description}</span>
                </div>
                {/* Hex */}
                <span className="text-[11px] font-mono text-white/40 flex-shrink-0">{value.toUpperCase()}</span>
                {/* Chevron */}
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  className={`flex-shrink-0 text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Expanded picker */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-2 space-y-3">
                      {/* react-colorful picker */}
                      <div className="palette-picker-wrap">
                        <HexColorPicker
                          color={value}
                          onChange={(c) => handlePickerChange(color.key, c)}
                        />
                      </div>

                      {/* Hex input + reset row */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/30 font-mono select-none">#</span>
                          <input
                            type="text"
                            value={hexDraft.replace(/^#/, '')}
                            onChange={(e) => handleHexDraft(color.key, e.target.value)}
                            onBlur={() => {
                              if (!isValidHex(hexDraft)) setHexDraft(value)
                            }}
                            maxLength={6}
                            className="w-full bg-white/8 border border-white/12 rounded-lg pl-7 pr-3 py-2 text-sm font-mono text-white/90 outline-none focus:border-accent/60 focus:bg-white/12 transition-colors"
                            spellCheck={false}
                          />
                        </div>
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => {
                              updateContent(color.key, color.defaultValue)
                              setHexDraft(color.defaultValue)
                            }}
                            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 border border-white/12 hover:border-white/25 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 3v5h5" />
                            </svg>
                            Repor
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
