import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useEditor } from '../../contexts/EditorContext'

interface EditableImageProps {
  contentKey: string
  fallback: string
  alt: string
  className?: string
  imgClassName?: string
}

export function EditableImage({ contentKey, fallback, alt, className = '', imgClassName = '' }: EditableImageProps) {
  const { getContent, updateContent, isEditMode } = useEditor()
  const src = getContent(contentKey, fallback) || fallback
  const [open, setOpen] = useState(false)
  const [urlInput, setUrlInput] = useState(src)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const apply = (newSrc: string) => {
    updateContent(contentKey, newSrc)
    setOpen(false)
    setError('')
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `editor/${contentKey.replace(/\./g, '/')}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('site-assets')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path)
      apply(data.publicUrl)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar imagem.')
    } finally {
      setUploading(false)
    }
  }

  if (!isEditMode) {
    return (
      <div className={`h-full w-full ${className}`}>
        <img src={src} alt={alt} className={imgClassName} />
      </div>
    )
  }

  return (
    <div className={`relative group h-full w-full ${className}`}>
      <img src={src} alt={alt} className={imgClassName} />
      {/* Hover overlay */}
      <button
        type="button"
        onClick={() => { setUrlInput(src); setOpen(true) }}
        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[inherit] cursor-pointer"
      >
        <span className="bg-white text-forest text-xs font-semibold px-3 py-1.5 rounded-full shadow">
          Editar imagem
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-accent-mid/30 p-4 w-80">
          <p className="text-xs font-semibold text-forest mb-2 uppercase tracking-wide">Alterar imagem</p>

          {/* URL input */}
          <input
            type="text"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://..."
            className="w-full text-sm border border-accent-mid/40 rounded-lg px-3 py-2 mb-2 outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="button"
            onClick={() => apply(urlInput.trim())}
            disabled={!urlInput.trim()}
            className="w-full bg-accent text-white text-sm font-medium rounded-lg py-2 mb-2 disabled:opacity-40 hover:bg-accent/80 transition-colors"
          >
            Usar URL
          </button>

          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-accent-mid/30" />
            <span className="text-xs text-forest/40">ou</span>
            <div className="flex-1 h-px bg-accent-mid/30" />
          </div>

          {/* File upload */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full border border-accent-mid/40 text-forest text-sm font-medium rounded-lg py-2 hover:bg-accent-light transition-colors disabled:opacity-40"
          >
            {uploading ? 'A carregar...' : 'Carregar ficheiro'}
          </button>

          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full mt-3 text-xs text-forest/50 hover:text-forest transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
