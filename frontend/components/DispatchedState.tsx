"use client";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

export function DispatchedState({ etaMinutes = 4 }: { etaMinutes?: number }) {
  const [countdown, setCountdown] = useState(etaMinutes * 60);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const arrived = countdown === 0;

  return (
    <motion.div
      id="dispatched-state"
      className="flex flex-col items-center gap-6"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <motion.div
        className="flex items-center justify-center w-40 h-40 rounded-full bg-green-600/20 border-4 border-green-500"
        animate={{ boxShadow: ["0 0 0 0 rgba(34,197,94,0.5)", "0 0 30px 15px rgba(34,197,94,0.15)", "0 0 0 0 rgba(34,197,94,0.5)"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <CheckCircle2 size={72} className="text-green-400" strokeWidth={1.5} />
      </motion.div>

      <div className="text-center space-y-2">
        <motion.p className="text-green-400 font-bold text-2xl tracking-wide" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          {arrived ? "Help Has Arrived" : "Help Is On The Way"}
        </motion.p>
        <motion.p className="text-gray-400 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          Emergency services have been notified
        </motion.p>
      </div>

      {!arrived && (
        <motion.div
          className="bg-gray-900 border border-green-800/50 rounded-2xl px-8 py-5 text-center space-y-1"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        >
          <p className="text-xs uppercase tracking-widest text-gray-500">Estimated Arrival</p>
          <p id="eta-countdown" className="text-4xl font-bold tabular-nums text-green-300">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </p>
          <p className="text-xs text-gray-500">Ambulance en route</p>
        </motion.div>
      )}

      <motion.div className="flex items-center gap-2 text-xs text-gray-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Location shared with responders
      </motion.div>
    </motion.div>
  );
}
