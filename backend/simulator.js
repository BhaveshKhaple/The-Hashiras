/**
 * Ambulance GPS Movement Simulator
 * 
 * Connects to the Socket.IO server, fetches the most recent active incident,
 * extracts the route GeoJSON, and emits ambulance:location events step-by-step
 * along the EXACT polyline coordinates returned by ORS.
 * 
 * KEY: No straight-line interpolation (lerp). The ambulance follows the road
 * by iterating through the exact coordinate array from ORS geometry.
 * 
 * Usage: node simulator.js          — uses existing active incident
 *        node simulator.js --mock   — creates a mock incident first
 * 
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env
 */

import { createClient } from '@supabase/supabase-js';
import { io } from 'socket.io-client';
import { config } from 'dotenv';
import path from 'path';

// Load .env from root
config({ path: path.resolve(process.cwd(), '../.env') });

const SOCKET_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const EMIT_INTERVAL_MS = 500; // emit every 500ms for smooth visual movement
const USE_MOCK = process.argv.includes('--mock');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Extract ALL coordinates from an ORS GeoJSON response.
 * Returns array of [lng, lat] pairs — ORS format.
 */
function extractRouteCoordinates(routeGeojson) {
  if (!routeGeojson) return [];

  // GeoJSON FeatureCollection
  if (routeGeojson.features && routeGeojson.features.length > 0) {
    const geometry = routeGeojson.features[0].geometry;
    if (geometry && geometry.coordinates) {
      return geometry.coordinates; // [[lng, lat], ...]
    }
  }

  // Raw LineString
  if (routeGeojson.type === 'LineString' && routeGeojson.coordinates) {
    return routeGeojson.coordinates;
  }

  // ORS JSON format
  if (routeGeojson.routes && routeGeojson.routes.length > 0) {
    const route = routeGeojson.routes[0];
    if (route.geometry && route.geometry.coordinates) {
      return route.geometry.coordinates;
    }
  }

  console.warn('⚠️  Could not extract coordinates from route_geojson');
  return [];
}

/**
 * Calculate bearing (heading) between two [lng, lat] points.
 */
function calculateBearing(from, to) {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
    - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/**
 * Subsample route coordinates ONLY by picking every Nth point.
 * NO lerp/straight-line interpolation — only exact road coordinates.
 * If the route has < maxPoints, ALL points are used as-is.
 */
function subsampleRoute(coordinates, maxPoints = 120) {
  if (coordinates.length <= maxPoints) return coordinates;

  const step = Math.max(1, Math.floor(coordinates.length / maxPoints));
  const points = [];
  for (let i = 0; i < coordinates.length; i += step) {
    points.push(coordinates[i]);
  }
  // Always include the final destination
  const last = coordinates[coordinates.length - 1];
  if (points[points.length - 1] !== last) {
    points.push(last);
  }
  return points;
}

// ── Mock route with MANY road-following waypoints ────────────────────────────
// This follows the actual road from Bandra Station → Worli Sea Link area
// with enough density to look natural (no straight-line cuts)
const MOCK_ROUTE_BANDRA_TO_WORLI = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        // Bandra Station area → SV Road
        [72.8295, 19.0596],
        [72.8302, 19.0580],
        [72.8310, 19.0565],
        [72.8318, 19.0548],
        [72.8325, 19.0532],
        // Turn onto Hill Road
        [72.8320, 19.0518],
        [72.8312, 19.0504],
        [72.8305, 19.0490],
        [72.8298, 19.0475],
        [72.8290, 19.0460],
        // Pali Hill descent
        [72.8282, 19.0445],
        [72.8275, 19.0430],
        [72.8268, 19.0415],
        [72.8260, 19.0400],
        [72.8252, 19.0385],
        // Linking Road
        [72.8248, 19.0370],
        [72.8245, 19.0355],
        [72.8240, 19.0340],
        [72.8235, 19.0325],
        [72.8230, 19.0310],
        // Khar Subway area
        [72.8228, 19.0295],
        [72.8225, 19.0280],
        [72.8220, 19.0265],
        [72.8218, 19.0250],
        [72.8215, 19.0235],
        // Towards Mahim
        [72.8210, 19.0220],
        [72.8205, 19.0205],
        [72.8200, 19.0190],
        [72.8198, 19.0175],
        [72.8195, 19.0160],
        // Mahim Causeway
        [72.8190, 19.0148],
        [72.8185, 19.0138],
        [72.8180, 19.0128],
        [72.8175, 19.0118],
        [72.8170, 19.0108],
        // Worli approach
        [72.8165, 19.0100],
        [72.8160, 19.0092],
        [72.8155, 19.0085],
        [72.8150, 19.0078],
        [72.8150, 19.0070],
      ],
    },
    properties: { summary: { duration: 720 } },
  }],
};

async function main() {
  console.log('🚑 Ambulance GPS Simulator Starting...');
  console.log(`📡 Connecting to Socket.IO at: ${SOCKET_URL}`);

  // 1. Fetch the most recent active incident with a route
  let incident;
  let { data: fetchedInc, error } = await supabase
    .from('incidents')
    .select('id, assigned_ambulance_id, route_geojson, status')
    .eq('status', 'active')
    .not('route_geojson', 'is', null)
    .not('assigned_ambulance_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  incident = fetchedInc;

  if (error || !incident) {
    if (USE_MOCK) {
      console.log('⚡ No active incident found — creating mock (--mock flag)...');
      const { data: amb } = await supabase.from('ambulances').select('id').limit(1).single();
      if (!amb) {
        console.error('❌ No ambulances in DB. Run: npm run seed first.');
        process.exit(1);
      }

      const { data: newInc, error: incErr } = await supabase.from('incidents').insert({
        emergency_text: 'MOCK: Cardiac arrest at Bandra Station',
        severity: 'CRITICAL',
        ambulance_type: 'ALS',
        status: 'active',
        patient_location: 'POINT(72.8295 19.0596)',
        assigned_ambulance_id: amb.id,
        route_geojson: MOCK_ROUTE_BANDRA_TO_WORLI,
        eta_minutes: 12,
        patient_summary: '54yo male, cardiac arrest, requires ALS with defibrillator.',
        triage_reasoning: 'CRITICAL: unresponsive with suspected cardiac etiology.',
      }).select().single();

      if (incErr || !newInc) {
        console.error('❌ Failed to create mock incident:', incErr?.message);
        process.exit(1);
      }

      // Mark ambulance as dispatched
      await supabase.from('ambulances').update({ status: 'dispatched' }).eq('id', amb.id);
      console.log(`✅ Mock incident created: ${newInc.id}`);
      console.log(`🚑 Ambulance ${amb.id} marked dispatched`);

      incident = newInc;

      // Re-fetch to get clean data
      const { data: fresh } = await supabase.from('incidents')
        .select('id, assigned_ambulance_id, route_geojson, status')
        .eq('id', newInc.id).single();
      if (fresh) incident = fresh;
    } else {
      console.error('❌ No active incident with route found.');
      console.log('💡 Tip: Run with --mock flag or create via POST /api/emergency/intake');
      process.exit(1);
    }
  }

  console.log(`📋 Incident: ${incident.id}`);
  console.log(`🚑 Ambulance: ${incident.assigned_ambulance_id}`);

  // 2. Extract exact road coordinates — NO interpolation
  const rawCoords = extractRouteCoordinates(incident.route_geojson);
  if (rawCoords.length === 0) {
    console.error('❌ No valid coordinates in route_geojson');
    process.exit(1);
  }

  // Subsample only if route has > 120 points (ORS can return thousands)
  // NO lerp — only exact road coordinates from the polyline
  const simPoints = subsampleRoute(rawCoords, 120);

  console.log(`🗺️  Route: ${rawCoords.length} raw coords → ${simPoints.length} simulation points`);
  console.log(`📍 Emitting every ${EMIT_INTERVAL_MS}ms`);
  console.log(`⏱️  Duration: ~${Math.ceil(simPoints.length * EMIT_INTERVAL_MS / 1000)}s\n`);

  // 3. Connect to Socket.IO
  const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
  });

  socket.on('connect', () => {
    console.log(`✅ Connected (socket: ${socket.id})`);
    console.log('🏁 Starting road-following simulation...\n');

    let index = 0;

    const interval = setInterval(async () => {
      if (index >= simPoints.length) {
        clearInterval(interval);
        console.log('\n🏥 Ambulance reached destination!');

        // Reset ambulance + resolve incident
        await supabase.from('ambulances')
          .update({ status: 'available' })
          .eq('id', incident.assigned_ambulance_id);
        await supabase.from('incidents')
          .update({ status: 'resolved' })
          .eq('id', incident.id);

        console.log('✅ Incident resolved. Ambulance available.');
        socket.disconnect();
        process.exit(0);
      }

      const [lng, lat] = simPoints[index];
      const progress = ((index / (simPoints.length - 1)) * 100);

      // Calculate heading from current to next point
      const heading = index < simPoints.length - 1
        ? calculateBearing(simPoints[index], simPoints[index + 1])
        : 0;

      const payload = {
        ambulance_id: incident.assigned_ambulance_id,
        incident_id: incident.id,
        lng,
        lat,
        heading,
        speed_kmh: 45 + Math.random() * 25, // 45-70 km/h in Mumbai traffic
        timestamp: new Date().toISOString(),
        progress: parseFloat(progress.toFixed(1)),
      };

      socket.emit('ambulance:location', payload);

      // Update Supabase location
      await supabase.from('ambulances')
        .update({
          location: `POINT(${lng} ${lat})`,
          last_seen: new Date().toISOString(),
        })
        .eq('id', incident.assigned_ambulance_id);

      // Console output with road-following indicator
      const roadChar = '🛣️';
      console.log(`${roadChar} [${progress.toFixed(0).padStart(3)}%] lat: ${lat.toFixed(6)}, lng: ${lng.toFixed(6)} | heading: ${heading.toFixed(0)}° | ${payload.speed_kmh.toFixed(0)} km/h`);

      index++;
    }, EMIT_INTERVAL_MS);
  });

  socket.on('connect_error', (err) => {
    console.error(`❌ Socket error: ${err.message}`);
    console.log(`💡 Is backend running at ${SOCKET_URL}?`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Disconnected: ${reason}`);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
