import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEditor } from '../../contexts/EditorContext'
import { SectionReorderPanel } from './SectionReorderPanel'
import { PaletteEditor } from './PaletteEditor'

export function EditorToolbar() {
  const { isEditMode, setEditMode, isAdmin, saveAll, revertAll, dirtyCount, isSaving, saveError, clearSaveError } = useEditor()
  const [showReorder, setShowReorder] = useState(false)
  const [showPalette, setShowPalette] = useState(false)

  if (!isAdmin) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] flex justify-center pointer-events-none">
      <div className="relative w-[min(calc(100%-0rem),36rem)] pointer-events-auto">
        {/* Reorder panel — slides up above toolbar */}
        <AnimatePresence>
          {isEditMode && showReorder && (
            <SectionReorderPanel onClose={() => setShowReorder(false)} />
          )}
        </AnimatePresence>

        {/* Palette editor — slides up above toolbar */}
        <AnimatePresence>
          {isEditMode && showPalette && (
            <PaletteEditor onClose={() => setShowPalette(false)} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isEditMode && (
            <motion.div
              key="editor-toolbar"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="flex items-center justify-between gap-2 bg-forest text-white px-3 py-2.5 shadow-2xl md:rounded-t-2xl"
            >
              {/* Status */}
              <div className="flex flex-col min-w-0 shrink-0">
                <span className="text-[10px] font-semibold text-sage uppercase tracking-wide leading-none">
                  Modo de edição
                </span>
                {saveError ? (
                  <span className="text-[11px] text-red-400 mt-0.5 max-w-[180px] truncate" title={saveError}>
                    ⚠ {saveError}
                  </span>
                ) : dirtyCount > 0 ? (
                  <span className="text-[11px] text-accent-mid mt-0.5">
                    {dirtyCount} {dirtyCount !== 1 ? 'alterações' : 'alteração'}
                  </span>
                ) : (
                  <span className="text-[11px] text-white/35 mt-0.5">Sem alterações</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Reorder sections */}
                <button
                  type="button"
                  onClick={() => { setShowReorder((v) => !v); setShowPalette(false) }}
                  className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${
                    showReorder
                      ? 'bg-accent/20 border-accent/40 text-white'
                      : 'border-white/20 text-white/70 hover:text-white hover:border-white/40'
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M3 12h18M3 6h18M3 18h18" />
                  </svg>
                  <span className="hidden sm:inline">Secções</span>
                </button>

                {/* Palette editor */}
                <button
                  type="button"
                  onClick={() => { setShowPalette((v) => !v); setShowReorder(false) }}
                  className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${
                    showPalette
                      ? 'bg-accent/20 border-accent/40 text-white'
                      : 'border-white/20 text-white/70 hover:text-white hover:border-white/40'
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
                    <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none"/>
                    <circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>
                    <circle cx="6.5" cy="12.5" r="1.5" fill="currentColor" stroke="none"/>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                  </svg>
                  <span className="hidden sm:inline">Cores</span>
                </button>

                {/* Revert */}
                {dirtyCount > 0 && (
                  <button
                    type="button"
                    onClick={revertAll}
                    disabled={isSaving}
                    className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1.5 rounded disabled:opacity-40"
                  >
                    Reverter
                  </button>
                )}

                {/* Save */}
                <button
                  type="button"
                  onClick={() => { clearSaveError(); saveAll() }}
                  disabled={dirtyCount === 0 || isSaving}
                  className="bg-accent text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-accent/80 transition-colors"
                >
                  {isSaving ? 'A guardar…' : 'Guardar'}
                </button>

                {/* Exit edit mode */}
                <button
                  type="button"
                  onClick={() => {
                    if (dirtyCount > 0 && !window.confirm('Tens alterações por guardar. Sair na mesma?')) return
                    setEditMode(false)
                    setShowReorder(false)
                    clearSaveError()
                  }}
                  disabled={isSaving}
                  className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1.5 rounded disabled:opacity-40 border border-white/20"
                >
                  Sair
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
