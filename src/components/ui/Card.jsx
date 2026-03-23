import clsx from "clsx";

const Card = ({ className, ...props }) => (
  <div
    className={clsx(
      "rounded-3xl border border-pearl-100/80 bg-pearl-50/85 p-6 shadow-soft backdrop-blur ring-1 ring-pearl-100/70 transition-all duration-300 dark:border-ink-700/50 dark:bg-ink-800/90 dark:ring-ink-600/30",
      className
    )}
    {...props}
  />
);

export default Card;
