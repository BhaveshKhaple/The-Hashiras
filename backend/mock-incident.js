import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createMockIncident() {
  console.log('Creating mock incident for simulator test...');

  // 1. Get an ambulance
  const { data: amb } = await supabase.from('ambulances').select('id').limit(1).single();
  if (!amb) {
    console.error('No ambulances found. Run seed first.');
    return;
  }

  // 2. Simple route (LineString from Bandra to Worli)
  const mockRoute = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [72.8295, 19.0596], // Bandra
          [72.8350, 19.0500],
          [72.8400, 19.0400],
          [72.8450, 19.0300],
          [72.8150, 19.0100]  // Worli
        ]
      },
      properties: { summary: { duration: 600 } }
    }]
  };

  const { data: incident, error } = await supabase.from('incidents').insert({
    emergency_text: "MOCK EMERGENCY: Cardiac arrest at Bandra Station",
    severity: "CRITICAL",
    ambulance_type: "ALS",
    status: "active",
    patient_location: "POINT(72.8295 19.0596)",
    assigned_ambulance_id: amb.id,
    route_geojson: mockRoute,
    eta_minutes: 10,
    // BUG-003 fix: include patient_summary and triage_reasoning so dashboard cards render correctly
    patient_summary: "54-year-old male, unresponsive, suspected cardiac arrest. Requires ALS with defibrillator.",
    triage_reasoning: "CRITICAL classification: loss of consciousness with suspected cardiac etiology.",
    suspected_conditions: ["cardiac arrest", "MI"],
    hospital_requirements: ["ICU", "cardiac"]
  }).select().single();

  if (error) {
    console.error('Error creating mock incident:', error);
  } else {
    // Mark the ambulance as dispatched so the dashboard shows the correct status
    await supabase.from('ambulances').update({ status: 'dispatched' }).eq('id', amb.id);
    console.log('✅ Mock incident created:', incident.id);
    console.log(`🚑 Ambulance ${amb.id} marked as dispatched`);
    console.log('💡 Now run: node simulator.js');
    return incident;
  }
}

createMockIncident();
