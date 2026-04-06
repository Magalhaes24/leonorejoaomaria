import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Alergia, type Boleia, type Gift } from '../lib/supabase'
import { MOTION_EASE, motionProps, presenceProps } from '../lib/motion'
import { copy } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { useEditor } from '../components/editor'
import { CONTENT_DEFAULTS } from '../lib/siteContent'

const ADMIN_USER_ID = '0b9c93dd-17a2-4943-befd-968943ba432f'
interface ContribRow {
  id: string
  gift_id: string
  contributor_name: string
  amount: number
  created_at: string
}

interface GiftRow extends Gift {
  total_contributed: number
  contributions: ContribRow[]
}

interface AlergiaRow extends Alergia {
  id: string
  created_at: string
}

interface BoleiaRow extends Boleia {
  id: string
  created_at: string
}

interface GiftInsertRow {
  name: string
  description: string | null
  price: number
  category: null
  image_url: string | null
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const MAX_IMAGE_DIMENSION = 1600
const MAX_IMAGE_BYTES = 900_000
const HOME_SECTION_LABELS: Record<string, string> = {
  countdown: 'Contagem',
  ceremony: 'Cerimonia',
  cocktail: 'Cocktail',
  list: 'Lista',
  info: 'Transportes e alergias',
}
const LISTA_SECTION_LABELS: Record<string, string> = {
  gifts: 'Presentes',
  honeymoon: 'Lua de mel',
}

const parseOrderedIds = (value: string, defaults: readonly string[]) => {
  const allowed = new Set(defaults)
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => allowed.has(item))
  const missing = defaults.filter((item) => !parsed.includes(item))
  return [...parsed, ...missing]
}

const moveItem = (items: string[], index: number, direction: -1 | 1) => {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= items.length) return items
  const next = [...items]
  ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
  return next
}

const loadImageElement = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(copy.admin.errors.imageRead))
    }
    image.src = objectUrl
  })

const canvasToDataUrl = (canvas: HTMLCanvasElement, quality: number) =>
  canvas.toDataURL('image/webp', quality)

const approximateBase64Bytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.ceil((base64.length * 3) / 4)
}

const readFileAsDataUrl = async (file: File) => {
  const image = await loadImageElement(file)
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error(copy.admin.errors.imageProcess)
  }

  canvas.width = width
  canvas.height = height
  context.drawImage(image, 0, 0, width, height)

  const qualities = [0.82, 0.72, 0.62, 0.52, 0.42]
  let best = canvasToDataUrl(canvas, qualities[0])

  for (const quality of qualities) {
    const candidate = canvasToDataUrl(canvas, quality)
    best = candidate

    if (approximateBase64Bytes(candidate) <= MAX_IMAGE_BYTES) {
      return candidate
    }
  }

  if (approximateBase64Bytes(best) > MAX_IMAGE_BYTES) {
    throw new Error(copy.admin.errors.imageTooLarge)
  }

  return best
}

const formatSupabaseError = (message?: string) => {
  if (!message) return copy.admin.errors.saveError
  if (message.toLowerCase().includes('row-level security')) return copy.admin.errors.noPermissionGift
  if (message.toLowerCase().includes('payload')) return copy.admin.errors.imageTooLarge
  return message
}

const CSV_TEMPLATE = [
  ['name', 'description', 'price', 'image_url'],
  ['Pratos Costa Nova', 'Servico de jantar para 12 pessoas', '120', 'https://exemplo.com/pratos.jpg'],
  ['Toalhas de banho', '', '45', ''],
]
  .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(','))
  .join('\n')

const normalizeNullableCsvValue = (value: string | undefined) => {
  const trimmed = (value ?? '').trim()
  if (!trimmed || trimmed.toLowerCase() === 'null') return null
  return trimmed
}

const parseCsv = (content: string) => {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let currentCell = ''
  let currentRow: string[] = []
  let inQuotes = false

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index]
    const nextCharacter = normalized[index + 1]

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === ',' && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if (character === '\n' && !inQuotes) {
      currentRow.push(currentCell)
      if (currentRow.some((cell) => cell.trim() !== '')) {
        rows.push(currentRow)
      }
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += character
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell)
    if (currentRow.some((cell) => cell.trim() !== '')) {
      rows.push(currentRow)
    }
  }

  return rows
}

const parseGiftCsv = (content: string) => {
  const rows = parseCsv(content)

  if (rows.length < 2) {
    throw new Error(copy.admin.errors.csvHeaderRequired)
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const requiredHeaders = ['name', 'description', 'price', 'image_url']
  const missingHeaders = requiredHeaders.filter((column) => !header.includes(column))

  if (missingHeaders.length > 0) {
    throw new Error(copy.admin.errors.csvMissingHeaders(missingHeaders))
  }

  const getValue = (row: string[], column: string) => row[header.indexOf(column)] ?? ''

  return rows.slice(1).map((row, index) => {
    const rowNumber = index + 2
    const name = normalizeNullableCsvValue(getValue(row, 'name'))
    const priceRaw = normalizeNullableCsvValue(getValue(row, 'price'))
    const description = normalizeNullableCsvValue(getValue(row, 'description'))
    const imageUrl = normalizeNullableCsvValue(getValue(row, 'image_url'))

    if (!name) {
      throw new Error(copy.admin.errors.csvNameRequired(rowNumber))
    }

    if (!priceRaw) {
      throw new Error(copy.admin.errors.csvPriceRequired(rowNumber))
    }

    const price = Number.parseFloat(priceRaw.replace(',', '.'))
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(copy.admin.errors.csvPriceInvalid(rowNumber))
    }

    return {
      name,
      description,
      price,
      category: null,
      image_url: imageUrl,
    } satisfies GiftInsertRow
  })
}

const decodeCsvBuffer = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

const readCsvFile = async (file: File) => {
  const buffer = await file.arrayBuffer()
  return decodeCsvBuffer(buffer)
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-[28px] border border-white/60 bg-white/85 px-5 py-5 shadow-lg shadow-forest/5 backdrop-blur">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-accent-dark/70">{label}</p>
      <p className="mt-3 font-serif text-3xl text-forest">{value}</p>
      <p className="mt-2 text-sm text-gray-500">{note}</p>
    </div>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(copy.admin.login.invalidCredentials)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-8">
      <motion.div
        {...motionProps({
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, ease: MOTION_EASE },
        })}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-accent-mid/30 bg-white p-10 shadow-xl shadow-forest/10"
      >
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent-dark/70">{copy.admin.login.titleTag}</p>
          <p className="mt-3 font-serif text-4xl text-forest">{copy.admin.login.title}</p>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            {copy.admin.login.description}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">{copy.admin.login.emailLabel}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            className="w-full rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">{copy.admin.login.passwordLabel}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            className="w-full rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-forest py-3 text-sm font-medium text-white transition-all hover:bg-accent-dark disabled:opacity-50"
          >
            {loading ? copy.admin.login.loading : copy.admin.login.submit}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

function GiftFormModal({
  gift,
  onClose,
  onSaved,
}: {
  gift?: Gift
  onClose: () => void
  onSaved: (gifts: Gift[]) => void
}) {
  const [name, setName] = useState(gift?.name ?? '')
  const [description, setDescription] = useState(gift?.description ?? '')
  const [price, setPrice] = useState(gift?.price?.toString() ?? '')
  const [imageUrl, setImageUrl] = useState(gift?.image_url ?? '')
  const [imageSource, setImageSource] = useState<'url' | 'upload'>(gift?.image_url?.startsWith('data:') ? 'upload' : 'url')
  const [mode, setMode] = useState<'single' | 'csv'>('single')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [csvFileName, setCsvFileName] = useState('')
  const [csvRows, setCsvRows] = useState<GiftInsertRow[]>([])
  const [csvSummary, setCsvSummary] = useState('')
  const [error, setError] = useState('')

  const isEdit = !!gift

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError(copy.admin.giftForm.fields.invalidImage)
      e.target.value = ''
      return
    }

    try {
      setUploadingImage(true)
      setError('')
      const dataUrl = await readFileAsDataUrl(file)
      setImageUrl(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.admin.giftForm.fields.loadImageError)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !price) return
    setLoading(true)
    setError('')

    const data = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category: null,
      image_url: imageUrl.trim() || null,
    }

    const result = isEdit
      ? await supabase.from('gifts').update(data).eq('id', gift.id).select().single()
      : await supabase.from('gifts').insert(data).select().single()

    if (result.error) {
      setError(formatSupabaseError(result.error.message))
      setLoading(false)
      return
    }

    onSaved([result.data as Gift])
    onClose()
  }

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setError('')
      const content = await readCsvFile(file)
      const parsedRows = parseGiftCsv(content)
      setCsvRows(parsedRows)
      setCsvFileName(file.name)
      setCsvSummary(`${parsedRows.length} presentes prontos a importar.`)
    } catch (err) {
      setCsvRows([])
      setCsvFileName('')
      setCsvSummary('')
      setError(err instanceof Error ? err.message : copy.admin.errors.csvRead)
    } finally {
      e.target.value = ''
    }
  }

  const handleDownloadTemplate = () => {
    const blob = new Blob(['\uFEFF', CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'template-presentes.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleBulkSubmit = async () => {
    if (csvRows.length === 0) {
      setError(copy.admin.giftForm.import.requiredRows)
      return
    }

    setLoading(true)
    setError('')

    const result = await supabase.from('gifts').insert(csvRows).select()

    if (result.error) {
      setError(formatSupabaseError(result.error.message))
      setLoading(false)
      return
    }

    setLoading(false)
    onSaved((result.data ?? []) as Gift[])
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center overflow-y-auto bg-forest/35 p-0 md:p-6 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-accent-mid/20 bg-white p-5 shadow-2xl shadow-forest/20 md:rounded-3xl md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] uppercase tracking-[0.28em] text-accent-dark/70">
          {isEdit ? copy.admin.giftForm.editTitle : copy.admin.giftForm.newTitle}
        </p>
        <h2 className="mt-3 font-serif text-3xl text-forest">
          {isEdit ? gift.name : copy.admin.giftForm.addTitle}
        </h2>

        {!isEdit && (
          <div className="mt-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('single')
                setError('')
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                mode === 'single'
                  ? 'bg-forest text-white'
                  : 'border border-accent-mid/40 bg-white text-accent-dark hover:border-accent'
              }`}
            >
              {copy.admin.giftForm.mode.manual}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('csv')
                setError('')
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                mode === 'csv'
                  ? 'bg-forest text-white'
                  : 'border border-accent-mid/40 bg-white text-accent-dark hover:border-accent'
              }`}
            >
              {copy.admin.giftForm.mode.csv}
            </button>
          </div>
        )}

        {(!isEdit && mode === 'csv') ? (
          <div className="mt-8 space-y-5">
            <div className="rounded-[28px] border border-accent-mid/30 bg-accent-light/20 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-accent-dark/70">{copy.admin.giftForm.import.tag}</p>
              <p className="mt-3 text-sm leading-6 text-gray-500">
                {copy.admin.giftForm.import.description}
              </p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-4 rounded-full border border-accent-mid/40 bg-white px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:border-accent hover:text-forest"
              >
                {copy.admin.giftForm.import.downloadTemplate}
              </button>
            </div>

            <div className="rounded-2xl border border-dashed border-accent-mid/50 bg-accent-light/25 p-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-accent-mid/30 bg-white px-4 py-8 text-center transition-colors hover:border-accent hover:bg-accent-light/30">
                <span className="text-sm font-medium text-forest">{copy.admin.giftForm.import.chooseCsv}</span>
                <span className="text-xs text-gray-500">{copy.admin.giftForm.import.accepted}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {csvFileName && (
              <div className="rounded-2xl border border-accent-mid/30 bg-white px-4 py-4">
                <p className="text-sm font-medium text-forest">{csvFileName}</p>
                <p className="mt-1 text-sm text-gray-500">{csvSummary}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-300">
                  {copy.admin.giftForm.import.validRows(csvRows.length)}
                </p>
              </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-accent-light py-3 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
              >
                {copy.admin.actions.cancel}
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={loading || csvRows.length === 0}
                className="flex-1 rounded-xl bg-forest py-3 text-sm font-medium text-white transition-all hover:bg-accent-dark disabled:opacity-50"
              >
                {loading ? copy.admin.giftForm.import.loading : copy.admin.giftForm.import.import}
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">{copy.admin.giftForm.fields.name}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={copy.admin.giftForm.fields.namePlaceholder}
              className="w-full rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">{copy.admin.giftForm.fields.description}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={copy.admin.giftForm.fields.descriptionPlaceholder}
              className="w-full resize-none rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">{copy.admin.giftForm.fields.price}</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              placeholder={copy.admin.giftForm.fields.pricePlaceholder}
              className="w-full rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">{copy.admin.giftForm.fields.image}</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImageSource('url')
                    if (imageUrl.startsWith('data:')) setImageUrl('')
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    imageSource === 'url'
                      ? 'bg-forest text-white'
                      : 'border border-accent-mid/40 bg-white text-accent-dark hover:border-accent'
                  }`}
                >
                  {copy.admin.giftForm.fields.imageUrl}
                </button>
                <button
                  type="button"
                  onClick={() => setImageSource('upload')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    imageSource === 'upload'
                      ? 'bg-forest text-white'
                      : 'border border-accent-mid/40 bg-white text-accent-dark hover:border-accent'
                  }`}
                >
                  {copy.admin.giftForm.fields.upload}
                </button>
              </div>
            </div>

            {imageSource === 'url' ? (
              <input
                value={imageUrl.startsWith('data:') ? '' : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder={copy.admin.giftForm.fields.imageUrlPlaceholder}
                className="w-full rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-accent-mid/50 bg-accent-light/25 p-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-accent-mid/30 bg-white px-4 py-6 text-center transition-colors hover:border-accent hover:bg-accent-light/30">
                  <span className="text-sm font-medium text-forest">
                    {uploadingImage ? copy.admin.giftForm.fields.uploadLoading : copy.admin.giftForm.fields.uploadChoose}
                  </span>
                  <span className="text-xs text-gray-500">{copy.admin.giftForm.fields.uploadAccepted}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {imageUrl && (
              <div className="overflow-hidden rounded-2xl border border-accent-mid/30 bg-white">
                <div className="aspect-[16/9] bg-accent-light/30">
                  <img src={imageUrl} alt={copy.admin.giftForm.fields.previewAlt} className="h-full w-full object-cover" />
                </div>
                <div className="flex justify-end border-t border-accent-mid/20 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs font-medium text-accent-dark transition-colors hover:text-forest"
                  >
                    {copy.admin.giftForm.fields.removeImage}
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-accent-light py-3 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
            >
              {copy.admin.actions.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-forest py-3 text-sm font-medium text-white transition-all hover:bg-accent-dark disabled:opacity-50"
            >
              {loading ? copy.admin.giftForm.submit.loading : isEdit ? copy.admin.giftForm.submit.update : copy.admin.giftForm.submit.create}
            </button>
          </div>
        </form>
        )}
      </motion.div>
    </motion.div>
  )
}

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const { setEditMode, isEditMode, getContent, updateContent, saveAll, dirtyCount, isSaving, saveError, clearSaveError } = useEditor()
  const [tab, setTab] = useState<'gifts' | 'contributions' | 'alergias' | 'boleias' | 'conteudo'>('gifts')
  const homeSectionOrder = parseOrderedIds(getContent('layout.home_order', 'countdown,ceremony,cocktail,list,info'), ['countdown', 'ceremony', 'cocktail', 'list', 'info'])
  const listaSectionOrder = parseOrderedIds(getContent('layout.lista_order', 'gifts,honeymoon'), ['gifts', 'honeymoon'])
  const [gifts, setGifts] = useState<GiftRow[]>([])
  const [alergias, setAlergias] = useState<AlergiaRow[]>([])
  const [boleias, setBoleias] = useState<BoleiaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editGift, setEditGift] = useState<Gift | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteContributionId, setDeleteContributionId] = useState<string | null>(null)
  const [deletingContribution, setDeletingContribution] = useState(false)
  const [editContributionId, setEditContributionId] = useState<string | null>(null)
  const [editContributionName, setEditContributionName] = useState('')
  const [editContributionAmount, setEditContributionAmount] = useState('')
  const [savingContribution, setSavingContribution] = useState(false)
  const [deleteAlergiaId, setDeleteAlergiaId] = useState<string | null>(null)
  const [deletingAlergia, setDeletingAlergia] = useState(false)
  const [editAlergiaId, setEditAlergiaId] = useState<string | null>(null)
  const [editAlergiaNome, setEditAlergiaNome] = useState('')
  const [editAlergiaRestricoes, setEditAlergiaRestricoes] = useState('')
  const [editAlergiaNotas, setEditAlergiaNotas] = useState('')
  const [savingAlergia, setSavingAlergia] = useState(false)
  const [deleteBoleiaId, setDeleteBoleiaId] = useState<string | null>(null)
  const [deletingBoleia, setDeletingBoleia] = useState(false)
  const [editBoleiaId, setEditBoleiaId] = useState<string | null>(null)
  const [editBoleiaNome, setEditBoleiaNome] = useState('')
  const [editBoleiaTelefone, setEditBoleiaTelefone] = useState('')
  const [editBoleiaLugares, setEditBoleiaLugares] = useState('')
  const [editBoleiaSentido, setEditBoleiaSentido] = useState('')
  const [editBoleiaNotas, setEditBoleiaNotas] = useState('')
  const [savingBoleia, setSavingBoleia] = useState(false)
  const [actionError, setActionError] = useState('')

  const loadData = async (showLoader = false) => {
    if (showLoader) setLoading(true)

    const [giftsRes, contribsRes, alergiasRes, boleiasRes] = await Promise.all([
      supabase.from('gifts').select('*').order('created_at', { ascending: false }),
      supabase.from('gift_contributions').select('*').order('created_at', { ascending: false }),
      supabase.from('alergias').select('*').order('created_at', { ascending: false }),
      supabase.from('boleias').select('*').order('created_at', { ascending: false }),
    ])

    if (!giftsRes.error && giftsRes.data) {
      const contribs = (contribsRes.data ?? []) as ContribRow[]
      const rows: GiftRow[] = giftsRes.data.map((g) => {
        const giftContribs = contribs.filter((c) => c.gift_id === g.id)
        return {
          ...g,
          total_contributed: giftContribs.reduce((sum, c) => sum + Number(c.amount), 0),
          contributions: giftContribs,
        }
      })
      setGifts(rows)
    }

    if (!alergiasRes.error && alergiasRes.data) {
      setAlergias(alergiasRes.data as AlergiaRow[])
    }

    if (!boleiasRes.error && boleiasRes.data) {
      setBoleias(boleiasRes.data as BoleiaRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData(true)

    const intervalId = window.setInterval(() => {
      loadData()
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    setActionError('')
    const currentDeleteId = deleteId
    const { error } = await supabase.from('gifts').delete().eq('id', currentDeleteId)
    if (error) {
      setActionError(error.message)
    } else {
      setGifts((prev) => prev.filter((g) => g.id !== currentDeleteId))
      setDeleteId(null)
    }
    setDeleting(false)
  }

  const handleDeleteContribution = async (giftId: string) => {
    if (!deleteContributionId) return
    setDeletingContribution(true)
    setActionError('')
    const currentDeleteId = deleteContributionId
    const { error } = await supabase.from('gift_contributions').delete().eq('id', currentDeleteId)
    if (error) {
      setActionError(error.message)
    } else {
      setGifts((prev) =>
        prev.map((gift) => {
          if (gift.id !== giftId) return gift

          const contributions = gift.contributions.filter((contribution) => contribution.id !== currentDeleteId)
          const totalContributed = contributions.reduce((sum, contribution) => sum + Number(contribution.amount), 0)

          return {
            ...gift,
            contributions,
            total_contributed: totalContributed,
          }
        }),
      )
      setDeleteContributionId(null)
    }
    setDeletingContribution(false)
  }

  const handleStartEditContribution = (contribution: ContribRow) => {
    setDeleteContributionId(null)
    setEditContributionId(contribution.id)
    setEditContributionName(contribution.contributor_name)
    setEditContributionAmount(String(Number(contribution.amount)))
  }

  const handleCancelEditContribution = () => {
    setEditContributionId(null)
    setEditContributionName('')
    setEditContributionAmount('')
  }

  const handleSaveContribution = async (giftId: string) => {
    if (!editContributionId || !editContributionName.trim() || Number(editContributionAmount) <= 0) return

    setSavingContribution(true)
    setActionError('')
    const updatedAmount = Number(editContributionAmount)
    const updatedName = editContributionName.trim()

    const { error } = await supabase
      .from('gift_contributions')
      .update({
        contributor_name: updatedName,
        amount: updatedAmount,
      })
      .eq('id', editContributionId)

    if (!error) {
      setGifts((prev) =>
        prev.map((gift) => {
          if (gift.id !== giftId) return gift

          const contributions = gift.contributions.map((contribution) =>
            contribution.id === editContributionId
              ? {
                  ...contribution,
                  contributor_name: updatedName,
                  amount: updatedAmount,
                }
              : contribution,
          )

          return {
            ...gift,
            contributions,
            total_contributed: contributions.reduce((sum, contribution) => sum + Number(contribution.amount), 0),
          }
        }),
      )
      handleCancelEditContribution()
    } else {
      setActionError(error.message)
    }

    setSavingContribution(false)
  }

  const handleStartEditAlergia = (entry: AlergiaRow) => {
    setDeleteAlergiaId(null)
    setEditAlergiaId(entry.id)
    setEditAlergiaNome(entry.nome)
    setEditAlergiaRestricoes(entry.restricoes.join(', '))
    setEditAlergiaNotas(entry.notas ?? '')
  }

  const handleCancelEditAlergia = () => {
    setEditAlergiaId(null)
    setEditAlergiaNome('')
    setEditAlergiaRestricoes('')
    setEditAlergiaNotas('')
  }

  const handleSaveAlergia = async () => {
    if (!editAlergiaId || !editAlergiaNome.trim()) return

    const restricoes = editAlergiaRestricoes
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    setSavingAlergia(true)
    setActionError('')
    const updatedNome = editAlergiaNome.trim()
    const updatedNotas = editAlergiaNotas.trim() || null

    const { error } = await supabase
      .from('alergias')
      .update({
        nome: updatedNome,
        restricoes,
        notas: updatedNotas,
      })
      .eq('id', editAlergiaId)

    if (!error) {
      setAlergias((prev) =>
        prev.map((entry) =>
          entry.id === editAlergiaId
            ? {
                ...entry,
                nome: updatedNome,
                restricoes,
                notas: updatedNotas,
              }
            : entry,
        ),
      )
      handleCancelEditAlergia()
    } else {
      setActionError(error.message)
    }

    setSavingAlergia(false)
  }

  const handleDeleteAlergia = async () => {
    if (!deleteAlergiaId) return
    setDeletingAlergia(true)
    setActionError('')
    const currentDeleteId = deleteAlergiaId
    const { error } = await supabase.from('alergias').delete().eq('id', currentDeleteId)
    if (!error) {
      setAlergias((prev) => prev.filter((entry) => entry.id !== currentDeleteId))
      setDeleteAlergiaId(null)
    } else {
      setActionError(error.message)
    }
    setDeletingAlergia(false)
  }

  const handleStartEditBoleia = (entry: BoleiaRow) => {
    setDeleteBoleiaId(null)
    setEditBoleiaId(entry.id)
    setEditBoleiaNome(entry.nome)
    setEditBoleiaTelefone(entry.telefone ?? '')
    setEditBoleiaLugares(String(entry.lugares ?? 1))
    setEditBoleiaSentido(entry.sentido)
    setEditBoleiaNotas(entry.notas ?? '')
  }

  const handleCancelEditBoleia = () => {
    setEditBoleiaId(null)
    setEditBoleiaNome('')
    setEditBoleiaTelefone('')
    setEditBoleiaLugares('')
    setEditBoleiaSentido('')
    setEditBoleiaNotas('')
  }

  const handleSaveBoleia = async () => {
    if (!editBoleiaId || !editBoleiaNome.trim() || !editBoleiaSentido.trim() || Number(editBoleiaLugares) < 1) return

    setSavingBoleia(true)
    setActionError('')
    const updatedNome = editBoleiaNome.trim()
    const updatedTelefone = editBoleiaTelefone.trim() || null
    const updatedLugares = Number(editBoleiaLugares)
    const updatedSentido = editBoleiaSentido.trim()
    const updatedNotas = editBoleiaNotas.trim() || null

    const { error } = await supabase
      .from('boleias')
      .update({
        nome: updatedNome,
        telefone: updatedTelefone,
        lugares: updatedLugares,
        sentido: updatedSentido,
        notas: updatedNotas,
      })
      .eq('id', editBoleiaId)

    if (!error) {
      setBoleias((prev) =>
        prev.map((entry) =>
          entry.id === editBoleiaId
            ? {
                ...entry,
                nome: updatedNome,
                telefone: updatedTelefone,
                lugares: updatedLugares,
                sentido: updatedSentido,
                notas: updatedNotas,
              }
            : entry,
        ),
      )
      handleCancelEditBoleia()
    } else {
      setActionError(error.message)
    }

    setSavingBoleia(false)
  }

  const handleDeleteBoleia = async () => {
    if (!deleteBoleiaId) return
    setDeletingBoleia(true)
    setActionError('')
    const currentDeleteId = deleteBoleiaId
    const { error } = await supabase.from('boleias').delete().eq('id', currentDeleteId)
    if (!error) {
      setBoleias((prev) => prev.filter((entry) => entry.id !== currentDeleteId))
      setDeleteBoleiaId(null)
    } else {
      setActionError(error.message)
    }
    setDeletingBoleia(false)
  }

  const handleSaved = (savedGifts: Gift[]) => {
    setGifts((prev) => {
      let next = [...prev]

      for (const saved of savedGifts) {
        const exists = next.find((g) => g.id === saved.id)

        if (exists) {
          next = next.map((g) => g.id === saved.id ? { ...g, ...saved } : g)
          continue
        }

        next = [{ ...saved, total_contributed: 0, contributions: [] }, ...next]
      }

      return next
    })
  }

  const totalContributed = gifts.reduce((sum, g) => sum + g.total_contributed, 0)
  const totalContributions = gifts.reduce((sum, g) => sum + g.contributions.length, 0)
  const fullyFunded = gifts.filter((g) => g.price > 0 && g.total_contributed >= g.price).length
  const pendingGifts = Math.max(gifts.length - fullyFunded, 0)
  const averageContribution = totalContributions > 0 ? totalContributed / totalContributions : 0
  const giftsWithContributions = gifts.filter((g) => g.contributions.length > 0)
  const totalSeatsOffered = boleias.reduce((sum, boleia) => sum + Number(boleia.lugares ?? 0), 0)

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="relative overflow-hidden bg-white px-5 pb-16 pt-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-widest text-accent">{copy.admin.dashboard.tag}</p>
              <h1 className="mt-4 font-serif text-5xl leading-none text-forest md:text-7xl">{copy.admin.dashboard.title}</h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-gray-500 sm:text-base">
                {copy.admin.dashboard.description}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-full border border-accent-mid/40 px-4 py-2 text-xs uppercase tracking-widest text-accent-dark">
                {copy.admin.dashboard.giftsCount(gifts.length)}
              </div>
              <button
                type="button"
                onClick={() => { setEditMode(true); navigate('/') }}
                className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-light px-4 py-2 text-sm font-medium text-forest transition-colors hover:bg-accent hover:text-white"
              >
                ✎ Editar Site
              </button>
              <button
                onClick={onLogout}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-mid/50 px-5 py-2.5 text-sm font-medium text-accent-dark transition-all duration-300 hover:bg-accent hover:text-white hover:border-accent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                {copy.admin.dashboard.logout}
              </button>
            </div>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            <StatCard
              label={copy.admin.stats.totalRaised}
              value={formatCurrency(totalContributed)}
              note={copy.admin.stats.contributionsRegistered(totalContributions)}
            />
            <StatCard
              label={copy.admin.stats.completedGifts}
              value={`${fullyFunded}`}
              note={copy.admin.stats.remainingGifts(pendingGifts)}
            />
            <StatCard
              label={copy.admin.stats.averageValue}
              value={formatCurrency(averageContribution)}
              note={copy.admin.stats.perContribution}
            />
          </div>
        </div>
      </section>

      <section className="bg-accent-light/40 px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(['gifts', 'contributions', 'alergias', 'boleias'] as const).map((currentTab) => {
                const active = tab === currentTab
                const label = currentTab === 'gifts'
                  ? copy.admin.tabs.gifts(gifts.length)
                  : currentTab === 'contributions'
                    ? copy.admin.tabs.contributions(totalContributions)
                    : currentTab === 'alergias'
                      ? copy.admin.tabs.alergias(alergias.length)
                      : copy.admin.tabs.boleias(boleias.length)

                return (
                  <button
                    key={currentTab}
                    onClick={() => setTab(currentTab)}
                    className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                      active
                        ? 'bg-forest text-white shadow-lg shadow-forest/15'
                        : 'border border-accent-mid/40 bg-white text-gray-500 hover:border-accent hover:text-forest'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setTab('conteudo')}
                className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                  tab === 'conteudo'
                    ? 'bg-forest text-white shadow-lg shadow-forest/15'
                    : 'border border-accent-mid/40 bg-white text-gray-500 hover:border-accent hover:text-forest'
                }`}
              >
                Conteúdo
              </button>
            </div>

            {tab === 'gifts' ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-forest px-8 py-4 text-sm font-medium text-white shadow-lg shadow-forest/20 transition-all duration-300 hover:bg-accent-dark"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {copy.admin.actions.addGift}
                </button>
              </div>
            ) : tab === 'contributions' ? (
              <p className="text-sm text-gray-500">
                {copy.admin.summary.contributions(totalContributions, formatCurrency(totalContributed))}
              </p>
            ) : tab === 'alergias' ? (
              <p className="text-sm text-gray-500">
                {copy.admin.summary.allergies(alergias.length)}
              </p>
            ) : tab === 'conteudo' ? (
              null
            ) : (
              <p className="text-sm text-gray-500">
                {copy.admin.summary.rides(boleias.length, totalSeatsOffered)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          {actionError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {actionError}
            </div>
          )}
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-40 rounded-3xl border border-accent-mid/30 bg-white animate-pulse shadow-sm shadow-accent/5" />
              ))}
            </div>
          ) : tab === 'gifts' ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {gifts.map((gift) => {
                const pct = gift.price > 0 ? Math.min(100, (gift.total_contributed / gift.price) * 100) : 0
                const remaining = Math.max(gift.price - gift.total_contributed, 0)

                return (
                  <motion.div
                    key={gift.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm shadow-accent/5"
                  >
                    <div className="border-b border-accent-mid/20 p-5 sm:p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-accent-light/70">
                          {gift.image_url ? (
                            <img src={gift.image_url} alt={gift.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 12v10H4V12M2 7h20v5H2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-serif text-2xl leading-tight text-forest">{gift.name}</h3>
                          </div>
                          {gift.description && (
                            <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-500">{gift.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          onClick={() => setEditGift(gift)}
                          className="inline-flex items-center gap-2 rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                  {copy.admin.actions.edit}
                        </button>

                        {deleteId === gift.id ? (
                          <>
                            <button
                              onClick={handleDelete}
                              disabled={deleting}
                              className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                            >
                              {deleting ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}
                            </button>
                            <button
                              onClick={() => setDeleteId(null)}
                              className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                            >
                              {copy.admin.actions.cancel}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteId(gift.id)}
                            className="rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-100"
                          >
                            {copy.admin.actions.delete}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 p-5 sm:grid-cols-[1.2fr_0.9fr] sm:p-6">
                      <div>
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">{copy.admin.giftCard.progress}</p>
                            <p className="mt-2 text-3xl font-semibold text-forest">{Math.round(pct)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">{copy.admin.giftCard.contributed}</p>
                            <p className="mt-2 text-lg font-medium text-gray-700">{formatCurrency(gift.total_contributed)}</p>
                          </div>
                        </div>

                        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-accent-light">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--color-accent), var(--color-forest))' }}
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500">
                          <span className="rounded-full bg-gray-50 px-3 py-2">{copy.admin.giftCard.meta} {formatCurrency(gift.price)}</span>
                          <span className="rounded-full bg-gray-50 px-3 py-2">{copy.admin.giftCard.remaining} {formatCurrency(remaining)}</span>
                          <span className="rounded-full bg-gray-50 px-3 py-2">{gift.contributions.length} {copy.admin.giftCard.contributions}</span>
                        </div>
                      </div>

                      <div className="rounded-3xl bg-accent-light/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-dark/70">{copy.admin.giftCard.status}</p>
                        <p className="mt-2 font-serif text-2xl text-forest">
                          {pct >= 100 ? copy.admin.giftCard.complete : pct >= 50 ? copy.admin.giftCard.halfway : copy.admin.giftCard.starting}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-accent-dark/80">
                          {pct >= 100
                            ? copy.admin.giftCard.completeDescription
                            : copy.admin.giftCard.startingDescription(formatCurrency(remaining))}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}

              {gifts.length === 0 && (
                <div className="col-span-full rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">
                  {copy.admin.giftCard.empty}
                </div>
              )}
            </div>
          ) : tab === 'contributions' ? (
            <div className="space-y-5">
              {giftsWithContributions.map((gift) => {
                const pct = gift.price > 0 ? Math.min(100, (gift.total_contributed / gift.price) * 100) : 0

                return (
                  <motion.div
                    key={gift.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm shadow-accent/5"
                  >
                    <div className="flex flex-col gap-4 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-2xl text-forest">{gift.name}</h3>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-accent-light">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--color-accent), var(--color-forest))' }}
                              />
                            </div>
                            <span className="text-xs font-medium text-accent">{Math.round(pct)}%</span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {formatCurrency(gift.total_contributed)} / {formatCurrency(gift.price)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-3xl bg-accent-light/60 px-4 py-3 text-right">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-dark/70">{copy.admin.contributions.title}</p>
                        <p className="mt-2 text-2xl font-semibold text-forest">{gift.contributions.length}</p>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100/80">
                      {gift.contributions.map((c) => (
                        <div key={c.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                              <span className="text-xs font-medium text-accent">{c.contributor_name[0]?.toUpperCase()}</span>
                            </div>
                            {editContributionId === c.id ? (
                              <div className="min-w-0 space-y-2">
                                <input
                                  value={editContributionName}
                                  onChange={(e) => setEditContributionName(e.target.value)}
                                  className="w-full rounded-full border border-accent-mid/40 bg-accent-light/30 px-3 py-2 text-sm font-medium text-gray-700 outline-none transition-all focus:border-accent"
                                />
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-300">{formatDate(c.created_at)}</p>
                              </div>
                            ) : (
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-700">{c.contributor_name}</p>
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-300">{formatDate(c.created_at)}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            {editContributionId === c.id ? (
                              <>
                                <div className="relative">
                                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                                  <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={editContributionAmount}
                                    onChange={(e) => setEditContributionAmount(e.target.value)}
                                    className="no-spinner w-28 rounded-full border border-accent-mid/40 bg-accent-light/30 py-2 pl-7 pr-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-accent"
                                  />
                                </div>
                                <button
                                  onClick={() => handleSaveContribution(gift.id)}
                                  disabled={savingContribution || !editContributionName.trim() || Number(editContributionAmount) <= 0}
                                  className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                                >
                                  {savingContribution ? copy.admin.actions.loadingSave : copy.admin.actions.save}
                                </button>
                                <button
                                  onClick={handleCancelEditContribution}
                                  className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                                >
                                  {copy.admin.actions.cancel}
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white">
                                  {formatCurrency(Number(c.amount))}
                                </span>
                                <button
                                  onClick={() => handleStartEditContribution(c)}
                                  className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                                >
                                  {copy.admin.actions.edit}
                                </button>
                              </>
                            )}

                            {editContributionId !== c.id && deleteContributionId === c.id ? (
                              <>
                                <button
                                  onClick={() => handleDeleteContribution(gift.id)}
                                  disabled={deletingContribution}
                                  className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                                >
                                  {deletingContribution ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}
                                </button>
                                <button
                                  onClick={() => setDeleteContributionId(null)}
                                  className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                                >
                                  {copy.admin.actions.cancel}
                                </button>
                              </>
                            ) : editContributionId !== c.id ? (
                              <button
                                onClick={() => setDeleteContributionId(c.id)}
                                className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100"
                              >
                                {copy.admin.actions.delete}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )
              })}

              {giftsWithContributions.length === 0 && (
                <div className="rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">
                  {copy.admin.contributions.empty}
                </div>
              )}
            </div>
          ) : tab === 'alergias' ? (
            <div className="space-y-4">
              {alergias.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-3xl border border-accent-mid/40 bg-white shadow-sm shadow-accent/5"
                >
                  <div className="flex flex-col gap-4 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="min-w-0 flex-1">
                      {editAlergiaId === entry.id ? (
                        <div className="space-y-3">
                          <input
                            value={editAlergiaNome}
                            onChange={(e) => setEditAlergiaNome(e.target.value)}
                            className="w-full rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 outline-none transition-all focus:border-accent"
                          />
                          <p className="text-xs uppercase tracking-[0.18em] text-gray-300">{formatDate(entry.created_at)}</p>
                        </div>
                      ) : (
                        <>
                          <p className="font-serif text-2xl text-forest">{entry.nome}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-300">{formatDate(entry.created_at)}</p>
                        </>
                      )}
                    </div>

                    <div className="rounded-3xl bg-accent-light/60 px-4 py-3 text-right">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-dark/70">{copy.admin.allergies.restrictions}</p>
                      <p className="mt-2 text-2xl font-semibold text-forest">{entry.restricoes.length}</p>
                    </div>
                  </div>

                  <div className="px-5 py-5 sm:px-6">
                    {editAlergiaId === entry.id ? (
                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-400">{copy.admin.allergies.restrictions}</label>
                          <input
                            value={editAlergiaRestricoes}
                            onChange={(e) => setEditAlergiaRestricoes(e.target.value)}
                            placeholder={copy.admin.allergies.editPlaceholder}
                            className="w-full rounded-2xl border border-accent-mid/40 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-all focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-400">{copy.admin.allergies.notes}</label>
                          <textarea
                            value={editAlergiaNotas}
                            onChange={(e) => setEditAlergiaNotas(e.target.value)}
                            rows={3}
                            className="w-full resize-none rounded-2xl border border-accent-mid/40 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-all focus:border-accent"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleSaveAlergia}
                            disabled={savingAlergia || !editAlergiaNome.trim()}
                            className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                          >
                            {savingAlergia ? copy.admin.actions.loadingSave : copy.admin.actions.save}
                          </button>
                          <button
                            onClick={handleCancelEditAlergia}
                            className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                          >
                            {copy.admin.actions.cancel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {entry.restricoes.map((restricao) => (
                            <span
                              key={restricao}
                              className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark"
                            >
                              {restricao}
                            </span>
                          ))}
                        </div>
                        {entry.notas && (
                          <p className="mt-4 text-sm leading-6 text-gray-500">{entry.notas}</p>
                        )}
                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleStartEditAlergia(entry)}
                            className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                          >
                            {copy.admin.actions.edit}
                          </button>
                          {deleteAlergiaId === entry.id ? (
                            <>
                              <button
                                onClick={handleDeleteAlergia}
                                disabled={deletingAlergia}
                                className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                              >
                                {deletingAlergia ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}
                              </button>
                              <button
                                onClick={() => setDeleteAlergiaId(null)}
                                className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                              >
                                {copy.admin.actions.cancel}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteAlergiaId(entry.id)}
                              className="rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-100"
                            >
                              {copy.admin.actions.delete}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}

              {alergias.length === 0 && (
                <div className="rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">
                  {copy.admin.allergies.empty}
                </div>
              )}
            </div>
          ) : tab === 'boleias' ? (
            <div className="space-y-4">
              {boleias.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-3xl border border-accent-mid/40 bg-white shadow-sm shadow-accent/5"
                >
                  <div className="flex flex-col gap-4 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="min-w-0 flex-1">
                      {editBoleiaId === entry.id ? (
                        <div className="space-y-3">
                          <input
                            value={editBoleiaNome}
                            onChange={(e) => setEditBoleiaNome(e.target.value)}
                            className="w-full rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 outline-none transition-all focus:border-accent"
                          />
                          <div className="grid gap-3 sm:grid-cols-3">
                            <input
                              value={editBoleiaSentido}
                              onChange={(e) => setEditBoleiaSentido(e.target.value)}
                              placeholder={copy.admin.rides.editPlaceholder.route}
                              className="rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none transition-all focus:border-accent"
                            />
                            <input
                              value={editBoleiaTelefone}
                              onChange={(e) => setEditBoleiaTelefone(e.target.value)}
                              placeholder={copy.admin.rides.editPlaceholder.phone}
                              className="rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none transition-all focus:border-accent"
                            />
                            <input
                              type="number"
                              min="1"
                              value={editBoleiaLugares}
                              onChange={(e) => setEditBoleiaLugares(e.target.value)}
                              className="no-spinner rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none transition-all focus:border-accent"
                            />
                          </div>
                          <p className="text-xs uppercase tracking-[0.18em] text-gray-300">{formatDate(entry.created_at)}</p>
                        </div>
                      ) : (
                        <>
                          <p className="font-serif text-2xl text-forest">{entry.nome}</p>
                          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
                            <span>{entry.sentido}</span>
                            {entry.telefone && <span>{entry.telefone}</span>}
                            <span>{formatDate(entry.created_at)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="rounded-3xl bg-accent-light/60 px-4 py-3 text-right">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-dark/70">{copy.admin.rides.seats}</p>
                      <p className="mt-2 text-2xl font-semibold text-forest">{editBoleiaId === entry.id ? editBoleiaLugares || entry.lugares : entry.lugares}</p>
                    </div>
                  </div>

                  <div className="px-5 py-5 sm:px-6">
                    {editBoleiaId === entry.id ? (
                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-400">{copy.admin.rides.notes}</label>
                          <textarea
                            value={editBoleiaNotas}
                            onChange={(e) => setEditBoleiaNotas(e.target.value)}
                            rows={3}
                            className="w-full resize-none rounded-2xl border border-accent-mid/40 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-all focus:border-accent"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleSaveBoleia}
                            disabled={savingBoleia || !editBoleiaNome.trim() || !editBoleiaSentido.trim() || Number(editBoleiaLugares) < 1}
                            className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                          >
                            {savingBoleia ? copy.admin.actions.loadingSave : copy.admin.actions.save}
                          </button>
                          <button
                            onClick={handleCancelEditBoleia}
                            className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                          >
                            {copy.admin.actions.cancel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {entry.notas && (
                          <p className="text-sm leading-6 text-gray-500">{entry.notas}</p>
                        )}
                        <div className={`flex flex-wrap gap-2 ${entry.notas ? 'mt-5' : ''}`}>
                          <button
                            onClick={() => handleStartEditBoleia(entry)}
                            className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                          >
                            {copy.admin.actions.edit}
                          </button>
                          {deleteBoleiaId === entry.id ? (
                            <>
                              <button
                                onClick={handleDeleteBoleia}
                                disabled={deletingBoleia}
                                className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                              >
                                {deletingBoleia ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}
                              </button>
                              <button
                                onClick={() => setDeleteBoleiaId(null)}
                                className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                              >
                                {copy.admin.actions.cancel}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteBoleiaId(entry.id)}
                              className="rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-100"
                            >
                              {copy.admin.actions.delete}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}

              {boleias.length === 0 && (
                <div className="rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">
                  {copy.admin.rides.empty}
                </div>
              )}
            </div>

          ) : tab === 'conteudo' ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-accent-mid/20 overflow-hidden">
                <div className="bg-accent-light/60 px-4 py-2.5 border-b border-accent-mid/20">
                  <h4 className="text-xs font-semibold text-forest uppercase tracking-wide">Estrutura das paginas</h4>
                </div>
                <div className="divide-y divide-accent-mid/10">
                  <div className="px-4 py-4">
                    <p className="text-xs font-medium text-forest/70 mb-3">Home</p>
                    <div className="space-y-2">
                      {homeSectionOrder.map((sectionId, index) => (
                        <div key={sectionId} className="flex items-center justify-between gap-3 rounded-lg border border-accent-mid/20 bg-white px-3 py-2">
                          <span className="text-sm text-forest">{HOME_SECTION_LABELS[sectionId]}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateContent('layout.home_order', moveItem(homeSectionOrder, index, -1).join(','))}
                              disabled={index === 0}
                              className="rounded-md border border-accent-mid/30 px-2 py-1 text-xs text-forest disabled:opacity-30"
                            >
                              Subir
                            </button>
                            <button
                              type="button"
                              onClick={() => updateContent('layout.home_order', moveItem(homeSectionOrder, index, 1).join(','))}
                              disabled={index === homeSectionOrder.length - 1}
                              className="rounded-md border border-accent-mid/30 px-2 py-1 text-xs text-forest disabled:opacity-30"
                            >
                              Descer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="px-4 py-4">
                    <p className="text-xs font-medium text-forest/70 mb-3">Lista</p>
                    <div className="space-y-2">
                      {listaSectionOrder.map((sectionId, index) => (
                        <div key={sectionId} className="flex items-center justify-between gap-3 rounded-lg border border-accent-mid/20 bg-white px-3 py-2">
                          <span className="text-sm text-forest">{LISTA_SECTION_LABELS[sectionId]}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateContent('layout.lista_order', moveItem(listaSectionOrder, index, -1).join(','))}
                              disabled={index === 0}
                              className="rounded-md border border-accent-mid/30 px-2 py-1 text-xs text-forest disabled:opacity-30"
                            >
                              Subir
                            </button>
                            <button
                              type="button"
                              onClick={() => updateContent('layout.lista_order', moveItem(listaSectionOrder, index, 1).join(','))}
                              disabled={index === listaSectionOrder.length - 1}
                              className="rounded-md border border-accent-mid/30 px-2 py-1 text-xs text-forest disabled:opacity-30"
                            >
                              Descer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-forest">Conteúdo do site</h3>
                  <p className="text-sm text-forest/60 mt-0.5">Edita os textos e imagens do site</p>
                </div>
                <div className="flex items-center gap-3">
                  {saveError && (
                    <span className="text-xs text-red-500 max-w-[200px] truncate" title={saveError}>⚠ {saveError}</span>
                  )}
                  {!saveError && dirtyCount > 0 && (
                    <span className="text-xs text-forest/50">{dirtyCount} alterações</span>
                  )}
                  <button
                    type="button"
                    onClick={() => { clearSaveError(); saveAll() }}
                    disabled={dirtyCount === 0 || isSaving}
                    className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 hover:bg-accent/80 transition-colors"
                  >
                    {isSaving ? 'A guardar…' : 'Guardar tudo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditMode(!isEditMode); if (!isEditMode) navigate('/') }}
                    className={`text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${isEditMode ? 'bg-forest text-white border-forest' : 'border-accent/30 text-forest hover:bg-accent-light'}`}
                  >
                    {isEditMode ? '✓ Modo edição ativo' : '✎ Ativar edição visual'}
                  </button>
                </div>
              </div>

              {/* Content items grouped by section */}
              {(() => {
                // Group CONTENT_DEFAULTS by section
                const sections: Record<string, Array<{ key: string; def: typeof CONTENT_DEFAULTS[keyof typeof CONTENT_DEFAULTS] }>> = {}
                for (const [key, def] of Object.entries(CONTENT_DEFAULTS)) {
                  if (!sections[def.section]) sections[def.section] = []
                  sections[def.section].push({ key, def: def as typeof CONTENT_DEFAULTS[keyof typeof CONTENT_DEFAULTS] })
                }
                return Object.entries(sections).map(([section, items]) => (
                  <div key={section} className="rounded-xl border border-accent-mid/20 overflow-hidden">
                    <div className="bg-accent-light/60 px-4 py-2.5 border-b border-accent-mid/20">
                      <h4 className="text-xs font-semibold text-forest uppercase tracking-wide">{section}</h4>
                    </div>
                    <div className="divide-y divide-accent-mid/10">
                      {items.map(({ key, def }) => {
                        const currentValue = getContent(key, def.value)
                        return (
                          <div key={key} className="flex items-start gap-4 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <label className="block text-xs font-medium text-forest/70 mb-1">{def.label}</label>
                              {def.type === 'text' || def.type === 'url' ? (
                                <input
                                  type="text"
                                  value={currentValue}
                                  onChange={e => updateContent(key, e.target.value)}
                                  className="w-full text-sm border border-accent-mid/40 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-accent/40 bg-white"
                                />
                              ) : def.type === 'html' ? (
                                <textarea
                                  rows={3}
                                  value={currentValue}
                                  onChange={e => updateContent(key, e.target.value)}
                                  className="w-full text-sm border border-accent-mid/40 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-accent/40 bg-white resize-y"
                                />
                              ) : def.type === 'image' ? (
                                <div className="flex gap-2 items-center">
                                  {currentValue && (
                                    <img src={currentValue} alt="" className="h-10 w-10 rounded object-cover border border-accent-mid/20 shrink-0" />
                                  )}
                                  <input
                                    type="text"
                                    value={currentValue}
                                    onChange={e => updateContent(key, e.target.value)}
                                    placeholder="https://..."
                                    className="flex-1 text-sm border border-accent-mid/40 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-accent/40 bg-white"
                                  />
                                </div>
                              ) : null}
                            </div>
                            <span className={`mt-5 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                              def.type === 'image' ? 'bg-purple-100 text-purple-700' :
                              def.type === 'url' ? 'bg-blue-100 text-blue-700' :
                              'bg-accent-light text-forest'
                            }`}>{def.type}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              })()}
            </div>
          ) : null}
        </div>
      </section>

        <AnimatePresence {...presenceProps({})}>
          {(showAddModal || editGift) && (
            <GiftFormModal
              gift={editGift ?? undefined}
              onClose={() => { setShowAddModal(false); setEditGift(null) }}
              onSaved={handleSaved}
            />
          )}
        </AnimatePresence>
    </div>
  )
}

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, currentSession) => setSession(currentSession))

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const isAdmin = session?.user.id === ADMIN_USER_ID

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-accent-light/30">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(168,216,210,0.35),_transparent_40%),linear-gradient(180deg,_#f7fbfa_0%,_#eef6f4_48%,_#f8fbfb_100%)] p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/88 p-10 text-center shadow-[0_35px_80px_-35px_color-mix(in_srgb,var(--color-forest)_35%,transparent)] backdrop-blur"
        >
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent-dark/70">{copy.admin.forbidden.tag}</p>
          <p className="mt-3 font-serif text-4xl text-forest">{copy.admin.forbidden.title}</p>
          <p className="mt-4 text-sm leading-6 text-gray-500">
            {copy.admin.forbidden.description}
          </p>
          <button
            onClick={handleLogout}
            className="mt-8 w-full rounded-2xl bg-forest py-3.5 text-sm font-medium text-white transition-all hover:bg-accent-dark"
          >
            {copy.admin.forbidden.logout}
          </button>
        </motion.div>
      </div>
    )
  }

  return <AdminPanel onLogout={handleLogout} />
}
