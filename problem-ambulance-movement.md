# problem-ambulance-movement.md — Ghost Ambulance Movement Fix

> Generated: 2026-04-25

---

## Root Cause Analysis

The "ghost ambulance" bug has **three** compounding root causes:

### RC-1 [CRITICAL] — MapComponent destroys and recreates ALL markers every 2 seconds

- **File**: `frontend/components/MapComponent.tsx`
- **Bug**: The single `useEffect` at line 214 ran on every change to `ambulances`, `hospitals`, OR `incidents`. It called:
  ```javascript
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker || layer instanceof L.Polyline) {
      map.removeLayer(layer);
    }
  });
  ```
  This removed EVERY marker on the map, then recreated them all from scratch. When the simulator emits GPS updates every 2 seconds, this caused:
  1. **Visual flickering** — markers blink/disappear for a frame during recreation
  2. **No smooth motion** — new marker appears at new position (no transition)
  3. **Popup destruction** — any open popup gets killed and recreated
  4. **Performance** — creating SVG divIcon DOM elements 6+ times every 2 seconds

- **Fix**: Rewrote MapComponent to use **persistent marker refs** (`Map<string, L.Marker>`):
  - Ambulance markers are **moved in-place** via `marker.setLatLng()` — produces smooth, continuous motion
  - Icon is updated via `marker.setIcon()` — heading rotation changes smoothly
  - Hospital and incident markers are created once, only removed when stale
  - Route polylines are cached per incident ID
  - Separate `useEffect` hooks for ambulances/hospitals/incidents — narrowed dependencies

- Status: [x] FIXED

### RC-2 [CRITICAL] — mock-incident.js didn't mark ambulance as `dispatched`

- **File**: `backend/mock-incident.js`
- **Bug**: The script created the incident with `assigned_ambulance_id: amb.id` but NEVER called:
  ```javascript
  await supabase.from('ambulances').update({ status: 'dispatched' }).eq('id', amb.id);
  ```
  Result: The dispatcher dashboard still showed the ambulance as `available` at its original seed position. When the simulator started emitting new positions, two things happened simultaneously:
  1. The Supabase subscription refreshed the ambulance list → marker snapped back to seed position
  2. The socket event moved the marker → forward
  
  This fight between Supabase-sourced position and socket-sourced position made the ambulance appear to "jump back and forth" or stay frozen.

- **Fix**: Added `update({ status: 'dispatched' })` call after incident creation

- Status: [x] FIXED

### RC-3 [MEDIUM] — Socket listener cleanup missing for key events

- **File**: `frontend/components/DispatcherDashboard.tsx` lines 101-107
- **Bug**: The `useEffect` cleanup called:
  ```javascript
  socket.off('corridor:granted');
  socket.off('incident:updated');
  ```
  But did NOT call:
  ```javascript
  socket.off('ambulance:location');    // ← MISSING
  socket.off('dispatch:ambulance');    // ← MISSING
  ```
  On React strict mode double-renders or HMR reloads, this caused duplicate listeners accumulating — the same ambulance update was processed 2x, 3x, etc.

- **Fix**: Added the missing `socket.off()` calls

- Status: [x] FIXED

---

## Technical Detail: Why `setLatLng()` vs Destroy/Recreate Matters

| Approach | What happens | Visual result |
|---|---|---|
| **Old (destroy/recreate)** | Every 2s: remove ALL markers, create ALL markers | Markers flicker. No CSS transition possible. Ambulance appears to "ghost" or freeze. |
| **New (setLatLng)** | Every 2s: call `marker.setLatLng(newPos)` | Leaflet internally moves the existing DOM element. The `transform:rotate()` CSS transition on the icon div produces smooth heading rotation. |

The key line that fixes movement:
```javascript
const newLatLng = L.latLng(lat, lng);
marker.setLatLng(newLatLng);   // ← SMOOTH MOVE, no DOM destruction
marker.setIcon(newIcon);       // ← Update heading rotation
```

---

## Fix Summary

| ID | Severity | Description | Status |
|---|---|---|---|
| RC-1 | CRITICAL | MapComponent: persistent markers + setLatLng | [x] FIXED |
| RC-2 | CRITICAL | mock-incident.js: mark ambulance dispatched | [x] FIXED |
| RC-3 | MEDIUM | Socket listener cleanup | [x] FIXED |

## TypeScript Verification

```
npx tsc --noEmit → Exit 0, zero errors ✅
```

---

## 🎮 How to Demo

### Prerequisites
- Backend running: `cd backend && npm run start` (port 3001)
- Frontend running: `cd frontend && npm run dev` (port 3000)
- Database seeded: `cd backend && npm run seed` (at least once)
- **Important**: Reset any stale data first:
  ```bash
  cd backend && npm run seed    # re-seeds clean data
  ```

### Method A — Two-Step Demo (Recommended)

**Step 1 — Create an incident:**
```bash
cd backend && node mock-incident.js
```
Expected output:
```
Creating mock incident for simulator test...
✅ Mock incident created: <uuid>
🚑 Ambulance <uuid> marked as dispatched
💡 Now run: node simulator.js
```

**Step 2 — Start the ambulance movement:**
```bash
node simulator.js
```
Expected output:
```
🚑 Ambulance GPS Simulator Starting...
📡 Connecting to Socket.IO at: http://localhost:3001
📋 Found incident: <uuid>
🚑 Ambulance ID: <uuid>
🗺️  Route has 5 raw coordinate points
📍 Simulation will emit 60 GPS points (every 2s)
⏱️  Estimated duration: 120s

✅ Connected to server
🏁 Starting GPS simulation...

📍 [0.0%] lng: 72.829500, lat: 19.059600 | heading: -66° | speed: 72 km/h
📍 [1.7%] lng: 72.830418, lat: 19.057996 ...
```

### Method B — One-Command Demo

```bash
cd backend && node simulator.js --mock
```
This creates a mock incident AND immediately starts the movement.

### What to Watch

Open both tabs side by side:

| Tab | URL | What you'll see |
|---|---|---|
| **Dispatcher** | `http://localhost:3000/dispatcher` | All ambulances on map. The dispatched one (AMB-001, red ALS icon) moves smoothly from Bandra toward Worli. Incident card shows assigned ambulance + ALS badge + driver name. |
| **Driver** | `http://localhost:3000/driver` | Your ambulance marker moves on the map. Progress bar fills 0% → 100%. Incident details in sidebar show severity, patient location, ETA. |

### Expected Timeline

| Time | What happens |
|---|---|
| 0s | Simulator connects, starts emitting from Bandra |
| 30s | Ambulance has moved ~25% along the route |
| 60s | Ambulance is ~50% (mid-route between Bandra and Worli) |
| 120s | Ambulance reaches destination (Worli) |
| 121s | Simulator marks incident resolved, ambulance back to available |

### Verification Checklist

- [ ] Ambulance marker moves smoothly on dispatcher map (no flickering)
- [ ] Ambulance marker moves on driver map
- [ ] Driver progress bar fills from 0% to 100%
- [ ] Dispatcher incident card shows ambulance name + ALS/BLS badge
- [ ] When simulator finishes, ambulance returns to "available" status
- [ ] Hospital markers remain stable during movement (no flickering)
- [ ] SOS incident marker pulses steadily (no re-creation flicker)
