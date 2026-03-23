import clsx from "clsx";

const Input = ({ className, ...props }) => (
  <input
    className={clsx(
      "w-full rounded-2xl border border-ink-200 bg-pearl-50/70 px-4 py-3 text-sm text-ink-900 shadow-sm transition-all duration-200 focus:border-ink-400 focus:shadow-glow focus:outline-none dark:border-ink-700/70 dark:bg-ink-800/80 dark:text-pearl-100",
      className
    )}
    {...props}
  />
);

export default Input;
