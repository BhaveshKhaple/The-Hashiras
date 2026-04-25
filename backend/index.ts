import { Hono } from 'hono'
import { Server } from 'socket.io'
import { createServer } from 'http'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { serve } from '@hono/node-server'
import { config } from 'dotenv'
import path from 'path'

// Load .env from root
config({ path: path.resolve(process.cwd(), '../.env') })

const app = new Hono()

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

app.get('/', (c) => {
  return c.text('AI Ambulance Backend - Healthy')
})

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Socket.IO setup
const httpServer = createServer()
const io = new Server(httpServer, {
  cors: { origin: '*' }
})

// Attach Hono to the same server
const port = 3001;
console.log(`🚀 Server starting on port ${port}...`)

serve({
  fetch: app.fetch,
  port,
  createServer: () => httpServer
}, (info) => {
  console.log(`✅ Hono & Socket.IO running on http://localhost:${info.port}`)
})

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  
  // Listen for ambulance GPS updates from simulator or driver app
  socket.on('ambulance:location', (data) => {
    // BUG-T003 fix: guard against missing/non-numeric lat/lng before broadcasting
    if (typeof data?.lat !== 'number' || typeof data?.lng !== 'number') {
      console.warn(`⚠️  ambulance:location skipped — invalid coords from ${socket.id}:`, data)
      return
    }
    // Broadcast to all other clients (dispatchers, hospitals, traffic police)
    socket.broadcast.emit('ambulance:location', data)
    console.log(`📍 Ambulance ${data.ambulance_id} → [${data.lng.toFixed(5)}, ${data.lat.toFixed(5)}] (${data.progress}%)`)
  })

  // Allow clients to join incident-specific rooms
  socket.on('join:incident', (incident_id) => {
    socket.join(`incident:${incident_id}`)
    console.log(`Socket ${socket.id} joined room incident:${incident_id}`)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

const systemPrompt = `You are an emergency medical dispatcher AI.
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
Do not include any text outside the JSON object.`

async function calculateRoute(coords: number[][], avoidPolygons?: any) {
  const orsKey = process.env.ORS_API_KEY;
  if (!orsKey) throw new Error("Missing ORS_API_KEY");

  const body: any = {
    coordinates: coords,
    preference: 'fastest',
    continue_straight: false
  };

  if (avoidPolygons) {
    body.options = { avoid_polygons: avoidPolygons };
  }

  const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
    method: 'POST',
    headers: {
      'Authorization': orsKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ORS API Error: ${errorText}`);
  }
  return response.json();
}

app.post('/api/route/calculate', async (c) => {
  try {
    const { start, end } = await c.req.json();
    if (!start || !end) return c.json({ error: 'Missing start or end' }, 400);

    const routeData = await calculateRoute([start, end]);
    return c.json({ success: true, route: routeData });
  } catch (error: any) {
    console.error("Calculate Route Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/route/reroute', async (c) => {
  try {
    const { ambulance_id, incident_id, blocked_polygon, start, end } = await c.req.json();
    if (!ambulance_id || !incident_id || !blocked_polygon || !start || !end) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const avoidPolygons = {
      type: "Polygon",
      coordinates: [blocked_polygon]
    };

    const routeData = await calculateRoute([start, end], avoidPolygons);
    
    await supabase.from('incidents').update({ route_geojson: routeData }).eq('id', incident_id);
    io.emit(`route:reroute`, { incident_id, route: routeData });

    return c.json({ success: true, route: routeData });
  } catch (error: any) {
    console.error("Reroute Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/emergency/intake', async (c) => {
  try {
    const body = await c.req.json()
    const { emergency_text, lat, lng } = body

    if (!emergency_text || !lat || !lng) {
      return c.json({ error: 'Missing emergency_text, lat, or lng' }, 400)
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite", systemInstruction: systemPrompt })
    const prompt = `Emergency description: ${emergency_text}\nLocation: ${lat}, ${lng}`
    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    
    let triageData
    try {
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
      triageData = JSON.parse(cleanJson)
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", responseText)
      return c.json({ error: 'Failed to generate valid triage data' }, 500)
    }

    // 1. Find Ambulance
    const { data: ambulances } = await supabase.rpc('find_nearest_ambulance', {
      search_type: triageData.ambulance_type,
      search_lng: lng,
      search_lat: lat
    })
    const assignedAmbulance = ambulances && ambulances.length > 0 ? ambulances[0] : null;

    // 2. Find Hospital
    const { data: hospitals } = await supabase.rpc('find_best_hospital', {
      req_capabilities: triageData.hospital_requirements,
      search_lng: lng,
      search_lat: lat
    })
    const assignedHospital = hospitals && hospitals.length > 0 ? hospitals[0] : null;

    // 3. Calculate Route (Ambulance -> Patient -> Hospital)
    let routeData = null;
    let etaMinutes = 0;
    if (assignedAmbulance && assignedHospital) {
      try {
        const coords = [
          [assignedAmbulance.lng, assignedAmbulance.lat], // Start at ambulance
          [lng, lat],                                     // Waypoint: Patient
          [assignedHospital.lng, assignedHospital.lat]    // End at hospital
        ];
        routeData = await calculateRoute(coords);
        
        // BUG-013 fix: ORS returns duration in multiple possible locations depending on API version/format
        let durationSeconds = 0;
        if (routeData?.features?.[0]?.properties?.segments?.[0]?.duration) {
          // GeoJSON FeatureCollection with segments array (ORS v2 standard)
          durationSeconds = routeData.features[0].properties.segments[0].duration;
        } else if (routeData?.features?.[0]?.properties?.summary?.duration) {
          // GeoJSON FeatureCollection with summary object (some ORS versions)
          durationSeconds = routeData.features[0].properties.summary.duration;
        } else if (routeData?.routes?.[0]?.summary?.duration) {
          // JSON format response
          durationSeconds = routeData.routes[0].summary.duration;
        }
        if (durationSeconds > 0) {
          etaMinutes = Math.ceil(durationSeconds / 60);
        }
      } catch (e) {
        console.error("Failed to calculate initial route:", e);
      }
    }

    // 4. Create Incident
    const { data: incident, error: incError } = await supabase.from('incidents').insert({
      emergency_text,
      severity: triageData.severity,
      ambulance_type: triageData.ambulance_type,
      patient_summary: triageData.patient_summary,
      triage_reasoning: triageData.triage_reasoning,
      suspected_conditions: triageData.suspected_conditions,
      patient_location: `POINT(${lng} ${lat})`,
      assigned_ambulance_id: assignedAmbulance?.id || null,
      assigned_hospital_id: assignedHospital?.id || null,
      route_geojson: routeData,
      eta_minutes: etaMinutes,
      status: 'active'
    }).select().single()

    if (incError) {
      console.error("Error creating incident:", incError)
      return c.json({ error: 'Database error creating incident' }, 500)
    }

    if (assignedAmbulance) {
      await supabase.from('ambulances').update({ status: 'dispatched' }).eq('id', assignedAmbulance.id)
      io.emit('dispatch:ambulance', { incident_id: incident.id, ambulance: assignedAmbulance, route: routeData })
    }

    return c.json({
      success: true,
      incident,
      triage: triageData,
      assigned_ambulance: assignedAmbulance,
      assigned_hospital: assignedHospital,
      route: routeData
    })

  } catch (error) {
    console.error("Intake Error:", error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Allowed ambulance status values
const VALID_AMBULANCE_STATUSES = ['available', 'dispatched', 'at_scene', 'transporting', 'off_duty'] as const;

// P1-005: Green Corridor — traffic police grants priority route clearance
// Broadcasts 'corridor:granted' event so dispatcher + driver dashboards can show green light status
app.post('/api/corridor/grant', async (c) => {
  try {
    const body = await c.req.json()
    const { incident_id } = body
    // BUG-T007 fix: validate incident_id including empty-string check
    if (!incident_id || typeof incident_id !== 'string' || incident_id.trim() === '') {
      return c.json({ error: 'incident_id required' }, 400)
    }

    // Mark corridor in DB — propagate Supabase errors
    const { error: dbError } = await supabase
      .from('incidents')
      .update({ corridor_granted: true, corridor_granted_at: new Date().toISOString() })
      .eq('id', incident_id)

    if (dbError) {
      console.error('Corridor grant DB error:', dbError)
      return c.json({ error: 'Database error updating corridor' }, 500)
    }

    // Broadcast to all connected dashboards
    io.emit('corridor:granted', { incident_id, granted_at: new Date().toISOString() })
    console.log(`🟢 Green corridor granted for incident ${incident_id}`)

    return c.json({ success: true, incident_id })
  } catch (error) {
    console.error('Corridor grant error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// P1-006: Driver status update — updates ambulance status in Supabase + broadcasts change
app.post('/api/ambulance/status', async (c) => {
  try {
    const { ambulance_id, status } = await c.req.json()
    if (!ambulance_id || !status) return c.json({ error: 'ambulance_id and status required' }, 400)

    // BUG-T001 fix: validate status against allowed enum values
    if (!(VALID_AMBULANCE_STATUSES as readonly string[]).includes(status)) {
      return c.json({
        error: `Invalid status. Must be one of: ${VALID_AMBULANCE_STATUSES.join(', ')}`
      }, 400)
    }

    const { error: dbError } = await supabase
      .from('ambulances')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ambulance_id)

    if (dbError) {
      console.error('Ambulance status DB error:', dbError)
      return c.json({ error: 'Database error updating ambulance' }, 500)
    }

    io.emit('ambulance:status', { ambulance_id, status })
    console.log(`🚑 Ambulance ${ambulance_id} → status: ${status}`)

    return c.json({ success: true, ambulance_id, status })
  } catch (error) {
    console.error('Ambulance status error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// P1-007: Incident update — hospital marks patient as admitted/resolved
app.post('/api/incident/update', async (c) => {
  try {
    const { incident_id, status } = await c.req.json()
    if (!incident_id || !status) return c.json({ error: 'incident_id and status required' }, 400)

    const { error: dbError } = await supabase
      .from('incidents')
      .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
      .eq('id', incident_id)

    if (dbError) {
      console.error('Incident update DB error:', dbError)
      return c.json({ error: 'Database error updating incident' }, 500)
    }

    io.emit('incident:updated', { incident_id, status })
    console.log(`🏥 Incident ${incident_id} → status: ${status}`)

    return c.json({ success: true, incident_id, status })
  } catch (error) {
    console.error('Incident update error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default app
