import { AnimatePresence, motion, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { db, type Gift, type GiftContribution, type HoneymoonContribution } from '../lib/firebase'
import { notifyAdmin } from '../lib/notify'
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { MOTION_EASE, MOTION_ENABLED, motionProps, presenceProps } from '../lib/motion'
import { copy } from '../lib/i18n'
import honeymoonImage from '../assets/img/nova-zelandia.jpg'
import mbwayIcon from '../assets/img/payment_icons/mbway.svg'
import revolutIcon from '../assets/img/payment_icons/revolut.svg'
import { EditableText, EditableImage, useContent } from '../components/editor'
import { useEditor } from '../components/editor'

type GiftWithProgress = Gift & { contributed: number }
const DEFAULT_LISTA_SECTION_ORDER = ['gifts', 'honeymoon'] as const

const DEFAULT_IBAN_VALUE = 'PT50 0023 0000 45479638251 94'

function parseSectionOrder(value: string, defaults: readonly string[]) {
  const allowed = new Set(defaults)
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => allowed.has(item))

  const missing = defaults.filter((item) => !parsed.includes(item))
  return [...parsed, ...missing]
}

function createSectionOrderMap(order: string[]) {
  return order.reduce<Record<string, number>>((acc, id, index) => {
    acc[id] = index
    return acc
  }, {})
}


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
  Outro: 'var(--color-accent)',
}

function GiftIcon() {
  const color = CATEGORY_COLORS.Outro
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

function CopyIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M7.5 3H14.6C16.8402 3 17.9603 3 18.816 3.43597C19.5686 3.81947 20.1805 4.43139 20.564 5.18404C21 6.03969 21 7.15979 21 9.4V16.5M6.2 21H14.3C15.4201 21 15.9802 21 16.408 20.782C16.7843 20.5903 17.0903 20.2843 17.282 19.908C17.5 19.4802 17.5 18.9201 17.5 17.8V9.7C17.5 8.57989 17.5 8.01984 17.282 7.59202C17.0903 7.21569 16.7843 6.90973 16.408 6.71799C15.9802 6.5 15.4201 6.5 14.3 6.5H6.2C5.0799 6.5 4.51984 6.5 4.09202 6.71799C3.71569 6.90973 3.40973 7.21569 3.21799 7.59202C3 8.01984 3 8.57989 3 9.7V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.0799 21 6.2 21Z"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PaymentMethods({ amount, inline = false }: { amount: number; inline?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const { isEditMode } = useEditor()
  const contact1Number = useContent('lista.payment.contact1.number', copy.lista.paymentMethods.contacts[0].number)
  const contact2Number = useContent('lista.payment.contact2.number', copy.lista.paymentMethods.contacts[1].number)
  const revolutTag = useContent('lista.payment.revolut', copy.lista.paymentMethods.revolutTag)
  const openLabel = useContent('lista.payment.open_label', copy.lista.paymentMethods.openLabel)
  const ibanValue = useContent('lista.payment.iban', DEFAULT_IBAN_VALUE)
  const ibanPreview = ibanValue.length > 8 ? `${ibanValue.slice(0, 8)}...` : ibanValue

  useDocumentScrollLock(open)

  const copyValue = async (label: string, value: string) => {
    if (isEditMode) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => {
        setCopied((current) => (current === label ? null : current))
      }, 1600)
    } catch {
      setCopied(null)
    }
  }

  const cards = (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="flex h-full flex-col rounded-2xl border border-accent-mid/20 bg-accent-light/15 p-2.5 sm:p-4">
        <div className="flex items-start justify-center">
          <a
            href="mbway://"
            onClick={(e) => {
              if (isEditMode) e.preventDefault()
            }}
            className="relative inline-flex h-10 w-full items-center justify-center rounded-xl border border-accent-mid/30 bg-white px-2 py-2 shadow-sm shadow-accent/5 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md hover:shadow-accent/10 sm:h-11 sm:w-24 sm:justify-start sm:px-3"
            aria-label={copy.lista.paymentMethods.mbway.openLabel}
          >
            <img src={mbwayIcon} alt={copy.lista.paymentMethods.mbway.openLabel} className="h-6 w-auto object-contain" />
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[11px] leading-[1] text-white shadow-sm">{'\u2197'}</span>
          </a>
        </div>
        <div className="mt-2 space-y-1 sm:mt-4 sm:space-y-2.5">
          <div key="contact1" className="px-0 py-0.5 text-center sm:text-left">
            <div className="min-w-0">
              {isEditMode ? (
                <>
                  <div className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-forest sm:text-[11px] sm:uppercase sm:tracking-[0.16em] sm:text-gray-400">
                    <span><EditableText contentKey="lista.payment.contact1.label" fallback={copy.lista.paymentMethods.contacts[0].label} tag="span" /></span>
                  </div>
                  <div className="mt-1 hidden items-center gap-1.5 whitespace-nowrap text-[12px] font-medium leading-none tracking-[0.01em] text-forest sm:inline-flex sm:text-[14px]">
                    <span><EditableText contentKey="lista.payment.contact1.number" fallback={copy.lista.paymentMethods.contacts[0].number} tag="span" /></span>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => copyValue(contact1Number, contact1Number)}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-forest underline decoration-accent-mid/70 underline-offset-2 transition-colors hover:text-accent-dark sm:pointer-events-none sm:text-[11px] sm:uppercase sm:tracking-[0.16em] sm:text-gray-400 sm:no-underline"
                  >
                    <span>{copy.lista.paymentMethods.contacts[0].label}</span>
                    <CopyIcon className="h-3.5 w-3.5 shrink-0 sm:hidden" />
                  </button>
                  <button
                    type="button"
                    onClick={() => copyValue(contact1Number, contact1Number)}
                    className="mt-1 hidden items-center gap-1.5 whitespace-nowrap text-[12px] font-medium leading-none tracking-[0.01em] text-forest transition-colors hover:text-accent-dark sm:inline-flex sm:text-[14px]"
                  >
                    <span>{contact1Number}</span>
                    <CopyIcon className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </>
              )}
            </div>
            {copied === contact1Number && <p className="mt-1 text-[11px] font-medium text-accent sm:mt-2 sm:text-xs">{copy.lista.paymentMethods.copied.number}</p>}
          </div>
          <div key="contact2" className="px-0 py-0.5 text-center sm:text-left">
            <div className="min-w-0">
              {isEditMode ? (
                <>
                  <div className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-forest sm:text-[11px] sm:uppercase sm:tracking-[0.16em] sm:text-gray-400">
                    <span><EditableText contentKey="lista.payment.contact2.label" fallback={copy.lista.paymentMethods.contacts[1].label} tag="span" /></span>
                  </div>
                  <div className="mt-1 hidden items-center gap-1.5 whitespace-nowrap text-[12px] font-medium leading-none tracking-[0.01em] text-forest sm:inline-flex sm:text-[14px]">
                    <span><EditableText contentKey="lista.payment.contact2.number" fallback={copy.lista.paymentMethods.contacts[1].number} tag="span" /></span>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => copyValue(contact2Number, contact2Number)}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-forest underline decoration-accent-mid/70 underline-offset-2 transition-colors hover:text-accent-dark sm:pointer-events-none sm:text-[11px] sm:uppercase sm:tracking-[0.16em] sm:text-gray-400 sm:no-underline"
                  >
                    <span>{copy.lista.paymentMethods.contacts[1].label}</span>
                    <CopyIcon className="h-3.5 w-3.5 shrink-0 sm:hidden" />
                  </button>
                  <button
                    type="button"
                    onClick={() => copyValue(contact2Number, contact2Number)}
                    className="mt-1 hidden items-center gap-1.5 whitespace-nowrap text-[12px] font-medium leading-none tracking-[0.01em] text-forest transition-colors hover:text-accent-dark sm:inline-flex sm:text-[14px]"
                  >
                    <span>{contact2Number}</span>
                    <CopyIcon className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </>
              )}
            </div>
            {copied === contact2Number && <p className="mt-1 text-[11px] font-medium text-accent sm:mt-2 sm:text-xs">{copy.lista.paymentMethods.copied.number}</p>}
          </div>
        </div>
      </div>

      <div className="flex h-full flex-col rounded-2xl border border-accent-mid/20 bg-accent-light/15 p-2.5 sm:p-4">
        <div className="flex items-start justify-center">
          <a
            href={`https://revolut.me/${revolutTag}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (isEditMode) e.preventDefault()
            }}
            className="relative inline-flex h-10 w-full items-center justify-center rounded-xl border border-accent-mid/30 bg-white px-2 py-2 shadow-sm shadow-accent/5 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md hover:shadow-accent/10 sm:h-11 sm:w-24 sm:justify-start sm:px-3"
            aria-label={copy.lista.paymentMethods.revolut.openLabel}
          >
            <img src={revolutIcon} alt={copy.lista.paymentMethods.revolut.openLabel} className="h-6 w-auto object-contain" />
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[11px] leading-[1] text-white shadow-sm">{'\u2197'}</span>
          </a>
        </div>
        <div className="mt-[0.55rem] text-center sm:mt-4 sm:pt-1.5 sm:text-left">
          <p className="hidden text-[11px] font-medium uppercase tracking-[0.16em] text-gray-400 sm:block">{copy.lista.paymentMethods.revolut.tagLabel}</p>
          {isEditMode ? (
            <div className="mt-1 inline-flex items-center justify-center gap-1 break-all text-[10px] font-medium leading-4 text-forest sm:justify-start sm:text-[13px] sm:leading-5">
              <span><EditableText contentKey="lista.payment.revolut" fallback={copy.lista.paymentMethods.revolutTag} tag="span" /></span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => copyValue('RevolutTag', revolutTag)}
              className="mt-1 inline-flex items-center justify-center gap-1 break-all text-[10px] font-medium leading-4 text-forest underline decoration-accent-mid/70 underline-offset-2 transition-colors hover:text-accent-dark sm:justify-start sm:text-[13px] sm:leading-5 sm:no-underline"
            >
              <span>{revolutTag}</span>
              <CopyIcon className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}
        </div>
        {copied === 'RevolutTag' && <p className="mt-1 text-center text-[11px] font-medium text-accent sm:mt-2 sm:text-left sm:text-xs">{copy.lista.paymentMethods.copied.tag}</p>}
      </div>

      <div className="flex h-full flex-col rounded-2xl border border-accent-mid/20 bg-accent-light/15 p-2.5 sm:p-4">
        <div className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-accent-mid/20 bg-white/75 px-2 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-dark sm:h-11 sm:w-24 sm:justify-start sm:px-3 sm:text-sm sm:tracking-[0.16em]">
          {copy.lista.paymentMethods.iban.label}
        </div>
        <div className="mt-[0.6rem] text-center sm:mt-4 sm:pt-0.5 sm:text-left">
          {isEditMode ? (
            <>
              <div className="inline-flex items-center gap-1 text-[11px] font-medium leading-5 text-forest sm:hidden">
                <EditableText contentKey="lista.payment.iban" fallback={ibanPreview} tag="span" />
              </div>
              <div className="hidden items-start gap-1.5 text-left text-sm font-medium leading-6 text-forest sm:inline-flex">
                <EditableText contentKey="lista.payment.iban" fallback={ibanValue} tag="span" className="break-all" />
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => copyValue('IBAN', ibanValue)}
                className="inline-flex items-center gap-1 text-[11px] font-medium leading-5 text-forest underline decoration-accent-mid/70 underline-offset-2 transition-colors hover:text-accent-dark sm:hidden"
              >
                <span>{ibanPreview}</span>
                <CopyIcon className="h-3.5 w-3.5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => copyValue('IBAN', ibanValue)}
                className="hidden items-start gap-1.5 text-left text-sm font-medium leading-6 text-forest transition-colors hover:text-accent-dark sm:inline-flex"
              >
                <span className="break-all">{ibanValue}</span>
                <CopyIcon className="mt-1 h-3.5 w-3.5 shrink-0" />
              </button>
            </>
          )}
        </div>
        {copied === 'IBAN' && <p className="mt-1 text-center text-[11px] font-medium text-accent sm:mt-2 sm:text-left sm:text-xs">{copy.lista.paymentMethods.copied.iban}</p>}
      </div>
    </div>
  )

  if (inline) {
    return (
      <div className="space-y-3 rounded-2xl border border-accent-mid/25 bg-white/80 p-3.5 sm:p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-accent-dark/70">{copy.lista.paymentMethods.inlineTitle}</p>
        {cards}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isEditMode) return
          setOpen(true)
        }}
        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-accent-mid/35 bg-white px-5 text-sm font-medium text-accent transition-colors hover:border-accent hover:text-accent-dark sm:w-auto"
      >
        <EditableText contentKey="lista.payment.open_label" fallback={openLabel} tag="span" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            {...motionProps({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
            })}
            className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 p-6 backdrop-blur-sm overscroll-none"
            onClick={() => setOpen(false)}
          >
            <motion.div
              {...motionProps({
                initial: { y: 18, opacity: 0, scale: 0.98 },
                animate: { y: 0, opacity: 1, scale: 1 },
                exit: { y: 10, opacity: 0, scale: 0.98 },
                transition: { duration: 0.3, ease: MOTION_EASE },
              })}
              className="w-full max-w-xl rounded-[28px] border border-accent-mid/20 bg-white p-5 shadow-2xl shadow-forest/20 sm:p-6 overscroll-contain"
              data-lenis-prevent
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-accent-dark/70">{copy.lista.paymentMethods.inlineTitle}</p>
                  <p className="mt-2 text-sm text-gray-500">
                    {copy.lista.contributionModal.transferLabel} <span className="font-medium text-gray-700">{amount > 0 ? `${amount}\u20AC` : ''}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-accent-mid/30 text-gray-400 transition-colors hover:border-accent hover:text-accent"
                  aria-label={copy.lista.contributionModal.closeLabel}
                >
                  <span className="text-lg leading-none">{'\u00D7'}</span>
                </button>
              </div>

              <div className="mt-5">{cards}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function GiftCard({ gift, onContribute }: { gift: GiftWithProgress; onContribute: (gift: GiftWithProgress) => void }) {
  const pct = gift.price > 0 ? Math.min(100, (gift.contributed / gift.price) * 100) : 0
  const isFull = pct >= 100
  const remaining = Math.max(0, gift.price - gift.contributed)
  const contributeLabel = useContent('lista.gift.contribute', copy.lista.giftCard.contribute)

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
          <GiftIcon />
        )}
        <div className="absolute left-3 top-3 rounded-full bg-white/92 px-3 py-1 text-[11px] font-semibold tracking-[0.02em] text-forest shadow-sm">
          €{gift.price.toFixed(0)}
        </div>
        {isFull && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-accent-mid/30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            <span className="text-xs font-medium text-accent-dark"><EditableText contentKey="lista.gift.full" fallback={copy.lista.giftCard.full} tag="span" /></span>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="mb-1 min-h-[2.25rem] text-sm font-medium leading-snug text-gray-900 break-words">{gift.name}</h3>
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-1 sm:line-clamp-2">{gift.description}</p>
        </div>

        {/* Progresso */}
        <div className="mt-auto space-y-1.5">
          <ProgressBar value={gift.contributed} max={gift.price} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              €{gift.contributed.toFixed(0)} <span className="text-gray-300">/</span> €{gift.price.toFixed(0)}
            </span>
            <span className="text-xs font-medium text-accent">{isFull ? 'Completo' : `Faltam €${remaining.toFixed(0)}`}</span>
          </div>
        </div>

        {!isFull && (
          <button
            onClick={() => onContribute(gift)}
            className="w-full text-xs font-medium text-white bg-accent py-2.5 rounded-full hover:bg-accent-dark transition-all duration-300 mt-1 cursor-pointer"
          >
            <EditableText contentKey="lista.gift.contribute" fallback={contributeLabel} tag="span" />
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
  const amountPlaceholder = useContent('lista.contribution.amount_placeholder', copy.lista.contributionModal.amountPlaceholder)
  const namePlaceholder = useContent('lista.contribution.name_placeholder', copy.lista.contributionModal.namePlaceholder)
  const cancelLabel = useContent('lista.contribution.cancel', copy.lista.contributionModal.cancel)

  useDocumentScrollLock(true)

  const finalAmount = custom ? parseFloat(custom) : 0
  const remaining = Math.max(0, gift.price - gift.contributed)
  const exceedsRemaining = finalAmount > remaining

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || finalAmount <= 0 || exceedsRemaining) return
    setLoading(true)
    setError('')
    try {
      await onConfirm(name.trim(), finalAmount)
      setDone(true)
      setTimeout(onClose, 2200)
    } catch {
      setError(copy.lista.honeymoon.error)
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
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-forest/40 backdrop-blur-sm overscroll-none"
      onClick={onClose}
    >
      <motion.div
        {...motionProps({
          initial: { y: 24, opacity: 0, scale: 0.97 },
          animate: { y: 0, opacity: 1, scale: 1 },
          exit: { y: 12, opacity: 0, scale: 0.97 },
          transition: { duration: 0.4, ease: MOTION_EASE },
        })}
        className="bg-white rounded-t-3xl md:rounded-3xl p-5 md:p-7 max-w-lg w-full shadow-2xl shadow-forest/20 border border-accent-mid/20 max-h-[92vh] overflow-y-auto overscroll-contain"
        data-lenis-prevent
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
            <h3 className="font-serif text-2xl text-forest mb-2">{copy.lista.contributionModal.successTitle}</h3>
          </div>
        ) : (
          <>
            <div className="mb-5 overflow-hidden rounded-[28px] border border-accent-mid/20 bg-accent-light/20">

              <div className="aspect-[16/9] w-full overflow-hidden bg-accent-light/40">

                {gift.image_url ? (

                  <img src={gift.image_url} alt={gift.name} className="h-full w-full object-cover" />

                ) : (

                  <GiftIcon />

                )}

              </div>

            </div>

            <div className="relative mb-5 pr-12">

              <div className="min-w-0">

                <p className="text-[11px] uppercase tracking-[0.28em] text-accent-dark/70">{copy.lista.contributionModal.titleTag}</p>

                <h3 className="mt-2 font-serif text-2xl leading-tight text-forest">{gift.name}</h3>

                {gift.description && (

                  <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">{gift.description}</p>

                )}

              </div>

              <button

                type="button"

                onClick={onClose}

                className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-accent-mid/40 bg-white text-accent-dark shadow-sm shadow-accent/10 transition-colors hover:border-accent hover:text-forest"

                aria-label={copy.lista.contributionModal.closeLabel}

              >

                <span className="text-lg font-medium leading-none">{'\u00D7'}</span>

              </button>

            </div>



            <div className="mb-6 overflow-hidden rounded-2xl border border-accent-mid/20 bg-accent-light/18">
              <div className="grid grid-cols-3 divide-x divide-accent-mid/15">
                <div className="min-w-0 px-2 py-2.5 text-center sm:px-4 sm:py-3">
                  <p className="whitespace-nowrap text-[8px] uppercase tracking-[0.08em] text-gray-400 sm:text-[10px] sm:tracking-[0.16em]">{copy.lista.contributionModal.totalLabel}</p>
                  <p className="mt-1 text-[13px] font-semibold text-forest sm:text-base">{'€'}{gift.price.toFixed(0)}</p>
                </div>
                <div className="min-w-0 px-2 py-2.5 text-center sm:px-4 sm:py-3">
                  <p className="whitespace-nowrap text-[8px] uppercase tracking-[0.08em] text-gray-400 sm:text-[10px] sm:tracking-[0.16em]">{copy.lista.contributionModal.contributedLabel}</p>
                  <p className="mt-1 text-[13px] font-semibold text-forest sm:text-base">{'€'}{gift.contributed.toFixed(0)}</p>
                </div>
                <div className="min-w-0 px-2 py-2.5 text-center sm:px-4 sm:py-3">
                  <p className="whitespace-nowrap text-[8px] uppercase tracking-[0.08em] text-gray-400 sm:text-[10px] sm:tracking-[0.16em]">{copy.lista.contributionModal.remainingLabel}</p>
                  <p className="mt-1 text-[13px] font-semibold text-forest sm:text-base">{'€'}{remaining.toFixed(0)}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-[0.95fr_1.05fr]">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">{copy.lista.contributionModal.amountLabel}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">€</span>
                    <input
                      type="number"
                      min="1"
                      value={custom}
                      onChange={(e) => {
                        setCustom(e.target.value)
                        if (error) setError('')
                      }}
                      placeholder={amountPlaceholder}
                      className={`no-spinner h-14 w-full rounded-2xl bg-accent-light/25 px-4 pl-14 text-base text-gray-900 outline-none transition-all focus:ring-2 ${
                        exceedsRemaining
                          ? 'border border-red-300 focus:border-red-400 focus:ring-red-100'
                          : 'border border-accent-mid/40 focus:border-accent focus:ring-accent/10'
                      }`}
                    />
                  </div>
                  {exceedsRemaining && (
                    <p className="mt-2 text-xs text-red-500">{copy.lista.contributionModal.overRemaining}</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">{copy.lista.contributionModal.nameLabel}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={namePlaceholder}
                    required
                    className="h-14 w-full rounded-2xl border border-accent-mid/40 bg-accent-light/25 px-4 text-base text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
                  />
                </div>
              </div>

              <PaymentMethods amount={finalAmount} inline />

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                <button type="button" onClick={onClose} className="h-12 rounded-2xl px-5 text-sm font-medium text-accent-dark bg-accent-light hover:bg-accent-mid/30 transition-colors sm:flex-1">
                  <EditableText contentKey="lista.contribution.cancel" fallback={cancelLabel} tag="span" />
                </button>
                <button
                  type="submit"
                  disabled={loading || finalAmount <= 0 || exceedsRemaining || !name.trim()}
                  className="h-12 rounded-2xl bg-forest px-5 text-sm font-medium text-white transition-all hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed sm:flex-1"
                >
                  {loading ? copy.lista.contributionModal.loading : `${copy.lista.contributionModal.submit} ${finalAmount > 0 ? `${finalAmount}€` : ''}`}
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
  const amountPlaceholder = useContent('lista.honeymoon.amount_placeholder', copy.lista.honeymoon.amountPlaceholder)
  const namePlaceholder = useContent('lista.honeymoon.name_placeholder', copy.lista.honeymoon.namePlaceholder)
  const messagePlaceholder = useContent('lista.honeymoon.message_placeholder', copy.lista.honeymoon.messagePlaceholder)
  const successTitle = useContent('lista.honeymoon.success_title', copy.lista.honeymoon.successTitle)
  const successMsgTemplate = useContent('lista.honeymoon.success_message', 'A contribuição de €{amount} significa muito para nós.')
  const submitLabel = useContent('lista.honeymoon.submit_label', copy.lista.honeymoon.submit)
  const loadingLabel = useContent('lista.honeymoon.loading_label', copy.lista.honeymoon.loading)

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

    try {
      await addDoc(collection(db, 'honeymoon_contributions'), {
        ...contribution,
        created_at: serverTimestamp(),
      })
      void notifyAdmin('Nova contribuição lua-de-mel 🌴', {
        Nome: contribution.contributor_name,
        Valor: `${finalAmount}€`,
        Mensagem: contribution.message,
      })
    } catch {
      setError('Ocorreu um erro. Por favor tente novamente.')
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
  }

  return (
    <FadeUp>
      <div className="overflow-hidden rounded-[32px] border border-accent-mid/20" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent-light) 20%, white) 0%, color-mix(in srgb, var(--color-accent-light) 70%, white) 100%)', boxShadow: '0 30px 80px -40px color-mix(in srgb, var(--color-forest) 25%, transparent)' }}>
        <div className="grid md:grid-cols-[0.95fr_1.05fr]">
          <div className="relative px-6 pb-8 pt-12 sm:px-8 md:px-10 md:py-12">
            <div className="absolute top-0 right-0 h-72 w-72 pointer-events-none"
              style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-sage) 16%, transparent) 0%, transparent 68%)' }} />
            <div className="absolute bottom-0 left-0 h-40 w-40 pointer-events-none"
              style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 8%, transparent) 0%, transparent 70%)' }} />

            <div className="relative">
              <p className="mb-4 text-xs font-medium uppercase tracking-widest text-accent"><EditableText contentKey="lista.honeymoon.tag" fallback={copy.lista.honeymoon.tag} tag="span" /></p>
              <h2 className="mb-4 font-serif text-3xl text-forest sm:text-4xl md:text-5xl"><EditableText contentKey="lista.honeymoon.title" fallback={copy.lista.honeymoon.title} tag="span" /></h2>
              {done ? (
                <motion.div
                  {...motionProps({
                    initial: { opacity: 0, y: 10 },
                    animate: { opacity: 1, y: 0 },
                  })}
                  className="flex items-center gap-4 rounded-2xl border border-accent/20 bg-white p-6"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/15">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-forest">
                      <EditableText contentKey="lista.honeymoon.success_title" fallback={successTitle} tag="span" />
                    </p>
                    <p className="text-sm text-gray-500">
                      {successMsgTemplate.replace('{amount}', String(finalAmount))}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="mb-3 block text-xs uppercase tracking-wider text-gray-500">
                      <EditableText contentKey="lista.honeymoon.amount_label" fallback={copy.lista.honeymoon.amountLabel} tag="span" />
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
                      <input
                        type="number"
                        min="1"
                        value={custom}
                        onChange={(e) => setCustom(e.target.value)}
                        placeholder={amountPlaceholder}
                        className={`no-spinner w-full sm:w-36 rounded-full border bg-white py-2.5 pl-8 pr-4 text-sm text-gray-900 outline-none transition-all duration-200 ${
                          custom ? 'border-accent' : 'border-accent-mid/30 focus:border-accent'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-xs uppercase tracking-wider text-gray-500">
                      <EditableText contentKey="lista.honeymoon.name_label" fallback={copy.lista.honeymoon.nameLabel} tag="span" />
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={namePlaceholder}
                      required
                      className="max-w-md w-full rounded-xl border border-accent-mid/30 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="mb-3 block text-xs uppercase tracking-wider text-gray-500">
                      <EditableText contentKey="lista.honeymoon.message_label" fallback={copy.lista.honeymoon.messageLabel} tag="span" />
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={messagePlaceholder}
                      rows={3}
                      className="block max-w-md w-full resize-none rounded-xl border border-accent-mid/30 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:border-accent"
                    />
                  </div>

                  <div className="flex w-full flex-col items-stretch gap-4">
                    <PaymentMethods amount={finalAmount} inline />

                    <button
                      type="submit"
                      disabled={loading || finalAmount <= 0 || !name.trim()}
                      className="w-full rounded-full bg-forest px-10 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                    >
                      {loading
                        ? <EditableText contentKey="lista.honeymoon.loading_label" fallback={loadingLabel} tag="span" />
                        : <><EditableText contentKey="lista.honeymoon.submit_label" fallback={submitLabel} tag="span" />{finalAmount > 0 ? ` ${finalAmount}€` : ''}</>
                      }
                    </button>
                  </div>

                  {error && <p className="text-xs text-red-500">{error}</p>}
                </form>
              )}
            </div>
          </div>

          <div className="relative min-h-[22rem] border-t border-accent-mid/20 md:min-h-full md:border-l md:border-t-0">
            <EditableImage contentKey="lista.honeymoon.image" fallback={honeymoonImage} alt={copy.lista.honeymoon.imageAlt} imgClassName="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[rgba(247,251,250,0.22)]" />
          </div>
        </div>
      </div>
    </FadeUp>
  )
}

export default function Lista() {
  const [gifts, setGifts] = useState<GiftWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGift, setSelectedGift] = useState<GiftWithProgress | null>(null)
  const [showAllGifts, setShowAllGifts] = useState(false)
  const [collapsedGiftCount, setCollapsedGiftCount] = useState(4)
  const showMoreLabel = useContent('lista.toggle.show_more', copy.lista.toggle.showMore)
  const showLessLabel = useContent('lista.toggle.show_less', copy.lista.toggle.showLess)
  const listaSectionOrder = parseSectionOrder(
    useContent('layout.lista_order', DEFAULT_LISTA_SECTION_ORDER.join(',')),
    DEFAULT_LISTA_SECTION_ORDER,
  )
  const listaSectionOrderMap = createSectionOrderMap(listaSectionOrder)

  const loadData = async (showLoader = false) => {
    if (showLoader) setLoading(true)

    try {
      const [giftsSnap, contribSnap] = await Promise.all([
        getDocs(query(collection(db, 'gifts'), orderBy('price', 'asc'))),
        getDocs(collection(db, 'gift_contributions')),
      ])

      const contribs = contribSnap.docs.map((d) => d.data() as { gift_id: string; amount: number })
      const totals: Record<string, number> = {}
      for (const c of contribs) {
        totals[c.gift_id] = (totals[c.gift_id] ?? 0) + Number(c.amount)
      }
      const data = giftsSnap.docs.map((d) => {
        const g = { id: d.id, ...d.data() } as Gift
        return { ...g, contributed: totals[g.id] ?? 0 }
      }) as GiftWithProgress[]
      setGifts(data)
    } catch {
      // silently fail — keep existing gifts
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

  useEffect(() => {
    const updateCollapsedGiftCount = () => {
      if (window.innerWidth >= 1024) {
        setCollapsedGiftCount(8)
      } else if (window.innerWidth >= 768) {
        setCollapsedGiftCount(6)
      } else {
        setCollapsedGiftCount(4)
      }
    }

    updateCollapsedGiftCount()
    window.addEventListener('resize', updateCollapsedGiftCount)
    return () => window.removeEventListener('resize', updateCollapsedGiftCount)
  }, [])

  useEffect(() => {
    if (gifts.length <= collapsedGiftCount) {
      setShowAllGifts(true)
    } else {
      setShowAllGifts(false)
    }
  }, [gifts.length, collapsedGiftCount])

  const handleContribute = async (name: string, amount: number) => {
    if (!selectedGift) return
    const contribution: GiftContribution = {
      gift_id: selectedGift.id,
      contributor_name: name,
      amount,
    }
    await addDoc(collection(db, 'gift_contributions'), {
      ...contribution,
      created_at: serverTimestamp(),
    })
    void notifyAdmin('Nova contribuição para presente 🎁', {
      Presente: selectedGift.name,
      Nome: name,
      Valor: `${amount}€`,
    })
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
          <p className="text-xs uppercase tracking-widest text-accent font-medium mb-5"><EditableText contentKey="lista.hero.subtitle" fallback={copy.lista.hero.subtitle} tag="span" /></p>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl text-forest mb-6 leading-tight">
            <EditableText contentKey="lista.hero.title" fallback={copy.lista.hero.title} tag="span" />
          </h1>
          <a
            href="#lua-de-mel"
            className="group inline-flex items-center gap-2.5 rounded-full border border-accent-mid/50 px-6 py-2.5 text-sm font-medium text-accent-dark transition-all duration-300 hover:border-accent hover:bg-accent-light"
          >
            Lua de mel
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="group-hover:translate-y-0.5 transition-transform duration-300">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </a>
        </motion.div>
      </section>

      {/* ── Fundo Lua de Mel ── */}

      {/* ── Divisor ── */}

      {/* ── Lista de Presentes ── */}
      <div className="flex flex-col">
      <section style={{ order: listaSectionOrderMap.gifts }} className="px-4 sm:px-6 md:px-8 pb-24 md:pb-32 max-w-6xl mx-auto">
        <FadeUp className="mb-10">
          <div>
            {!loading && (
              <>
                <p className="text-sm text-accent mt-1">{gifts.length} presentes</p>
              </>
            )}
          </div>
        </FadeUp>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-accent-light/60 aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : gifts.length === 0 ? (
          <FadeUp>
            <div className="text-center py-24">
              <p className="font-serif text-3xl text-accent-mid mb-3">{copy.lista.empty.title}</p>
              <p className="text-gray-400 text-sm">{copy.lista.empty.description}</p>
              <p className="text-accent-mid/60 text-xs mt-3 font-mono">{copy.lista.empty.tableLabel} <span className="text-accent">{copy.lista.empty.tableValue}</span></p>
            </div>
          </FadeUp>
        ) : (
          <>
          <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence {...presenceProps({ mode: 'popLayout' as const })}>
              {(showAllGifts ? gifts : gifts.slice(0, collapsedGiftCount)).map((gift) => (
                <GiftCard key={gift.id} gift={gift} onContribute={setSelectedGift} />
              ))}
            </AnimatePresence>
          </motion.div>
          {gifts.length > collapsedGiftCount && (
            <FadeUp className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllGifts((current) => !current)}
                className="inline-flex h-12 items-center justify-center rounded-full border border-accent-mid/35 bg-white px-6 text-sm font-medium text-accent transition-colors hover:border-accent hover:text-accent-dark"
              >
                <EditableText contentKey={showAllGifts ? 'lista.toggle.show_less' : 'lista.toggle.show_more'} fallback={showAllGifts ? showLessLabel : showMoreLabel} tag="span" />
              </button>
            </FadeUp>
          )}
          </>
        )}
      </section>

      {/* ── Modal de Contribuição ── */}
      <div style={{ order: listaSectionOrderMap.honeymoon }} className="h-px bg-gradient-to-r from-transparent via-accent-mid/50 to-transparent mx-4 sm:mx-6 md:mx-24 mb-20 md:mb-24" />

      <section id="lua-de-mel" style={{ order: listaSectionOrderMap.honeymoon }} className="px-4 sm:px-6 md:px-8 pb-20 md:pb-24 max-w-6xl mx-auto">
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
      </div>
      <footer className="py-10 bg-forest border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 text-center sm:text-left">
          <p className="font-serif text-lg text-accent-mid"><EditableText contentKey="navbar.brand" fallback={copy.navbar.brand} tag="span" /></p>
          <p className="text-xs uppercase tracking-widest text-sage/60"><EditableText contentKey="home.footer.date" fallback={copy.lista.footer.date} tag="span" /></p>
        </div>
      </footer>
    </div>
  )
}

function useDocumentScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const htmlOverflow = document.documentElement.style.overflow
    const htmlOverscroll = document.documentElement.style.overscrollBehavior
    const bodyOverflow = document.body.style.overflow
    const bodyOverscroll = document.body.style.overscrollBehavior

    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.overscrollBehavior = 'none'
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'

    return () => {
      document.documentElement.style.overflow = htmlOverflow
      document.documentElement.style.overscrollBehavior = htmlOverscroll
      document.body.style.overflow = bodyOverflow
      document.body.style.overscrollBehavior = bodyOverscroll
    }
  }, [locked])
}
