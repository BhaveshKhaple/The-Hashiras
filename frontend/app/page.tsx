"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SOSButton, LoadingSpinner } from "../components/SOSButton";
import { FallbackForm } from "../components/FallbackForm";
import { DispatchedState } from "../components/DispatchedState";

type AppState = "IDLE" | "LISTENING" | "DISPATCHING" | "DISPATCHED";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const FALLBACK_LOCATION = { lat: 19.07, lng: 72.87 }; // Mumbai

export default function Home() {
  const [appState, setAppState] = useState<AppState>("IDLE");
  const [transcript, setTranscript] = useState("");
  const [micSupported, setMicSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // ── Wake Lock ──────────────────────────────────────────
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // silent skip per spec
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      // silent skip
    }
  }, []);

  // ── Haptics ────────────────────────────────────────────
  const vibrate = useCallback((pattern: number[]) => {
    try {
      navigator?.vibrate?.(pattern);
    } catch {
      // silent skip
    }
  }, []);

  // ── Geolocation ────────────────────────────────────────
  const getLocation = useCallback((): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve) => {
      try {
        if (!navigator.geolocation) {
          resolve(FALLBACK_LOCATION);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(FALLBACK_LOCATION),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      } catch {
        resolve(FALLBACK_LOCATION);
      }
    });
  }, []);

  // ── Dispatch Emergency ─────────────────────────────────
  const dispatchEmergency = useCallback(async (emergencyText: string) => {
    setAppState("DISPATCHING");
    vibrate([200, 100, 200]);

    const location = await getLocation();

    try {
      const res = await fetch(`${BACKEND_URL}/api/emergency/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: emergencyText, lat: location.lat, lng: location.lng }),
      });

      if (!res.ok) {
        console.warn("Backend returned non-200, but transitioning to DISPATCHED per demo resilience");
      }
    } catch (err) {
      console.warn("Backend unreachable, transitioning to DISPATCHED per demo resilience:", err);
    }

    // Demo resilience: ALWAYS transition to DISPATCHED
    vibrate([300, 100, 300, 100, 600]);
    await requestWakeLock();
    setAppState("DISPATCHED");
  }, [vibrate, getLocation, requestWakeLock]);

  // ── SpeechRecognition Setup ────────────────────────────
  useEffect(() => {
    const w = window as any;
    const API: (new () => SpeechRecognition) | undefined =
      w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!API) {
      setMicSupported(false);
      return;
    }

    const recognition = new API();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let fullTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      setTranscript(fullTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-available") {
        setMicSupported(false);
        setError("Microphone access denied. Use the text form below.");
      }
      setAppState("IDLE");
    };

    // Auto-dispatch on speech end — uses setter callback to avoid stale closure
    recognition.onend = () => {
      setTranscript((finalTranscript) => {
        if (finalTranscript.trim()) {
          dispatchEmergency(finalTranscript.trim());
        } else {
          setAppState("IDLE");
        }
        return finalTranscript;
      });
    };

    recognitionRef.current = recognition;
  }, [dispatchEmergency]);

  // ── Button Handler ─────────────────────────────────────
  const handleSOSClick = useCallback(() => {
    if (appState === "DISPATCHED" || appState === "DISPATCHING") return;

    if (appState === "LISTENING") {
      // Stop listening — onend will handle dispatch
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      return;
    }

    // IDLE → LISTENING
    vibrate([200, 100, 200]);
    setTranscript("");
    setError(null);

    if (!micSupported || !recognitionRef.current) {
      setError("Microphone not available. Use the text form below.");
      return;
    }

    try {
      recognitionRef.current.start();
      setAppState("LISTENING");
      requestWakeLock();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setError("Could not start microphone. Use the text form below.");
    }
  }, [appState, micSupported, vibrate, requestWakeLock]);

  // ── Text Fallback Submit ───────────────────────────────
  const handleTextSubmit = useCallback((text: string) => {
    dispatchEmergency(text);
  }, [dispatchEmergency]);

  // ── Cleanup wake lock on unmount ───────────────────────
  useEffect(() => {
    return () => { releaseWakeLock(); };
  }, [releaseWakeLock]);

  // ── Render ─────────────────────────────────────────────
  return (
    <main className="flex flex-col items-center justify-between h-full bg-gray-950 text-white safe-top safe-bottom">
      {/* Header */}
      <motion.header
        className="flex flex-col items-center pt-8 pb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold tracking-tight text-red-500">SOS</h1>
        <p className="text-xs text-gray-500 uppercase tracking-[0.3em] mt-1">Emergency Responder</p>
      </motion.header>

      {/* Center Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 w-full max-w-sm">
        <AnimatePresence mode="wait">
          {appState === "DISPATCHING" ? (
            <motion.div key="dispatching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSpinner />
            </motion.div>
          ) : appState === "DISPATCHED" ? (
            <motion.div key="dispatched" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DispatchedState etaMinutes={4} />
            </motion.div>
          ) : (
            <motion.div key="sos" className="flex flex-col items-center gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* SOS Button */}
              <SOSButton state={appState} onClick={handleSOSClick} />

              {/* Status text */}
              <div className="text-center min-h-[60px]">
                {appState === "IDLE" && !error && (
                  <motion.p className="text-gray-400 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {micSupported ? "Tap the button and speak your emergency" : "Microphone unavailable — type below"}
                  </motion.p>
                )}
                {appState === "LISTENING" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-red-400 text-sm font-medium animate-pulse">🎙️ Listening…</p>
                    {transcript && (
                      <div className="transcript-box mt-2 max-h-24 overflow-y-auto text-xs text-gray-300 bg-gray-900/50 rounded-lg p-3">
                        {transcript}
                      </div>
                    )}
                  </motion.div>
                )}
                {error && (
                  <motion.p className="text-amber-400 text-xs" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    ⚠️ {error}
                  </motion.p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom: Fallback form — always visible unless dispatched */}
      {appState !== "DISPATCHED" && appState !== "DISPATCHING" && (
        <motion.div
          className="w-full max-w-sm px-6 pb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <FallbackForm
            onSubmit={handleTextSubmit}
            disabled={appState === "LISTENING"}
          />
        </motion.div>
      )}

      {/* Footer */}
      <div className="pb-4 text-center">
        <p className="text-[10px] text-gray-700">Build for Bharat 2026 — The Hashiras</p>
      </div>
    </main>
  );
}
