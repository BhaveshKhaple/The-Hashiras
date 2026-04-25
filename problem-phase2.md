# problem-phase2.md — Remaining Feature Implementation Plan

> Generated: 2026-04-25 | Session: Phase 2-5 Execution

---

## Audit Summary

### ✅ Already Done (Discovered)
- All 4 dashboards have full UI implementations (not placeholders)
- All env vars are set in root `.env` (Supabase, Gemini, ORS)
- Driver, Hospital, Traffic Police pages already reference `NEXT_PUBLIC_BACKEND_URL`
- Green Corridor frontend (`handleGrantCorridor`) already calls `/api/corridor/grant`

### ❌ Missing — Implementing Now

---

## P1-001 [CRITICAL] — `NEXT_PUBLIC_BACKEND_URL` missing from `.env`
- **Problem**: `.env` has `BACKEND_URL` (backend-only) and `NEXT_PUBLIC_SOCKET_URL` but is missing `NEXT_PUBLIC_BACKEND_URL`. All 3 dashboards use `process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'` — the fallback works locally but breaks in production (Vercel) where the backend is on Railway.
- **Fix**: Add `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001` to `.env` and `.env.example`
- Status: [x] FIXED

## P1-002 [CRITICAL] — `traffic-police/page.tsx` has hydration error (`new Date().toLocaleTimeString()` in footer)
- **Problem**: `{new Date().toLocaleTimeString()}` renders on server and client at different times → React hydration mismatch warning.
- **Fix**: Use `useState('')` + `useEffect` pattern (same as DispatcherDashboard)
- Status: [x] FIXED

## P1-003 [CRITICAL] — `driver/page.tsx` same hydration error in footer
- **Problem**: `{new Date().toLocaleTimeString()}` in footer (line 204)
- **Fix**: Same pattern — useState + useEffect
- Status: [x] FIXED

## P1-004 [HIGH] — `DispatcherDashboard` missing React Error Boundary
- **Problem**: If MapComponent, Supabase query, or socket handler throws, entire dashboard crashes with no recovery UI
- **Fix**: Add `DashboardErrorBoundary` class component wrapping the dashboard
- Status: [x] FIXED

## P1-005 [HIGH] — Backend missing `/api/corridor/grant` route (Green Corridor logic)
- **Problem**: Traffic Police dashboard calls `POST /api/corridor/grant` but this endpoint doesn't exist in `backend/index.ts`. Returns 404, corridor grant silently fails.
- **Fix**: Add the route + `corridor:granted` Socket.IO broadcast so dispatcher/driver dashboards can receive the green light event
- Status: [x] FIXED

## P1-006 [HIGH] — Backend missing `/api/ambulance/status` route
- **Problem**: Driver dashboard calls `POST /api/ambulance/status` to update status but endpoint doesn't exist
- **Fix**: Add route that updates Supabase ambulances table + broadcasts status change
- Status: [x] FIXED

## P1-007 [HIGH] — Backend missing `/api/incident/update` route
- **Problem**: Hospital dashboard calls `POST /api/incident/update` to mark incidents resolved, endpoint missing
- **Fix**: Add route
- Status: [x] FIXED

## P1-008 [MEDIUM] — `hospital/page.tsx` Supabase subscription not wrapped in try/catch
- **Problem**: If Supabase realtime is unavailable (no env vars), uncaught error crashes the component
- **Fix**: Wrap in try/catch for demo resilience
- Status: [x] FIXED

---

## Fix Summary Table

| ID | Severity | Description | Status |
|---|---|---|---|
| P1-001 | CRITICAL | NEXT_PUBLIC_BACKEND_URL in .env | [x] FIXED |
| P1-002 | CRITICAL | traffic-police hydration error | [x] FIXED |
| P1-003 | CRITICAL | driver hydration error | [x] FIXED |
| P1-004 | HIGH | DispatcherDashboard Error Boundary | [x] FIXED |
| P1-005 | HIGH | /api/corridor/grant endpoint | [x] FIXED |
| P1-006 | HIGH | /api/ambulance/status endpoint | [x] FIXED |
| P1-007 | HIGH | /api/incident/update endpoint | [x] FIXED |
| P1-008 | MEDIUM | hospital page Supabase error guard | [x] FIXED |

---

## Verification

- TypeScript: `tsc --noEmit` → Exit 0, zero errors ✅
- All 3 missing backend routes now registered ✅
- Green Corridor broadcasts `corridor:granted` to connected clients ✅

---

## ⚠️ MANUAL ACTION REQUIRED

### Step 1 — Apply Supabase Schema

Your Supabase project is already configured (env vars set). You need to apply the schema:

1. Go to: **https://supabase.com/dashboard/project/wmsmgmoquratfupanvgo/editor**
2. Click **"SQL Editor"** in the left sidebar
3. Paste the entire contents of **`backend/schema.sql`**
4. Click **"Run"**
5. Then run seed data: in your terminal → `cd backend && npm run seed`

### Step 2 — Verify API Keys Work

Test each service:
```bash
# Test Gemini (from backend dir)
cd backend && node -e "
const { GoogleGenerativeAI } = require('@google/generative-ai');
const g = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
g.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }).generateContent('hello').then(r => console.log('Gemini OK:', r.response.text().substring(0,50))).catch(console.error)
"

# Test ORS
curl -X POST https://api.openrouteservice.org/v2/directions/driving-car \
  -H "Authorization: YOUR_ORS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"coordinates":[[72.8777,19.0760],[72.8295,19.0596]]}'
```

### Step 3 — Production Deployment

**Frontend → Vercel:**
```
NEXT_PUBLIC_SUPABASE_URL=https://wmsmgmoquratfupanvgo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
NEXT_PUBLIC_SOCKET_URL=https://<your-railway-backend-url>
NEXT_PUBLIC_BACKEND_URL=https://<your-railway-backend-url>
```

**Backend → Railway:**
```
NEXT_PUBLIC_SUPABASE_URL=https://wmsmgmoquratfupanvgo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
GEMINI_API_KEY=<your key>
ORS_API_KEY=<your key>
```
