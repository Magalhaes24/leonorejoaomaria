import { motion } from "framer-motion";

const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
  >
    {children}
  </motion.div>
);

export default PageTransition;
