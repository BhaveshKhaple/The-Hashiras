# REQUIREMENTS.md — AI Ambulance v1

## Vision
AI-Enabled Smart Emergency Response & Ambulance Coordination System.

## Core Features (v1 Scope)
1. **Emergency Intake**: Voice and text input via Web Speech API and textarea.
2. **AI Triage**: Gemini 2.0 Flash processing intake text to generate structured triage JSON (severity, type, requirements).
3. **Dispatch Routing**: PostGIS-based nearest ambulance/hospital query + OpenRouteService routing.
4. **Real-time Broadcast**: Socket.IO (Hono) rooms for incident tracking across 4 dashboards.
5. **Role-Based Dashboards**:
    - Dispatcher: Intake and oversight.
    - Driver: Navigation and status updates.
    - Hospital: Pre-alert and bed management.
    - Traffic Police: Green corridor and roadblock reporting.

## Technical Stack
- **Frontend**: Next.js 15 (App Router), Tailwind v4, shadcn/ui.
- **Backend**: Hono.js on Bun, Socket.IO.
- **Database**: Supabase (Postgres + PostGIS + Realtime).
- **APIs**: Gemini 2.0 Flash, OpenRouteService.
- **Maps**: Leaflet.js + OpenStreetMap.

## Acceptance Criteria
- AI correctly triages an emergency description into JSON.
- Nearest ambulance is correctly identified via geo-query.
- Route is displayed on Leaflet map using ORS GeoJSON.
- Real-time updates propagate to all 4 dashboards via Socket.IO.
