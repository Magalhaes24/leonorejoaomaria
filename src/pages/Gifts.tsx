import { AnimatePresence, motion, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { supabase, type Gift, type GiftContribution, type HoneymoonContribution } from '../lib/supabase'
import { MOTION_EASE, MOTION_ENABLED, motionProps, presenceProps } from '../lib/motion'

type GiftWithProgress = Gift & { contributed: number }


// ─── Fade-up helper ───────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const shown = MOTION_ENABLED ? inView : true
  return (
    <motion.div ref={ref} className={className}
      {...motionProps({
        initial: { y: 18, opacity: 0 },
        animate: shown ? { y: 0, opacity: 1 } : {},
        transition: { duration: 0.8, delay, ease: MOTION_EASE },
      })}
    >
      {children}
    </motion.div>
  )
}

// ─── Category icon ────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Cozinha: '#D97706',
  Quarto: '#7C3AED',
  Sala: '#2563EB',
  'Experiência': '#DB2777',
  Tecnologia: '#4F46E5',
  Outro: '#3A9E8F',
}

function GiftIcon({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? '#3A9E8F'
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: `${color}12` }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12v10H4V12M2 7h20v5H2z" />
        <path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-full h-1 bg-accent-light rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-accent rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

// ─── Gift card ────────────────────────────────────────────────────────────────
function GiftCard({ gift, onContribute }: { gift: GiftWithProgress; onContribute: (gift: GiftWithProgress) => void }) {
  const pct = gift.price > 0 ? Math.min(100, (gift.contributed / gift.price) * 100) : 0
  const isFull = pct >= 100

  return (
    <motion.div
      layout
      {...motionProps({
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95 },
        whileHover: { y: -3 },
        transition: { duration: 0.55, ease: MOTION_EASE },
      })}
      className={`group bg-white rounded-2xl border overflow-hidden flex flex-col transition-all duration-500 ${
        isFull
          ? 'border-accent-mid/20'
          : 'border-accent-mid/30 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/10'
      }`}
    >
      {/* Imagem */}
      <div className="aspect-[4/3] overflow-hidden bg-accent-light/50 relative">
        {gift.image_url ? (
          <img src={gift.image_url} alt={gift.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" />
        ) : (
          <GiftIcon category={gift.category} />
        )}
        {isFull && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-accent-mid/30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3A9E8F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-xs font-medium text-accent-dark">Completo</span>
            </div>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="text-xs font-medium text-accent-dark bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-accent-mid/30">
            {gift.category}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">{gift.name}</h3>
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{gift.description}</p>
        </div>

        {/* Progresso */}
        <div className="mt-auto space-y-1.5">
          <ProgressBar value={gift.contributed} max={gift.price} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              €{gift.contributed.toFixed(0)} <span className="text-gray-300">/</span> €{gift.price.toFixed(0)}
            </span>
            <span className="text-xs font-medium text-accent">{Math.round(pct)}%</span>
          </div>
        </div>

        {!isFull && (
          <button
            onClick={() => onContribute(gift)}
            className="w-full text-xs font-medium text-white bg-accent py-2.5 rounded-full hover:bg-accent-dark transition-all duration-300 mt-1 cursor-pointer"
          >
            Contribuir
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Modal de Contribuição ────────────────────────────────────────────────────
function ContributeModal({
  gift,
  onClose,
  onConfirm,
}: {
  gift: GiftWithProgress
  onClose: () => void
  onConfirm: (name: string, amount: number) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const finalAmount = custom ? parseFloat(custom) : 0
  const pct = gift.price > 0 ? Math.min(100, (gift.contributed / gift.price) * 100) : 0
  const remaining = Math.max(0, gift.price - gift.contributed)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || finalAmount <= 0) return
    setLoading(true)
    setError('')
    try {
      await onConfirm(name.trim(), finalAmount)
      setDone(true)
      setTimeout(onClose, 2200)
    } catch {
      setError('Ocorreu um erro. Por favor tenta novamente.')
      setLoading(false)
    }
  }

  return (
    <motion.div
      {...motionProps({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      })}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-forest/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        {...motionProps({
          initial: { y: 24, opacity: 0, scale: 0.97 },
          animate: { y: 0, opacity: 1, scale: 1 },
          exit: { y: 12, opacity: 0, scale: 0.97 },
          transition: { duration: 0.4, ease: MOTION_EASE },
        })}
        className="bg-white rounded-t-3xl md:rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl shadow-forest/20 border border-accent-mid/20 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-6">
            <motion.div
              {...motionProps({
                initial: { scale: 0 },
                animate: { scale: 1 },
                transition: { type: 'spring', stiffness: 300, damping: 20 },
              })}
              className="w-14 h-14 bg-accent/15 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3A9E8F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
            <h3 className="font-serif text-2xl text-forest mb-2">Obrigado!</h3>
            <p className="text-gray-400 text-sm">A tua contribuição de <span className="text-accent-dark font-medium">€{finalAmount}</span> foi registada.</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-accent mb-2">Contribuir para</p>
              <h3 className="font-serif text-2xl text-forest mb-3">{gift.name}</h3>
              <div className="space-y-1.5">
                <div className="w-full h-1.5 bg-accent-light rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>€{gift.contributed.toFixed(0)} contribuído</span>
                  <span>Faltam €{remaining.toFixed(0)}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-2">Valor</label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">€</span>
                  <input
                    type="number"
                    min="1"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="Valor"
                    className="no-spinner w-full pl-8 bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-2">O teu nome *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium text-accent-dark bg-accent-light hover:bg-accent-mid/30 transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || finalAmount <= 0 || !name.trim()}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-forest hover:bg-accent-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? 'A processar…' : `Contribuir €${finalAmount > 0 ? finalAmount : '—'}`}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Fundo de Lua de Mel ──────────────────────────────────────────────────────
function HoneymoonFund() {  const [custom, setCustom] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const finalAmount = custom ? parseFloat(custom) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || finalAmount <= 0) return
    setLoading(true)
    setError('')

    const contribution: HoneymoonContribution = {
      contributor_name: name.trim(),
      message: message.trim() || undefined,
      amount: finalAmount,
    }

    const { error: err } = await supabase.from('honeymoon_contributions').insert(contribution)

    if (err) {
      setError('Ocorreu um erro. Por favor tenta novamente.')
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
  }

  return (
    <FadeUp>
      <div className="bg-forest rounded-3xl overflow-hidden">
        <div className="relative px-6 sm:px-8 pt-12 md:pt-14 pb-8 md:pb-10 md:px-14">
          <div className="absolute top-0 right-0 w-80 h-80 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(107,181,173,0.3) 0%, transparent 65%)' }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(58,158,143,0.2) 0%, transparent 65%)' }} />

          <div className="relative">
            <p className="text-xs uppercase tracking-widest text-sage mb-4">Fundo de Lua de Mel</p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white mb-4">Ajuda-nos a voar</h2>
            <p className="text-accent-mid text-sm leading-relaxed max-w-lg mb-10">
              Sonhamos com uma longa aventura na lua de mel. Qualquer contribuição para o nosso fundo de viagem é um presente maravilhoso que guardaremos para sempre.
            </p>

            {done ? (
              <motion.div
                {...motionProps({
                  initial: { opacity: 0, y: 10 },
                  animate: { opacity: 1, y: 0 },
                })}
                className="flex items-center gap-4 bg-white/5 rounded-2xl p-6 border border-accent/30"
              >
                <div className="w-12 h-12 bg-accent/25 rounded-full flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6BB5AD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Muito obrigado!</p>
                  <p className="text-accent-mid text-sm">A tua contribuição de €{finalAmount} significa muito para nós.</p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-xs text-sage/70 uppercase tracking-wider block mb-3">Escolhe um valor</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sage text-sm">€</span>
                    <input
                      type="number"
                      min="1"
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      placeholder="Valor"
                    className={`no-spinner w-full sm:w-36 pl-8 pr-4 py-2.5 rounded-full text-sm bg-white/10 text-white placeholder-sage/50 border outline-none transition-all duration-200 ${
                        custom ? 'border-accent' : 'border-white/15 focus:border-accent/60'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-sage/70 uppercase tracking-wider block mb-3">O teu nome *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome completo"
                    required
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-sage/40 outline-none focus:border-accent/60 focus:bg-white/15 transition-all duration-200 max-w-md"
                  />
                </div>

                <div>
                  <label className="text-xs text-sage/70 uppercase tracking-wider block mb-3">Deixa uma mensagem (opcional)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Desejamos-vos uma aventura maravilhosa…"
                    rows={3}
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-sage/40 outline-none focus:border-accent/60 focus:bg-white/15 transition-all duration-200 resize-none max-w-md block"
                  />
                </div>

                {error && <p className="text-red-400 text-xs">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || finalAmount <= 0 || !name.trim()}
                  className="w-full sm:w-auto bg-accent text-white text-sm font-medium px-10 py-3.5 rounded-full hover:bg-sage transition-all duration-300 shadow-lg shadow-accent/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? 'A processar…' : `Contribuir €${finalAmount > 0 ? finalAmount : '—'}`}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </FadeUp>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function Gifts() {
  const [gifts, setGifts] = useState<GiftWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('Todos')
  const [selectedGift, setSelectedGift] = useState<GiftWithProgress | null>(null)
  const [categories, setCategories] = useState<string[]>(['Todos'])

  useEffect(() => {
    Promise.all([
      supabase.from('gifts').select('*').order('price', { ascending: true }),
      supabase.from('gift_contributions').select('gift_id, amount'),
    ]).then(([giftsRes, contribRes]) => {
      if (!giftsRes.error && giftsRes.data) {
        const contribs = (contribRes.data ?? []) as { gift_id: string; amount: number }[]
        const totals: Record<string, number> = {}
        for (const c of contribs) {
          totals[c.gift_id] = (totals[c.gift_id] ?? 0) + Number(c.amount)
        }
        const data = giftsRes.data.map((g) => ({ ...g, contributed: totals[g.id] ?? 0 })) as GiftWithProgress[]
        setGifts(data)
        const cats = ['Todos', ...Array.from(new Set(giftsRes.data.map((g) => g.category).filter(Boolean)))]
        setCategories(cats)
      }
      setLoading(false)
    })
  }, [])

  const filtered = activeCategory === 'Todos' ? gifts : gifts.filter((g) => g.category === activeCategory)

  const handleContribute = async (name: string, amount: number) => {
    if (!selectedGift) return
    const contribution: GiftContribution = {
      gift_id: selectedGift.id,
      contributor_name: name,
      amount,
    }
    const { error } = await supabase.from('gift_contributions').insert(contribution)
    if (error) throw error
    setGifts((prev) =>
      prev.map((g) => g.id === selectedGift.id ? { ...g, contributed: g.contributed + amount } : g)
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Cabeçalho ── */}
      <section className="pt-28 md:pt-32 pb-16 md:pb-20 px-4 sm:px-6 md:px-8 max-w-6xl mx-auto">
        <motion.div
          {...motionProps({
            initial: { opacity: 0, y: 18 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.8, ease: MOTION_EASE },
          })}
        >
          <p className="text-xs uppercase tracking-widest text-accent font-medium mb-5">Leonor e João Maria · 2026</p>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl text-forest mb-6 leading-tight">
            Lista de<br />Casamento
          </h1>
          <p className="text-gray-500 text-base md:text-lg max-w-lg leading-relaxed">
            A vossa presença na nossa celebração é o presente mais precioso. Mas se quiserem contribuir para a nossa nova casa ou para a nossa lua de mel, aqui fica uma pequena lista.
          </p>
        </motion.div>
      </section>

      {/* ── Fundo Lua de Mel ── */}

      {/* ── Divisor ── */}

      {/* ── Lista de Presentes ── */}
      <section className="px-4 sm:px-6 md:px-8 pb-24 md:pb-32 max-w-6xl mx-auto">
        <FadeUp className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="font-serif text-3xl text-forest">Lista</h2>
            {!loading && (
              <p className="text-sm text-accent mt-1">{gifts.length} presentes</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                type="button"
                className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide transition-all duration-200 ${
                  activeCategory === cat
                    ? 'bg-forest text-white shadow-sm'
                    : 'bg-accent-light text-accent-dark hover:bg-accent-mid/40'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </FadeUp>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-accent-light/60 aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <FadeUp>
            <div className="text-center py-24">
              <p className="font-serif text-3xl text-accent-mid mb-3">Sem presentes ainda</p>
              <p className="text-gray-400 text-sm">A lista aparecerá aqui após ser adicionada no Supabase.</p>
              <p className="text-accent-mid/60 text-xs mt-3 font-mono">Tabela: <span className="text-accent">gifts</span></p>
            </div>
          </FadeUp>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence {...presenceProps({ mode: 'popLayout' as const })}>
              {filtered.map((gift) => (
                <GiftCard key={gift.id} gift={gift} onContribute={setSelectedGift} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* ── Modal de Contribuição ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-accent-mid/50 to-transparent mx-4 sm:mx-6 md:mx-24 mb-20 md:mb-24" />

      <section className="px-4 sm:px-6 md:px-8 pb-20 md:pb-24 max-w-6xl mx-auto">
        <HoneymoonFund />
      </section>

      <AnimatePresence {...presenceProps({})}>
        {selectedGift && (
          <ContributeModal
            gift={selectedGift}
            onClose={() => setSelectedGift(null)}
            onConfirm={handleContribute}
          />
        )}
      </AnimatePresence>

      {/* ── Rodapé ── */}
      <footer className="py-10 bg-forest border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 text-center sm:text-left">
          <p className="font-serif text-lg text-accent-mid">L JM</p>
          <p className="text-xs uppercase tracking-widest text-sage/60">Setembro · 2026</p>
        </div>
      </footer>
    </div>
  )
}
