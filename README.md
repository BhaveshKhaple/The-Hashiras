# AI-Enabled Smart Emergency Response & Ambulance Coordination System

## Tech Stack
- **Frontend**: Next.js 15, Tailwind v4, shadcn/ui, Leaflet.js
- **Backend**: Hono.js on Bun, Socket.IO
- **Database**: Supabase + PostGIS
- **AI**: Gemini 2.0 Flash
- **Routing**: OpenRouteService

## Deployment URLs
- **Frontend**: [LIVE_URL_HERE]
- **Backend**: [LIVE_URL_HERE]

## Local Setup

### Prerequisites
- [Bun](https://bun.sh/) installed
- [Node.js](https://nodejs.org/) installed

### Installation

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your keys.

#### Backend
```bash
cd backend
bun install
bun run dev
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## GSD Commands
This project uses the GSD (Get Shit Done) workflow.
- `.planning/` contains all project context and roadmaps.
- Use `gsd-progress` to check status.
