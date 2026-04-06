import { useState } from 'react'
import { Reorder, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useEditor } from '../../contexts/EditorContext'

type Section = { id: string; label: string; icon: string }

const HOME_SECTIONS: Section[] = [
  { id: 'countdown', label: 'Contagem decrescente', icon: '⏱' },
  { id: 'ceremony', label: 'Cerimónia', icon: '⛪' },
  { id: 'cocktail', label: 'Cocktail', icon: '🥂' },
  { id: 'list', label: 'Lista de presentes', icon: '🎁' },
  { id: 'info', label: 'Transportes & Alergias', icon: 'ℹ' },
]

const LISTA_SECTIONS: Section[] = [
  { id: 'gifts', label: 'Presentes', icon: '🎁' },
  { id: 'honeymoon', label: 'Lua de mel', icon: '✈' },
]

const DEFAULTS: Record<'home' | 'lista', string> = {
  home: 'countdown,ceremony,cocktail,list,info',
  lista: 'gifts,honeymoon',
}

function parseOrder(value: string, sections: Section[]): Section[] {
  const ids = value.split(',').map((s) => s.trim())
  const found = ids.map((id) => sections.find((s) => s.id === id)).filter(Boolean) as Section[]
  const missing = sections.filter((s) => !ids.includes(s.id))
  return [...found, ...missing]
}

export function SectionReorderPanel({ onClose }: { onClose: () => void }) {
  const location = useLocation()
  const { getContent, updateContent } = useEditor()

  const defaultPage: 'home' | 'lista' = location.pathname.startsWith('/lista') ? 'lista' : 'home'
  const [activePage, setActivePage] = useState<'home' | 'lista'>(defaultPage)

  const sectionsForPage = (page: 'home' | 'lista') =>
    page === 'home' ? HOME_SECTIONS : LISTA_SECTIONS
  const keyForPage = (page: 'home' | 'lista') =>
    page === 'home' ? 'layout.home_order' : 'layout.lista_order'

  const [items, setItems] = useState<Section[]>(() =>
    parseOrder(getContent(keyForPage(defaultPage), DEFAULTS[defaultPage]), sectionsForPage(defaultPage)),
  )

  function switchPage(page: 'home' | 'lista') {
    setActivePage(page)
    setItems(
      parseOrder(getContent(keyForPage(page), DEFAULTS[page]), sectionsForPage(page)),
    )
  }

  function handleReorder(newItems: Section[]) {
    setItems(newItems)
    updateContent(keyForPage(activePage), newItems.map((s) => s.id).join(','))
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      className="absolute bottom-full mb-2 left-0 right-0 mx-auto w-[min(calc(100%-2rem),36rem)] bg-white rounded-2xl shadow-2xl shadow-forest/20 border border-accent-mid/20 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent-mid/15">
        <span className="text-xs font-semibold text-forest uppercase tracking-wide">
          Reordenar secções
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-forest/40 hover:text-forest transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-accent-light text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Page tabs */}
      <div className="flex border-b border-accent-mid/15">
        {(['home', 'lista'] as const).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => switchPage(page)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activePage === page
                ? 'text-accent border-b-2 border-accent -mb-px bg-accent-light/40'
                : 'text-forest/50 hover:text-forest hover:bg-accent-light/20'
            }`}
          >
            {page === 'home' ? 'Página Inicial' : 'Lista'}
          </button>
        ))}
      </div>

      {/* Draggable section list */}
      <Reorder.Group
        values={items}
        onReorder={handleReorder}
        className="p-3 space-y-1.5 select-none"
        as="ul"
        style={{ listStyle: 'none', margin: 0, padding: '0.75rem', gap: '0.375rem', display: 'flex', flexDirection: 'column' }}
      >
        {items.map((item) => (
          <Reorder.Item
            key={item.id}
            value={item}
            as="li"
            style={{ listStyle: 'none' }}
            whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px -8px rgba(12,61,53,0.18)' }}
            className="flex items-center gap-3 bg-accent-light/30 hover:bg-accent-light/60 border border-accent-mid/20 rounded-xl px-3 py-2.5 cursor-grab active:cursor-grabbing"
          >
            <span className="text-base leading-none shrink-0">{item.icon}</span>
            <span className="flex-1 text-sm font-medium text-forest">{item.label}</span>
            {/* Drag handle dots */}
            <svg className="text-forest/25 shrink-0" width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
              <circle cx="3" cy="3" r="1.5" />
              <circle cx="9" cy="3" r="1.5" />
              <circle cx="3" cy="8" r="1.5" />
              <circle cx="9" cy="8" r="1.5" />
              <circle cx="3" cy="13" r="1.5" />
              <circle cx="9" cy="13" r="1.5" />
            </svg>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <p className="text-center text-[11px] text-forest/30 pb-3 px-4">
        Arrasta para reordenar · Guarda na barra abaixo para aplicar
      </p>
    </motion.div>
  )
}
