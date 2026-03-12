import Lenis from 'lenis'
import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Gifts from './pages/Gifts'
import Admin from './pages/Admin'
import { MOTION_EASE, MOTION_ENABLED, motionProps, presenceProps } from './lib/motion'

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

function AppInner() {
  const location = useLocation()

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
    let id: number
    const raf = (time: number) => {
      lenis.raf(time)
      id = requestAnimationFrame(raf)
    }
    id = requestAnimationFrame(raf)
    return () => { cancelAnimationFrame(id); lenis.destroy() }
  }, [])

  const isAdmin = location.pathname === '/admin'

  return (
    <MotionConfig reducedMotion={MOTION_ENABLED ? 'never' : 'always'} transition={{ ease: MOTION_EASE }}>
      {!isAdmin && <Navbar />}
      <AnimatePresence {...presenceProps({ mode: 'wait' as const })}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/gifts" element={<PageTransition><Gifts /></PageTransition>} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </AnimatePresence>
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
