import clsx from "clsx";
import { motion } from "framer-motion";

export const Tabs = ({ className, ...props }) => (
  <div className={clsx("flex flex-wrap gap-2", className)} {...props} />
);

export const Tab = ({ active, className, ...props }) => (
  <motion.button
    layout
    whileHover={{ y: -1 }}
    whileTap={{ scale: 0.98 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className={clsx(
      "rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] transition",
      active
        ? "border-ink-900 bg-ink-900 text-pearl-100 dark:border-ink-50 dark:bg-ink-50 dark:text-ink-900"
        : "border-ink-200 text-pearl-700 hover:border-ink-400 dark:border-ink-700 dark:text-ink-300",
      className
    )}
    {...props}
  />
);
