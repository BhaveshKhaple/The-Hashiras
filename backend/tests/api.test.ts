/**
 * The Hashiras — Backend API Test Suite
 * Tests all three newly added routes plus existing critical endpoints.
 * Uses Hono's built-in test client so no actual server needs to run.
 *
 * Run: npm test  (from backend/)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────
// We mock heavy external dependencies so tests stay offline and fast.

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: 'test-incident-1', status: 'active' },
            error: null,
          })),
        })),
      })),
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  })),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn(() => Promise.resolve({
        response: {
          text: vi.fn(() => JSON.stringify({
            severity: 'HIGH',
            ambulance_type: 'ALS',
            suspected_conditions: ['cardiac arrest'],
            hospital_requirements: ['cardiac cath lab'],
            patient_summary: 'Test patient',
            triage_reasoning: 'Test reasoning',
          })),
        },
      })),
    })),
  })),
}));

vi.mock('socket.io', () => ({
  Server: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('http', () => ({
  createServer: vi.fn(() => ({})),
}));

vi.mock('@hono/node-server', () => ({
  serve: vi.fn((opts: any, cb: any) => cb?.({ port: 3001 })),
}));

vi.mock('dotenv', () => ({ config: vi.fn() }));

// ─── Import the Hono app ──────────────────────────────────────────────────────
// We import the default export (the Hono app) after all mocks are in place.
// Using a dynamic import inside each describe block ensures fresh module state.

async function getApp() {
  vi.resetModules();
  const mod = await import('../index.js');
  return mod.default;
}

// ─── Helper ──────────────────────────────────────────────────────────────────
async function post(app: any, path: string, body: Record<string, unknown>) {
  const req = new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return app.fetch(req);
}

async function get(app: any, path: string) {
  return app.fetch(new Request(`http://localhost${path}`));
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns status ok with timestamp', async () => {
    const app = await getApp();
    const res = await get(app, '/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/corridor/grant
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/corridor/grant', () => {
  it('returns 200 with valid incident_id', async () => {
    const app = await getApp();
    const res = await post(app, '/api/corridor/grant', { incident_id: 'inc-001' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.incident_id).toBe('inc-001');
  });

  it('returns 400 when incident_id is missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/corridor/grant', {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/incident_id/i);
  });

  it('returns 400 when incident_id is an empty string', async () => {
    const app = await getApp();
    const res = await post(app, '/api/corridor/grant', { incident_id: '   ' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/incident_id/i);
  });

  it('returns 400 when incident_id is null', async () => {
    const app = await getApp();
    const res = await post(app, '/api/corridor/grant', { incident_id: null });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ambulance/status
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/ambulance/status', () => {
  it('returns 200 with valid ambulance_id and status=available', async () => {
    const app = await getApp();
    const res = await post(app, '/api/ambulance/status', {
      ambulance_id: 'amb-001',
      status: 'available',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.ambulance_id).toBe('amb-001');
    expect(body.status).toBe('available');
  });

  it('accepts all valid status values', async () => {
    const app = await getApp();
    const validStatuses = ['available', 'dispatched', 'at_scene', 'transporting', 'off_duty'];
    for (const status of validStatuses) {
      const res = await post(app, '/api/ambulance/status', { ambulance_id: 'amb-001', status });
      expect(res.status).toBe(200, `Expected 200 for status=${status}`);
    }
  });

  it('returns 400 for invalid status value (BUG-T001)', async () => {
    const app = await getApp();
    const res = await post(app, '/api/ambulance/status', {
      ambulance_id: 'amb-001',
      status: 'HACKED',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid status/i);
  });

  it('returns 400 when ambulance_id is missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/ambulance/status', { status: 'available' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when status is missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/ambulance/status', { ambulance_id: 'amb-001' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty body', async () => {
    const app = await getApp();
    const res = await post(app, '/api/ambulance/status', {});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/incident/update
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/incident/update', () => {
  it('returns 200 with valid body (status=resolved)', async () => {
    const app = await getApp();
    const res = await post(app, '/api/incident/update', {
      incident_id: 'inc-001',
      status: 'resolved',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('resolved');
  });

  it('returns 200 with valid body (status=active)', async () => {
    const app = await getApp();
    const res = await post(app, '/api/incident/update', {
      incident_id: 'inc-001',
      status: 'active',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 400 when incident_id is missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/incident/update', { status: 'resolved' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/incident_id/i);
  });

  it('returns 400 when status is missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/incident/update', { incident_id: 'inc-001' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/status/i);
  });

  it('returns 400 for completely empty body', async () => {
    const app = await getApp();
    const res = await post(app, '/api/incident/update', {});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/route/calculate — validation only (no real ORS call)
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/route/calculate — validation', () => {
  it('returns 400 when start is missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/route/calculate', {
      end: [72.877, 19.076],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing/i);
  });

  it('returns 400 when end is missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/route/calculate', {
      start: [72.877, 19.076],
    });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/route/reroute — validation only
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/route/reroute — validation', () => {
  it('returns 400 when required fields are missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/route/reroute', { ambulance_id: 'amb-001' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/emergency/intake — validation only (mocked Gemini)
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/emergency/intake — validation', () => {
  it('returns 400 when emergency_text is missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/emergency/intake', { lat: 19.07, lng: 72.87 });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing/i);
  });

  it('returns 400 when lat is missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/emergency/intake', {
      emergency_text: 'chest pain',
      lng: 72.87,
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when lng is missing', async () => {
    const app = await getApp();
    const res = await post(app, '/api/emergency/intake', {
      emergency_text: 'chest pain',
      lat: 19.07,
    });
    expect(res.status).toBe(400);
  });
});
