import { useEffect, useState } from "react";
import { WifiOff, Loader2, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "./utils.js";

/**
 * Floating pill banner that appears when the browser goes offline and
 * auto-hides once connectivity is restored (with a brief "Back online" flash).
 */
export function NetworkStatusBanner({ className }: { className?: string }) {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
      setShowReconnected(false);
    };
    const goOnline = () => {
      setIsOffline(false);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 2500);
      }
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [wasOffline]);

  const visible = isOffline || showReconnected;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -60, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          role="alert"
          className="fixed inset-x-0 top-4 z-[9999] flex justify-center pointer-events-none"
        >
          <div
            className={cn(
              "pointer-events-auto inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium shadow-xl backdrop-blur-md transition-colors duration-300",
              isOffline
                ? "bg-slate-900/90 text-white dark:bg-white/90 dark:text-slate-900"
                : "bg-emerald-600/90 text-white dark:bg-emerald-500/90 dark:text-white",
              className
            )}
          >
            {isOffline ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                </span>
                <WifiOff size={15} className="opacity-80" />
                <span>No internet connection</span>
                <Loader2 size={14} className="animate-spin opacity-60" />
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                </span>
                <RefreshCw size={15} className="opacity-80" />
                <span>Back online</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
