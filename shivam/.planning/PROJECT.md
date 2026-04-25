# AI-Enabled Smart Emergency Response & Ambulance Coordination System
# Tech Stack — 2026 Edition (Lightweight, Free-Tier, Hackathon-Ready)

---

## THE 7 LAYERS OF THIS SYSTEM

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1 — INTAKE       Voice / Text Emergency Input    │
│  LAYER 2 — AI BRAIN     Triage + Dispatch Intelligence  │
│  LAYER 3 — ROUTING      Live Route + Reroute Engine     │
│  LAYER 4 — REALTIME     Live Push to All 4 Dashboards   │
│  LAYER 5 — DATABASE     State, Availability, History    │
│  LAYER 6 — FRONTEND     4 Role-Based UIs                │
│  LAYER 7 — DEPLOY       Live in < 30 min, free tier     │
└─────────────────────────────────────────────────────────┘
```

---

## FULL STACK DECISION TABLE

| Layer | Tool | Why This, Not Alternatives |
|---|---|---|
| Frontend framework | Next.js 15 (App Router) | SSR + CSR in one, fastest to build multi-page role UIs |
| UI components | shadcn/ui + Tailwind v4 | Zero design work, professional out of the box |
| Map rendering | Leaflet.js + OpenStreetMap tiles | Free forever, no API key, works offline for demo |
| Routing engine | OpenRouteService API (free tier) | REST API, no self-hosting needed, handles ambulance costing |
| Realtime layer | Socket.IO (on Hono) | Rooms per incident, auto-reconnect, works behind Vercel |
| Backend framework | Hono.js on Bun | Fastest JS runtime, minimal boilerplate, native WebSocket |
| AI triage | Gemini 2.0 Flash (free tier) | Fastest inference, 1M token context, free API key |
| Voice input | Web Speech API (browser native) | Zero dependency, zero cost, works in Chrome demo |
| Database | Supabase (Postgres + Realtime) | Free tier, REST + realtime subscriptions, PostGIS for geo |
| Geo queries | Supabase PostGIS extension | Find nearest ambulance with SQL in 1 query |
| Auth | Supabase Auth | Role-based login (dispatcher / driver / hospital / police) |
| Deploy frontend | Vercel | 1-click, free tier, auto HTTPS |
| Deploy backend | Railway | Free trial, supports Bun + WebSocket, persistent process |
| Simulation data | Faker.js + seeded JSON | Generate realistic ambulances, hospitals, bed counts |

---

## LAYER 1 — INTAKE (Emergency Input)

### Tool: Web Speech API + plain textarea fallback

```
Browser → Web Speech API (voice-to-text) → text input field
                                          ↓
                             POST /api/emergency/intake
```

**Why Web Speech API:**
- Zero npm package, zero cost
- Works in Chrome and Edge (which is what your demo device will use)
- Perfectly demoable — speak the emergency, watch the system respond
- Fallback: plain text textarea for when mic is blocked

**What the intake captures:**
- Free text / voice: "There's been a road accident at MG Road junction, two people injured, one unconscious"
- Location: browser geolocation API (navigator.geolocation) OR manual pin on Leaflet map
- Timestamp: auto

---

## LAYER 2 — AI BRAIN (Triage + Dispatch Intelligence)

### Tool: Gemini 2.0 Flash via Google AI SDK

```
Emergency text + location
        ↓
Gemini 2.0 Flash (structured JSON output)
        ↓
{
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW",
  ambulance_type: "ALS" | "BLS",
  suspected_conditions: ["head trauma", "internal bleeding"],
  hospital_requirements: ["trauma center", "ICU"],
  patient_summary: "Male, unconscious, suspected head trauma from road accident",
  triage_reasoning: "Unconscious patient requires ALS + trauma center"
}
```

**Why Gemini 2.0 Flash:**
- Free API key, generous rate limits for a hackathon demo
- Fastest inference of any free-tier model (~300ms)
- Structured JSON output mode — no parsing issues
- Gemini Flash handles medical triage prompts extremely well

**System prompt for triage (use this exactly):**
```
You are an emergency medical dispatcher AI.
Given the emergency description and location, respond ONLY with valid JSON:
{
  "severity": "CRITICAL|HIGH|MODERATE|LOW",
  "ambulance_type": "ALS|BLS",
  "suspected_conditions": ["condition1", "condition2"],
  "hospital_requirements": ["requirement1", "requirement2"],
  "patient_summary": "one sentence for hospital pre-alert",
  "triage_reasoning": "one sentence explaining your classification"
}
ALS = Advanced Life Support (paramedic, cardiac monitor, defibrillator)
BLS = Basic Life Support (EMT, basic equipment)
Do not include any text outside the JSON object.
```

---

## LAYER 3 — ROUTING ENGINE

### Tool: OpenRouteService API (free, no self-hosting)

**Free tier:** 2,000 requests/day — plenty for a demo

**API endpoints you will use:**

```
# Get fastest route for ambulance
POST https://api.openrouteservice.org/v2/directions/driving-car
Body: {
  "coordinates": [[start_lng, start_lat], [end_lng, end_lat]],
  "preference": "fastest",
  "continue_straight": false
}
Returns: GeoJSON route geometry + duration + distance

# Reroute when traffic police flags a roadblock
Same endpoint, add:
  "options": {
    "avoid_polygons": {
      "type": "Polygon",
      "coordinates": [[[blocked area polygon]]]
    }
  }
```

---

## LAYER 4 — REALTIME LAYER

### Tool: Socket.IO on Hono.js backend

**Why Socket.IO over raw WebSocket:**
- Auto-reconnect built in (demo won't break if WiFi hiccups)
- Rooms: each incident gets its own room, messages only go to relevant parties
- Works behind Vercel edge and Railway proxy
- 10x simpler than raw WebSocket for multi-client broadcast

---

## LAYER 5 — DATABASE

### Tool: Supabase (Postgres + PostGIS + Realtime)

**Free tier:** 500MB storage, 50,000 monthly active users — more than enough

---

## LAYER 6 — FRONTEND (4 Role-Based Dashboards)

### Tool: Next.js 15 + shadcn/ui + Tailwind v4 + Leaflet.js

**Single Next.js app, 4 route groups:**
```
/app
  /dispatcher        → main control center
  /driver/[id]       → ambulance driver map + navigation
  /hospital/[id]     → pre-alert + bed management
  /traffic-police    → green corridor + roadblock reporting
```

---

## HACKATHON BUILD ORDER

```
HOUR 0:00  Get all 3 API keys. Clone Next.js + Hono starter. Push to GitHub.
HOUR 0:30  Supabase schema created. Seed data loaded. Verify PostGIS query works.
HOUR 1:00  MVP: intake → Gemini triage → dispatch query → Socket.IO emit
           All 4 dashboards exist as blank pages with correct routing.
HOUR 2:00  Live URL on Vercel + Railway. Share with team.
HOUR 2:30  Leaflet maps on dispatcher + driver pages. ORS route drawn in green.
HOUR 3:30  Hospital pre-alert dashboard live. ETA countdown working.
HOUR 4:30  Traffic police dashboard. Roadblock polygon → reroute flow.
HOUR 5:30  Ambulance live location tracking (GPS → Socket.IO → all maps).
HOUR 6:00  Seed all 5 demo scenarios. Test every flow.
HOUR 7:00  UI polish. shadcn components. Mobile check.
HOUR 7:30  Rehearse demo script 2 times. Feature freeze.
```

---

## USP vs EXISTING SOLUTIONS

| What exists | What this does differently |
|---|---|
| Manual dispatch by phone | AI triage in < 1 second, no human dispatcher needed |
| Static hospital assignment | Real-time bed + capability matching, auto-selected |
| Google Maps for routing | Specialized ambulance routing with avoid-polygon rerouting |
| No traffic police coordination | Green Corridor broadcast with zero approval delay |
| Hospital told on arrival | Pre-alert 10+ minutes early with AI patient summary |
| Fixed route | Dynamic reroute pushed to driver in real time without stopping |
