"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2 } from "lucide-react";

type SOSButtonProps = { state: "IDLE" | "LISTENING" | "DISPATCHED"; onClick: () => void };

export function SOSButton({ state, onClick }: SOSButtonProps) {
  const isListening = state === "LISTENING";
  const isIdle = state === "IDLE";

  return (
    <div className="relative flex items-center justify-center">
      {/* Ripple rings — only when LISTENING */}
      <AnimatePresence>
        {isListening && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute rounded-full border-2 border-red-500/60"
                style={{ width: 160, height: 160 }}
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: 2.8, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, delay: i * 0.6, repeat: Infinity, ease: "easeOut" }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      <motion.button
        id="sos-main-button"
        onClick={onClick}
        disabled={state === "DISPATCHED"}
        whileTap={{ scale: 0.94 }}
        animate={isListening ? {
          scale: [1, 1.05, 1],
          boxShadow: ["0 0 0 0 rgba(220,38,38,0.5)", "0 0 30px 15px rgba(220,38,38,0.15)", "0 0 0 0 rgba(220,38,38,0.5)"],
        } : { scale: 1 }}
        transition={isListening ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : {}}
        className={`relative z-10 flex items-center justify-center w-40 h-40 rounded-full border-4
          text-white font-bold text-4xl transition-colors duration-300
          focus:outline-none focus-visible:ring-4 focus-visible:ring-red-400
          ${isListening
            ? "bg-red-600 border-red-400 shadow-[0_0_40px_10px_rgba(220,38,38,0.4)]"
            : isIdle
            ? "bg-red-700 border-red-500 hover:bg-red-600 active:bg-red-500"
            : "bg-red-900 border-red-800 opacity-60 cursor-not-allowed"}`}
        aria-label={isListening ? "Stop listening" : "Activate SOS"}
        aria-pressed={isListening}
      >
        <Mic size={60} strokeWidth={2} className={isListening ? "animate-pulse" : ""} />
      </motion.button>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center gap-3 text-red-400">
      <Loader2 size={40} className="animate-spin" />
      <p className="text-sm font-medium tracking-widest uppercase">Dispatching…</p>
    </div>
  );
}
