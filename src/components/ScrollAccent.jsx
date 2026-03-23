import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Card from "./ui/Card.jsx";

const ScrollAccent = ({ title, subtitle, image, note }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [48, -48]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.98, 1, 1.03]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.85, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="relative mt-24 overflow-hidden rounded-[36px]">
      <div className="absolute inset-0 bg-gradient-to-br from-pearl-100/60 via-pearl-50/30 to-transparent dark:from-ink-800/80 dark:via-ink-900/50" />
      <div className="relative z-10 grid gap-10 px-6 py-14 md:grid-cols-[1.1fr_0.9fr] md:px-10">
        <div className="space-y-6">
          <p className="section-kicker">{note}</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
          <p className="text-sm text-pearl-800 dark:text-ink-300">{subtitle}</p>
          <Card className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-pearl-600">Detail</p>
            <p className="text-sm text-pearl-800 dark:text-ink-300">
              Service choreography that stays invisible, yet always present.
            </p>
          </Card>
        </div>
        <motion.div style={{ y, scale, opacity }} className="relative">
          <div
            className="h-64 w-full rounded-3xl bg-cover bg-center shadow-soft"
            style={{
              backgroundImage: `url(${image})`,
            }}
          />
          <div className="pointer-events-none absolute -bottom-6 left-6 right-6 h-20 rounded-3xl bg-pearl-50/70 blur-2xl dark:bg-ink-800/70" />
        </motion.div>
      </div>
    </section>
  );
};

export default ScrollAccent;
