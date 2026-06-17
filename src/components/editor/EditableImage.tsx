import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { storage } from '../../lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
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
  const btnRef = useRef<HTMLButtonElement>(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPopoverPos({
        top: rect.top + rect.height / 2 + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      })
    }
  }, [open])

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
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      apply(url)
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

  const popover = open ? createPortal(
    <>
      <div className="fixed inset-0 z-[99]" onClick={() => setOpen(false)} />
      <div
        className="fixed z-[100] bg-white rounded-xl shadow-2xl border border-accent-mid/30 p-4 w-80 -translate-x-1/2 -translate-y-1/2"
        style={{ top: popoverPos.top, left: popoverPos.left }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs font-semibold text-forest mb-2 uppercase tracking-wide">Alterar imagem</p>

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
    </>,
    document.body,
  ) : null

  return (
    <div className={`relative group h-full w-full ${className}`}>
      <img src={src} alt={alt} className={imgClassName} />
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setUrlInput(src); setOpen(true) }}
        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[inherit] cursor-pointer"
      >
        <span className="bg-white text-forest text-xs font-semibold px-3 py-1.5 rounded-full shadow">
          Editar imagem
        </span>
      </button>
      {popover}
    </div>
  )
}
