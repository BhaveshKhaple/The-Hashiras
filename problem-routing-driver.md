# problem-routing-driver.md — Routing, Allocation & Driver Dashboard Fix

> Generated: 2026-04-25

---

## Root Cause Analysis

### RTG-001 [CRITICAL] — Driver Dashboard used hardcoded `AMB-001` string name, not Supabase UUID
- **File**: `frontend/app/(roles)/driver/page.tsx`
- **Problem**: The driver page hardcoded `ambulance_id: 'AMB-001'` in status updates and used a string name instead of the actual UUID from Supabase. This meant:
  1. `dispatch:ambulance` socket events (which contain the UUID) never matched
  2. `ambulance:location` events (which contain the UUID) never updated the driver's marker
  3. Status POST to `/api/ambulance/status` sent a string name instead of UUID → DB update failed silently
- **Fix**: Fetch the driver's ambulance from Supabase on mount, store UUID in `useRef`, match all socket events against it
- Status: [x] FIXED

### RTG-002 [CRITICAL] — Driver Dashboard didn't show route polyline to patient
- **File**: `frontend/app/(roles)/driver/page.tsx` line 119
- **Problem**: `incidents` array passed to MapComponent only contained `{lat, lng}` but NOT `route_geojson`. The MapComponent renders polylines from `route_geojson` — without it, no route line appears on the map.
- **Fix**: Extract `route_geojson` from the `dispatch:ambulance` socket event and attach it to the incident object
- Status: [x] FIXED

### RTG-003 [HIGH] — Driver Dashboard didn't show hospitals on map
- **File**: `frontend/app/(roles)/driver/page.tsx` line 119
- **Problem**: `hospitals={[]}` was hardcoded as empty array — driver had no context about where they're taking the patient
- **Fix**: Fetch hospitals from Supabase and pass them to MapComponent
- Status: [x] FIXED

### RTG-004 [HIGH] — No progress indicator for GPS movement
- **Problem**: Simulator emits `progress` (0-100%) in every `ambulance:location` event, but the driver page never displayed it. The driver had no sense of how far along the route they were.
- **Fix**: Added progress bar in header + in the incident card panel, updated from socket `progress` field
- Status: [x] FIXED

### RTG-005 [HIGH] — Driver didn't auto-detect already-dispatched state on page load
- **Problem**: If the driver refreshes the page mid-route, all state was lost. The page started in "Available" mode with no incident.
- **Fix**: On mount, check if the ambulance has `status: 'dispatched'`. If yes, fetch its active incident from Supabase and restore the en_route state
- Status: [x] FIXED

### RTG-006 [MEDIUM] — Dispatcher incident cards didn't show ambulance type, driver, or hospital
- **File**: `frontend/components/DispatcherDashboard.tsx`
- **Problem**: Incident cards only showed `AMB-???` name. Didn't show whether it's ALS/BLS, who's driving, or which hospital was assigned.
- **Fix**: Now shows ambulance name + type badge (red ALS / green BLS) + driver name + hospital with bed count
- Status: [x] FIXED

### RTG-007 [INFO] — Simulator already works correctly
- **File**: `backend/simulator.js`
- **Analysis**: The simulator already correctly:
  1. Fetches the active incident with route_geojson
  2. Extracts coordinates from the GeoJSON
  3. Emits `ambulance:location` with lat, lng, heading, progress, speed_kmh every 2 seconds
  4. Updates Supabase ambulance location at each step
  5. Marks incident resolved and ambulance available when done
- No changes needed.

---

## Fix Summary

| ID | Severity | Description | Status |
|---|---|---|---|
| RTG-001 | CRITICAL | Driver page AMB UUID matching | [x] FIXED |
| RTG-002 | CRITICAL | Driver map route polyline | [x] FIXED |
| RTG-003 | HIGH | Driver map hospitals | [x] FIXED |
| RTG-004 | HIGH | GPS progress indicator | [x] FIXED |
| RTG-005 | HIGH | Restore state on refresh | [x] FIXED |
| RTG-006 | MEDIUM | Dispatcher allocation visibility | [x] FIXED |
| RTG-007 | INFO | Simulator verification | ✅ Already working |

## TypeScript Verification

```
npx tsc --noEmit → Exit 0, zero errors ✅
```

---

## 🎮 How to Demo

### Prerequisite
- Backend running: `cd backend && npm run start` → port 3001
- Frontend running: `cd frontend && npm run dev` → port 3000
- Database seeded: `cd backend && npm run seed` (must have been run at least once)

### Step 1 — Open Two Browser Tabs

| Tab | URL | What it shows |
|---|---|---|
| Tab 1 | `http://localhost:3000/dispatcher` | Dispatcher Center — all ambulances, hospitals, incidents on map |
| Tab 2 | `http://localhost:3000/driver` | Driver Console — your ambulance unit, standby screen |

### Step 2 — Create a Mock Incident

Open a **third terminal** and run:

```bash
cd backend
node mock-incident.js
```

**Expected output:**
```
Creating mock incident for simulator test...
✅ Mock incident created: <uuid>
```

**What you should see:**
- **Dispatcher tab**: New incident card appears in sidebar with severity badge, assigned ambulance (AMB-001, ALS type, driver name), and assigned hospital
- **Dispatcher map**: Red pulsing SOS marker appears at Bandra
- **Driver tab**: Should switch from "Standby" to "En Route" with incident details, if the dispatch:ambulance socket event arrives. If it doesn't change automatically, refresh the driver page — it will detect the dispatched state from Supabase.

### Step 3 — Start the Ambulance Movement Simulator

In the **same third terminal**:

```bash
node simulator.js
```

**Expected output:**
```
🚑 Ambulance GPS Simulator Starting...
📡 Connecting to Socket.IO at: http://localhost:3001
📋 Found incident: <uuid>
🚑 Ambulance ID: <uuid>
🗺️  Route has 5 raw coordinate points
📍 Simulation will emit 60 GPS points (every 2s)
✅ Connected to server
🏁 Starting GPS simulation...
📍 [0.0%] lng: 72.829500, lat: 19.059600 | heading: -66° | speed: 72 km/h
📍 [1.7%] lng: 72.830418, lat: 19.057996 ...
```

**What you should see in REAL TIME:**
- **Dispatcher map**: The ambulance marker (red ALS vehicle) moves smoothly along the route from Bandra to Worli
- **Driver tab**:
  - Progress bar fills from 0% to 100% in the header
  - Progress bar also updates in the incident card panel
  - The ambulance marker moves on the driver's map
  - ETA badge shows in top-left of map

### Step 4 — Watch Completion

When the simulator reaches 100%:
```
🏥 Ambulance reached destination!
✅ Incident resolved. Ambulance marked available.
```

- **Dispatcher**: Incident card disappears from sidebar, ambulance returns to "available" (green)
- **Driver**: Status resets to "Available" if you refresh

### Using `--mock` Flag (One Command)

For a completely autonomous demo:

```bash
cd backend && node simulator.js --mock
```

This creates a mock incident AND runs the simulator in one command. Watch both tabs simultaneously!
