import { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import Button from "./ui/Button.jsx";
import { useContent } from "../data/contentStore.jsx";
import logoMark from "../assets/lumeo.svg";

const navLinkClass = ({ isActive }) =>
  `text-sm transition ${
    isActive
      ? "text-ink-900 dark:text-ink-50"
      : "text-pearl-700 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-50"
  }`;

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const { restaurant } = useContent();
  const brand = restaurant?.name?.[i18n.language] || "Lumeo";

  return (
    <header className="sticky top-0 z-40 border-b border-pearl-100/80 bg-pearl-50/85 backdrop-blur dark:border-ink-700/40 dark:bg-ink-900/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
        <NavLink to="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          <img src={logoMark} alt={`${brand} logo`} className="h-7 w-7" />
          <span>{brand}</span>
        </NavLink>
        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/" className={navLinkClass}>
            {t("nav.home")}
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            {t("nav.about")}
          </NavLink>
          <NavLink to="/menus" className={navLinkClass}>
            {t("nav.menus")}
          </NavLink>
          <NavLink to="/contact" className={navLinkClass}>
            {t("nav.contact")}
          </NavLink>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button as={NavLink} to="/book" size="sm">
            {t("actions.book")}
          </Button>
        </div>
        <button
          className="inline-flex items-center rounded-full border border-ink-200 px-3 py-2 text-xs uppercase tracking-[0.3em] text-pearl-700 md:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={t("labels.toggleMenu")}
        >
          {t("labels.menu")}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-pearl-100/80 bg-pearl-50/95 px-6 pb-6 dark:border-ink-700/60 dark:bg-ink-900/95 md:hidden"
          >
            <div className="flex flex-col gap-4 pt-4">
              <NavLink to="/" className={navLinkClass} onClick={() => setOpen(false)}>
                {t("nav.home")}
              </NavLink>
              <NavLink to="/about" className={navLinkClass} onClick={() => setOpen(false)}>
                {t("nav.about")}
              </NavLink>
              <NavLink to="/menus" className={navLinkClass} onClick={() => setOpen(false)}>
                {t("nav.menus")}
              </NavLink>
              <NavLink to="/contact" className={navLinkClass} onClick={() => setOpen(false)}>
                {t("nav.contact")}
              </NavLink>
              <div className="flex items-center gap-3 pt-2">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;

