# problem-dispatcher.md — Dispatcher Dashboard Route Debug

> Generated: 2026-04-25 | Route: `/dispatcher`

---

## Root Cause Analysis

### DISP-001 [CRITICAL] — Missing `layout.tsx` in `(roles)` route group
- **File**: `frontend/app/(roles)/` — directory has no `layout.tsx`
- **Problem**: The `(roles)` route group inherits the root `layout.tsx` which sets `body` to `h-full overflow-hidden`. Without its own layout, the dispatcher page cannot override these body constraints. In Next.js 15 App Router, a route group without a layout correctly inherits the root, but the constraint chain means:
  - Root body: `h-full overflow-hidden bg-gray-950`
  - `globals.css` also: `html, body { height: 100%; overflow: hidden; }`
  - Dispatcher page `<main>`: `w-full h-screen` → renders but is invisible/clipped behind the constraint cascade
- **Fix**: Create `frontend/app/(roles)/layout.tsx` that provides a clean full-screen container for all dashboard routes.
- Status: [x] FIXED

### DISP-002 [CRITICAL] — `globals.css` global `overflow: hidden` kills dashboard scroll and visibility
- **File**: `frontend/app/globals.css` line 13
- **Problem**: `html, body { overflow: hidden; }` is needed for the SOS PWA page (prevents pull-to-refresh on mobile) but it applies globally to ALL routes including `/dispatcher`. The dispatcher is a full-screen map dashboard — this is fine — but Leaflet's map container needs the body height chain to be `100%` at every level. If any ancestor is `overflow: hidden` without an explicit height, child `h-screen` elements may not get the correct viewport height, causing the map to render as 0px.
- **Fix**: The `(roles)/layout.tsx` fix resolves this by providing an explicit `height: 100vh` container that bypasses the body constraint.
- Status: [x] FIXED (via DISP-001)

### DISP-003 [HIGH] — `dispatcher/page.tsx` missing `'use client'` boundary awareness
- **File**: `frontend/app/(roles)/dispatcher/page.tsx`
- **Problem**: The page is a Server Component (`no 'use client'`). It imports `DispatcherDashboard` which IS `'use client'`. This pattern is valid in Next.js 15, but the page renders a `<main className="w-full h-screen">` wrapper. In the current layout chain (body: h-full + overflow-hidden), `h-screen` on the main doesn't fill correctly because the body and html are constrained. The fix is to remove the `<main>` wrapper entirely and let `DispatcherDashboard` own its full-screen container (it already does: `<div className="flex h-screen bg-black...">`).
- **Fix**: Remove the `<main>` wrapper, just render `<DispatcherDashboard />` directly from the page.
- Status: [x] FIXED

### DISP-004 [MEDIUM] — `next.config.js` uses empty `turbopack: {}` object
- **File**: `frontend/next.config.js` line 10
- **Problem**: In Next.js 15.1+, an empty `turbopack` object can trigger warnings or unexpected behavior with route group resolution. This is unlikely to be the primary cause of the blank page but should be cleaned up.
- **Fix**: Remove the empty `turbopack: {}` key since we're not configuring Turbopack.
- Status: [x] FIXED

### DISP-005 [MEDIUM] — `DispatcherDashboard` uses `supabase` with placeholder URL on first load
- **File**: `frontend/lib/supabase.ts`
- **Problem**: When Supabase env vars aren't set, `createClient('https://placeholder.supabase.co', 'placeholder-key')` is created. The `setupSubscriptions()` call then attempts to open a realtime WebSocket to the placeholder URL, which throws a network error. This error is caught and warned, but if it happens during the initial hydration, it could cause a React boundary to trigger.
- **Fix**: The dashboard already wraps in try/catch for demo mode — but ensure the Supabase client initialization is guarded to prevent WebSocket spam to the placeholder URL.
- Status: [x] FIXED

---

## Fix Summary

| ID | Severity | Status |
|---|---|---|
| DISP-001 | CRITICAL | [x] FIXED |
| DISP-002 | CRITICAL | [x] FIXED (via DISP-001) |
| DISP-003 | HIGH | [x] FIXED |
| DISP-004 | MEDIUM | [x] FIXED |
| DISP-005 | MEDIUM | [x] FIXED |

---

## Manual Steps If Still Blank

If the page is still blank after these fixes, clear the Next.js cache:

```bash
# Stop the dev server, then:
rm -rf frontend/.next
# Restart
cd frontend && npm run dev
```

This is necessary when Next.js has cached stale route manifests from before the layout fix.
