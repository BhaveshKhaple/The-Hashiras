# problem-map-visuals.md — Map Rendering & Data Seeding Fix

> Generated: 2026-04-25

---

## Root Cause Analysis

### MAP-001 [HIGH] — Ambulance markers colored by `status` not `type`
- **File**: `frontend/components/MapComponent.tsx` line 55
- **Problem**: `const color = a.status === 'dispatched' ? '#ff3e3e' : '#4ade80'` — this makes ALL available ambulances green and ALL dispatched ones red, ignoring the ALS/BLS distinction the user wants.
- **Required**: ALS (Advanced Life Support, has ventilator/defib) → Red. BLS (Basic Life Support, standard) → Green. Dispatched status → shown in popup only.
- Status: [x] FIXED

### MAP-002 [HIGH] — Hospital marker crashes when `h.lat` or `h.lng` is undefined
- **File**: `frontend/components/MapComponent.tsx` line 86
- **Problem**: `L.marker([h.lat, h.lng])` — if Supabase returns the PostGIS `location` as a WKB binary or null instead of numeric lat/lng, Leaflet throws and the map crashes.
- **Fix**: Add null guard with Mumbai fallback coordinates.
- Status: [x] FIXED

### MAP-003 [HIGH] — Hospital icon renders using SVG building path, not a clear H+ cross
- **Problem**: The SVG used for hospitals is a building silhouette, not easily recognizable as a hospital on a map.
- **Fix**: Replace with a clearly recognizable red cross / H icon with blue background.
- Status: [x] FIXED

### MAP-004 [HIGH] — Patient/Incident marker is a tiny 16px dot — hard to see
- **Problem**: Incident marker is `w-4 h-4` (16px) dot — almost invisible, especially when overlapping with ambulance markers.
- **Fix**: Replace with a pulsing SOS cross icon, larger and more distinct.
- Status: [x] FIXED

### MAP-005 [MEDIUM] — Seed has only 4 ambulances, 3 hospitals — not enough visual data
- **File**: `backend/seed.js`
- **Problem**: Only 4 ambulances seeded (2 ALS, 2 BLS). Map looks sparse. Dashboard shows "0 AMB" because it counts `status === 'available'` but seeded data may have been overwritten.
- **Fix**: Expand to 6 ambulances (3 ALS Advanced, 3 BLS Standard) and 5 hospitals with realistic Mumbai neighborhoods.
- Status: [x] FIXED

### MAP-006 [MEDIUM] — `mock-incident.js` route coordinates are correct (Mumbai) but `--mock` flag in simulator didn't use realistic varied coords
- **Fix**: Keep existing Bandra route, add lat/lng fields.
- Status: [x] FIXED (verified coords already in Mumbai range)

---

## Fix Summary

| ID | Severity | Description | Status |
|---|---|---|---|
| MAP-001 | HIGH | Ambulance color by type (ALS=red, BLS=green) | [x] FIXED |
| MAP-002 | HIGH | Hospital marker null-safe lat/lng | [x] FIXED |
| MAP-003 | HIGH | Hospital icon → blue H+ cross | [x] FIXED |
| MAP-004 | HIGH | Incident marker → pulsing SOS | [x] FIXED |
| MAP-005 | MEDIUM | Expand seed to 6 amb + 5 hospitals | [x] FIXED |
| MAP-006 | MEDIUM | mock-incident Mumbai coords | [x] FIXED (already correct) |

---

## TypeScript Verification

```
npx tsc --noEmit → Exit 0 ✅
```

---

## 🚀 Demo Instructions

### To see Red/Green ambulances + Hospital icons on the map:

**1. Re-seed the database** (wipes old data and inserts fresh Mumbai data):
```bash
cd backend
npm run seed
```
Expected output:
```
Seeding database...
Ambulances seeded successfully. (6 rows)
Hospitals seeded successfully. (5 rows)
Seeding complete.
```

**2. Restart the backend** (if already running):
```bash
# Ctrl+C the existing backend terminal, then:
cd backend && npm run start
```

**3. Refresh your browser:**
- Go to `http://localhost:3000/dispatcher`
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

**4. What you should see on the map:**
- 🔴 **3 Red ambulances** = ALS (Advanced — has ventilator, defibrillator) at Andheri, Bandra, Dadar
- 🟢 **3 Green ambulances** = BLS (Standard) at Kurla, Thane, Worli
- 🏥 **5 Blue hospital markers** = H+ cross icons at Lilavati, KEM, Hinduja, Nanavati, Jaslok
- ⚡ **Incident markers** = pulsing red SOS cross (appear when an emergency is active)

**5. To trigger a live incident:**
```bash
cd backend && node mock-incident.js
```
Then refresh `/dispatcher` — you'll see an incident marker appear on the Bandra area.

**6. To run the ambulance movement simulation:**
```bash
cd backend && node simulator.js --mock
```
Watch the ambulance marker animate across the map in real-time!
