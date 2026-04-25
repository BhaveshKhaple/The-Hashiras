# ROADMAP.md — AI Ambulance

## Milestone 1: MVP Core & Real-time Integration

### Phase 1: Skeleton & Environment Setup
- **1.1**: Initialize Next.js 15 (Frontend) and Hono.js (Backend) skeletons.
- **1.2**: Configure Supabase schema and Auth.
- **1.3**: Setup basic Socket.IO server and health checks.

### Phase 2: AI Triage & Intake
- **2.1**: Implement Voice/Text Intake UI.
- **2.2**: Integrate Gemini 2.0 Flash for medical triage.
- **2.3**: Store incidents in Supabase.

### Phase 3: Routing & Geo-Queries
- **3.1**: Seed hospital and ambulance data with PostGIS points.
- **3.2**: Implement nearest-neighbor search for dispatch.
- **3.3**: Integrate OpenRouteService for ambulance routing.

### Phase 4: Dashboards & Real-time
- **4.1**: Build Dispatcher Dashboard (Map + Active Incidents).
- **4.2**: Build Driver Dashboard (Navigation + Status).
- **4.3**: Build Hospital Dashboard (Pre-alerts + Bed updates).
- **4.4**: Build Traffic Police Dashboard (Green corridor).

### Phase 5: Verification & Deployment
- **5.1**: Comprehensive end-to-end testing of the demo scenarios.
- **5.2**: Final deployment to Vercel and Railway.

### Phase 6: Wrap up current phase in md doc
- **6.1**: Document completed work for Phase 1 and 2.1.
- **6.2**: Extract learnings and patterns.
