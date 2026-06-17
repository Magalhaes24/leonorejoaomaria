import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { auth, db, storage, type Alergia, type Boleia, type Gift, type HoneymoonContribution, type Presenca } from '../lib/firebase'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { MOTION_EASE, motionProps, presenceProps } from '../lib/motion'
import { copy } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { useEditor } from '../components/editor'
import { CONTENT_DEFAULTS } from '../lib/siteContent'

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

interface PresencaRow extends Presenca {
  id: string
  created_at: string
}

interface HoneymoonRow extends HoneymoonContribution {
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

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function fuzzyMatch(query: string, target: string): boolean {
  const q = normalizeStr(query)
  const t = normalizeStr(target)
  if (!q) return true
  if (t.includes(q)) return true
  // check each word in target against each word in query
  const qWords = q.split(/\s+/)
  const tWords = t.split(/\s+/)
  return qWords.every((qw) =>
    tWords.some((tw) => {
      if (tw.includes(qw) || qw.includes(tw)) return true
      const maxLen = Math.max(qw.length, tw.length)
      const threshold = maxLen <= 4 ? 1 : maxLen <= 7 ? 2 : 3
      return levenshtein(qw, tw) <= threshold
    })
  )
}

function exportCsv(filename: string, rows: string[][], headers: string[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  const blob = new Blob(['﻿', lines], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Exportar CSV"
      className="flex items-center gap-1.5 rounded-xl border border-accent-mid/40 bg-white px-3 py-2 text-xs font-medium text-accent-dark transition-colors hover:border-accent hover:text-forest"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span className="hidden sm:inline">Exportar</span>
    </button>
  )
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

const HOME_SECTION_LABELS: Record<string, string> = {
  countdown: 'Contagem',
  ceremony: 'Cerimonia',
  cocktail: 'Cocktail',
  list: 'Lista',
  info: 'Transportes e alergias',
  presenca: 'Confirmação de presença',
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

const uploadGiftImage = async (file: File): Promise<string> => {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `gifts/${Date.now()}.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
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
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch {
      setError(copy.admin.login.invalidCredentials)
    }
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
  const [imageSource, setImageSource] = useState<'url' | 'upload'>('url')
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
      const url = await uploadGiftImage(file)
      setImageUrl(url)
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

    try {
      let savedGift: Gift
      if (isEdit) {
        await updateDoc(doc(db, 'gifts', gift.id), data)
        savedGift = { ...gift, ...data }
      } else {
        const docRef = await addDoc(collection(db, 'gifts'), { ...data, created_at: serverTimestamp() })
        savedGift = { id: docRef.id, ...data, created_at: new Date().toISOString() } as Gift
      }
      onSaved([savedGift])
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar.')
      setLoading(false)
    }
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

    try {
      const savedGifts: Gift[] = []
      for (const row of csvRows) {
        const docRef = await addDoc(collection(db, 'gifts'), { ...row, created_at: serverTimestamp() })
        savedGifts.push({ id: docRef.id, ...row, created_at: new Date().toISOString() } as Gift)
      }
      setLoading(false)
      onSaved(savedGifts)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao importar.')
      setLoading(false)
    }
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
                    setImageUrl('')
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
                value={imageUrl}
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
  const [tab, setTab] = useState<'gifts' | 'contributions' | 'alergias' | 'boleias' | 'presencas' | 'conteudo'>('gifts')
  const homeSectionOrder = parseOrderedIds(getContent('layout.home_order', 'countdown,ceremony,cocktail,list,info,presenca'), ['countdown', 'ceremony', 'cocktail', 'list', 'info', 'presenca'])
  const listaSectionOrder = parseOrderedIds(getContent('layout.lista_order', 'gifts,honeymoon'), ['gifts', 'honeymoon'])
  const [gifts, setGifts] = useState<GiftRow[]>([])
  const [alergias, setAlergias] = useState<AlergiaRow[]>([])
  const [boleias, setBoleias] = useState<BoleiaRow[]>([])
  const [presencas, setPresencas] = useState<PresencaRow[]>([])
  const [honeymoonContribs, setHoneymoonContribs] = useState<HoneymoonRow[]>([])
  const [contributionsSubTab, setContributionsSubTab] = useState<'presentes' | 'luademel'>('presentes')
  const [presentesView, setPresentesView] = useState<'cards' | 'tabela' | 'grupos'>('grupos')
  const [honeymoonView, setHoneymoonView] = useState<'cards' | 'tabela' | 'grupos'>('tabela')
  const [honeymoonCols, setHoneymoonCols] = useState<1 | 3 | 6>(3)
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
  const [deletePresencaId, setDeletePresencaId] = useState<string | null>(null)
  const [deletingPresenca, setDeletingPresenca] = useState(false)
  const [editPresencaId, setEditPresencaId] = useState<string | null>(null)
  const [editPresencaNome, setEditPresencaNome] = useState('')
  const [editPresencaOpcao, setEditPresencaOpcao] = useState<'tudo' | 'missa' | 'festa' | 'nao'>('tudo')
  const [savingPresenca, setSavingPresenca] = useState(false)
  const [presencasSearch, setPresencasSearch] = useState('')
  const [presencasView, setPresencasView] = useState<'cards' | 'tabela' | 'grupos'>('cards')
  const [presencasCols, setPresencasCols] = useState<1 | 3 | 6>(3)
  const [boleiasView, setBoleiasView] = useState<'cards' | 'tabela' | 'grupos'>('cards')
  const [boleiasCols, setBoleiasCols] = useState<1 | 3 | 6>(3)
  const [alergiasView, setAlergiasView] = useState<'cards' | 'tabela' | 'grupos'>('cards')
  const [alergiasViewCols, setAlergiasViewCols] = useState<1 | 3 | 6>(3)
  const [actionError, setActionError] = useState('')

  const loadData = async (showLoader = false) => {
    if (showLoader) setLoading(true)

    try {
      const [giftsSnap, contribsSnap, alergiasSnap, boleiasSnap, presencasSnap, honeymoonSnap] = await Promise.all([
        getDocs(query(collection(db, 'gifts'), orderBy('created_at', 'desc'))),
        getDocs(query(collection(db, 'gift_contributions'), orderBy('created_at', 'desc'))),
        getDocs(query(collection(db, 'alergias'), orderBy('created_at', 'desc'))),
        getDocs(query(collection(db, 'boleias'), orderBy('created_at', 'desc'))),
        getDocs(query(collection(db, 'presencas'), orderBy('created_at', 'desc'))),
        getDocs(query(collection(db, 'honeymoon_contributions'), orderBy('created_at', 'desc'))),
      ])

      const contribs = contribsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ContribRow))
      const rows: GiftRow[] = giftsSnap.docs.map((d) => {
        const g = { id: d.id, ...d.data() } as Gift
        const giftContribs = contribs.filter((c) => c.gift_id === g.id)
        return {
          ...g,
          total_contributed: giftContribs.reduce((sum, c) => sum + Number(c.amount), 0),
          contributions: giftContribs,
        }
      })
      setGifts(rows)
      setAlergias(alergiasSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AlergiaRow)))
      setBoleias(boleiasSnap.docs.map((d) => ({ id: d.id, ...d.data() } as BoleiaRow)))
      setPresencas(presencasSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PresencaRow)))
      setHoneymoonContribs(honeymoonSnap.docs.map((d) => ({ id: d.id, ...d.data() } as HoneymoonRow)))
    } catch {
      // silently fail
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
    try {
      await deleteDoc(doc(db, 'gifts', currentDeleteId))
      setGifts((prev) => prev.filter((g) => g.id !== currentDeleteId))
      setDeleteId(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao eliminar.')
    }
    setDeleting(false)
  }

  const handleDeleteContribution = async (giftId: string) => {
    if (!deleteContributionId) return
    setDeletingContribution(true)
    setActionError('')
    const currentDeleteId = deleteContributionId
    try {
      await deleteDoc(doc(db, 'gift_contributions', currentDeleteId))
      setGifts((prev) =>
        prev.map((gift) => {
          if (gift.id !== giftId) return gift
          const contributions = gift.contributions.filter((c) => c.id !== currentDeleteId)
          return { ...gift, contributions, total_contributed: contributions.reduce((s, c) => s + Number(c.amount), 0) }
        }),
      )
      setDeleteContributionId(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao eliminar.')
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

    try {
      await updateDoc(doc(db, 'gift_contributions', editContributionId), {
        contributor_name: updatedName,
        amount: updatedAmount,
      })
      setGifts((prev) =>
        prev.map((gift) => {
          if (gift.id !== giftId) return gift
          const contributions = gift.contributions.map((c) =>
            c.id === editContributionId ? { ...c, contributor_name: updatedName, amount: updatedAmount } : c,
          )
          return { ...gift, contributions, total_contributed: contributions.reduce((s, c) => s + Number(c.amount), 0) }
        }),
      )
      handleCancelEditContribution()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao guardar.')
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

    try {
      await updateDoc(doc(db, 'alergias', editAlergiaId), { nome: updatedNome, restricoes, notas: updatedNotas })
      setAlergias((prev) =>
        prev.map((entry) =>
          entry.id === editAlergiaId ? { ...entry, nome: updatedNome, restricoes, notas: updatedNotas } : entry,
        ),
      )
      handleCancelEditAlergia()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao guardar.')
    }

    setSavingAlergia(false)
  }

  const handleDeleteAlergia = async () => {
    if (!deleteAlergiaId) return
    setDeletingAlergia(true)
    setActionError('')
    const currentDeleteId = deleteAlergiaId
    try {
      await deleteDoc(doc(db, 'alergias', currentDeleteId))
      setAlergias((prev) => prev.filter((entry) => entry.id !== currentDeleteId))
      setDeleteAlergiaId(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao eliminar.')
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

    try {
      await updateDoc(doc(db, 'boleias', editBoleiaId), {
        nome: updatedNome,
        telefone: updatedTelefone,
        lugares: updatedLugares,
        sentido: updatedSentido,
        notas: updatedNotas,
      })
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
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao guardar.')
    }

    setSavingBoleia(false)
  }

  const handleDeleteBoleia = async () => {
    if (!deleteBoleiaId) return
    setDeletingBoleia(true)
    setActionError('')
    const currentDeleteId = deleteBoleiaId
    try {
      await deleteDoc(doc(db, 'boleias', currentDeleteId))
      setBoleias((prev) => prev.filter((entry) => entry.id !== currentDeleteId))
      setDeleteBoleiaId(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao eliminar.')
    }
    setDeletingBoleia(false)
  }

  const handleStartEditPresenca = (entry: PresencaRow) => {
    setDeletePresencaId(null)
    setEditPresencaId(entry.id)
    setEditPresencaNome(entry.nome)
    setEditPresencaOpcao(entry.presenca)
  }

  const handleCancelEditPresenca = () => {
    setEditPresencaId(null)
    setEditPresencaNome('')
    setEditPresencaOpcao('tudo')
  }

  const handleSavePresenca = async () => {
    if (!editPresencaId || !editPresencaNome.trim()) return

    setSavingPresenca(true)
    setActionError('')
    const updatedNome = editPresencaNome.trim()

    try {
      await updateDoc(doc(db, 'presencas', editPresencaId), {
        nome: updatedNome,
        presenca: editPresencaOpcao,
      })
      setPresencas((prev) =>
        prev.map((entry) =>
          entry.id === editPresencaId
            ? { ...entry, nome: updatedNome, presenca: editPresencaOpcao }
            : entry,
        ),
      )
      handleCancelEditPresenca()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao guardar.')
    }

    setSavingPresenca(false)
  }

  const handleDeletePresenca = async () => {
    if (!deletePresencaId) return
    setDeletingPresenca(true)
    setActionError('')
    const currentDeleteId = deletePresencaId
    try {
      await deleteDoc(doc(db, 'presencas', currentDeleteId))
      setPresencas((prev) => prev.filter((entry) => entry.id !== currentDeleteId))
      setDeletePresencaId(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erro ao eliminar.')
    }
    setDeletingPresenca(false)
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
              {(['gifts', 'contributions', 'alergias', 'boleias', 'presencas'] as const).map((currentTab) => {
                const active = tab === currentTab
                const label = currentTab === 'gifts'
                  ? copy.admin.tabs.gifts(gifts.length)
                  : currentTab === 'contributions'
                    ? copy.admin.tabs.contributions(totalContributions)
                    : currentTab === 'alergias'
                      ? copy.admin.tabs.alergias(alergias.length)
                      : currentTab === 'presencas'
                        ? copy.admin.tabs.presencas(presencas.length)
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
            (() => {
              const totalHoneymoon = honeymoonContribs.reduce((s, c) => s + Number(c.amount), 0)
              // flat list of all gift contributions for tabela/grupos views
              const allContribs = giftsWithContributions.flatMap((g) =>
                g.contributions.map((c) => ({ ...c, giftName: g.name, giftPrice: g.price }))
              )
              const handleExportPresentes = () => exportCsv('contribuicoes-presentes', allContribs.map((c) => [
                c.contributor_name, c.giftName, String(Number(c.amount)), c.created_at ? formatDate(c.created_at) : '',
              ]), ['Nome', 'Presente', 'Valor (€)', 'Data'])
              const handleExportLuaMel = () => exportCsv('contribuicoes-lua-de-mel', honeymoonContribs.map((c) => [
                c.contributor_name, String(Number(c.amount)), c.message ?? '', c.created_at ? formatDate(c.created_at) : '',
              ]), ['Nome', 'Valor (€)', 'Mensagem', 'Data'])

              const ViewToggle = ({ view, setView, showCols, cols, setCols }: {
                view: string; setView: (v: 'cards' | 'tabela' | 'grupos') => void
                showCols?: boolean; cols?: number; setCols?: (n: 1 | 3 | 6) => void
              }) => (
                <div className="flex items-center gap-2 self-start">
                  {showCols && cols !== undefined && setCols && (
                    <div className="flex gap-1 rounded-2xl border border-accent-mid/30 bg-white p-1">
                      {([1, 3, 6] as const).map((n) => (
                        <button key={n} type="button" onClick={() => setCols(n)}
                          className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${cols === n ? 'bg-forest text-white shadow-sm' : 'text-gray-400 hover:text-forest'}`}>{n}</button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1 rounded-2xl border border-accent-mid/30 bg-white p-1">
                    {([
                      { key: 'cards', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>, label: 'Cards' },
                      { key: 'tabela', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor" opacity=".4"/><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="11" width="14" height="2" rx="1" fill="currentColor"/></svg>, label: 'Tabela' },
                      { key: 'grupos', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="7" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity=".5"/><rect x="1" y="13" width="8" height="2" rx="1" fill="currentColor" opacity=".3"/></svg>, label: 'Grupos' },
                    ] as { key: 'cards' | 'tabela' | 'grupos'; icon: React.ReactNode; label: string }[]).map(({ key, icon, label }) => (
                      <button key={key} type="button" onClick={() => setView(key)} title={label}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${view === key ? 'bg-forest text-white shadow-sm' : 'text-gray-400 hover:text-forest'}`}>
                        {icon}<span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )

              const ContribRow = ({ c, giftId, giftName }: { c: ContribRow; giftId: string; giftName?: string }) => (
                <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
                      <span className="text-xs font-medium text-accent">{c.contributor_name[0]?.toUpperCase()}</span>
                    </div>
                    {editContributionId === c.id ? (
                      <div className="min-w-0 space-y-2">
                        <input value={editContributionName} onChange={(e) => setEditContributionName(e.target.value)}
                          className="w-full rounded-full border border-accent-mid/40 bg-accent-light/30 px-3 py-2 text-sm font-medium text-gray-700 outline-none transition-all focus:border-accent" />
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-300">{formatDate(c.created_at)}</p>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-700">{c.contributor_name}</p>
                        {giftName && <p className="text-xs text-gray-400">{giftName}</p>}
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-300">{formatDate(c.created_at)}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {editContributionId === c.id ? (
                      <>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                          <input type="number" min="1" step="0.01" value={editContributionAmount} onChange={(e) => setEditContributionAmount(e.target.value)}
                            className="no-spinner w-28 rounded-full border border-accent-mid/40 bg-accent-light/30 py-2 pl-7 pr-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-accent" />
                        </div>
                        <button onClick={() => handleSaveContribution(giftId)} disabled={savingContribution || !editContributionName.trim() || Number(editContributionAmount) <= 0}
                          className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50">
                          {savingContribution ? copy.admin.actions.loadingSave : copy.admin.actions.save}
                        </button>
                        <button onClick={handleCancelEditContribution} className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                          {copy.admin.actions.cancel}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white">{formatCurrency(Number(c.amount))}</span>
                        <button onClick={() => handleStartEditContribution(c)} className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">{copy.admin.actions.edit}</button>
                      </>
                    )}
                    {editContributionId !== c.id && deleteContributionId === c.id ? (
                      <>
                        <button onClick={() => handleDeleteContribution(giftId)} disabled={deletingContribution} className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50">
                          {deletingContribution ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}
                        </button>
                        <button onClick={() => setDeleteContributionId(null)} className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">{copy.admin.actions.cancel}</button>
                      </>
                    ) : editContributionId !== c.id ? (
                      <button onClick={() => setDeleteContributionId(c.id)} className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100">{copy.admin.actions.delete}</button>
                    ) : null}
                  </div>
                </div>
              )

              return (
                <div className="space-y-5">
                  {/* Sub-tabs */}
                  <div className="flex gap-2">
                    {([
                      { key: 'presentes', label: `Presentes (${totalContributions})` },
                      { key: 'luademel', label: `Lua de mel (${honeymoonContribs.length})` },
                    ] as { key: 'presentes' | 'luademel'; label: string }[]).map(({ key, label }) => (
                      <button key={key} type="button" onClick={() => setContributionsSubTab(key)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${contributionsSubTab === key ? 'bg-forest text-white shadow-sm' : 'border border-accent-mid/40 bg-white text-gray-500 hover:border-accent hover:text-forest'}`}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* ── Presentes ── */}
                  {contributionsSubTab === 'presentes' && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-3">
                          <div className="rounded-2xl border border-accent-mid/30 bg-white px-4 py-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent-dark/70">Total angariado</p>
                            <p className="mt-1 font-serif text-2xl text-forest">{formatCurrency(totalContributed)}</p>
                          </div>
                          <div className="rounded-2xl border border-accent-mid/30 bg-accent-light/40 px-4 py-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent-dark/70">Contribuições</p>
                            <p className="mt-1 font-serif text-2xl text-forest">{totalContributions}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ViewToggle view={presentesView} setView={setPresentesView} />
                          <ExportButton onClick={handleExportPresentes} />
                        </div>
                      </div>

                      {/* Cards: grouped by gift (existing style) */}
                      {presentesView === 'cards' && (
                        <div className="space-y-4">
                          {giftsWithContributions.map((gift) => {
                            const pct = gift.price > 0 ? Math.min(100, (gift.total_contributed / gift.price) * 100) : 0
                            return (
                              <motion.div key={gift.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm shadow-accent/5">
                                <div className="flex flex-col gap-4 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                  <div className="min-w-0 flex-1">
                                    <h3 className="font-serif text-2xl text-forest">{gift.name}</h3>
                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                      <div className="flex items-center gap-3">
                                        <div className="h-2 w-28 overflow-hidden rounded-full bg-accent-light">
                                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--color-accent), var(--color-forest))' }} />
                                        </div>
                                        <span className="text-xs font-medium text-accent">{Math.round(pct)}%</span>
                                      </div>
                                      <span className="text-sm text-gray-500">{formatCurrency(gift.total_contributed)} / {formatCurrency(gift.price)}</span>
                                    </div>
                                  </div>
                                  <div className="rounded-2xl bg-accent-light/60 px-4 py-2.5 text-right">
                                    <p className="text-[11px] uppercase tracking-[0.22em] text-accent-dark/70">{copy.admin.contributions.title}</p>
                                    <p className="mt-1 text-2xl font-semibold text-forest">{gift.contributions.length}</p>
                                  </div>
                                </div>
                                <div className="divide-y divide-gray-100/80">
                                  {gift.contributions.map((c) => <ContribRow key={c.id} c={c} giftId={gift.id} />)}
                                </div>
                              </motion.div>
                            )
                          })}
                          {giftsWithContributions.length === 0 && (
                            <div className="rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">{copy.admin.contributions.empty}</div>
                          )}
                        </div>
                      )}

                      {/* Tabela: flat table of all contributions */}
                      {presentesView === 'tabela' && (
                        <div className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm">
                          {allContribs.length === 0 ? (
                            <p className="px-6 py-20 text-center text-sm text-gray-400">{copy.admin.contributions.empty}</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-accent-mid/20 bg-accent-light/30">
                                  <th className="px-5 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">Nome</th>
                                  <th className="hidden px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60 sm:table-cell">Presente</th>
                                  <th className="px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">Valor</th>
                                  <th className="hidden px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60 sm:table-cell">Data</th>
                                  <th className="px-4 py-3.5" />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-accent-mid/10">
                                {allContribs.map((c) => {
                                  const gift = giftsWithContributions.find((g) => g.id === c.gift_id)
                                  return (
                                    <>
                                      <tr key={c.id} className={`transition-colors hover:bg-accent-light/10 ${editContributionId === c.id ? 'bg-accent-light/20' : ''}`}>
                                        <td className="px-5 py-3.5 font-medium text-forest">{c.contributor_name}</td>
                                        <td className="hidden px-4 py-3.5 text-sm text-gray-500 sm:table-cell">{c.giftName}</td>
                                        <td className="px-4 py-3.5"><span className="rounded-full bg-forest px-2.5 py-1 text-xs font-medium text-white">{formatCurrency(Number(c.amount))}</span></td>
                                        <td className="hidden px-4 py-3.5 text-xs text-gray-400 sm:table-cell">{formatDate(c.created_at)}</td>
                                        <td className="px-4 py-3.5">
                                          <div className="flex justify-end gap-1.5">
                                            <button onClick={() => editContributionId === c.id ? handleCancelEditContribution() : handleStartEditContribution(c)}
                                              className="rounded-lg bg-accent-light px-2.5 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                                              {editContributionId === c.id ? copy.admin.actions.cancel : copy.admin.actions.edit}
                                            </button>
                                            {deleteContributionId === c.id ? (
                                              <><button onClick={() => gift && handleDeleteContribution(gift.id)} disabled={deletingContribution} className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50">{deletingContribution ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}</button><button onClick={() => setDeleteContributionId(null)} className="rounded-lg bg-accent-light px-2.5 py-1.5 text-xs font-medium text-accent-dark hover:bg-accent-mid/30">{copy.admin.actions.cancel}</button></>
                                            ) : <button onClick={() => setDeleteContributionId(c.id)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100">{copy.admin.actions.delete}</button>}
                                          </div>
                                        </td>
                                      </tr>
                                      {editContributionId === c.id && gift && (
                                        <tr key={`${c.id}-edit`}><td colSpan={5} className="border-t border-accent-mid/20 bg-accent-light/10 p-0">
                                          <ContribRow c={c} giftId={gift.id} />
                                        </td></tr>
                                      )}
                                    </>
                                  )
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}

                      {/* Grupos: one block per gift */}
                      {presentesView === 'grupos' && (
                        <div className="space-y-4">
                          {giftsWithContributions.map((gift) => {
                            const pct = gift.price > 0 ? Math.min(100, (gift.total_contributed / gift.price) * 100) : 0
                            return (
                              <div key={gift.id} className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm">
                                <div className="flex items-center justify-between gap-4 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-4 sm:px-6">
                                  <div>
                                    <p className="font-serif text-xl text-forest">{gift.name}</p>
                                    <div className="mt-2 flex items-center gap-3">
                                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-accent-light">
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--color-accent), var(--color-forest))' }} />
                                      </div>
                                      <span className="text-xs text-gray-500">{formatCurrency(gift.total_contributed)} / {formatCurrency(gift.price)}</span>
                                    </div>
                                  </div>
                                  <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark">{gift.contributions.length} contrib.</span>
                                </div>
                                {gift.contributions.length > 0 && (
                                  <ul className="divide-y divide-accent-mid/10">
                                    {gift.contributions.map((c) => (
                                      <li key={c.id}><ContribRow c={c} giftId={gift.id} /></li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )
                          })}
                          {giftsWithContributions.length === 0 && (
                            <div className="rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">{copy.admin.contributions.empty}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Lua de mel ── */}
                  {contributionsSubTab === 'luademel' && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-3">
                          <div className="rounded-2xl border border-accent-mid/30 bg-white px-4 py-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent-dark/70">Total angariado</p>
                            <p className="mt-1 font-serif text-2xl text-forest">{formatCurrency(totalHoneymoon)}</p>
                          </div>
                          <div className="rounded-2xl border border-accent-mid/30 bg-accent-light/40 px-4 py-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent-dark/70">Contribuições</p>
                            <p className="mt-1 font-serif text-2xl text-forest">{honeymoonContribs.length}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ViewToggle view={honeymoonView} setView={setHoneymoonView} showCols={honeymoonView === 'cards'} cols={honeymoonCols} setCols={setHoneymoonCols} />
                          <ExportButton onClick={handleExportLuaMel} />
                        </div>
                      </div>

                      {/* Cards */}
                      {honeymoonView === 'cards' && (
                        <div className={`grid gap-3 ${honeymoonCols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : honeymoonCols === 6 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-1'}`}>
                          {honeymoonContribs.map((c) => (
                            <motion.div key={c.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                              className="rounded-3xl border border-accent-mid/40 bg-white p-5 shadow-sm shadow-accent/5">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
                                  <span className="text-xs font-medium text-accent">{c.contributor_name[0]?.toUpperCase()}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-serif text-lg text-forest">{c.contributor_name}</p>
                                  <p className="text-xs uppercase tracking-[0.18em] text-gray-300">{formatDate(c.created_at)}</p>
                                </div>
                                <span className="rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white">{formatCurrency(Number(c.amount))}</span>
                              </div>
                              {c.message && <p className="text-sm leading-relaxed text-gray-500 italic">"{c.message}"</p>}
                            </motion.div>
                          ))}
                          {honeymoonContribs.length === 0 && (
                            <div className="col-span-full rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">Ainda não há contribuições para a lua de mel.</div>
                          )}
                        </div>
                      )}

                      {/* Tabela */}
                      {honeymoonView === 'tabela' && (
                        <div className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm">
                          {honeymoonContribs.length === 0 ? (
                            <p className="px-6 py-20 text-center text-sm text-gray-400">Ainda não há contribuições para a lua de mel.</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-accent-mid/20 bg-accent-light/30">
                                  <th className="px-5 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">Nome</th>
                                  <th className="px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">Valor</th>
                                  <th className="hidden px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60 sm:table-cell">Mensagem</th>
                                  <th className="hidden px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60 sm:table-cell">Data</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-accent-mid/10">
                                {honeymoonContribs.map((c) => (
                                  <tr key={c.id} className="transition-colors hover:bg-accent-light/10">
                                    <td className="px-5 py-3.5">
                                      <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                                          <span className="text-xs font-medium text-accent">{c.contributor_name[0]?.toUpperCase()}</span>
                                        </div>
                                        <span className="font-medium text-forest">{c.contributor_name}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5"><span className="rounded-full bg-forest px-3 py-1 text-xs font-medium text-white">{formatCurrency(Number(c.amount))}</span></td>
                                    <td className="hidden px-4 py-3.5 text-sm text-gray-500 sm:table-cell">{c.message ?? '—'}</td>
                                    <td className="hidden px-4 py-3.5 text-xs text-gray-400 sm:table-cell">{formatDate(c.created_at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}

                      {/* Grupos: com mensagem / sem mensagem */}
                      {honeymoonView === 'grupos' && (
                        <div className="space-y-5">
                          {([
                            { key: 'com', label: 'Com mensagem', items: honeymoonContribs.filter((c) => c.message) },
                            { key: 'sem', label: 'Sem mensagem', items: honeymoonContribs.filter((c) => !c.message) },
                          ] as { key: string; label: string; items: HoneymoonRow[] }[]).map(({ key, label, items }) => {
                            if (items.length === 0) return null
                            return (
                              <div key={key} className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm">
                                <div className="flex items-center gap-3 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-4">
                                  <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark">{label}</span>
                                  <span className="font-serif text-lg text-forest">{items.length}</span>
                                  <span className="ml-auto text-sm text-gray-500">{formatCurrency(items.reduce((s, c) => s + Number(c.amount), 0))}</span>
                                </div>
                                <ul className="divide-y divide-accent-mid/10">
                                  {items.map((c) => (
                                    <li key={c.id} className="px-5 py-3.5">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                                            <span className="text-xs font-medium text-accent">{c.contributor_name[0]?.toUpperCase()}</span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-forest">{c.contributor_name}</p>
                                            {c.message && <p className="mt-0.5 text-xs italic text-gray-400">"{c.message}"</p>}
                                          </div>
                                        </div>
                                        <span className="rounded-full bg-forest px-3 py-1 text-xs font-medium text-white">{formatCurrency(Number(c.amount))}</span>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )
                          })}
                          {honeymoonContribs.length === 0 && (
                            <div className="rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">Ainda não há contribuições para a lua de mel.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()
          ) : tab === 'alergias' ? (
            (() => {
              // collect all unique restriction types
              const allRestricoes = [...new Set(alergias.flatMap((a) => a.restricoes))].sort()
              const handleExportAlergias = () => exportCsv('alergias', alergias.map((a) => [
                a.nome, a.restricoes.join('; '), a.notas ?? '', a.created_at ? formatDate(a.created_at) : '',
              ]), ['Nome', 'Restrições', 'Notas', 'Data'])

              const AlergiaEditForm = (_: { entry: AlergiaRow }) => (
                <div className="space-y-4 p-5">
                  <input value={editAlergiaNome} onChange={(e) => setEditAlergiaNome(e.target.value)}
                    className="w-full rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 outline-none transition-all focus:border-accent" />
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-400">{copy.admin.allergies.restrictions}</label>
                    <input value={editAlergiaRestricoes} onChange={(e) => setEditAlergiaRestricoes(e.target.value)}
                      placeholder={copy.admin.allergies.editPlaceholder}
                      className="w-full rounded-2xl border border-accent-mid/40 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-all focus:border-accent" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-400">{copy.admin.allergies.notes}</label>
                    <textarea value={editAlergiaNotas} onChange={(e) => setEditAlergiaNotas(e.target.value)} rows={3}
                      className="w-full resize-none rounded-2xl border border-accent-mid/40 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-all focus:border-accent" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleSaveAlergia} disabled={savingAlergia || !editAlergiaNome.trim()}
                      className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50">
                      {savingAlergia ? copy.admin.actions.loadingSave : copy.admin.actions.save}
                    </button>
                    <button onClick={handleCancelEditAlergia}
                      className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                      {copy.admin.actions.cancel}
                    </button>
                  </div>
                </div>
              )

              const AlergiaActions = ({ entry }: { entry: AlergiaRow }) => (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleStartEditAlergia(entry)}
                    className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                    {copy.admin.actions.edit}
                  </button>
                  {deleteAlergiaId === entry.id ? (
                    <>
                      <button onClick={handleDeleteAlergia} disabled={deletingAlergia}
                        className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50">
                        {deletingAlergia ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}
                      </button>
                      <button onClick={() => setDeleteAlergiaId(null)}
                        className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                        {copy.admin.actions.cancel}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteAlergiaId(entry.id)}
                      className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100">
                      {copy.admin.actions.delete}
                    </button>
                  )}
                </div>
              )

              return (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-3">
                      <div className="rounded-2xl border border-accent-mid/30 bg-white px-4 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent-dark/70">Total</p>
                        <p className="mt-1 font-serif text-2xl text-forest">{alergias.length}</p>
                      </div>
                      {allRestricoes.slice(0, 5).map((r) => (
                        <div key={r} className="rounded-2xl border border-accent-mid/30 bg-accent-light/40 px-4 py-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent-dark/70">{r}</p>
                          <p className="mt-1 font-serif text-2xl text-forest">{alergias.filter((a) => a.restricoes.includes(r)).length}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 self-start">
                      {alergiasView === 'cards' && (
                        <div className="flex gap-1 rounded-2xl border border-accent-mid/30 bg-white p-1">
                          {([1, 3, 6] as const).map((n) => (
                            <button key={n} type="button" onClick={() => setAlergiasViewCols(n)} title={`${n} por linha`}
                              className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${alergiasViewCols === n ? 'bg-forest text-white shadow-sm' : 'text-gray-400 hover:text-forest'}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1 rounded-2xl border border-accent-mid/30 bg-white p-1">
                        {([
                          { key: 'cards', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>, label: 'Cards' },
                          { key: 'tabela', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor" opacity=".4"/><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="11" width="14" height="2" rx="1" fill="currentColor"/></svg>, label: 'Tabela' },
                          { key: 'grupos', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="7" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity=".5"/><rect x="1" y="13" width="8" height="2" rx="1" fill="currentColor" opacity=".3"/></svg>, label: 'Grupos' },
                        ] as { key: 'cards' | 'tabela' | 'grupos'; icon: React.ReactNode; label: string }[]).map(({ key, icon, label }) => (
                          <button key={key} type="button" onClick={() => setAlergiasView(key)} title={label}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${alergiasView === key ? 'bg-forest text-white shadow-sm' : 'text-gray-400 hover:text-forest'}`}>
                            {icon}<span className="hidden sm:inline">{label}</span>
                          </button>
                        ))}
                      </div>
                      <ExportButton onClick={handleExportAlergias} />
                    </div>
                  </div>

                  {alergiasView === 'cards' && (
                    <div className={`grid gap-3 ${alergiasViewCols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : alergiasViewCols === 6 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-1'}`}>
                      {alergias.map((entry) => (
                        <motion.div key={entry.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          className="rounded-3xl border border-accent-mid/40 bg-white shadow-sm shadow-accent/5">
                          {alergiasViewCols === 1 ? (
                            <>
                              <div className="flex items-center justify-between gap-4 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-5 sm:px-6">
                                <div><p className="font-serif text-2xl text-forest">{entry.nome}</p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-300">{formatDate(entry.created_at)}</p></div>
                                <div className="rounded-2xl bg-accent-light/60 px-4 py-2.5 text-right">
                                  <p className="text-[11px] uppercase tracking-[0.22em] text-accent-dark/70">{copy.admin.allergies.restrictions}</p>
                                  <p className="mt-1 text-2xl font-semibold text-forest">{entry.restricoes.length}</p>
                                </div>
                              </div>
                              {editAlergiaId === entry.id ? <AlergiaEditForm entry={entry} /> : (
                                <div className="px-5 py-4 sm:px-6">
                                  <div className="flex flex-wrap gap-2 mb-4">
                                    {entry.restricoes.map((r) => <span key={r} className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark">{r}</span>)}
                                  </div>
                                  {entry.notas && <p className="mb-4 text-sm leading-6 text-gray-500">{entry.notas}</p>}
                                  <AlergiaActions entry={entry} />
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col gap-2 p-4">
                              <p className={`font-serif text-forest leading-tight ${alergiasViewCols === 6 ? 'text-base' : 'text-lg'}`}>{entry.nome}</p>
                              <div className="flex flex-wrap gap-1">
                                {entry.restricoes.map((r) => <span key={r} className="rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-medium text-accent-dark">{r}</span>)}
                              </div>
                              <div className="mt-1 flex gap-1.5">
                                <button onClick={() => editAlergiaId === entry.id ? handleCancelEditAlergia() : handleStartEditAlergia(entry)}
                                  className="rounded-lg bg-accent-light px-2 py-1 text-[11px] font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                                  {editAlergiaId === entry.id ? copy.admin.actions.cancel : copy.admin.actions.edit}
                                </button>
                                {deleteAlergiaId === entry.id ? (
                                  <>
                                    <button onClick={handleDeleteAlergia} disabled={deletingAlergia} className="rounded-lg bg-red-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-600 disabled:opacity-50">{deletingAlergia ? '…' : copy.admin.actions.confirm}</button>
                                    <button onClick={() => setDeleteAlergiaId(null)} className="rounded-lg bg-accent-light px-2 py-1 text-[11px] font-medium text-accent-dark hover:bg-accent-mid/30">{copy.admin.actions.cancel}</button>
                                  </>
                                ) : (
                                  <button onClick={() => setDeleteAlergiaId(entry.id)} className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-100">{copy.admin.actions.delete}</button>
                                )}
                              </div>
                              {editAlergiaId === entry.id && <AlergiaEditForm entry={entry} />}
                            </div>
                          )}
                        </motion.div>
                      ))}
                      {alergias.length === 0 && <div className="col-span-full rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">{copy.admin.allergies.empty}</div>}
                    </div>
                  )}

                  {alergiasView === 'tabela' && (
                    <div className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm">
                      {alergias.length === 0 ? <p className="px-6 py-20 text-center text-sm text-gray-400">{copy.admin.allergies.empty}</p> : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-accent-mid/20 bg-accent-light/30">
                              <th className="px-5 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">Nome</th>
                              <th className="px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">{copy.admin.allergies.restrictions}</th>
                              <th className="hidden px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60 sm:table-cell">{copy.admin.allergies.notes}</th>
                              <th className="px-4 py-3.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-accent-mid/10">
                            {alergias.map((entry) => (
                              <>
                                <tr key={entry.id} className={`transition-colors hover:bg-accent-light/10 ${editAlergiaId === entry.id ? 'bg-accent-light/20' : ''}`}>
                                  <td className="px-5 py-3.5 font-medium text-forest">{entry.nome}</td>
                                  <td className="px-4 py-3.5"><div className="flex flex-wrap gap-1">{entry.restricoes.map((r) => <span key={r} className="rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-medium text-accent-dark">{r}</span>)}</div></td>
                                  <td className="hidden px-4 py-3.5 text-xs text-gray-400 sm:table-cell">{entry.notas ?? '—'}</td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex justify-end gap-1.5">
                                      <button onClick={() => editAlergiaId === entry.id ? handleCancelEditAlergia() : handleStartEditAlergia(entry)} className="rounded-lg bg-accent-light px-2.5 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">{editAlergiaId === entry.id ? copy.admin.actions.cancel : copy.admin.actions.edit}</button>
                                      {deleteAlergiaId === entry.id ? (
                                        <><button onClick={handleDeleteAlergia} disabled={deletingAlergia} className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50">{deletingAlergia ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}</button><button onClick={() => setDeleteAlergiaId(null)} className="rounded-lg bg-accent-light px-2.5 py-1.5 text-xs font-medium text-accent-dark hover:bg-accent-mid/30">{copy.admin.actions.cancel}</button></>
                                      ) : <button onClick={() => setDeleteAlergiaId(entry.id)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100">{copy.admin.actions.delete}</button>}
                                    </div>
                                  </td>
                                </tr>
                                {editAlergiaId === entry.id && <tr key={`${entry.id}-edit`}><td colSpan={4} className="border-t border-accent-mid/20 bg-accent-light/10 p-0"><AlergiaEditForm entry={entry} /></td></tr>}
                              </>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {alergiasView === 'grupos' && (
                    <div className="space-y-5">
                      {allRestricoes.length === 0 ? (
                        <div className="rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">{copy.admin.allergies.empty}</div>
                      ) : allRestricoes.map((restricao) => {
                        const grupo = alergias.filter((a) => a.restricoes.includes(restricao))
                        return (
                          <div key={restricao} className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm">
                            <div className="flex items-center gap-3 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-4">
                              <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark">{restricao}</span>
                              <span className="font-serif text-lg text-forest">{grupo.length}</span>
                            </div>
                            <ul className="divide-y divide-accent-mid/10">
                              {grupo.map((entry) => (
                                <li key={entry.id}>
                                  {editAlergiaId === entry.id ? <AlergiaEditForm entry={entry} /> : (
                                    <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <p className="font-medium text-forest">{entry.nome}</p>
                                        {entry.restricoes.length > 1 && <div className="mt-1 flex flex-wrap gap-1">{entry.restricoes.filter((r) => r !== restricao).map((r) => <span key={r} className="text-xs text-gray-400">{r}</span>)}</div>}
                                      </div>
                                      <AlergiaActions entry={entry} />
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()

          ) : tab === 'boleias' ? (
            (() => {
              const totalLugares = boleias.reduce((s, b) => s + Number(b.lugares ?? 0), 0)
              const sentidos = [...new Set(boleias.map((b) => b.sentido))].sort()
              const handleExportBoleias = () => exportCsv('boleias', boleias.map((b) => [
                b.nome, b.sentido, String(b.lugares), b.telefone ?? '', b.notas ?? '', b.created_at ? formatDate(b.created_at) : '',
              ]), ['Nome', 'Sentido', 'Lugares', 'Telemóvel', 'Notas', 'Data'])

              const BoleiaEditForm = (_: { entry: BoleiaRow }) => (
                <div className="space-y-4 p-5">
                  <input value={editBoleiaNome} onChange={(e) => setEditBoleiaNome(e.target.value)}
                    className="w-full rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 outline-none transition-all focus:border-accent" />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input value={editBoleiaSentido} onChange={(e) => setEditBoleiaSentido(e.target.value)} placeholder={copy.admin.rides.editPlaceholder.route}
                      className="rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none transition-all focus:border-accent" />
                    <input value={editBoleiaTelefone} onChange={(e) => setEditBoleiaTelefone(e.target.value)} placeholder={copy.admin.rides.editPlaceholder.phone}
                      className="rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none transition-all focus:border-accent" />
                    <input type="number" min="1" value={editBoleiaLugares} onChange={(e) => setEditBoleiaLugares(e.target.value)}
                      className="no-spinner rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none transition-all focus:border-accent" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-400">{copy.admin.rides.notes}</label>
                    <textarea value={editBoleiaNotas} onChange={(e) => setEditBoleiaNotas(e.target.value)} rows={3}
                      className="w-full resize-none rounded-2xl border border-accent-mid/40 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-all focus:border-accent" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleSaveBoleia} disabled={savingBoleia || !editBoleiaNome.trim() || !editBoleiaSentido.trim() || Number(editBoleiaLugares) < 1}
                      className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50">
                      {savingBoleia ? copy.admin.actions.loadingSave : copy.admin.actions.save}
                    </button>
                    <button onClick={handleCancelEditBoleia}
                      className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                      {copy.admin.actions.cancel}
                    </button>
                  </div>
                </div>
              )

              const BoleiaActions = ({ entry }: { entry: BoleiaRow }) => (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleStartEditBoleia(entry)}
                    className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                    {copy.admin.actions.edit}
                  </button>
                  {deleteBoleiaId === entry.id ? (
                    <>
                      <button onClick={handleDeleteBoleia} disabled={deletingBoleia}
                        className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50">
                        {deletingBoleia ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}
                      </button>
                      <button onClick={() => setDeleteBoleiaId(null)}
                        className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                        {copy.admin.actions.cancel}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteBoleiaId(entry.id)}
                      className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100">
                      {copy.admin.actions.delete}
                    </button>
                  )}
                </div>
              )

              return (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-3">
                      <div className="rounded-2xl border border-accent-mid/30 bg-white px-4 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent-dark/70">Registos</p>
                        <p className="mt-1 font-serif text-2xl text-forest">{boleias.length}</p>
                      </div>
                      <div className="rounded-2xl border border-accent-mid/30 bg-accent-light/40 px-4 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent-dark/70">{copy.admin.rides.seats}</p>
                        <p className="mt-1 font-serif text-2xl text-forest">{totalLugares}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start">
                      {boleiasView === 'cards' && (
                        <div className="flex gap-1 rounded-2xl border border-accent-mid/30 bg-white p-1">
                          {([1, 3, 6] as const).map((n) => (
                            <button key={n} type="button" onClick={() => setBoleiasCols(n)} title={`${n} por linha`}
                              className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${boleiasCols === n ? 'bg-forest text-white shadow-sm' : 'text-gray-400 hover:text-forest'}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1 rounded-2xl border border-accent-mid/30 bg-white p-1">
                        {([
                          { key: 'cards', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>, label: 'Cards' },
                          { key: 'tabela', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor" opacity=".4"/><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="11" width="14" height="2" rx="1" fill="currentColor"/></svg>, label: 'Tabela' },
                          { key: 'grupos', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="7" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity=".5"/><rect x="1" y="13" width="8" height="2" rx="1" fill="currentColor" opacity=".3"/></svg>, label: 'Grupos' },
                        ] as { key: 'cards' | 'tabela' | 'grupos'; icon: React.ReactNode; label: string }[]).map(({ key, icon, label }) => (
                          <button key={key} type="button" onClick={() => setBoleiasView(key)} title={label}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${boleiasView === key ? 'bg-forest text-white shadow-sm' : 'text-gray-400 hover:text-forest'}`}>
                            {icon}<span className="hidden sm:inline">{label}</span>
                          </button>
                        ))}
                      </div>
                      <ExportButton onClick={handleExportBoleias} />
                    </div>
                  </div>

                  {boleiasView === 'cards' && (
                    <div className={`grid gap-3 ${boleiasCols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : boleiasCols === 6 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-1'}`}>
                      {boleias.map((entry) => (
                        <motion.div key={entry.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          className="rounded-3xl border border-accent-mid/40 bg-white shadow-sm shadow-accent/5">
                          {boleiasCols === 1 ? (
                            <>
                              <div className="flex items-center justify-between gap-4 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-5 sm:px-6">
                                <div>
                                  <p className="font-serif text-2xl text-forest">{entry.nome}</p>
                                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
                                    <span>{entry.sentido}</span>
                                    {entry.telefone && <span>{entry.telefone}</span>}
                                    <span>{formatDate(entry.created_at)}</span>
                                  </div>
                                </div>
                                <div className="rounded-2xl bg-accent-light/60 px-4 py-2.5 text-right">
                                  <p className="text-[11px] uppercase tracking-[0.22em] text-accent-dark/70">{copy.admin.rides.seats}</p>
                                  <p className="mt-1 text-2xl font-semibold text-forest">{editBoleiaId === entry.id ? editBoleiaLugares || entry.lugares : entry.lugares}</p>
                                </div>
                              </div>
                              {editBoleiaId === entry.id ? <BoleiaEditForm entry={entry} /> : (
                                <div className="px-5 py-4 sm:px-6">
                                  {entry.notas && <p className="mb-4 text-sm leading-6 text-gray-500">{entry.notas}</p>}
                                  <BoleiaActions entry={entry} />
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col gap-2 p-4">
                              <p className={`font-serif text-forest leading-tight ${boleiasCols === 6 ? 'text-base' : 'text-lg'}`}>{entry.nome}</p>
                              <div className="flex flex-wrap gap-1 text-xs text-gray-500">
                                <span className="rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-medium text-accent-dark">{entry.sentido}</span>
                                <span className="rounded-full bg-accent-light/60 px-2 py-0.5 text-[11px] font-medium text-forest">{entry.lugares} lugares</span>
                              </div>
                              <div className="mt-1 flex gap-1.5">
                                <button onClick={() => editBoleiaId === entry.id ? handleCancelEditBoleia() : handleStartEditBoleia(entry)}
                                  className="rounded-lg bg-accent-light px-2 py-1 text-[11px] font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                                  {editBoleiaId === entry.id ? copy.admin.actions.cancel : copy.admin.actions.edit}
                                </button>
                                {deleteBoleiaId === entry.id ? (
                                  <><button onClick={handleDeleteBoleia} disabled={deletingBoleia} className="rounded-lg bg-red-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-600 disabled:opacity-50">{deletingBoleia ? '…' : copy.admin.actions.confirm}</button><button onClick={() => setDeleteBoleiaId(null)} className="rounded-lg bg-accent-light px-2 py-1 text-[11px] font-medium text-accent-dark hover:bg-accent-mid/30">{copy.admin.actions.cancel}</button></>
                                ) : <button onClick={() => setDeleteBoleiaId(entry.id)} className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-100">{copy.admin.actions.delete}</button>}
                              </div>
                              {editBoleiaId === entry.id && <BoleiaEditForm entry={entry} />}
                            </div>
                          )}
                        </motion.div>
                      ))}
                      {boleias.length === 0 && <div className="col-span-full rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">{copy.admin.rides.empty}</div>}
                    </div>
                  )}

                  {boleiasView === 'tabela' && (
                    <div className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm">
                      {boleias.length === 0 ? <p className="px-6 py-20 text-center text-sm text-gray-400">{copy.admin.rides.empty}</p> : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-accent-mid/20 bg-accent-light/30">
                              <th className="px-5 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">Nome</th>
                              <th className="px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">Sentido</th>
                              <th className="px-4 py-3.5 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">{copy.admin.rides.seats}</th>
                              <th className="hidden px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60 sm:table-cell">Telemóvel</th>
                              <th className="px-4 py-3.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-accent-mid/10">
                            {boleias.map((entry) => (
                              <>
                                <tr key={entry.id} className={`transition-colors hover:bg-accent-light/10 ${editBoleiaId === entry.id ? 'bg-accent-light/20' : ''}`}>
                                  <td className="px-5 py-3.5 font-medium text-forest">{entry.nome}</td>
                                  <td className="px-4 py-3.5 text-gray-500">{entry.sentido}</td>
                                  <td className="px-4 py-3.5 text-center font-semibold text-forest">{editBoleiaId === entry.id ? editBoleiaLugares || entry.lugares : entry.lugares}</td>
                                  <td className="hidden px-4 py-3.5 text-xs text-gray-400 sm:table-cell">{entry.telefone ?? '—'}</td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex justify-end gap-1.5">
                                      <button onClick={() => editBoleiaId === entry.id ? handleCancelEditBoleia() : handleStartEditBoleia(entry)} className="rounded-lg bg-accent-light px-2.5 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">{editBoleiaId === entry.id ? copy.admin.actions.cancel : copy.admin.actions.edit}</button>
                                      {deleteBoleiaId === entry.id ? (
                                        <><button onClick={handleDeleteBoleia} disabled={deletingBoleia} className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50">{deletingBoleia ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}</button><button onClick={() => setDeleteBoleiaId(null)} className="rounded-lg bg-accent-light px-2.5 py-1.5 text-xs font-medium text-accent-dark hover:bg-accent-mid/30">{copy.admin.actions.cancel}</button></>
                                      ) : <button onClick={() => setDeleteBoleiaId(entry.id)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100">{copy.admin.actions.delete}</button>}
                                    </div>
                                  </td>
                                </tr>
                                {editBoleiaId === entry.id && <tr key={`${entry.id}-edit`}><td colSpan={5} className="border-t border-accent-mid/20 bg-accent-light/10 p-0"><BoleiaEditForm entry={entry} /></td></tr>}
                              </>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {boleiasView === 'grupos' && (
                    <div className="space-y-5">
                      {sentidos.length === 0 ? (
                        <div className="rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">{copy.admin.rides.empty}</div>
                      ) : sentidos.map((sentido) => {
                        const grupo = boleias.filter((b) => b.sentido === sentido)
                        const lugaresGrupo = grupo.reduce((s, b) => s + Number(b.lugares ?? 0), 0)
                        return (
                          <div key={sentido} className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm">
                            <div className="flex items-center gap-3 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-4">
                              <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark">{sentido}</span>
                              <span className="font-serif text-lg text-forest">{grupo.length} reg.</span>
                              <span className="text-sm text-gray-500">· {lugaresGrupo} {copy.admin.rides.seats.toLowerCase()}</span>
                            </div>
                            <ul className="divide-y divide-accent-mid/10">
                              {grupo.map((entry) => (
                                <li key={entry.id}>
                                  {editBoleiaId === entry.id ? <BoleiaEditForm entry={entry} /> : (
                                    <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <div className="flex items-center gap-3">
                                          <p className="font-medium text-forest">{entry.nome}</p>
                                          <span className="rounded-full bg-accent-light/60 px-2.5 py-0.5 text-xs font-medium text-forest">{entry.lugares} lugares</span>
                                        </div>
                                        {entry.telefone && <p className="mt-0.5 text-xs text-gray-400">{entry.telefone}</p>}
                                      </div>
                                      <BoleiaActions entry={entry} />
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()

          ) : tab === 'presencas' ? (
            (() => {
              const filteredPresencas = presencas.filter((p) => fuzzyMatch(presencasSearch, p.nome))
              const totalNao = presencas.filter((p) => p.presenca === 'nao').length
              const opcoes = copy.admin.presencas.opcoes
              const handleExportPresencas = () => exportCsv('presencas', presencas.map((p) => [
                p.nome, opcoes[p.presenca], p.created_at ? formatDate(p.created_at) : '',
              ]), ['Nome', 'Presença', 'Data'])
              const presencaColor: Record<string, string> = {
                tudo: 'bg-green-50 text-green-700',
                missa: 'bg-blue-50 text-blue-700',
                festa: 'bg-purple-50 text-purple-700',
                nao: 'bg-red-50 text-red-600',
              }

              const PresencaEditForm = () => (
                <div className="space-y-4 p-5">
                  <input
                    value={editPresencaNome}
                    onChange={(e) => setEditPresencaNome(e.target.value)}
                    className="w-full rounded-full border border-accent-mid/40 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 outline-none transition-all focus:border-accent"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(['tudo', 'missa', 'festa', 'nao'] as const).map((op) => (
                      <button key={op} type="button" onClick={() => setEditPresencaOpcao(op)}
                        className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${editPresencaOpcao === op ? 'bg-forest text-white' : 'border border-accent-mid/40 bg-white text-accent-dark hover:border-accent'}`}>
                        {opcoes[op]}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={handleSavePresenca} disabled={savingPresenca || !editPresencaNome.trim()}
                      className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50">
                      {savingPresenca ? copy.admin.actions.loadingSave : copy.admin.actions.save}
                    </button>
                    <button onClick={handleCancelEditPresenca}
                      className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                      {copy.admin.actions.cancel}
                    </button>
                  </div>
                </div>
              )

              const PresencaActions = ({ entry }: { entry: PresencaRow }) => (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleStartEditPresenca(entry)}
                    className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                    {copy.admin.actions.edit}
                  </button>
                  {deletePresencaId === entry.id ? (
                    <>
                      <button onClick={handleDeletePresenca} disabled={deletingPresenca}
                        className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50">
                        {deletingPresenca ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}
                      </button>
                      <button onClick={() => setDeletePresencaId(null)}
                        className="rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                        {copy.admin.actions.cancel}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setDeletePresencaId(entry.id)}
                      className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100">
                      {copy.admin.actions.delete}
                    </button>
                  )}
                </div>
              )

              return (
                <div className="space-y-5">
                  {/* Search */}
                  <div className="relative">
                    <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                      type="text"
                      value={presencasSearch}
                      onChange={(e) => setPresencasSearch(e.target.value)}
                      placeholder="Pesquisar por nome..."
                      className="w-full rounded-2xl border border-accent-mid/40 bg-white py-3 pl-10 pr-10 text-sm text-gray-700 outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
                    />
                    {presencasSearch && (
                      <button type="button" onClick={() => setPresencasSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:text-gray-600">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                  {presencasSearch && (
                    <p className="text-xs text-gray-400">
                      {filteredPresencas.length === 0
                        ? 'Nenhum resultado encontrado.'
                        : `${filteredPresencas.length} resultado${filteredPresencas.length !== 1 ? 's' : ''} para "${presencasSearch}"`}
                    </p>
                  )}

                  {/* Resumo + toggle de view */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-3">
                      <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-green-700/70">{opcoes.tudo}</p>
                        <p className="mt-1 font-serif text-2xl text-green-700">{presencas.filter((p) => p.presenca === 'tudo').length}</p>
                      </div>
                      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-blue-700/70">{opcoes.missa}</p>
                        <p className="mt-1 font-serif text-2xl text-blue-700">{presencas.filter((p) => p.presenca === 'missa').length}</p>
                      </div>
                      <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-purple-700/70">{opcoes.festa}</p>
                        <p className="mt-1 font-serif text-2xl text-purple-700">{presencas.filter((p) => p.presenca === 'festa').length}</p>
                      </div>
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-red-600/70">{opcoes.nao}</p>
                        <p className="mt-1 font-serif text-2xl text-red-600">{totalNao}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {presencasView === 'cards' && (
                        <div className="flex gap-1 rounded-2xl border border-accent-mid/30 bg-white p-1">
                          {([1, 3, 6] as const).map((n) => (
                            <button key={n} type="button" onClick={() => setPresencasCols(n)} title={`${n} por linha`}
                              className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${presencasCols === n ? 'bg-forest text-white shadow-sm' : 'text-gray-400 hover:text-forest'}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1 rounded-2xl border border-accent-mid/30 bg-white p-1">
                        {([
                          { key: 'cards', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>, label: 'Cards' },
                          { key: 'tabela', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor" opacity=".4"/><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="11" width="14" height="2" rx="1" fill="currentColor"/></svg>, label: 'Tabela' },
                          { key: 'grupos', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="7" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity=".5"/><rect x="1" y="13" width="8" height="2" rx="1" fill="currentColor" opacity=".3"/></svg>, label: 'Grupos' },
                        ] as { key: 'cards' | 'tabela' | 'grupos'; icon: React.ReactNode; label: string }[]).map(({ key, icon, label }) => (
                          <button key={key} type="button" onClick={() => setPresencasView(key)} title={label}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${presencasView === key ? 'bg-forest text-white shadow-sm' : 'text-gray-400 hover:text-forest'}`}>
                            {icon}
                            <span className="hidden sm:inline">{label}</span>
                          </button>
                        ))}
                      </div>
                      <ExportButton onClick={handleExportPresencas} />
                    </div>
                  </div>

                  {/* VIEW: Cards */}
                  {presencasView === 'cards' && (
                    <div className={`grid gap-3 ${presencasCols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : presencasCols === 6 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-1'}`}>
                      {filteredPresencas.map((entry) => (
                        <motion.div key={entry.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          className="rounded-3xl border border-accent-mid/40 bg-white shadow-sm shadow-accent/5">
                          {presencasCols === 1 ? (
                            <>
                              <div className="flex items-center justify-between gap-4 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-5 sm:px-6">
                                <p className="font-serif text-2xl text-forest">{entry.nome}</p>
                                <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${presencaColor[entry.presenca]}`}>
                                  {opcoes[entry.presenca]}
                                </span>
                              </div>
                              {editPresencaId === entry.id ? (
                                <PresencaEditForm />
                              ) : (
                                <div className="px-5 py-4 sm:px-6">
                                  <PresencaActions entry={entry} />
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col gap-2 p-4">
                              <span className={`self-start rounded-full px-2.5 py-1 text-[11px] font-medium ${presencaColor[entry.presenca]}`}>
                                {opcoes[entry.presenca]}
                              </span>
                              <p className={`font-serif text-forest leading-tight ${presencasCols === 6 ? 'text-base' : 'text-lg'}`}>{entry.nome}</p>
                              <div className="mt-1 flex gap-1.5">
                                <button onClick={() => handleStartEditPresenca(entry)}
                                  className="rounded-lg bg-accent-light px-2 py-1 text-[11px] font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                                  {copy.admin.actions.edit}
                                </button>
                                {deletePresencaId === entry.id ? (
                                  <>
                                    <button onClick={handleDeletePresenca} disabled={deletingPresenca} className="rounded-lg bg-red-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-600 disabled:opacity-50">
                                      {deletingPresenca ? '…' : copy.admin.actions.confirm}
                                    </button>
                                    <button onClick={() => setDeletePresencaId(null)} className="rounded-lg bg-accent-light px-2 py-1 text-[11px] font-medium text-accent-dark hover:bg-accent-mid/30">
                                      {copy.admin.actions.cancel}
                                    </button>
                                  </>
                                ) : (
                                  <button onClick={() => setDeletePresencaId(entry.id)} className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-100">
                                    {copy.admin.actions.delete}
                                  </button>
                                )}
                              </div>
                              {editPresencaId === entry.id && <PresencaEditForm />}
                            </div>
                          )}
                        </motion.div>
                      ))}
                      {filteredPresencas.length === 0 && (
                        <div className="col-span-full rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">
                          {copy.admin.presencas.empty}
                        </div>
                      )}
                    </div>
                  )}

                  {/* VIEW: Tabela */}
                  {presencasView === 'tabela' && (
                    <div className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm">
                      {filteredPresencas.length === 0 ? (
                        <p className="px-6 py-20 text-center text-sm text-gray-400">{copy.admin.presencas.empty}</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-accent-mid/20 bg-accent-light/30">
                              <th className="px-5 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">Nome</th>
                              <th className="px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.2em] text-accent-dark/60">{copy.admin.presencas.presenca}</th>
                              <th className="px-4 py-3.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-accent-mid/10">
                            {filteredPresencas.map((entry) => (
                              <>
                                <tr key={entry.id} className={`transition-colors hover:bg-accent-light/10 ${editPresencaId === entry.id ? 'bg-accent-light/20' : ''}`}>
                                  <td className="px-5 py-3.5 font-medium text-forest">{entry.nome}</td>
                                  <td className="px-4 py-3.5">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${presencaColor[entry.presenca]}`}>
                                      {opcoes[entry.presenca]}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex justify-end gap-1.5">
                                      <button
                                        onClick={() => editPresencaId === entry.id ? handleCancelEditPresenca() : handleStartEditPresenca(entry)}
                                        className="rounded-lg bg-accent-light px-2.5 py-1.5 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-mid/30">
                                        {editPresencaId === entry.id ? copy.admin.actions.cancel : copy.admin.actions.edit}
                                      </button>
                                      {deletePresencaId === entry.id ? (
                                        <>
                                          <button onClick={handleDeletePresenca} disabled={deletingPresenca} className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50">
                                            {deletingPresenca ? copy.admin.actions.loadingDelete : copy.admin.actions.confirm}
                                          </button>
                                          <button onClick={() => setDeletePresencaId(null)} className="rounded-lg bg-accent-light px-2.5 py-1.5 text-xs font-medium text-accent-dark hover:bg-accent-mid/30">
                                            {copy.admin.actions.cancel}
                                          </button>
                                        </>
                                      ) : (
                                        <button onClick={() => setDeletePresencaId(entry.id)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100">
                                          {copy.admin.actions.delete}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {editPresencaId === entry.id && (
                                  <tr key={`${entry.id}-edit`}>
                                    <td colSpan={3} className="border-t border-accent-mid/20 bg-accent-light/10 p-0">
                                      <PresencaEditForm />
                                    </td>
                                  </tr>
                                )}
                              </>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* VIEW: Grupos */}
                  {presencasView === 'grupos' && (
                    <div className="space-y-5">
                      {(['tudo', 'missa', 'festa', 'nao'] as const).map((op) => {
                        const grupo = filteredPresencas.filter((p) => p.presenca === op)
                        if (grupo.length === 0) return null
                        return (
                          <div key={op} className="overflow-hidden rounded-3xl border border-accent-mid/40 bg-white shadow-sm">
                            <div className="flex items-center gap-3 border-b border-accent-mid/20 bg-accent-light/20 px-5 py-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${presencaColor[op]}`}>
                                {opcoes[op]}
                              </span>
                              <span className="font-serif text-lg text-forest">{grupo.length}</span>
                            </div>
                            <ul className="divide-y divide-accent-mid/10">
                              {grupo.map((entry) => (
                                <li key={entry.id}>
                                  {editPresencaId === entry.id ? (
                                    <PresencaEditForm />
                                  ) : (
                                    <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                      <p className="font-medium text-forest">{entry.nome}</p>
                                      <PresencaActions entry={entry} />
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                      {filteredPresencas.length === 0 && (
                        <div className="rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">
                          {copy.admin.presencas.empty}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()

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
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        const token = await currentUser.getIdTokenResult()
        setIsAdmin(token.claims['admin'] === true)
      } else {
        setIsAdmin(false)
      }
      setChecking(false)
    })
    return unsubscribe
  }, [])

  const handleLogout = async () => {
    await signOut(auth)
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-accent-light/30">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    )
  }

  if (!user) {
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
