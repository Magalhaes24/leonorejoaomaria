import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'framer-motion'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/firebase'
import { notifyAdmin } from '../lib/notify'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { MOTION_EASE, MOTION_ENABLED, motionProps, motionValue, presenceProps } from '../lib/motion'
import { copy } from '../lib/i18n'
import { EditableText, EditableImage, useContent, useEditor } from '../components/editor'
import cocktailIcon from '../assets/img/cocktail.png'
import cocktailVenueImage from '../assets/img/tenda-herdade-do-crescido.jpg'
import heroPhotoOne from '../assets/img/fotografia-1.jpeg'
import presencaImage from '../assets/img/fotografia-3.jpeg'
import heroPhotoFour from '../assets/img/fotografia-4.jpeg'
import heroPhoto from '../assets/img/fotografia-5.jpeg'
import listSectionImage from '../assets/img/nova-zelandia.jpg'
import ceremonyVenueImage from '../assets/img/igreja-matriz-da-azambuja.jpg'
import googleMapsIcon from '../assets/img/maps_icons/google-maps-icon.svg'
import appleMapsIcon from '../assets/img/maps_icons/apple-maps-icon.svg'
import wazeIcon from '../assets/img/maps_icons/waze-icon.svg'

const DEFAULT_HOME_SECTION_ORDER = ['countdown', 'ceremony', 'cocktail', 'list', 'info', 'presenca'] as const

// ─── Countdown ────────────────────────────────────────────────────────────────
const DEFAULT_WEDDING_TIMESTAMP = new Date('2026-09-19T15:00:00').getTime()
const MONTHS: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
}

function useCountdown(targetTimestamp: number) {
  const [t, setT] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  useEffect(() => {
    const tick = () => {
      const diff = targetTimestamp - Date.now()
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
  }, [targetTimestamp])
  return t
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function parseWeddingTimestamp(dateText: string, timeText: string) {
  const normalizedDate = normalizeText(dateText)
  const normalizedTime = normalizeText(timeText)

  const dateMatch = normalizedDate.match(/(\d{1,2})(?:\s+de)?\s+([a-z]+)(?:\s+de)?\s+(\d{4})/)
  const timeMatch = normalizedTime.match(/(\d{1,2})(?:[:h](\d{2}))?/)

  if (!dateMatch || !timeMatch) return DEFAULT_WEDDING_TIMESTAMP

  const day = Number(dateMatch[1])
  const month = MONTHS[dateMatch[2]]
  const year = Number(dateMatch[3])
  const hours = Number(timeMatch[1])
  const minutes = Number(timeMatch[2] ?? '0')

  if (
    Number.isNaN(day) ||
    month === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return DEFAULT_WEDDING_TIMESTAMP
  }

  return new Date(year, month, day, hours, minutes, 0, 0).getTime()
}

function buildMapLinks(address: string) {
  const normalizedAddress = address.trim()
  const encodedAddress = encodeURIComponent(normalizedAddress)

  return {
    mapQuery: normalizedAddress,
    googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
    appleMapsUrl: `https://maps.apple.com/?daddr=${encodedAddress}`,
    wazeUrl: `https://waze.com/ul?q=${encodedAddress}&navigate=yes`,
  }
}

function parseSectionOrder(value: string, defaults: readonly string[]) {
  const allowed = new Set(defaults)
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => allowed.has(item))

  const missing = defaults.filter((item) => !parsed.includes(item))
  return [...parsed, ...missing]
}


function CountUnit({ value, label, contentKey }: { value: number; label: string; contentKey?: string }) {
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
      <span className="text-xs uppercase tracking-widest text-accent mt-2">
        {contentKey ? <EditableText contentKey={contentKey} fallback={label} tag="span" /> : label}
      </span>
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
  style,
}: {
  children: React.ReactNode
  className?: string
  offset?: NonNullable<Parameters<typeof useScroll>[0]>['offset']
  style?: CSSProperties
}) {
  const ref = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset })
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [18, 0, -18])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.995, 1, 0.995])

  return (
    <motion.section
      ref={ref}
      style={{ y: motionValue(y, 0), scale: motionValue(scale, 1), ...style }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

function scrollTo(id: string) {
  const element = document.getElementById(id)
  if (!element) return

  const navbarOffset = window.innerWidth >= 768 ? 116 : 84
  const top = element.getBoundingClientRect().top + window.scrollY - navbarOffset

  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
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
const SENTIDOS = copy.home.boleias.options

function BoleiasModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [lugares, setLugares] = useState(1)
  const [sentido, setSentido] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const closeLabel = useContent('home.boleias.close', copy.home.boleias.modal.close)
  const cancelLabel = useContent('home.boleias.cancel', copy.home.boleias.modal.cancel)
  const submitLabel = useContent('home.boleias.submit', copy.home.boleias.modal.submit)
  const loadingLabel = useContent('home.boleias.loading', copy.home.boleias.modal.loading)
  const namePlaceholder = useContent('home.boleias.name_placeholder', copy.home.boleias.modal.namePlaceholder)
  const phonePlaceholder = useContent('home.boleias.phone_placeholder', copy.home.boleias.modal.phonePlaceholder)
  const notesPlaceholder = useContent('home.boleias.notes_placeholder', copy.home.boleias.modal.notesPlaceholder)
  const introTag = useContent('home.boleias.intro_tag', copy.home.boleias.modal.introTag)
  const title = useContent('home.boleias.title', copy.home.boleias.modal.title)
  const description = useContent('home.boleias.description', copy.home.boleias.modal.description)
  const nameLabel = useContent('home.boleias.name_label', copy.home.boleias.modal.nameLabel)
  const phoneLabel = useContent('home.boleias.phone_label', copy.home.boleias.modal.phoneLabel)
  const seatsLabel = useContent('home.boleias.seats_label', copy.home.boleias.modal.seatsLabel)
  const whenLabel = useContent('home.boleias.when_label', copy.home.boleias.modal.whenLabel)
  const notesLabel = useContent('home.boleias.notes_label', copy.home.boleias.modal.notesLabel)
  const successTitle = useContent('home.boleias.success_title', copy.home.boleias.modal.successTitle)
  const successMessage = useContent('home.boleias.success_message', copy.home.boleias.modal.successMessage)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !sentido) return
    setLoading(true)
    setError('')
    try {
      await addDoc(collection(db, 'boleias'), {
        nome: nome.trim(), telefone: telefone.trim() || null,
        lugares, sentido, notas: notas.trim() || null,
        created_at: serverTimestamp(),
      })
    } catch {
      setError(copy.home.boleias.modal.error); setLoading(false); return
    }
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
            <h3 className="font-serif text-2xl text-forest mb-2"><EditableText contentKey="home.boleias.success_title" fallback={successTitle} tag="span" /></h3>
            <p className="text-gray-400 text-sm"><EditableText contentKey="home.boleias.success_message" fallback={successMessage} tag="span" /></p>
            <button onClick={onClose} className="mt-6 text-sm text-accent font-medium hover:text-accent-dark transition-colors"><EditableText contentKey="home.boleias.close" fallback={closeLabel} tag="span" /></button>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-accent mb-2"><EditableText contentKey="home.boleias.intro_tag" fallback={introTag} tag="span" /></p>
            <h3 className="font-serif text-2xl text-forest mb-1"><EditableText contentKey="home.boleias.title" fallback={title} tag="span" /></h3>
            <p className="text-gray-400 text-sm mb-6"><EditableText contentKey="home.boleias.description" fallback={description} tag="span" multiline /></p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2"><EditableText contentKey="home.boleias.name_label" fallback={nameLabel} tag="span" /></label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder={namePlaceholder}
                  required className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2"><EditableText contentKey="home.boleias.phone_label" fallback={phoneLabel} tag="span" /></label>
                <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder={phonePlaceholder}
                  className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2"><EditableText contentKey="home.boleias.seats_label" fallback={seatsLabel} tag="span" /></label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setLugares(l => Math.max(1, l - 1))}
                    className="w-10 h-10 rounded-full border border-accent-mid/60 text-accent-dark font-medium hover:bg-accent-light transition-colors">−</button>
                  <span className="font-serif text-2xl text-forest w-8 text-center">{lugares}</span>
                  <button type="button" onClick={() => setLugares(l => Math.min(8, l + 1))}
                    className="w-10 h-10 rounded-full border border-accent-mid/60 text-accent-dark font-medium hover:bg-accent-light transition-colors">+</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2"><EditableText contentKey="home.boleias.when_label" fallback={whenLabel} tag="span" /></label>
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
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2"><EditableText contentKey="home.boleias.notes_label" fallback={notesLabel} tag="span" /></label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder={notesPlaceholder}
                  rows={2} className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all resize-none" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium text-accent-dark bg-accent-light hover:bg-accent-mid/30 transition-colors"><EditableText contentKey="home.boleias.cancel" fallback={cancelLabel} tag="span" /></button>
                <button type="submit" disabled={loading || !nome.trim() || !sentido}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-forest hover:bg-accent-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <EditableText contentKey={loading ? 'home.boleias.loading' : 'home.boleias.submit'} fallback={loading ? loadingLabel : submitLabel} tag="span" />
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
const RESTRICOES_COMUNS = copy.home.boleias.commonRestrictions

function AlergiasModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('')
  const [restricoes, setRestricoes] = useState<string[]>([])
  const [outra, setOutra] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const closeLabel = useContent('home.allergies_modal.close', copy.home.allergiesModal.close)
  const cancelLabel = useContent('home.allergies_modal.cancel', copy.home.allergiesModal.cancel)
  const submitLabel = useContent('home.allergies_modal.submit', copy.home.allergiesModal.submit)
  const loadingLabel = useContent('home.allergies_modal.loading', copy.home.allergiesModal.loading)
  const namePlaceholder = useContent('home.allergies_modal.name_placeholder', copy.home.allergiesModal.namePlaceholder)
  const otherPlaceholder = useContent('home.allergies_modal.other_placeholder', copy.home.allergiesModal.otherRestrictionPlaceholder)
  const notesPlaceholder = useContent('home.allergies_modal.notes_placeholder', copy.home.allergiesModal.notesPlaceholder)
  const introTag = useContent('home.allergies_modal.intro_tag', copy.home.allergiesModal.introTag)
  const title = useContent('home.allergies_modal.title', copy.home.allergiesModal.title)
  const description = useContent('home.allergies_modal.description', copy.home.allergiesModal.description)
  const nameLabel = useContent('home.allergies_modal.name_label', copy.home.allergiesModal.nameLabel)
  const restrictionsLabel = useContent('home.allergies_modal.restrictions_label', copy.home.allergiesModal.restrictionsLabel)
  const otherLabel = useContent('home.allergies_modal.other_label', copy.home.allergiesModal.otherRestrictionLabel)
  const notesLabel = useContent('home.allergies_modal.notes_label', copy.home.allergiesModal.notesLabel)
  const successTitle = useContent('home.allergies_modal.success_title', copy.home.allergiesModal.successTitle)
  const successMessage = useContent('home.allergies_modal.success_message', copy.home.allergiesModal.successMessage)

  const toggleRestricao = (r: string) =>
    setRestricoes(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    setLoading(true)
    setError('')
    const todasRestricoes = outra.trim() ? [...restricoes, outra.trim()] : restricoes
    try {
      await addDoc(collection(db, 'alergias'), {
        nome: nome.trim(), restricoes: todasRestricoes, notas: notas.trim() || null,
        created_at: serverTimestamp(),
      })
    } catch {
      setError(copy.home.allergiesModal.error); setLoading(false); return
    }
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
            <h3 className="font-serif text-2xl text-forest mb-2"><EditableText contentKey="home.allergies_modal.success_title" fallback={successTitle} tag="span" /></h3>
            <p className="text-gray-400 text-sm"><EditableText contentKey="home.allergies_modal.success_message" fallback={successMessage} tag="span" /></p>
            <button onClick={onClose} className="mt-6 text-sm text-accent font-medium hover:text-accent-dark transition-colors"><EditableText contentKey="home.allergies_modal.close" fallback={closeLabel} tag="span" /></button>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-accent mb-2"><EditableText contentKey="home.allergies_modal.intro_tag" fallback={introTag} tag="span" /></p>
            <h3 className="font-serif text-2xl text-forest mb-1"><EditableText contentKey="home.allergies_modal.title" fallback={title} tag="span" /></h3>
            <p className="text-gray-400 text-sm mb-6"><EditableText contentKey="home.allergies_modal.description" fallback={description} tag="span" multiline /></p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2"><EditableText contentKey="home.allergies_modal.name_label" fallback={nameLabel} tag="span" /></label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder={namePlaceholder}
                  required className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-3"><EditableText contentKey="home.allergies_modal.restrictions_label" fallback={restrictionsLabel} tag="span" /></label>
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
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2"><EditableText contentKey="home.allergies_modal.other_label" fallback={otherLabel} tag="span" /></label>
                <input type="text" value={outra} onChange={e => setOutra(e.target.value)} placeholder={otherPlaceholder}
                  className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2"><EditableText contentKey="home.allergies_modal.notes_label" fallback={notesLabel} tag="span" /></label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder={notesPlaceholder}
                  rows={2} className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all resize-none" />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium text-accent-dark bg-accent-light hover:bg-accent-mid/30 transition-colors"><EditableText contentKey="home.allergies_modal.cancel" fallback={cancelLabel} tag="span" /></button>
                <button type="submit" disabled={loading || !nome.trim() || (restricoes.length === 0 && !outra.trim())}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-forest hover:bg-accent-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <EditableText contentKey={loading ? 'home.allergies_modal.loading' : 'home.allergies_modal.submit'} fallback={loading ? loadingLabel : submitLabel} tag="span" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Modal: Presença ─────────────────────────────────────────────────────────
const OPCOES_PRESENCA = copy.home.presencaModal.opcoes

function PresencaModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('')
  const [presenca, setPresenca] = useState<'tudo' | 'missa' | 'festa' | 'nao' | ''>('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const modalTag = useContent('home.presenca_modal.tag', copy.home.presencaModal.tag)
  const modalTitle = useContent('home.presenca_modal.title', copy.home.presencaModal.title)
  const nameLabel = useContent('home.presenca_modal.name_label', copy.home.presencaModal.nameLabel)
  const namePlaceholder = useContent('home.presenca_modal.name_placeholder', copy.home.presencaModal.namePlaceholder)
  const presencaLabel = useContent('home.presenca_modal.presenca_label', copy.home.presencaModal.presencaLabel)
  const cancelLabel = useContent('home.presenca_modal.cancel', copy.home.presencaModal.cancel)
  const submitLabel = useContent('home.presenca_modal.submit', copy.home.presencaModal.submit)
  const loadingLabel = useContent('home.presenca_modal.loading', copy.home.presencaModal.loading)
  const successTitle = useContent('home.presenca_modal.success_title', copy.home.presencaModal.successTitle)
  const successMessage = useContent('home.presenca_modal.success_message', copy.home.presencaModal.successMessage)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !presenca) return
    setLoading(true)
    setError('')
    try {
      await addDoc(collection(db, 'presencas'), {
        nome: nome.trim(),
        presenca,
        created_at: serverTimestamp(),
      })
      const presencaLabels: Record<string, string> = {
        tudo: 'Missa e festa',
        missa: 'Só missa',
        festa: 'Só festa',
        nao: 'Não vai poder ir',
      }
      void notifyAdmin('Nova presença confirmada 🎉', {
        Nome: nome.trim(),
        Presença: presencaLabels[presenca] ?? presenca,
      })
    } catch {
      setError(copy.home.presencaModal.error)
      setLoading(false)
      return
    }
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
            <h3 className="font-serif text-2xl text-forest mb-2"><EditableText contentKey="home.presenca_modal.success_title" fallback={successTitle} tag="span" /></h3>
            <p className="text-gray-400 text-sm"><EditableText contentKey="home.presenca_modal.success_message" fallback={successMessage} tag="span" /></p>
            <button onClick={onClose} className="mt-6 text-sm text-accent font-medium hover:text-accent-dark transition-colors">{copy.home.presencaModal.close}</button>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-accent mb-2"><EditableText contentKey="home.presenca_modal.tag" fallback={modalTag} tag="span" /></p>
            <h3 className="font-serif text-2xl text-forest mb-6"><EditableText contentKey="home.presenca_modal.title" fallback={modalTitle} tag="span" /></h3>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2"><EditableText contentKey="home.presenca_modal.name_label" fallback={nameLabel} tag="span" /></label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                  placeholder={namePlaceholder} required
                  className="w-full bg-accent-light/40 border border-accent-mid/40 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all" />
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider block mb-3"><EditableText contentKey="home.presenca_modal.presenca_label" fallback={presencaLabel} tag="span" /></label>
                <div className="grid grid-cols-1 gap-2">
                  {OPCOES_PRESENCA.map(op => (
                    <label key={op.value}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                        presenca === op.value
                          ? 'border-accent bg-accent-light/50'
                          : 'border-accent-mid/40 hover:border-accent/40'
                      }`}
                    >
                      <input type="radio" name="presenca" value={op.value}
                        checked={presenca === op.value}
                        onChange={() => setPresenca(op.value as typeof presenca)}
                        className="accent-accent" />
                      <span className="text-sm text-gray-800">{op.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-accent-dark bg-accent-light hover:bg-accent-mid/30 transition-colors">
                  <EditableText contentKey="home.presenca_modal.cancel" fallback={cancelLabel} tag="span" />
                </button>
                <button type="submit" disabled={loading || !nome.trim() || !presenca}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-forest hover:bg-accent-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <EditableText contentKey={loading ? 'home.presenca_modal.loading' : 'home.presenca_modal.submit'} fallback={loading ? loadingLabel : submitLabel} tag="span" />
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
function MapCard({
  name,
  mapQuery,
  zoom = 16,
  fillHeight = false,
}: {
  name: string
  mapQuery: string
  zoom?: number
  fillHeight?: boolean
}) {
  return (
    <div className={`relative rounded-3xl overflow-hidden shadow-xl shadow-forest/10 ring-1 ring-forest/10 ${fillHeight ? 'h-full' : ''}`}>
      {/* Iframe — altura extra para cortar o painel de detalhes no fundo */}
      <div className={`relative overflow-hidden ${fillHeight ? 'h-full min-h-[26rem]' : 'aspect-[4/3]'}`}>
        <iframe
          title={`Mapa - ${name}`}
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
  imageSrc: string
  imageKey?: string
  mapQuery: string
  googleMapsUrl: string
  appleMapsUrl: string
  wazeUrl: string
  accentBg?: boolean
  mapZoom?: number
  reverseLayout?: boolean
  layoutKey?: string
  nameKey?: string
  addressKey?: string
  timeKey?: string
  style?: CSSProperties
}

function VenueSection({
  id,
  name,
  address,
  time,
  imageSrc,
  imageKey,
  mapQuery,
  googleMapsUrl,
  appleMapsUrl,
  wazeUrl,
  accentBg,
  mapZoom,
  reverseLayout = false,
  layoutKey,
  nameKey,
  addressKey,
  timeKey,
  style,
}: VenueProps) {
  const { isEditMode, getContent, updateContent } = useEditor()
  const googleMapsLabel = useContent('home.venue_actions.google_maps', copy.home.venueActions.googleMaps)
  const appleMapsLabel = useContent('home.venue_actions.apple_maps', copy.home.venueActions.appleMaps)
  const wazeLabel = useContent('home.venue_actions.waze', copy.home.venueActions.waze)

  const effectiveReverse = layoutKey
    ? getContent(layoutKey, String(reverseLayout)) === 'true'
    : reverseLayout

  return (
    <ScrollPlane style={style} className={`relative py-20 md:py-28 ${accentBg ? 'bg-accent-light/40' : 'bg-white'}`}>
      {/* Layout flip button — edit mode only */}
      {isEditMode && layoutKey && (
        <button
          type="button"
          onClick={() => updateContent(layoutKey, String(!effectiveReverse))}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-accent-mid/30 rounded-full px-3 py-1.5 text-xs font-medium text-forest shadow-sm hover:bg-accent-light hover:border-accent transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" />
          </svg>
          Inverter layout
        </button>
      )}

      <section id={id} className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8">

        {/* Linha superior: info à esquerda, mapa à direita */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-stretch mb-6">

          {/* Esquerda: título + descrição + endereço */}
          <FadeUp className={`flex h-full flex-col justify-center ${effectiveReverse ? 'md:order-2' : ''}`}>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-forest mb-5">
              {nameKey ? <EditableText contentKey={nameKey} fallback={name} tag="span" /> : name}
            </h2>
            <div className="flex items-center gap-3 mb-3">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-base font-semibold text-forest">{timeKey ? <EditableText contentKey={timeKey} fallback={time} tag="span" /> : time}</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-gray-500">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span>{addressKey ? <EditableText contentKey={addressKey} fallback={address} tag="span" /> : address}</span>
            </div>
            <div className="relative mt-6 overflow-hidden rounded-3xl shadow-xl shadow-forest/10 ring-1 ring-forest/10">
              <div className="aspect-[4/3]">
                {imageKey ? (
                  <EditableImage contentKey={imageKey} fallback={imageSrc} alt={name} imgClassName="h-full w-full object-cover" />
                ) : (
                  <img src={imageSrc} alt={name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="absolute inset-0 pointer-events-none rounded-3xl ring-inset ring-1 ring-black/8" />
            </div>
          </FadeUp>

          <FadeUp delay={0.12} className={`h-full ${effectiveReverse ? 'md:order-1' : ''}`}>
            <MapCard name={name} mapQuery={mapQuery} zoom={mapZoom} fillHeight />
          </FadeUp>
        </div>

        {/* Linha inferior: 3 botões em colunas iguais */}
        <FadeUp delay={0.2}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border border-accent-mid/40 bg-white hover:border-accent hover:shadow-md hover:shadow-accent/10 transition-all duration-200">
                <img src={googleMapsIcon} alt={googleMapsLabel} className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap"><EditableText contentKey="home.venue_actions.google_maps" fallback={googleMapsLabel} tag="span" /></span>
              </a>
              <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border border-accent-mid/40 bg-white hover:border-accent hover:shadow-md hover:shadow-accent/10 transition-all duration-200">
                <img src={appleMapsIcon} alt={appleMapsLabel} className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap"><EditableText contentKey="home.venue_actions.apple_maps" fallback={appleMapsLabel} tag="span" /></span>
              </a>
              <a href={wazeUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border border-accent-mid/40 bg-white hover:border-accent hover:shadow-md hover:shadow-accent/10 transition-all duration-200">
                <img src={wazeIcon} alt={wazeLabel} className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap"><EditableText contentKey="home.venue_actions.waze" fallback={wazeLabel} tag="span" /></span>
              </a>
          </div>
        </FadeUp>

      </section>
    </ScrollPlane>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'cerimonia', label: copy.home.locations.churchLabel },
  { id: 'cocktail', label: copy.home.locations.cocktailLabel },
  { id: 'lista', label: copy.home.listSection.tag },
  { id: 'presenca', label: copy.home.presenca.tag, highlight: true },
]

export default function Home() {
  const [showBoleias, setShowBoleias] = useState(false)
  const [showAlergias, setShowAlergias] = useState(false)
  const [showPresenca, setShowPresenca] = useState(false)
  const { isEditMode, updateContent, getContent } = useEditor()
  const listReversed = getContent('home.list.reverse_layout', 'false') === 'true'
  const heroTag = useContent('home.hero.tag', copy.home.hero.tag)
  const ceremonyName = useContent('home.venue.ceremony.name', copy.home.venues.ceremony.name)
  const ceremonyAddress = useContent('home.venue.ceremony.address', copy.home.venues.ceremony.address)
  const ceremonyTime = useContent('home.venue.ceremony.time', copy.home.venues.ceremony.time)
  const cocktailName = useContent('home.venue.cocktail.name', copy.home.venues.cocktail.name)
  const cocktailAddress = useContent('home.venue.cocktail.address', copy.home.venues.cocktail.address)
  const cocktailTime = useContent('home.venue.cocktail.time', copy.home.venues.cocktail.time)
  const listCtaLabel = useContent('home.list.cta', copy.home.listSection.cta)
  const transportCtaLabel = useContent('home.transport.cta', copy.home.transport.cta)
  const allergiesCtaLabel = useContent('home.allergies.cta', copy.home.allergies.cta)

  const homeSectionOrder = parseSectionOrder(
    useContent('layout.home_order', DEFAULT_HOME_SECTION_ORDER.join(',')),
    DEFAULT_HOME_SECTION_ORDER,
  )
  const weddingTimestamp = parseWeddingTimestamp(heroTag, ceremonyTime)
  const { days, hours, minutes, seconds } = useCountdown(weddingTimestamp)
  const ceremonyMaps = buildMapLinks(ceremonyAddress)
  const cocktailMaps = buildMapLinks(cocktailAddress)
  const ceremonyGmaps = useContent('home.venue.ceremony.gmaps', ceremonyMaps.googleMapsUrl)
  const ceremonyApple = useContent('home.venue.ceremony.apple', ceremonyMaps.appleMapsUrl)
  const ceremonyWaze = useContent('home.venue.ceremony.waze', ceremonyMaps.wazeUrl)
  const cocktailGmaps = useContent('home.venue.cocktail.gmaps', cocktailMaps.googleMapsUrl)
  const cocktailApple = useContent('home.venue.cocktail.apple', cocktailMaps.appleMapsUrl)
  const cocktailWaze = useContent('home.venue.cocktail.waze', cocktailMaps.wazeUrl)
  const { scrollYProgress } = useScroll()
  const heroBackgroundY = useTransform(scrollYProgress, [0, 1], [0, 140])
  const heroPatternY = useTransform(scrollYProgress, [0, 1], [0, 180])
  const heroContentY = useTransform(scrollYProgress, [0, 0.25], [0, 40])
  const heroContentScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.985])
  const heroContentOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0.7])
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 md:px-8">
        {/* Gradiente de fundo */}
        <motion.div
          style={{
            y: motionValue(heroBackgroundY, 0),
            background: 'radial-gradient(ellipse 100% 70% at 50% -5%, color-mix(in srgb, var(--color-accent) 16%, transparent) 0%, color-mix(in srgb, var(--color-sage) 5%, transparent) 55%, transparent 72%)',
          }}
          className="absolute inset-0 pointer-events-none"
        />
        <motion.div
          style={{
            y: motionValue(heroPatternY, 0),
            backgroundImage: 'repeating-linear-gradient(45deg, var(--color-accent) 0, var(--color-accent) 1px, transparent 0, transparent 50%)',
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
          className="relative text-center max-w-6xl mx-auto w-full origin-center pt-16 pb-8 md:pt-0 md:pb-0"
        >
          {/* Data */}
          <motion.p
            {...motionProps({
              initial: { opacity: 0, letterSpacing: '0.15em' },
              animate: { opacity: 1, letterSpacing: '0.3em' },
              transition: { duration: 1.4, ease: MOTION_EASE },
            })}
            className="text-sm sm:text-base font-semibold text-accent mb-8 tracking-[0.3em]"
          >
            <EditableText contentKey="home.hero.tag" fallback={copy.home.hero.tag} tag="span" />
          </motion.p>

          <motion.div
            {...motionProps({
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.9, delay: 0.12, ease: MOTION_EASE },
            })}
            className="mx-auto mb-8 flex w-[19rem] items-end justify-center gap-3 sm:mb-10 sm:w-[24rem] md:w-[30rem]"
          >
            <div className="h-32 w-20 overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/80 p-1 shadow-xl shadow-forest/10 sm:h-40 sm:w-24 md:h-52 md:w-32 md:-rotate-6">
              <EditableImage contentKey="home.hero.photo_1" fallback={heroPhoto} alt="Leonor e João Maria" imgClassName="h-full w-full rounded-[1.2rem] object-cover" />
            </div>
            <div className="h-40 w-28 overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-1.5 shadow-2xl shadow-forest/15 sm:h-52 sm:w-36 md:h-72 md:w-48">
              <EditableImage contentKey="home.hero.photo_2" fallback={heroPhotoOne} alt="Leonor e João Maria" imgClassName="h-full w-full rounded-[1.5rem] object-cover" />
            </div>
            <div className="h-28 w-[4.5rem] overflow-hidden rounded-[1.4rem] border border-white/70 bg-white/80 p-1 shadow-xl shadow-forest/10 sm:h-36 sm:w-24 md:h-48 md:w-[7.5rem] md:rotate-6">
              <EditableImage contentKey="home.hero.photo_3" fallback={heroPhotoFour} alt="Leonor e João Maria" imgClassName="h-full w-full rounded-[1rem] object-cover" />
            </div>
          </motion.div>

          {/* Nome */}
          <motion.h1
            {...motionProps({
              initial: { opacity: 0, y: 28 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 1, delay: 0.2, ease: MOTION_EASE },
            })}
            className="font-serif text-[2.8rem] sm:text-5xl md:text-[6.8rem] leading-[0.92] text-forest mb-8 md:mb-10 text-balance md:whitespace-nowrap"
          >
            <EditableText contentKey="home.hero.couple_name" fallback={copy.home.coupleName} tag="span" />
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
              <span className="text-xs uppercase tracking-wider"><EditableText contentKey="home.hero.church_label" fallback={copy.home.locations.churchLabel} tag="span" /></span>
              <span className="text-accent-mid">·</span>
              <span><EditableText contentKey="home.venue.ceremony.name" fallback={copy.home.locations.churchName} tag="span" /></span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-accent-mid/40" />
            <div className="flex items-center justify-center gap-2 text-sm text-sage text-center">
              <img src={cocktailIcon} alt="" className="h-[13px] w-[13px] object-contain" />
              <span className="text-xs uppercase tracking-wider"><EditableText contentKey="home.hero.cocktail_label" fallback={copy.home.locations.cocktailLabel} tag="span" /></span>
              <span className="text-accent-mid">·</span>
              <span><EditableText contentKey="home.venue.cocktail.name" fallback={copy.home.locations.cocktailName} tag="span" /></span>
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
                className={`flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-full text-sm font-medium border transition-all duration-300 ${'highlight' in item && item.highlight ? 'bg-forest text-white border-forest hover:bg-accent-dark hover:border-accent-dark shadow-lg shadow-forest/20' : 'border-accent-mid/50 text-accent-dark hover:bg-accent hover:text-white hover:border-accent'}`}
              >
                {item.label}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </motion.button>
            ))}
          </motion.div>

        </motion.div>

      </section>

      {/* ── Secções ordenáveis ───────────────────────────────────────────── */}
      {homeSectionOrder.map((sectionId) => {
        if (sectionId === 'countdown') return (
          <ScrollPlane key="countdown" className="py-20 md:py-24 bg-accent-light/40 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 50% 100% at 100% 50%, color-mix(in srgb, var(--color-accent) 10%, transparent) 0%, transparent 60%)' }} />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 relative">
              <FadeUp className="text-center mb-12">
                <p className="text-xs uppercase tracking-widest text-accent font-medium">
                  <EditableText contentKey="home.countdown.title" fallback={copy.home.countdown.title} tag="span" />
                </p>
              </FadeUp>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                <CountUnit value={days} label={copy.home.countdown.days} contentKey="home.countdown.days" />
                <CountUnit value={hours} label={copy.home.countdown.hours} contentKey="home.countdown.hours" />
                <CountUnit value={minutes} label={copy.home.countdown.minutes} contentKey="home.countdown.minutes" />
                <CountUnit value={seconds} label={copy.home.countdown.seconds} contentKey="home.countdown.seconds" />
              </div>
            </div>
          </ScrollPlane>
        )

        if (sectionId === 'ceremony') return (
          <VenueSection key="ceremony"
            id="cerimonia"
            sectionLabel={copy.home.venues.ceremony.sectionLabel}
            name={ceremonyName}
            address={ceremonyAddress}
            time={ceremonyTime}
            imageSrc={ceremonyVenueImage}
            imageKey="home.venue.ceremony.image"
            mapQuery={`${ceremonyName}, ${ceremonyAddress}`}
            googleMapsUrl={ceremonyGmaps}
            appleMapsUrl={ceremonyApple}
            wazeUrl={ceremonyWaze}
            mapZoom={17}
            layoutKey="home.venue.ceremony.reverse_layout"
            nameKey="home.venue.ceremony.name"
            addressKey="home.venue.ceremony.address"
            timeKey="home.venue.ceremony.time"
          />
        )

        if (sectionId === 'cocktail') return (
          <VenueSection key="cocktail"
            id="cocktail"
            sectionLabel={copy.home.venues.cocktail.sectionLabel}
            name={cocktailName}
            address={cocktailAddress}
            time={cocktailTime}
            imageSrc={cocktailVenueImage}
            imageKey="home.venue.cocktail.image"
            mapQuery={`${cocktailName}, ${cocktailAddress}`}
            googleMapsUrl={cocktailGmaps}
            appleMapsUrl={cocktailApple}
            wazeUrl={cocktailWaze}
            accentBg
            mapZoom={15}
            reverseLayout
            layoutKey="home.venue.cocktail.reverse_layout"
            nameKey="home.venue.cocktail.name"
            addressKey="home.venue.cocktail.address"
            timeKey="home.venue.cocktail.time"
          />
        )

        if (sectionId === 'list') return (
          <section key="list" id="lista" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent-light) 20%, white) 0%, color-mix(in srgb, var(--color-accent-light) 70%, white) 100%)' }} className="relative overflow-hidden py-20 md:py-28">
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 70% 80% at 85% 40%, color-mix(in srgb, var(--color-sage) 14%, transparent) 0%, transparent 55%)' }} />
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 40% 50% at 10% 70%, color-mix(in srgb, var(--color-accent) 8%, transparent) 0%, transparent 50%)' }} />
            <div className="relative max-w-5xl mx-auto px-4 sm:px-6 md:px-8">
              {isEditMode && (
                <button type="button"
                  onClick={() => updateContent('home.list.reverse_layout', String(!listReversed))}
                  className="absolute top-0 right-0 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-accent-mid/30 rounded-full px-3 py-1.5 text-xs font-medium text-forest shadow-sm hover:bg-accent-light hover:border-accent transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" />
                  </svg>
                  Inverter layout
                </button>
              )}
              <div className="grid items-center gap-10 md:grid-cols-[0.95fr_1.05fr] md:gap-14">
                <FadeUp className={`max-w-xl ${listReversed ? 'md:order-2' : ''}`}>
                  <p className="mb-4 text-xs uppercase tracking-widest text-accent"><EditableText contentKey="home.list.tag" fallback={copy.home.listSection.tag} tag="span" /></p>
                  <h2 className="mb-6 font-serif text-3xl leading-tight text-forest sm:text-4xl md:text-5xl">
                    <EditableText contentKey="home.list.title" fallback={copy.home.listSection.title} tag="span" />
                  </h2>
                  <p className="max-w-lg text-sm leading-relaxed text-gray-500">
                    <EditableText contentKey="home.list.description" fallback={copy.home.listSection.description} tag="span" multiline />
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Link to="/lista" className="group inline-flex w-full items-center justify-center gap-3 rounded-full bg-forest px-8 py-4 text-sm font-medium text-white shadow-xl shadow-forest/15 transition-all duration-300 hover:bg-accent-dark sm:w-auto">
                      <EditableText contentKey="home.list.cta" fallback={listCtaLabel} tag="span" />
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform duration-300"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </Link>
                    <Link to="/lista#lua-de-mel" className="group inline-flex w-full items-center justify-center gap-3 rounded-full border border-accent-mid/50 px-8 py-4 text-sm font-medium text-accent-dark transition-all duration-300 hover:border-accent hover:bg-accent-light sm:w-auto">
                      Lua de mel
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform duration-300"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </Link>
                  </div>
                </FadeUp>
                <FadeUp delay={0.15} className={listReversed ? 'md:order-1' : ''}>
                  <div className="relative overflow-hidden rounded-[32px] shadow-[0_28px_70px_-30px_color-mix(in_srgb,var(--color-forest)_22%,transparent)] ring-1 ring-accent-mid/20">
                    <div className="aspect-[4/3]">
                      <EditableImage contentKey="home.list.image" fallback={listSectionImage} alt={copy.home.listSection.imageAlt} imgClassName="h-full w-full object-cover" />
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/8 via-transparent to-transparent" />
                  </div>
                </FadeUp>
              </div>
            </div>
          </section>
        )

        if (sectionId === 'info') return (
          <section key="info" id="transportes" className="py-18 md:py-24 bg-accent-light/25">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="grid items-stretch gap-10 md:grid-cols-2 md:gap-16">
                <FadeUp className="flex min-h-full flex-col rounded-[28px] border border-accent-mid/20 bg-white/80 p-6 sm:p-7 md:rounded-none md:border-0 md:bg-transparent md:p-0">
                  <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-accent/80"><EditableText contentKey="home.transport.tag" fallback={copy.home.transport.tag} tag="span" /></p>
                  <h2 className="mb-5 font-serif text-2xl leading-tight text-forest sm:text-[2rem]"><EditableText contentKey="home.transport.title" fallback={copy.home.transport.title} tag="span" /></h2>
                  <p className="max-w-md text-gray-500 text-sm leading-relaxed">
                    <EditableText contentKey="home.transport.description" fallback={copy.home.transport.description} tag="span" multiline />
                  </p>
                  <button onClick={() => setShowBoleias(true)}
                    className="group mt-12 inline-flex w-full self-start items-center justify-center gap-2.5 rounded-full border border-accent-mid/40 bg-transparent px-6 py-3 text-sm font-medium text-accent-dark transition-all duration-300 hover:border-accent/40 hover:bg-white/60 sm:w-auto">
                    <EditableText contentKey="home.transport.cta" fallback={transportCtaLabel} tag="span" />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform duration-300"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </FadeUp>
                <FadeUp delay={0.08} className="flex min-h-full flex-col rounded-[28px] border border-accent-mid/20 bg-white/80 p-6 sm:p-7 md:rounded-none md:border-0 md:bg-transparent md:p-0">
                  <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-accent/80"><EditableText contentKey="home.allergies.tag" fallback={copy.home.allergies.tag} tag="span" /></p>
                  <h2 className="mb-5 font-serif text-2xl leading-tight text-forest sm:text-[2rem]"><EditableText contentKey="home.allergies.title" fallback={copy.home.allergies.title} tag="span" /></h2>
                  <p className="max-w-md text-gray-500 text-sm leading-relaxed">
                    <EditableText contentKey="home.allergies.description" fallback={copy.home.allergies.description} tag="span" multiline />
                  </p>
                  <button onClick={() => setShowAlergias(true)}
                    className="group mt-12 inline-flex w-full self-start items-center justify-center gap-2.5 rounded-full border border-accent-mid/40 bg-transparent px-6 py-3 text-sm font-medium text-accent-dark transition-all duration-300 hover:border-accent/40 hover:bg-white/60 sm:w-auto">
                    <EditableText contentKey="home.allergies.cta" fallback={allergiesCtaLabel} tag="span" />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform duration-300"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </FadeUp>
              </div>
            </div>
          </section>
        )

        if (sectionId === 'presenca') return (
          <section key="presenca" id="presenca" className="relative overflow-hidden py-20 md:py-28">
            <div className="relative max-w-5xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="grid items-center gap-10 md:grid-cols-[0.95fr_1.05fr] md:gap-14">
                <FadeUp className="max-w-xl">
                  <p className="mb-4 text-xs uppercase tracking-widest text-accent"><EditableText contentKey="home.presenca.tag" fallback={copy.home.presenca.tag} tag="span" /></p>
                  <h2 className="mb-6 font-serif text-3xl leading-tight text-forest sm:text-4xl md:text-5xl">
                    <EditableText contentKey="home.presenca.title" fallback={copy.home.presenca.title} tag="span" />
                  </h2>
                  <p className="max-w-lg text-sm leading-relaxed text-gray-500">
                    <EditableText contentKey="home.presenca.description" fallback={copy.home.presenca.description} tag="span" multiline />
                  </p>
                  <div className="mt-8">
                    <button
                      onClick={() => setShowPresenca(true)}
                      className="group inline-flex w-full items-center justify-center gap-3 rounded-full bg-forest px-8 py-4 text-sm font-medium text-white shadow-xl shadow-forest/15 transition-all duration-300 hover:bg-accent-dark sm:w-auto"
                    >
                      <EditableText contentKey="home.presenca.cta" fallback={copy.home.presenca.cta} tag="span" />
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className="group-hover:translate-x-1 transition-transform duration-300">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </FadeUp>
                <FadeUp delay={0.15}>
                  <div className="relative overflow-hidden rounded-[32px] shadow-[0_28px_70px_-30px_color-mix(in_srgb,var(--color-forest)_22%,transparent)] ring-1 ring-accent-mid/20">
                    <div className="aspect-[4/3]">
                      <EditableImage contentKey="home.presenca.image" fallback={presencaImage} alt="Leonor e João Maria" imgClassName="h-full w-full object-cover" />
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/8 via-transparent to-transparent" />
                  </div>
                </FadeUp>
              </div>
            </div>
          </section>
        )

        return null
      })}

      {/* ── Rodapé ───────────────────────────────────────────────────────── */}
      <footer className="py-10 bg-forest border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 text-center sm:text-left">
          <p className="font-serif text-lg text-accent-mid"><EditableText contentKey="navbar.brand" fallback={copy.navbar.brand} tag="span" /></p>
          <p className="text-xs uppercase tracking-widest text-sage/60"><EditableText contentKey="home.footer.date" fallback={copy.home.footer.date} tag="span" /></p>
        </div>
      </footer>

      {/* ── Modais ───────────────────────────────────────────────────────── */}
      <AnimatePresence {...presenceProps({})}>
        {showBoleias && <BoleiasModal onClose={() => setShowBoleias(false)} />}
      </AnimatePresence>
      <AnimatePresence {...presenceProps({})}>
        {showAlergias && <AlergiasModal onClose={() => setShowAlergias(false)} />}
      </AnimatePresence>
      <AnimatePresence {...presenceProps({})}>
        {showPresenca && <PresencaModal onClose={() => setShowPresenca(false)} />}
      </AnimatePresence>
    </div>
  )
}
