import { motion } from "framer-motion";

const SectionReveal = ({ children, className }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.25 }}
    transition={{ duration: 0.75, ease: [0.2, 0.8, 0.2, 1] }}
  >
    {children}
  </motion.div>
);

export default SectionReveal;
