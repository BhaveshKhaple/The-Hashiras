# SOS PWA — UI Build Specification

> Drop this file in any Next.js (App Router) + Tailwind repo to recreate the SOS emergency PWA UI.

---

## Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16+ | Framework (App Router) |
| `tailwindcss` | 4+ | Styling |
| `framer-motion` | latest | Animations & ripple |
| `lucide-react` | latest | Icons (Mic, Send, CheckCircle2, etc.) |
| `next-pwa` | latest | Service worker + PWA manifest |

```bash
npm install next-pwa framer-motion lucide-react
```

---

## File Structure

```
app/
├── SOSApp.tsx                  ← Main orchestration component
├── page.tsx                    ← Entry: just renders <SOSApp />
├── layout.tsx                  ← PWA meta tags, no-zoom viewport
├── globals.css                 ← Custom animations
├── components/
│   ├── SOSButton.tsx           ← Mic button + framer ripple rings
│   ├── FallbackForm.tsx        ← Text input fallback
│   └── DispatchedState.tsx     ← Green checkmark + ETA countdown
└── types/
    └── browser.d.ts            ← SpeechRecognition + WakeLock types
public/
├── manifest.json
└── icons/
    ├── icon-192.png
    └── icon-512.png
next.config.js                  ← withPWA wrapper (CommonJS, not .ts)
```

---

## next.config.js

```js
/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  turbopack: {},
  async headers() {
    return [{
      source: "/(.*)",
      headers: [{ key: "Permissions-Policy", value: "microphone=*, geolocation=*, vibrate=*" }],
    }];
  },
};

module.exports = withPWA(nextConfig);
```

> **Important:** Delete `next.config.ts` if it exists — only keep `next.config.js`.

---

## public/manifest.json

```json
{
  "name": "SOS Emergency Responder",
  "short_name": "SOS",
  "description": "Emergency SOS app — speak or type to dispatch help immediately.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0a0a0a",
  "theme_color": "#dc2626",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

## app/layout.tsx

```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "SOS — Emergency Responder",
  description: "Speak or type to dispatch emergency services immediately.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SOS" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,        // ← prevents pinch-zoom
  themeColor: "#dc2626",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="h-full overflow-hidden bg-gray-950 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

---

## app/globals.css

```css
@import "tailwindcss";

html, body {
  height: 100%;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

* { -webkit-user-select: none; user-select: none; }
textarea, input { -webkit-user-select: text; user-select: text; }

/* Safe area for notched phones */
.safe-bottom { padding-bottom: env(safe-area-inset-bottom, 16px); }
.safe-top    { padding-top: env(safe-area-inset-top, 16px); }

/* Transcript scrollbar */
.transcript-box::-webkit-scrollbar { width: 4px; }
.transcript-box::-webkit-scrollbar-track { background: transparent; }
.transcript-box::-webkit-scrollbar-thumb { background: rgba(220,38,38,0.4); border-radius: 2px; }
```

---

## app/types/browser.d.ts

```ts
// SpeechRecognition — not in TS bundled DOM lib by default
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare var SpeechRecognition: { prototype: SpeechRecognition; new(): SpeechRecognition };
declare var webkitSpeechRecognition: { prototype: SpeechRecognition; new(): SpeechRecognition };

// Screen Wake Lock API
interface WakeLockSentinel extends EventTarget {
  readonly released: boolean;
  readonly type: "screen";
  release(): Promise<void>;
  onrelease: ((ev: Event) => void) | null;
}
interface WakeLock { request(type: "screen"): Promise<WakeLockSentinel>; }
interface Navigator { readonly wakeLock: WakeLock; }
```

---

## app/components/SOSButton.tsx

```tsx
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
```

---

## app/components/FallbackForm.tsx

```tsx
"use client";
import { useState } from "react";
import { Send } from "lucide-react";

type FallbackFormProps = { onSubmit: (text: string) => void; disabled?: boolean };

export function FallbackForm({ onSubmit, disabled }: FallbackFormProps) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <form id="sos-fallback-form" onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <p className="text-xs text-gray-500 uppercase tracking-widest text-center">
        Can&apos;t speak? Type your emergency below
      </p>
      <div className="flex gap-2">
        <textarea
          id="sos-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); }}}
          placeholder="Describe your emergency…"
          rows={2}
          disabled={disabled}
          className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-900
            px-4 py-3 text-white placeholder-gray-600 text-sm
            focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 transition-all"
          aria-label="Emergency description text field"
        />
        <button
          id="sos-send-button"
          type="submit"
          disabled={disabled || !text.trim()}
          className="flex items-center justify-center w-12 h-auto rounded-xl
            bg-red-600 hover:bg-red-500 active:bg-red-700 text-white
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="Send emergency text"
        >
          <Send size={18} />
        </button>
      </div>
    </form>
  );
}
```

---

## app/components/DispatchedState.tsx

```tsx
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
```

---

## app/SOSApp.tsx (main orchestration)

### State machine
```
IDLE → (tap mic) → LISTENING → (speech ends / text submit) → DISPATCHED
```

### Browser APIs — all wrapped in try/catch

| API | Fallback |
|-----|---------|
| `navigator.geolocation` | hardcode `{ lat: 19.07, lng: 72.87 }` |
| `navigator.vibrate` | silent skip |
| `SpeechRecognition` / `webkitSpeechRecognition` | show error, keep text form usable |
| `navigator.wakeLock.request('screen')` | silent skip |

### Backend payload
```ts
POST /api/emergency/intake
Content-Type: application/json

{ "text": "<transcript>", "lat": <number>, "lng": <number> }
```

> Demo resilience: transition to `DISPATCHED` even if the backend returns non-200 or is unreachable.

### Key implementation notes

1. **SpeechRecognition init** — use `window as any` to access the prefixed API:
   ```ts
   const w = window as any;
   const API: (new () => SpeechRecognition) | undefined = w.SpeechRecognition || w.webkitSpeechRecognition;
   ```

2. **Auto-dispatch on speech end** — `recognition.onend` reads the latest transcript via the state setter callback (avoids stale closure):
   ```ts
   recognition.onend = () => {
     setTranscript((finalTranscript) => {
       if (finalTranscript.trim()) dispatchEmergency(finalTranscript.trim());
       else setAppState("IDLE");
       return finalTranscript;
     });
   };
   ```

3. **Wake lock** — request when entering LISTENING or DISPATCHED, release on IDLE.

4. **Haptic patterns**
   - Button press: `vibrate([200, 100, 200])`
   - Dispatch success: `vibrate([300, 100, 300, 100, 600])`

---

## app/page.tsx

```tsx
import { SOSApp } from "./SOSApp";
export default function Home() { return <SOSApp />; }
```

---

## Run commands

```bash
# Development (PWA disabled, fast HMR)
npm run dev

# Production (PWA + service worker active)
npm run build
npm start -- -p 3002   # use -p if 3000 is taken

# PowerShell note: && is invalid — run commands separately
```

---

## Common gotchas

| Issue | Fix |
|-------|-----|
| `Cannot find name 'SpeechRecognition'` TS error | Create `app/types/browser.d.ts` with the declarations above |
| `next-pwa` Turbopack/webpack conflict | Add `turbopack: {}` to `nextConfig` and set `disable: process.env.NODE_ENV === "development"` |
| Port 3000 in use | Use `npm start -- -p 3002` |
| `&&` in PowerShell fails | Run `npm run build` then `npm start` as two separate commands |
| `next.config.ts` conflicts with `next.config.js` | Delete the `.ts` version — next-pwa needs CommonJS `require()` |
