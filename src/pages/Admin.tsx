import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Gift } from '../lib/supabase'
import { MOTION_EASE, motionProps, presenceProps } from '../lib/motion'

const ADMIN_USER_ID = '0b9c93dd-17a2-4943-befd-968943ba432f'
const CATEGORIES = ['Cozinha', 'Quarto', 'Sala', 'Experiencia', 'Tecnologia', 'Outro']

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
      reject(new Error('Nao foi possivel ler a imagem.'))
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
    throw new Error('Nao foi possivel processar a imagem.')
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
    throw new Error('A imagem e demasiado grande. Usa uma imagem mais pequena.')
  }

  return best
}

const formatSupabaseError = (message?: string) => {
  if (!message) return 'Erro ao guardar. Tenta novamente.'
  if (message.toLowerCase().includes('row-level security')) return 'Esta conta nao tem permissao para guardar presentes.'
  if (message.toLowerCase().includes('payload')) return 'A imagem e demasiado grande. Usa uma imagem mais pequena.'
  return message
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
    if (err) setError('Credenciais invalidas.')
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
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent-dark/70">Painel privado</p>
          <p className="mt-3 font-serif text-4xl text-forest">Admin</p>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            Entre com a conta autorizada para gerir a lista de presentes e acompanhar as contribuicoes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            className="w-full rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">Password</label>
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
            {loading ? 'A entrar...' : 'Entrar'}
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
  onSaved: (g: Gift) => void
}) {
  const [name, setName] = useState(gift?.name ?? '')
  const [description, setDescription] = useState(gift?.description ?? '')
  const [price, setPrice] = useState(gift?.price?.toString() ?? '')
  const [category, setCategory] = useState(gift?.category ?? 'Outro')
  const [imageUrl, setImageUrl] = useState(gift?.image_url ?? '')
  const [imageSource, setImageSource] = useState<'url' | 'upload'>(gift?.image_url?.startsWith('data:') ? 'upload' : 'url')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!gift

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Seleciona um ficheiro de imagem valido.')
      e.target.value = ''
      return
    }

    try {
      setUploadingImage(true)
      setError('')
      const dataUrl = await readFileAsDataUrl(file)
      setImageUrl(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar a imagem.')
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
      category,
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

    onSaved(result.data as Gift)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/35 p-6 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-accent-mid/20 bg-white p-8 shadow-2xl shadow-forest/20 md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] uppercase tracking-[0.28em] text-accent-dark/70">
          {isEdit ? 'Editar presente' : 'Novo presente'}
        </p>
        <h2 className="mt-3 font-serif text-3xl text-forest">
          {isEdit ? gift.name : 'Adicionar a lista'}
        </h2>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex: Robot de cozinha"
              className="w-full rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">Descricao</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Breve descricao..."
              className="w-full resize-none rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">Preco (EUR)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                placeholder="0.00"
                className="w-full rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-gray-500">Imagem</label>
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
                  URL
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
                  Upload
                </button>
              </div>
            </div>

            {imageSource === 'url' ? (
              <input
                value={imageUrl.startsWith('data:') ? '' : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-accent-mid/40 bg-accent-light/40 px-4 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-accent-mid/50 bg-accent-light/25 p-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-accent-mid/30 bg-white px-4 py-6 text-center transition-colors hover:border-accent hover:bg-accent-light/30">
                  <span className="text-sm font-medium text-forest">
                    {uploadingImage ? 'A carregar imagem...' : 'Escolher imagem'}
                  </span>
                  <span className="text-xs text-gray-500">PNG, JPG, WEBP ou semelhante</span>
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
                  <img src={imageUrl} alt="Preview da imagem" className="h-full w-full object-cover" />
                </div>
                <div className="flex justify-end border-t border-accent-mid/20 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs font-medium text-accent-dark transition-colors hover:text-forest"
                  >
                    Remover imagem
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
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-forest py-3 text-sm font-medium text-white transition-all hover:bg-accent-dark disabled:opacity-50"
            >
              {loading ? 'A guardar...' : isEdit ? 'Guardar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'gifts' | 'contributions'>('gifts')
  const [gifts, setGifts] = useState<GiftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editGift, setEditGift] = useState<Gift | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    const [giftsRes, contribsRes] = await Promise.all([
      supabase.from('gifts').select('*').order('created_at', { ascending: false }),
      supabase.from('gift_contributions').select('*').order('created_at', { ascending: false }),
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

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('gifts').delete().eq('id', deleteId)
    setGifts((prev) => prev.filter((g) => g.id !== deleteId))
    setDeleteId(null)
    setDeleting(false)
  }

  const handleSaved = (saved: Gift) => {
    setGifts((prev) => {
      const exists = prev.find((g) => g.id === saved.id)
      if (exists) return prev.map((g) => g.id === saved.id ? { ...g, ...saved } : g)
      return [{ ...saved, total_contributed: 0, contributions: [] }, ...prev]
    })
  }

  const totalContributed = gifts.reduce((sum, g) => sum + g.total_contributed, 0)
  const totalContributions = gifts.reduce((sum, g) => sum + g.contributions.length, 0)
  const fullyFunded = gifts.filter((g) => g.price > 0 && g.total_contributed >= g.price).length
  const pendingGifts = Math.max(gifts.length - fullyFunded, 0)
  const averageContribution = totalContributions > 0 ? totalContributed / totalContributions : 0
  const giftsWithContributions = gifts.filter((g) => g.contributions.length > 0)

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="relative overflow-hidden bg-white px-5 pb-16 pt-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-widest text-accent">Painel de administracao</p>
              <h1 className="mt-4 font-serif text-5xl leading-none text-forest md:text-7xl">Admin</h1>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-gray-500 sm:text-base">
                Gere presentes, acompanhe a evolucao das contribuicoes e mantenha a lista clara sem sair desta pagina.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-full border border-accent-mid/40 px-4 py-2 text-xs uppercase tracking-widest text-accent-dark">
                {gifts.length} presentes registados
              </div>
              <button
                onClick={onLogout}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-mid/50 px-5 py-2.5 text-sm font-medium text-accent-dark transition-all duration-300 hover:bg-accent hover:text-white hover:border-accent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Sair
              </button>
            </div>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            <StatCard
              label="Total angariado"
              value={formatCurrency(totalContributed)}
              note={`${totalContributions} contribuicoes registadas`}
            />
            <StatCard
              label="Presentes concluidos"
              value={`${fullyFunded}`}
              note={pendingGifts > 0 ? `${pendingGifts} ainda por completar` : 'Todos os presentes estao completos'}
            />
            <StatCard
              label="Valor medio"
              value={formatCurrency(averageContribution)}
              note="Media por contribuicao recebida"
            />
          </div>
        </div>
      </section>

      <section className="bg-accent-light/40 px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(['gifts', 'contributions'] as const).map((currentTab) => {
                const active = tab === currentTab
                const label = currentTab === 'gifts'
                  ? `Presentes (${gifts.length})`
                  : `Contribuicoes (${totalContributions})`

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
                  Adicionar presente
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {totalContributions} contribuicoes · {formatCurrency(totalContributed)} recebidos
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
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
                              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3A9E8F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 12v10H4V12M2 7h20v5H2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-serif text-2xl leading-tight text-forest">{gift.name}</h3>
                            <span className="rounded-full bg-accent-light px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-accent-dark">
                              {gift.category}
                            </span>
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
                          Editar
                        </button>

                        {deleteId === gift.id ? (
                          <>
                            <button
                              onClick={handleDelete}
                              disabled={deleting}
                              className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                            >
                              {deleting ? 'A eliminar...' : 'Confirmar'}
                            </button>
                            <button
                              onClick={() => setDeleteId(null)}
                              className="rounded-full bg-accent-light px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-mid/30"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteId(gift.id)}
                            className="rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-100"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 p-5 sm:grid-cols-[1.2fr_0.9fr] sm:p-6">
                      <div>
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">Progresso</p>
                            <p className="mt-2 text-3xl font-semibold text-forest">{Math.round(pct)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">Contribuido</p>
                            <p className="mt-2 text-lg font-medium text-gray-700">{formatCurrency(gift.total_contributed)}</p>
                          </div>
                        </div>

                        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-accent-light">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,_#3A9E8F,_#0C3D35)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500">
                          <span className="rounded-full bg-gray-50 px-3 py-2">Meta: {formatCurrency(gift.price)}</span>
                          <span className="rounded-full bg-gray-50 px-3 py-2">Falta: {formatCurrency(remaining)}</span>
                          <span className="rounded-full bg-gray-50 px-3 py-2">{gift.contributions.length} contrib.</span>
                        </div>
                      </div>

                      <div className="rounded-3xl bg-accent-light/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-dark/70">Estado</p>
                        <p className="mt-2 font-serif text-2xl text-forest">
                          {pct >= 100 ? 'Completo' : pct >= 50 ? 'A meio' : 'A comecar'}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-accent-dark/80">
                          {pct >= 100
                            ? 'Este presente ja atingiu ou ultrapassou a meta.'
                            : `Faltam ${formatCurrency(remaining)} para completar este presente.`}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}

              {gifts.length === 0 && (
                <div className="col-span-full rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">
                  Nenhum presente ainda. Adiciona o primeiro.
                </div>
              )}
            </div>
          ) : (
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
                          <span className="rounded-full bg-accent-light px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-accent-dark">
                            {gift.category}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-accent-light">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,_#3A9E8F,_#0C3D35)]"
                                style={{ width: `${pct}%` }}
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
                        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-dark/70">Contribuicoes</p>
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
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-700">{c.contributor_name}</p>
                              <p className="text-xs uppercase tracking-[0.18em] text-gray-300">{formatDate(c.created_at)}</p>
                            </div>
                          </div>

                          <span className="rounded-full bg-forest px-3 py-1.5 text-sm font-medium text-white">
                            {formatCurrency(Number(c.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )
              })}

              {giftsWithContributions.length === 0 && (
                <div className="rounded-[30px] border border-dashed border-accent-mid bg-white/70 px-6 py-20 text-center text-sm text-gray-400">
                  Ainda nao ha contribuicoes.
                </div>
              )}
            </div>
          )}
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
          className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/88 p-10 text-center shadow-[0_35px_80px_-35px_rgba(12,61,53,0.35)] backdrop-blur"
        >
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent-dark/70">Acesso restrito</p>
          <p className="mt-3 font-serif text-4xl text-forest">Sem acesso</p>
          <p className="mt-4 text-sm leading-6 text-gray-500">
            Esta conta nao tem permissao para abrir a area de administracao.
          </p>
          <button
            onClick={handleLogout}
            className="mt-8 w-full rounded-2xl bg-forest py-3.5 text-sm font-medium text-white transition-all hover:bg-accent-dark"
          >
            Sair
          </button>
        </motion.div>
      </div>
    )
  }

  return <AdminPanel onLogout={handleLogout} />
}
