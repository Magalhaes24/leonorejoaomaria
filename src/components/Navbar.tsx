import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MOTION_EASE, motionProps } from '../lib/motion'

export default function Navbar() {
  const location = useLocation()
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 40))

  return (
    <motion.header
      {...motionProps({
        initial: { y: -20, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.7, ease: MOTION_EASE },
      })}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        scrolled
          ? 'bg-white/85 backdrop-blur-xl border-b border-accent-mid/30 shadow-sm shadow-accent/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-3 md:py-4 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="font-serif text-base sm:text-xl tracking-[0.14em] sm:tracking-[0.18em] text-gray-900 hover:text-accent transition-colors duration-500 shrink-0"
        >
          LJM
        </Link>

        <nav className="flex items-center gap-4 sm:gap-8 min-w-0">
          <Link
            to="/"
            className={`relative text-xs sm:text-sm font-medium tracking-wide transition-colors duration-300 after:absolute after:left-0 after:-bottom-1.5 after:h-px after:w-full after:origin-left after:bg-current after:transition-transform after:duration-500 ${
              location.pathname === '/' ? 'text-accent after:scale-x-100' : 'text-gray-500 hover:text-gray-900 after:scale-x-0 hover:after:scale-x-100'
            }`}
          >
            Início
          </Link>
          <Link
            to="/gifts"
            className={`relative text-xs sm:text-sm font-medium tracking-wide transition-colors duration-300 after:absolute after:left-0 after:-bottom-1.5 after:h-px after:w-full after:origin-left after:bg-current after:transition-transform after:duration-500 ${
              location.pathname === '/gifts' ? 'text-accent after:scale-x-100' : 'text-gray-500 hover:text-gray-900 after:scale-x-0 hover:after:scale-x-100'
            }`}
          >
            Lista de Casamento
          </Link>
        </nav>
      </div>
      <motion.div
        {...motionProps({
          animate: { opacity: scrolled ? 1 : 0, scaleX: scrolled ? 1 : 0.92 },
          transition: { duration: 0.5, ease: MOTION_EASE },
        })}
        className="absolute bottom-0 left-4 right-4 sm:left-6 sm:right-6 md:left-8 md:right-8 h-px origin-center bg-gradient-to-r from-transparent via-accent-mid/70 to-transparent pointer-events-none"
      />
    </motion.header>
  )
}
