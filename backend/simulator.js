/**
 * Ambulance GPS Movement Simulator
 * 
 * Connects to the Socket.IO server, fetches the most recent active incident,
 * extracts the route GeoJSON, and emits ambulance:location events every 2 seconds
 * with interpolated coordinates along the route.
 * 
 * Usage: bun run simulator.js
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env
 */

import { createClient } from '@supabase/supabase-js';
import { io } from 'socket.io-client';
import { config } from 'dotenv';
import path from 'path';

// Load .env from root
config({ path: path.resolve(process.cwd(), '../.env') });

const SOCKET_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const EMIT_INTERVAL_MS = 2000; // emit every 2 seconds
const SPEED_FACTOR = 3; // skip coordinates to simulate faster movement

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Extract all coordinates from an ORS GeoJSON response.
 * ORS returns either:
 *   - { features: [{ geometry: { coordinates: [[lng,lat], ...] } }] }  (GeoJSON FeatureCollection)
 *   - { routes: [{ geometry: "encoded_polyline" }] }  (JSON response)
 * We handle the GeoJSON FeatureCollection format since that's what our backend stores.
 */
function extractRouteCoordinates(routeGeojson) {
  if (!routeGeojson) return [];

  // GeoJSON FeatureCollection (from ORS /v2/directions with geojson format)
  if (routeGeojson.features && routeGeojson.features.length > 0) {
    const geometry = routeGeojson.features[0].geometry;
    if (geometry && geometry.coordinates) {
      return geometry.coordinates; // [[lng, lat], [lng, lat], ...]
    }
  }

  // Raw GeoJSON geometry
  if (routeGeojson.type === 'LineString' && routeGeojson.coordinates) {
    return routeGeojson.coordinates;
  }

  // Fallback: ORS JSON format with routes array
  if (routeGeojson.routes && routeGeojson.routes.length > 0) {
    const route = routeGeojson.routes[0];
    if (route.geometry && route.geometry.coordinates) {
      return route.geometry.coordinates;
    }
  }

  console.warn('⚠️  Could not extract coordinates from route_geojson structure');
  return [];
}

/**
 * Interpolate between two coordinate points [lng, lat]
 */
function lerp(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t
  ];
}

/**
 * Subsample route coordinates for smoother or faster simulation.
 * If the route has thousands of points, we pick every Nth point.
 * If it has few points, we interpolate between them.
 */
function prepareSimulationPoints(coordinates, targetPointCount = 60) {
  if (coordinates.length <= 2) return coordinates;

  if (coordinates.length >= targetPointCount) {
    // Subsample: pick every Nth point
    const step = Math.max(1, Math.floor(coordinates.length / targetPointCount));
    const points = [];
    for (let i = 0; i < coordinates.length; i += step) {
      points.push(coordinates[i]);
    }
    // Always include the last point (destination)
    if (points[points.length - 1] !== coordinates[coordinates.length - 1]) {
      points.push(coordinates[coordinates.length - 1]);
    }
    return points;
  }

  // Interpolate: add intermediate points between each pair
  const points = [];
  const segmentSubdivisions = Math.ceil(targetPointCount / coordinates.length);
  for (let i = 0; i < coordinates.length - 1; i++) {
    for (let j = 0; j < segmentSubdivisions; j++) {
      const t = j / segmentSubdivisions;
      points.push(lerp(coordinates[i], coordinates[i + 1], t));
    }
  }
  points.push(coordinates[coordinates.length - 1]);
  return points;
}

async function main() {
  console.log('🚑 Ambulance GPS Simulator Starting...');
  console.log(`📡 Connecting to Socket.IO at: ${SOCKET_URL}`);

  // 1. Fetch the most recent active incident with a route
  const { data: incident, error } = await supabase
    .from('incidents')
    .select('id, assigned_ambulance_id, route_geojson, status')
    .eq('status', 'active')
    .not('route_geojson', 'is', null)
    .not('assigned_ambulance_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !incident) {
    console.error('❌ No active incident with route found:', error?.message || 'No data');
    console.log('💡 Tip: Create an incident first via POST /api/emergency/intake');
    process.exit(1);
  }

  console.log(`📋 Found incident: ${incident.id}`);
  console.log(`🚑 Ambulance ID: ${incident.assigned_ambulance_id}`);

  // 2. Extract route coordinates
  const rawCoords = extractRouteCoordinates(incident.route_geojson);
  if (rawCoords.length === 0) {
    console.error('❌ No valid coordinates found in route_geojson');
    process.exit(1);
  }

  console.log(`🗺️  Route has ${rawCoords.length} raw coordinate points`);

  // 3. Prepare simulation points (target ~60 points = ~2 min simulation at 2s interval)
  const simPoints = prepareSimulationPoints(rawCoords, 60);
  console.log(`📍 Simulation will emit ${simPoints.length} GPS points (every ${EMIT_INTERVAL_MS / 1000}s)`);
  console.log(`⏱️  Estimated duration: ${Math.ceil(simPoints.length * EMIT_INTERVAL_MS / 1000)}s\n`);

  // 4. Connect to Socket.IO
  const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true
  });

  socket.on('connect', () => {
    console.log(`✅ Connected to server (socket id: ${socket.id})`);
    console.log('🏁 Starting GPS simulation...\n');

    let index = 0;

    const interval = setInterval(async () => {
      if (index >= simPoints.length) {
        clearInterval(interval);
        console.log('\n🏥 Ambulance reached destination!');
        
        // Update ambulance status back to available
        await supabase.from('ambulances')
          .update({ status: 'available' })
          .eq('id', incident.assigned_ambulance_id);
        
        // Mark incident as resolved
        await supabase.from('incidents')
          .update({ status: 'resolved' })
          .eq('id', incident.id);

        console.log('✅ Incident resolved. Ambulance marked available.');
        socket.disconnect();
        process.exit(0);
      }

      const [lng, lat] = simPoints[index];
      const progress = ((index / (simPoints.length - 1)) * 100).toFixed(1);

      const payload = {
        ambulance_id: incident.assigned_ambulance_id,
        incident_id: incident.id,
        lng,
        lat,
        heading: index < simPoints.length - 1 
          ? Math.atan2(simPoints[index + 1][1] - lat, simPoints[index + 1][0] - lng) * (180 / Math.PI) 
          : 0,
        speed_kmh: 60 + Math.random() * 20, // simulated speed: 60-80 km/h
        timestamp: new Date().toISOString(),
        progress: parseFloat(progress)
      };

      socket.emit('ambulance:location', payload);
      
      // Also update the ambulance location in Supabase
      await supabase.from('ambulances')
        .update({ 
          location: `POINT(${lng} ${lat})`,
          last_seen: new Date().toISOString()
        })
        .eq('id', incident.assigned_ambulance_id);

      console.log(`📍 [${progress}%] lng: ${lng.toFixed(6)}, lat: ${lat.toFixed(6)} | heading: ${payload.heading.toFixed(0)}° | speed: ${payload.speed_kmh.toFixed(0)} km/h`);
      
      index++;
    }, EMIT_INTERVAL_MS);
  });

  socket.on('connect_error', (err) => {
    console.error(`❌ Socket connection error: ${err.message}`);
    console.log(`💡 Is the backend server running at ${SOCKET_URL}?`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Disconnected: ${reason}`);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
