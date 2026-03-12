import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MOTION_EASE, MOTION_ENABLED, motionProps, motionValue, presenceProps } from '../lib/motion'
import googleMapsIcon from '../assets/img/maps_icons/google-maps-icon.svg'
import appleMapsIcon from '../assets/img/maps_icons/apple-maps-icon.svg'
import wazeIcon from '../assets/img/maps_icons/waze-icon.svg'

// ─── Countdown ────────────────────────────────────────────────────────────────
const WEDDING_DATE = new Date('2026-09-19T16:00:00')

function useCountdown(target: Date) {
  const [t, setT] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  useEffect(() => {
    const tick = () => {
      const diff = target.getTime() - Date.now()
      if (diff <= 0) return setT({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      setT({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])
  return t
}

function CountUnit({ value, label }: { value: number; label: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const shown = MOTION_ENABLED ? inView : false
  return (
    <motion.div ref={ref}
      {...motionProps({
        initial: { y: 16, opacity: 0 },
        animate: shown ? { y: 0, opacity: 1 } : {},
        transition: { duration: 0.75, ease: MOTION_EASE },
      })}
      className="flex flex-col items-center bg-white rounded-2xl p-6 md:p-10 border border-accent-mid/40 shadow-sm shadow-accent/5"
    >
      <span className="font-serif text-4xl md:text-6xl text-forest tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-xs uppercase tracking-widest text-accent mt-2">{label}</span>
    </motion.div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  const shown = MOTION_ENABLED ? inView : true
  return (
    <motion.div ref={ref} className={className}
      {...motionProps({
        initial: { y: 18, opacity: 0 },
        animate: shown ? { y: 0, opacity: 1 } : {},
        transition: { duration: 0.8, delay, ease: MOTION_EASE },
      })}
    >{children}</motion.div>
  )
}

function ScrollPlane({
  children,
  className = '',
  offset = ['start end', 'end start'] as const,
}: {
  children: React.ReactNode
  className?: string
  offset?: NonNullable<Parameters<typeof useScroll>[0]>['offset']
}) {
  const ref = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset })
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [18, 0, -18])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.995, 1, 0.995])

  return (
    <motion.section
      ref={ref}
      style={{ y: motionValue(y, 0), scale: motionValue(scale, 1) }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}


// ─── Modal base ───────────────────────────────────────────────────────────────
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      {...motionProps({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      })}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 bg-forest/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        {...motionProps({
          initial: { y: 40, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: 40, opacity: 0 },
          transition: { duration: 0.4, ease: MOTION_EASE },
        })}
        className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-lg shadow-2xl shadow-forest/20 border border-accent-mid/20 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

// ─── Modal: Boleias ──────────────────────────────────────────────────────────
const SENTIDOS = [
  { value: 'cerimonia', label: 'Para a cerimónia' },
  { value: 'recepcao', label: 'Para a receção' },
  { value: 'regresso', label: 'Para o regresso' },
  { value: 'ambos', label: 'Cerimónia e regresso' },
]

function BoleiasModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [lugares, setLugares] = useState(1)
  const [sentido, setSentido] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !sentido) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('boleias').insert({
      nome: nome.trim(), telefone: telefone.trim() || null,
      lugares, sentido, notas: notas.trim() || null,
    })
    if (err) { setError('Ocorreu um erro. Por favor tenta novamente.'); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-8">
        {/* Handle */}
        <div className="w-10 h-1 bg-accent-mid rounded-full mx-auto mb-6 md:hidden" />

        {done ? (
          <div className="text-center py-8">
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
            <p className="text-gray-400 text-sm">Registámos a tua disponibilidade.</p>
            <button onClick={onClose} className="mt-6 text-sm text-accent font-medium hover:text-accent-dark transition-colors">Fechar</button>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-accent mb-2">Transportes</p>
            <h3 className="font-serif text-2xl text-forest mb-1">Ofereces boleia?</h3>
            <p className="text-gray-400 text-sm mb-6">Regista a tua disponibilidade para ajudar outros convidados.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">O teu nome *</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo"
                  required className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Telemóvel (opcional)</label>
                <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="+351 9XX XXX XXX"
                  className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Lugares disponíveis *</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setLugares(l => Math.max(1, l - 1))}
                    className="w-10 h-10 rounded-full border border-accent-mid/60 text-accent-dark font-medium hover:bg-accent-light transition-colors">−</button>
                  <span className="font-serif text-2xl text-forest w-8 text-center">{lugares}</span>
                  <button type="button" onClick={() => setLugares(l => Math.min(8, l + 1))}
                    className="w-10 h-10 rounded-full border border-accent-mid/60 text-accent-dark font-medium hover:bg-accent-light transition-colors">+</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Para quando? *</label>
                <div className="grid grid-cols-1 gap-2">
                  {SENTIDOS.map(s => (
                    <label key={s.value} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${sentido === s.value ? 'border-accent bg-accent-light/50' : 'border-accent-mid/40 hover:border-accent/40'}`}>
                      <input type="radio" name="sentido" value={s.value} checked={sentido === s.value} onChange={() => setSentido(s.value)} className="accent-accent" />
                      <span className="text-sm text-gray-800">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Notas (opcional)</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Zona de partida, horário preferido…"
                  rows={2} className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all resize-none" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium text-accent-dark bg-accent-light hover:bg-accent-mid/30 transition-colors">Cancelar</button>
                <button type="submit" disabled={loading || !nome.trim() || !sentido}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-forest hover:bg-accent-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? 'A guardar…' : 'Registar'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Modal: Alergias ─────────────────────────────────────────────────────────
const RESTRICOES_COMUNS = ['Glúten', 'Lactose', 'Frutos secos', 'Marisco', 'Ovo', 'Vegetariano', 'Vegan']

function AlergiasModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('')
  const [restricoes, setRestricoes] = useState<string[]>([])
  const [outra, setOutra] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const toggleRestricao = (r: string) =>
    setRestricoes(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    setLoading(true)
    setError('')
    const todasRestricoes = outra.trim() ? [...restricoes, outra.trim()] : restricoes
    const { error: err } = await supabase.from('alergias').insert({
      nome: nome.trim(), restricoes: todasRestricoes, notas: notas.trim() || null,
    })
    if (err) { setError('Ocorreu um erro. Por favor tenta novamente.'); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-8">
        <div className="w-10 h-1 bg-accent-mid rounded-full mx-auto mb-6 md:hidden" />

        {done ? (
          <div className="text-center py-8">
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
            <p className="text-gray-400 text-sm">Registámos as tuas restrições alimentares.</p>
            <button onClick={onClose} className="mt-6 text-sm text-accent font-medium hover:text-accent-dark transition-colors">Fechar</button>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-accent mb-2">Alergias e Intolerâncias</p>
            <h3 className="font-serif text-2xl text-forest mb-1">Restrições alimentares</h3>
            <p className="text-gray-400 text-sm mb-6">Indica-nos se tens alguma alergia ou intolerância para que possamos preparar a ementa.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">O teu nome *</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo"
                  required className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-3">Restrições *</label>
                <div className="flex flex-wrap gap-2">
                  {RESTRICOES_COMUNS.map(r => (
                    <button key={r} type="button" onClick={() => toggleRestricao(r)}
                      className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${restricoes.includes(r) ? 'bg-accent text-white shadow-sm' : 'bg-accent-light text-accent-dark hover:bg-accent-mid/40 border border-accent-mid/40'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Outra restrição</label>
                <input type="text" value={outra} onChange={e => setOutra(e.target.value)} placeholder="Ex: Soja, amendoim…"
                  className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Notas adicionais (opcional)</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Informa-nos de qualquer detalhe adicional…"
                  rows={2} className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all resize-none" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium text-accent-dark bg-accent-light hover:bg-accent-mid/30 transition-colors">Cancelar</button>
                <button type="submit" disabled={loading || !nome.trim() || (restricoes.length === 0 && !outra.trim())}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-forest hover:bg-accent-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? 'A guardar…' : 'Registar'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Cartão de Mapa ──────────────────────────────────────────────────────────
function MapCard({ name, mapQuery, zoom = 16 }: { name: string; mapQuery: string; zoom?: number }) {
  return (
    <div className="relative rounded-3xl overflow-hidden shadow-xl shadow-forest/10 ring-1 ring-forest/10">
      {/* Iframe — altura extra para cortar o painel de detalhes no fundo */}
      <div className="aspect-[4/3] relative overflow-hidden">
        <iframe
          title={`Mapa — ${name}`}
          src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&z=${zoom}&iwloc=`}
          className="absolute w-full"
          style={{ top: '-110px', height: 'calc(80% + 330px)' }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {/* Anel interno */}
      <div className="absolute inset-0 pointer-events-none rounded-3xl ring-inset ring-1 ring-black/8" />
    </div>
  )
}

// ─── Secção de Local ─────────────────────────────────────────────────────────
interface VenueProps {
  id: string
  sectionLabel: string
  name: string
  address: string
  time: string
  mapQuery: string
  googleMapsUrl: string
  appleMapsUrl: string
  wazeUrl: string
  accentBg?: boolean
  mapZoom?: number
}

function VenueSection({ id, name, address, time, mapQuery, googleMapsUrl, appleMapsUrl, wazeUrl, accentBg, mapZoom }: VenueProps) {
  return (
    <ScrollPlane className={`py-20 md:py-28 ${accentBg ? 'bg-accent-light/40' : 'bg-white'}`}>
      <section id={id} className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8">

        {/* Linha superior: info à esquerda, mapa à direita */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start mb-6">

          {/* Esquerda: título + descrição + endereço */}
          <FadeUp className="flex flex-col justify-center h-full">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-forest mb-5">{name}</h2>
            <div className="flex items-start gap-3 text-sm text-gray-500 mb-3">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3A9E8F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{time}</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-gray-500">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3A9E8F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span>{address}</span>
            </div>
          </FadeUp>

          {/* Direita: mapa */}
          <FadeUp delay={0.1}>
            <MapCard name={name} mapQuery={mapQuery} zoom={mapZoom} />
          </FadeUp>
        </div>

        {/* Linha inferior: 3 botões em colunas iguais */}
        <FadeUp delay={0.2}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border border-accent-mid/40 bg-white hover:border-accent hover:shadow-md hover:shadow-accent/10 transition-all duration-200">
                <img src={googleMapsIcon} alt="Google Maps" className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Google Maps</span>
              </a>
              <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border border-accent-mid/40 bg-white hover:border-accent hover:shadow-md hover:shadow-accent/10 transition-all duration-200">
                <img src={appleMapsIcon} alt="Maps" className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Maps</span>
              </a>
              <a href={wazeUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border border-accent-mid/40 bg-white hover:border-accent hover:shadow-md hover:shadow-accent/10 transition-all duration-200">
                <img src={wazeIcon} alt="Waze" className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Waze</span>
              </a>
          </div>
        </FadeUp>

      </section>
    </ScrollPlane>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'cerimonia', label: 'Cerimónia' },
  { id: 'cocktail', label: 'Cocktail' },
  { id: 'presentes', label: 'Lista' },
]

export default function Home() {
  const { days, hours, minutes, seconds } = useCountdown(WEDDING_DATE)
  const [showBoleias, setShowBoleias] = useState(false)
  const [showAlergias, setShowAlergias] = useState(false)
  const { scrollYProgress } = useScroll()
  const heroBackgroundY = useTransform(scrollYProgress, [0, 1], [0, 140])
  const heroPatternY = useTransform(scrollYProgress, [0, 1], [0, 180])
  const heroContentY = useTransform(scrollYProgress, [0, 0.25], [0, 40])
  const heroContentScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.985])
  const heroContentOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0.7])
  const scrollIndicatorY = useTransform(scrollYProgress, [0, 0.2], [0, 56])
  const scrollIndicatorOpacity = useTransform(scrollYProgress, [0, 0.18], [1, 0])

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 md:px-8">
        {/* Gradiente de fundo */}
        <motion.div
          style={{
            y: motionValue(heroBackgroundY, 0),
            background: 'radial-gradient(ellipse 100% 70% at 50% -5%, rgba(58,158,143,0.16) 0%, rgba(107,181,173,0.05) 55%, transparent 72%)',
          }}
          className="absolute inset-0 pointer-events-none"
        />
        <motion.div
          style={{
            y: motionValue(heroPatternY, 0),
            backgroundImage: 'repeating-linear-gradient(45deg, #3A9E8F 0, #3A9E8F 1px, transparent 0, transparent 50%)',
            backgroundSize: '18px 18px',
          }}
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
        />

        <motion.div
          style={{
            y: motionValue(heroContentY, 0),
            scale: motionValue(heroContentScale, 1),
            opacity: motionValue(heroContentOpacity, 1),
          }}
          className="relative text-center max-w-6xl mx-auto w-full origin-center"
        >
          {/* Data */}
          <motion.p
            {...motionProps({
              initial: { opacity: 0, letterSpacing: '0.15em' },
              animate: { opacity: 1, letterSpacing: '0.4em' },
              transition: { duration: 1.4, ease: MOTION_EASE },
            })}
            className="text-xs font-medium text-accent mb-8"
          >
            19 DE SETEMBRO DE 2026
          </motion.p>

          {/* Nome */}
          <motion.h1
            {...motionProps({
              initial: { opacity: 0, y: 28 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 1, delay: 0.2, ease: MOTION_EASE },
            })}
            className="font-serif text-[2.8rem] sm:text-5xl md:text-[6.8rem] leading-[0.92] text-forest mb-8 md:mb-10 text-balance md:whitespace-nowrap"
          >
            Leonor e João Maria
          </motion.h1>

          {/* Locais */}
          <motion.div
            {...motionProps({
              initial: { opacity: 0, y: 10 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.8, delay: 0.9 },
            })}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-10 md:mb-14 px-2"
          >
            <div className="flex items-center justify-center gap-2 text-sm text-sage text-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span className="text-xs uppercase tracking-wider">Igreja</span>
              <span className="text-accent-mid">·</span>
              <span>Igreja Matriz da Azambuja</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-accent-mid/40" />
            <div className="flex items-center justify-center gap-2 text-sm text-sage text-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l19-9-9 19-2-8-8-2z" />
              </svg>
              <span className="text-xs uppercase tracking-wider">Cocktail</span>
              <span className="text-accent-mid">·</span>
              <span>Herdade do Crescido</span>
            </div>
          </motion.div>

          {/* Botões de navegação */}
          <motion.div
            {...motionProps({
              initial: { opacity: 0, y: 10 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.8, delay: 1.1 },
            })}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {NAV_ITEMS.map((item, i) => (
              <motion.button
                key={item.id}
                {...motionProps({
                  initial: { opacity: 0, y: 8 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.5, delay: 1.2 + i * 0.07 },
                })}
                onClick={() => scrollTo(item.id)}
                className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-full text-sm font-medium border border-accent-mid/50 text-accent-dark hover:bg-accent hover:text-white hover:border-accent transition-all duration-300"
              >
                {item.label}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </motion.button>
            ))}
          </motion.div>

        </motion.div>

        {/* Indicador scroll */}
        <motion.div
          {...motionProps({
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: { delay: 2.2, duration: 1 },
          })}
          style={{ y: motionValue(scrollIndicatorY, 0), opacity: motionValue(scrollIndicatorOpacity, 1) }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <motion.div
            {...motionProps({
              animate: { scaleY: [0.4, 1, 0.4], opacity: [0.3, 0.8, 0.3] },
              transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
            })}
            className="w-px h-12 bg-gradient-to-b from-transparent via-accent to-transparent origin-top mx-auto"
          />
        </motion.div>
      </section>

      {/* ── Contagem ─────────────────────────────────────────────────────── */}
      <ScrollPlane className="py-20 md:py-24 bg-accent-light/40 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 50% 100% at 100% 50%, rgba(58,158,143,0.1) 0%, transparent 60%)' }} />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 relative">
          <FadeUp className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-accent font-medium">Contagem decrescente</p>
          </FadeUp>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            <CountUnit value={days} label="Dias" />
            <CountUnit value={hours} label="Horas" />
            <CountUnit value={minutes} label="Minutos" />
            <CountUnit value={seconds} label="Segundos" />
          </div>
        </div>
      </ScrollPlane>

      {/* ── Cerimónia ────────────────────────────────────────────────────── */}
      <VenueSection
        id="cerimonia"
        sectionLabel="19 de Setembro · 16h00"
        name="Igreja Matriz da Azambuja"
        address="Largo da Igreja, 2050-326 Azambuja"
        time="16h00"
        mapQuery="Igreja Matriz da Azambuja, Largo da Igreja, 2050-326 Azambuja, Portugal"
        googleMapsUrl="https://www.google.com/maps/dir/?api=1&destination=Igreja+Matriz+da+Azambuja,+2050-326+Azambuja,+Portugal"
        appleMapsUrl="https://maps.apple.com/?daddr=Igreja+Matriz+da+Azambuja,+Azambuja,+Portugal"
        wazeUrl="https://waze.com/ul?q=Igreja+Matriz+da+Azambuja+Azambuja+Portugal&navigate=yes"
        mapZoom={17}
      />

      {/* ── Cocktail ─────────────────────────────────────────────────────── */}
      <VenueSection
        id="cocktail"
        sectionLabel="19 de Setembro · 18h30"
        name="Herdade do Crescido"
        address="Herdade do Crescido, Valada do Ribatejo, 2070-512 Cartaxo"
        time="18h30"
        mapQuery="Herdade do Crescido, Valada do Ribatejo, 2070-512 Cartaxo, Portugal"
        googleMapsUrl="https://www.google.com/maps/dir/?api=1&destination=Herdade+do+Crescido,+Valada+do+Ribatejo,+2070-512+Cartaxo,+Portugal"
        appleMapsUrl="https://maps.apple.com/?daddr=Herdade+do+Crescido,+Valada+do+Ribatejo,+Cartaxo,+Portugal"
        wazeUrl="https://waze.com/ul?q=Herdade+do+Crescido+Valada+do+Ribatejo+Cartaxo+Portugal&navigate=yes"
        accentBg
        mapZoom={15}
      />

      {/* ── Lista de Presentes ───────────────────────────────────────────── */}
      <section id="presentes" className="py-20 md:py-28 bg-forest relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 80% at 85% 40%, rgba(107,181,173,0.18) 0%, transparent 55%)' }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 40% 50% at 10% 70%, rgba(58,158,143,0.12) 0%, transparent 50%)' }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
            <FadeUp>
              <p className="text-xs uppercase tracking-widest text-sage mb-4">Lista</p>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white mb-6 leading-tight">
                Contribui para o nosso novo capítulo.
              </h2>
              <p className="text-accent-mid text-sm leading-relaxed">
                Se quiserem contribuir para a nossa nova casa ou para a nossa lua de mel, preparámos uma pequena lista.
              </p>
            </FadeUp>
            <FadeUp delay={0.15} className="flex md:justify-end">
              <Link to="/gifts"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-3 bg-accent text-white text-sm font-medium px-8 py-4 rounded-full hover:bg-sage transition-all duration-300 shadow-xl shadow-accent/25 group">
                Ver Lista
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="group-hover:translate-x-1 transition-transform duration-300">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── Transportes ─────────────────────────────────────────────────── */}
      <ScrollPlane className="py-16 md:py-22 bg-white">
        <section id="transportes" className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-center">
            <FadeUp>
              <p className="text-[11px] uppercase tracking-[0.28em] text-accent/80 font-medium mb-3">Transportes</p>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-[2.2rem] text-forest mb-4 leading-tight">Vens de carro?</h2>
              <p className="text-gray-500 text-sm leading-relaxed max-w-md">
                Se podes oferecer ou precisas de boleia para a cerimónia ou para o regresso, regista-te aqui. Vamos tentar ligar quem precisa de transporte com quem pode ajudar.
              </p>
            </FadeUp>
            <FadeUp delay={0.15} className="flex md:justify-end">
              <button onClick={() => setShowBoleias(true)}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 border border-accent-mid/40 bg-accent-light/40 text-accent-dark text-sm font-medium px-6 py-3 rounded-full hover:bg-accent-light hover:border-accent/40 transition-all duration-300 group">
                Registar Boleia
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="group-hover:translate-x-0.5 transition-transform duration-300">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </FadeUp>
          </div>
        </section>
      </ScrollPlane>

      {/* ── Alergias ────────────────────────────────────────────────────── */}
      <section id="alergias" className="py-16 md:py-22 bg-accent-light/25">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-center">
            <FadeUp>
              <p className="text-[11px] uppercase tracking-[0.28em] text-accent/80 font-medium mb-3">Alergias e Intolerâncias</p>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-[2.2rem] text-forest mb-4 leading-tight">Tens alguma restrição alimentar?</h2>
              <p className="text-gray-500 text-sm leading-relaxed max-w-md">
                Para garantir que toda a gente desfruta da refeição com segurança, pedimos que nos indiques quaisquer alergias ou intolerâncias alimentares.
              </p>
            </FadeUp>
            <FadeUp delay={0.15} className="flex md:justify-end">
              <button onClick={() => setShowAlergias(true)}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 border border-accent-mid/40 bg-white/70 text-accent-dark text-sm font-medium px-6 py-3 rounded-full hover:bg-white hover:border-accent/40 transition-all duration-300 group">
                Registar Alergias
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="group-hover:translate-x-0.5 transition-transform duration-300">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── Rodapé ───────────────────────────────────────────────────────── */}
      <footer className="py-10 bg-forest border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 text-center sm:text-left">
          <p className="font-serif text-lg text-accent-mid">L JM</p>
          <p className="text-xs uppercase tracking-widest text-sage/60">19 Setembro · 2026</p>
        </div>
      </footer>

      {/* ── Modais ───────────────────────────────────────────────────────── */}
      <AnimatePresence {...presenceProps({})}>
        {showBoleias && <BoleiasModal onClose={() => setShowBoleias(false)} />}
      </AnimatePresence>
      <AnimatePresence {...presenceProps({})}>
        {showAlergias && <AlergiasModal onClose={() => setShowAlergias(false)} />}
      </AnimatePresence>
    </div>
  )
}
