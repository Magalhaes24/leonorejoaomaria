import React, { useEffect, useRef, useState } from 'react'
import { useEditor } from '../../contexts/EditorContext'

type AllowedTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div' | 'time'

const BLOCK_TAGS = new Set<AllowedTag>(['h1', 'h2', 'h3', 'h4', 'p', 'div'])

const SIZE_PRESETS = [
  { label: 'XS', value: '0.75rem' },
  { label: 'SM', value: '0.875rem' },
  { label: 'MD', value: '1rem' },
  { label: 'LG', value: '1.125rem' },
  { label: 'XL', value: '1.25rem' },
  { label: '2XL', value: '1.5rem' },
  { label: '3XL', value: '1.875rem' },
  { label: '4XL', value: '2.25rem' },
  { label: '5XL', value: '3rem' },
  { label: '6XL', value: '3.75rem' },
]

interface EditableTextProps {
  contentKey: string
  fallback: string
  tag?: AllowedTag
  className?: string
  multiline?: boolean
}

export function EditableText({ contentKey, fallback, tag: Tag = 'span', className = '', multiline = false }: EditableTextProps) {
  const { getContent, updateContent, isEditMode } = useEditor()
  const value = getContent(contentKey, fallback)
  const sizeKey = `${contentKey}__size`
  const fontSize = getContent(sizeKey, '')
  const ref = useRef<HTMLElement>(null)
  const isComposing = useRef(false)
  const isFocused = useRef(false)
  const [showPicker, setShowPicker] = useState(false)

  // Sync DOM when value changes from outside (e.g. revert)
  useEffect(() => {
    if (!ref.current) return
    if (isFocused.current) return
    if (ref.current.textContent !== value) {
      ref.current.textContent = value
    }
  }, [value, isEditMode])

  if (!isEditMode) {
    return <Tag className={className} style={fontSize ? { fontSize } : undefined}>{value}</Tag>
  }

  const isBlock = BLOCK_TAGS.has(Tag)
  const WrapTag = isBlock ? 'div' : 'span'
  const wrapClass = isBlock ? 'relative' : 'relative inline-block'

  return (
    <WrapTag
      className={wrapClass}
      onMouseEnter={() => setShowPicker(true)}
      onMouseLeave={() => { if (!isFocused.current) setShowPicker(false) }}
    >
      {showPicker && (
        <div
          className="absolute bottom-full left-0 mb-1 z-[10000] flex items-center gap-0.5 bg-forest/95 backdrop-blur-sm rounded-lg px-1.5 py-1 shadow-lg whitespace-nowrap"
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="text-[9px] text-white/40 mr-1 uppercase tracking-wide select-none">Tamanho</span>
          {SIZE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                updateContent(sizeKey, fontSize === p.value ? '' : p.value)
              }}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                fontSize === p.value
                  ? 'bg-accent text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
          {fontSize && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); updateContent(sizeKey, '') }}
              className="text-[10px] text-white/40 hover:text-white ml-1 px-1 rounded hover:bg-white/10 transition-colors"
              title="Repor tamanho"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <Tag
        ref={ref as React.Ref<any>}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        className={`${className} outline-none ring-2 ring-accent/40 ring-offset-1 rounded-sm cursor-text min-w-4 inline-block`}
        style={{ whiteSpace: multiline ? 'pre-wrap' : undefined, fontSize: fontSize || undefined }}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
        onFocus={() => { isFocused.current = true; setShowPicker(true) }}
        onBlur={(e) => {
          isFocused.current = false
          setShowPicker(false)
          updateContent(contentKey, (e.currentTarget as HTMLElement).textContent ?? '')
        }}
        onCompositionStart={() => { isComposing.current = true }}
        onCompositionEnd={(e) => {
          isComposing.current = false
          updateContent(contentKey, (e.currentTarget as HTMLElement).textContent ?? '')
        }}
        onInput={(e) => {
          if (!isComposing.current) {
            updateContent(contentKey, (e.currentTarget as HTMLElement).textContent ?? '')
          }
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (!multiline && e.key === 'Enter') {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).blur()
          }
        }}
      />
    </WrapTag>
  )
}
