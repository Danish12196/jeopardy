import { AnimatePresence, motion } from "framer-motion";

/** Small pill shown while the live connection is down. */
export default function ReconnectingBadge({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          role="status"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-card/90 border border-accent/60 px-4 py-1.5 text-sm font-semibold text-foreground shadow-lg backdrop-blur"
        >
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          Reconnecting…
        </motion.div>
      )}
    </AnimatePresence>
  );
}
