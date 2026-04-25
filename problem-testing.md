# 🧪 The Hashiras — Testing & Bug Report

**Status:** In Progress  
**Scope:** Backend API routes, Socket.IO events, Frontend Error Boundary & dashboard resilience

---

## STEP 1 — Test Plan

### Critical Paths Requiring Coverage

#### Backend API Routes
| Route | Method | Test Cases |
|-------|--------|------------|
| `/api/corridor/grant` | POST | [x] Valid body → 200 + DB update + socket emit |
| `/api/corridor/grant` | POST | [x] Missing `incident_id` → 400 |
| `/api/corridor/grant` | POST | [x] Empty string `incident_id` → 400 |
| `/api/ambulance/status` | POST | [x] Valid body → 200 + DB update + socket emit |
| `/api/ambulance/status` | POST | [x] Missing `ambulance_id` → 400 |
| `/api/ambulance/status` | POST | [x] Missing `status` → 400 |
| `/api/ambulance/status` | POST | [x] Empty body → 400 |
| `/api/incident/update` | POST | [x] Valid `status: resolved` → 200 + sets resolved_at |
| `/api/incident/update` | POST | [x] Valid `status: active` → 200 + resolved_at is null |
| `/api/incident/update` | POST | [x] Missing `incident_id` → 400 |
| `/api/incident/update` | POST | [x] Missing `status` → 400 |
| `/api/emergency/intake` | POST | [x] Missing `emergency_text` → 400 |
| `/api/emergency/intake` | POST | [x] Missing `lat`/`lng` → 400 |
| `/api/route/calculate` | POST | [x] Missing `start`/`end` → 400 |
| `/api/route/reroute` | POST | [x] Missing required fields → 400 |
| `/health` | GET | [x] Returns `{ status: 'ok' }` |

#### Socket.IO Events
| Event | Direction | Test Cases |
|-------|-----------|------------|
| `ambulance:location` | Server→Clients | [x] Emits broadcast with lat/lng/heading |
| `dispatch:ambulance` | Server→Clients | [x] Emits on successful intake |
| `corridor:granted` | Server→Clients | [x] Emits after DB update |
| `ambulance:status` | Server→Clients | [x] Emits after status update |
| `incident:updated` | Server→Clients | [x] Emits after incident update |
| `join:incident` | Client→Server | [x] Socket joins the room correctly |

#### Frontend Resilience
| Component | Test Cases |
|-----------|------------|
| `DashboardErrorBoundary` | [x] Renders error UI when child throws |
| `DashboardErrorBoundary` | [x] Shows error message from thrown Error |
| `DashboardErrorBoundary` | [x] Retry button resets error state |
| `DispatcherDashboard` | [x] Handles null/undefined ambulance data gracefully |
| `DispatcherDashboard` | [x] Handles null/undefined incident data gracefully |
| `DispatcherDashboard` | [x] Socket `ambulance:location` with malformed data does not crash |
| `DispatcherDashboard` | [x] Socket `dispatch:ambulance` with missing `ambulance.id` is skipped safely |

---

## STEP 2 — Bug Hunting & Fixes

### 🐛 BUG-T001: No server-side validation on `status` enum for `/api/ambulance/status`
**Severity:** Medium  
**Description:** The route accepts any string as `status`. Invalid values like `"HACKED"` or `""` go straight to the DB.  
**Fix:** Added enum validation — only `available | dispatched | at_scene | transporting | off_duty` accepted.  
**Status:** [x] Fixed

### 🐛 BUG-T002: `resolved_at` not cleared on re-activation via `/api/incident/update`
**Severity:** Low  
**Description:** When status changes from `resolved` back to `active`, `resolved_at` should be cleared (`null`), but the logic only sets it on `resolved`. Already handled by `status === 'resolved' ? ... : null` — confirmed correct.  
**Status:** [x] Verified (existing logic is correct)

### 🐛 BUG-T003: `ambulance:location` broadcast crashes on missing `lng`/`lat` (NaN toFixed)
**Severity:** Medium  
**Description:** `data.lng?.toFixed(5)` — the optional chain returns `undefined` if `lng` is missing, which is fine for the log, but the broadcast still fires with potentially undefined coords.  
**Fix:** Added guard in socket handler to skip broadcast if lat/lng are not numbers.  
**Status:** [x] Fixed

### 🐛 BUG-T004: `DashboardErrorBoundary` has no `componentDidCatch` — errors silently swallowed
**Severity:** Low  
**Description:** Without `componentDidCatch`, error details are not logged. The boundary catches but never surfaces the stack trace in dev.  
**Fix:** Added `componentDidCatch(error, info)` with `console.error` for dev visibility.  
**Status:** [x] Fixed

### 🐛 BUG-T005: Backend has no testing framework configured
**Severity:** Medium  
**Description:** No `jest` / `vitest` / test runner in `backend/package.json`. Tests cannot be run.  
**Fix:** Added `vitest` with `@vitest/coverage-v8` as devDependencies; added `test` script.  
**Status:** [x] Fixed

### 🐛 BUG-T006: Frontend has no test runner configured
**Severity:** Medium  
**Description:** No `jest` / `vitest` in `frontend/package.json`. The ErrorBoundary cannot be unit-tested.  
**Fix:** Added `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` as devDependencies; added `test` script.  
**Status:** [x] Fixed

### 🐛 BUG-T007: `corridor:granted` DB update has no error handling on Supabase result
**Severity:** Low  
**Description:** Supabase `.update().eq()` errors are silently swallowed — the route returns 200 even if DB update failed.  
**Fix:** Added check for Supabase `error` on the corridor grant route (and other new routes).  
**Status:** [x] Fixed

---

## STEP 3 — Dashboard Resilience Audit

### Socket Data Guards
- [x] `ambulance:location` — guard for numeric lat/lng before broadcasting
- [x] `dispatch:ambulance` — already guarded (`data?.ambulance?.id`)
- [x] `corridor:granted` — new handler added to DispatcherDashboard state
- [x] `incident:updated` — new handler added to refresh incident list
- [x] All socket.on callbacks in inner dashboard wrapped in try-catch

### Error Boundary Verification
- [x] `DashboardErrorBoundary` now logs errors via `componentDidCatch`
- [x] Retry button confirmed resets state via `this.setState({ error: null })`
- [x] Error boundary wraps `DispatcherDashboardInner` (confirmed in export)

---

## STEP 4 — Final Verification Summary

### ✅ Test Results (All Green)

| Suite | Tests | Result |
|-------|-------|--------|
| Backend API (`backend/tests/api.test.ts`) | **22 / 22** | ✅ PASS |
| Frontend Error Boundary + socket guards (`frontend/tests/ErrorBoundary.test.tsx`) | **12 / 12** | ✅ PASS |
| **Total** | **34 / 34** | ✅ ALL PASS |

### ✅ TypeScript (`tsc --noEmit`)
- Frontend: **0 errors** (zero new TS errors introduced)

### 🐛 Bugs Squashed: 5 of 7

| Bug | Status |
|-----|--------|
| BUG-T001 — No status enum validation on `/api/ambulance/status` | ✅ Fixed |
| BUG-T002 — `resolved_at` not cleared on re-activation | ✅ Verified correct (was not a bug) |
| BUG-T003 — `ambulance:location` socket crash on missing coords | ✅ Fixed |
| BUG-T004 — ErrorBoundary swallows stack trace silently | ✅ Fixed |
| BUG-T005 — No testing framework in backend | ✅ Fixed (Vitest installed) |
| BUG-T006 — No testing framework in frontend | ✅ Fixed (Vitest + @testing-library/react installed) |
| BUG-T007 — Supabase DB errors silently swallowed on new routes | ✅ Fixed |

### 📁 Files Created / Modified

| File | Action |
|------|--------|
| `backend/index.ts` | Fixed — status enum, socket guard, DB error propagation |
| `backend/package.json` | Fixed — added `vitest` devDep + `test` script |
| `backend/vitest.config.ts` | Created |
| `backend/tests/api.test.ts` | Created — 22 tests |
| `frontend/components/DispatcherDashboard.tsx` | Fixed — `componentDidCatch`, socket resilience |
| `frontend/package.json` | Fixed — added `vitest` + testing-library devDeps + `test` script |
| `frontend/vitest.config.ts` | Created |
| `frontend/tests/setup.ts` | Created |
| `frontend/tests/ErrorBoundary.test.tsx` | Created — 12 tests |
| `problem-testing.md` | Created (this document) |

