import Lenis from 'lenis'
import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Lista from './pages/Lista'
import Admin from './pages/Admin'
import { MOTION_EASE, MOTION_ENABLED, motionProps, presenceProps } from './lib/motion'
import { copy } from './lib/i18n'

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      {...motionProps({
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.45, ease: MOTION_EASE },
      })}
    >
      {children}
    </motion.div>
  )
}

function BackToTopButton({ onClick }: { onClick: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 520)
    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  return (
    <AnimatePresence {...presenceProps({})}>
      {visible && (
        <motion.button
          type="button"
          aria-label={copy.shared.backToTopLabel}
          onClick={onClick}
          {...motionProps({
            initial: { opacity: 0, y: 12, scale: 0.96 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 10, scale: 0.96 },
            transition: { duration: 0.28, ease: MOTION_EASE },
          })}
          className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-accent-mid/35 bg-white/88 text-accent shadow-[0_16px_40px_-24px_rgba(12,61,53,0.4)] backdrop-blur-md transition-colors hover:border-accent hover:text-accent-dark md:bottom-6 md:right-6"
        >
          <span className="text-base leading-none">↑</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

function AppInner() {
  const location = useLocation()
  const lenisRef = useRef<Lenis | null>(null)
  const isAdminRoute = location.pathname === '/admin'

  useEffect(() => {
    if (isAdminRoute) {
      lenisRef.current = null
      return
    }

    const lenis = new Lenis({
      duration: 0.88,
      wheelMultiplier: 1.28,
      touchMultiplier: 1,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    })
    lenisRef.current = lenis
    let id: number
    const raf = (time: number) => {
      lenis.raf(time)
      id = requestAnimationFrame(raf)
    }
    id = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(id)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [isAdminRoute])

  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true })
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  return (
    <MotionConfig reducedMotion={MOTION_ENABLED ? 'never' : 'always'} transition={{ ease: MOTION_EASE }}>
      <Navbar />
      <AnimatePresence {...presenceProps({ mode: 'wait' as const })}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/lista" element={<PageTransition><Lista /></PageTransition>} />
          <Route path="/gifts" element={<Navigate to="/lista" replace />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </AnimatePresence>
      <BackToTopButton onClick={() => lenisRef.current?.scrollTo(0) ?? window.scrollTo({ top: 0, behavior: 'smooth' })} />
    </MotionConfig>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
