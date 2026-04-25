import { Hono } from 'hono'
import { Server } from 'socket.io'
import { createServer } from 'http'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

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

// Dummy Socket.IO setup for skeleton
const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
})

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
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

app.post('/api/emergency/intake', async (c) => {
  try {
    const body = await c.req.json()
    const { emergency_text, lat, lng } = body

    if (!emergency_text || !lat || !lng) {
      return c.json({ error: 'Missing emergency_text, lat, or lng' }, 400)
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash", 
      systemInstruction: systemPrompt 
    })
    
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

    // Find nearest ambulance via RPC
    const { data: ambulances, error: ambError } = await supabase.rpc('find_nearest_ambulance', {
      search_type: triageData.ambulance_type,
      search_lng: lng,
      search_lat: lat
    })
    
    const assignedAmbulance = ambulances && ambulances.length > 0 ? ambulances[0] : null;

    // Create incident in DB
    const { data: incident, error: incError } = await supabase.from('incidents').insert({
      emergency_text,
      severity: triageData.severity,
      ambulance_type: triageData.ambulance_type,
      patient_summary: triageData.patient_summary,
      triage_reasoning: triageData.triage_reasoning,
      suspected_conditions: triageData.suspected_conditions,
      patient_location: `POINT(${lng} ${lat})`,
      assigned_ambulance_id: assignedAmbulance ? assignedAmbulance.id : null,
      status: 'active'
    }).select().single()

    if (incError) {
      console.error("Error creating incident:", incError)
      return c.json({ error: 'Database error creating incident' }, 500)
    }

    if (assignedAmbulance) {
      await supabase.from('ambulances').update({ status: 'dispatched' }).eq('id', assignedAmbulance.id)
      
      // Emit to dispatch dashboard via Socket.IO
      io.emit('dispatch:ambulance', { 
        incident_id: incident.id, 
        ambulance: assignedAmbulance 
      })
    }

    return c.json({
      success: true,
      incident,
      triage: triageData,
      assigned_ambulance: assignedAmbulance
    })

  } catch (error) {
    console.error("Intake Error:", error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default app
