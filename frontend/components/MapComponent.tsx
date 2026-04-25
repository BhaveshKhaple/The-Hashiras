'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

interface MapProps {
  ambulances: any[];
  hospitals: any[];
  incidents: any[];
}

// ── Custom Leaflet Icons ─────────────────────────────────────────────────────

/**
 * MAP-001: Ambulance icon colored by TYPE not status.
 * ALS (Advanced Life Support — ventilator/defib) → Red
 * BLS (Basic Life Support — standard)           → Green
 */
function makeAmbulanceIcon(type: string, heading: number = 0) {
  // ALS = Advanced = red, BLS = Standard = green
  const isAdvanced = type === 'ALS';
  const bodyColor  = isAdvanced ? '#ef4444' : '#22c55e';
  const glowColor  = isAdvanced ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)';
  const label      = isAdvanced ? 'ALS' : 'BLS';

  return L.divIcon({
    className: '',
    html: `
      <div style="
        position:relative;
        width:40px;height:40px;
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          transform:rotate(${heading}deg);
          transition:transform 0.5s ease;
          filter:drop-shadow(0 0 6px ${glowColor});
        ">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Body -->
            <rect x="4" y="12" width="22" height="14" rx="2" fill="${bodyColor}" stroke="white" stroke-width="1.5"/>
            <!-- Cab -->
            <rect x="22" y="16" width="8" height="10" rx="1" fill="${bodyColor}" stroke="white" stroke-width="1.5"/>
            <!-- Red cross on body -->
            <rect x="11" y="15" width="8" height="2.5" rx="0.5" fill="white"/>
            <rect x="13.75" y="13" width="2.5" height="7" rx="0.5" fill="white"/>
            <!-- Wheels -->
            <circle cx="10" cy="26" r="3" fill="#1f2937" stroke="white" stroke-width="1.2"/>
            <circle cx="24" cy="26" r="3" fill="#1f2937" stroke="white" stroke-width="1.2"/>
            <!-- Siren light -->
            <rect x="10" y="10" width="8" height="3" rx="1" fill="${isAdvanced ? '#fbbf24' : '#60a5fa'}" stroke="white" stroke-width="0.5"/>
          </svg>
        </div>
        <div style="
          position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);
          background:${bodyColor};color:white;
          font-size:8px;font-weight:700;letter-spacing:0.5px;
          padding:1px 4px;border-radius:3px;white-space:nowrap;
          font-family:monospace;
          box-shadow:0 1px 4px rgba(0,0,0,0.4);
        ">${label}</div>
      </div>
    `,
    iconSize: [40, 54],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
}

/**
 * MAP-003: Hospital icon — distinct blue H+ cross, clearly recognizable.
 */
function makeHospitalIcon(beds: number = 0) {
  const bedColor = beds > 10 ? '#22c55e' : beds > 0 ? '#f59e0b' : '#ef4444';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position:relative;
        width:38px;height:38px;
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          width:34px;height:34px;
          background:#1d4ed8;
          border:2.5px solid white;
          border-radius:6px;
          box-shadow:0 2px 8px rgba(29,78,216,0.5);
          display:flex;align-items:center;justify-content:center;
          position:relative;
        ">
          <!-- H cross -->
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="9" y="2" width="4" height="18" rx="1" fill="white"/>
            <rect x="2" y="9" width="18" height="4" rx="1" fill="white"/>
          </svg>
          <!-- Bed availability dot -->
          <div style="
            position:absolute;top:-4px;right:-4px;
            width:10px;height:10px;
            background:${bedColor};
            border:2px solid white;
            border-radius:50%;
          "></div>
        </div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
}

/**
 * MAP-004: Patient/Incident marker — large pulsing red SOS cross.
 */
function makeIncidentIcon(severity: string = 'MODERATE') {
  const isCritical = severity === 'CRITICAL';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position:relative;
        width:48px;height:48px;
        display:flex;align-items:center;justify-content:center;
      ">
        <!-- Pulse rings -->
        <div style="
          position:absolute;
          width:48px;height:48px;
          border-radius:50%;
          background:rgba(239,68,68,0.15);
          animation:pulseRing 1.8s ease-out infinite;
        "></div>
        <div style="
          position:absolute;
          width:36px;height:36px;
          border-radius:50%;
          background:rgba(239,68,68,0.25);
          animation:pulseRing 1.8s ease-out infinite 0.4s;
        "></div>
        <!-- Core icon -->
        <div style="
          width:26px;height:26px;
          background:#dc2626;
          border:2.5px solid white;
          border-radius:50%;
          box-shadow:0 0 12px rgba(220,38,38,0.7);
          display:flex;align-items:center;justify-content:center;
          position:relative;z-index:2;
        ">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="7" y="2" width="2" height="12" rx="0.5" fill="white"/>
            <rect x="2" y="7" width="12" height="2" rx="0.5" fill="white"/>
          </svg>
        </div>
        ${isCritical ? `<div style="
          position:absolute;top:-8px;left:50%;transform:translateX(-50%);
          background:#dc2626;color:white;
          font-size:7px;font-weight:800;letter-spacing:0.5px;
          padding:1px 4px;border-radius:3px;white-space:nowrap;
          font-family:sans-serif;
        ">CRITICAL</div>` : ''}
      </div>
      <style>
        @keyframes pulseRing {
          0%   { transform:scale(0.8); opacity:1; }
          100% { transform:scale(1.6); opacity:0; }
        }
      </style>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28],
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MapComponent({ ambulances, hospitals, incidents }: MapProps) {
  const mapRef       = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null!);
  const [ready, setReady] = useState(false);

  // Initialize map ONCE — center on Mumbai by default
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [19.0760, 72.8777],  // Mumbai
      zoom: 12,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control on right side
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;
    setReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-render markers whenever data or readiness changes
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    const map = mapRef.current;

    // Remove all marker / polyline layers (keep tile layers)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // ── Ambulance Markers (MAP-001: color by TYPE) ──────────────────────────
    ambulances.forEach((a) => {
      // MAP-002: guard against missing coords
      const lat = a.lat ?? a.latitude;
      const lng = a.lng ?? a.longitude;
      if (!lat || !lng) return;

      const icon = makeAmbulanceIcon(a.type || 'BLS', a.heading || 0);
      const typeLabel = a.type === 'ALS' ? '🔴 Advanced (ALS)' : '🟢 Standard (BLS)';

      L.marker([lat, lng], { icon })
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:160px">
            <b style="font-size:13px">${a.name || 'Ambulance'}</b>
            <div style="color:#666;font-size:11px;margin-top:4px">${typeLabel}</div>
            <div style="margin-top:6px;font-size:12px">
              👤 ${a.driver_name || 'N/A'}<br/>
              📍 Status: <b>${a.status || 'idle'}</b>
            </div>
          </div>
        `, { maxWidth: 200 })
        .addTo(map);
    });

    // ── Hospital Markers (MAP-003: blue H+ cross) ───────────────────────────
    hospitals.forEach((h) => {
      // MAP-002: guard against missing coords
      const lat = h.lat ?? h.latitude;
      const lng = h.lng ?? h.longitude;
      if (!lat || !lng) return;

      const icon = makeHospitalIcon(h.available_beds);
      const dotColor = (h.available_beds ?? 0) > 10 ? '#22c55e' : (h.available_beds ?? 0) > 0 ? '#f59e0b' : '#ef4444';

      L.marker([lat, lng], { icon })
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:180px">
            <b style="font-size:13px">🏥 ${h.name || 'Hospital'}</b>
            <div style="margin-top:6px;font-size:12px">
              🛏 Beds: <b style="color:${dotColor}">${h.available_beds ?? 'N/A'} free</b>
              ${h.capabilities ? `<br/>⚕️ ${h.capabilities.slice(0,3).join(', ')}` : ''}
            </div>
          </div>
        `, { maxWidth: 220 })
        .addTo(map);
    });

    // ── Incident Markers (MAP-004: pulsing SOS cross) ───────────────────────
    incidents.forEach((i) => {
      const lat = i.lat ?? i.latitude;
      const lng = i.lng ?? i.longitude;
      if (!lat || !lng) return;

      const icon = makeIncidentIcon(i.severity);

      L.marker([lat, lng], { icon })
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:180px">
            <b style="color:#dc2626;font-size:13px">🚨 ${i.severity || 'EMERGENCY'}</b>
            <div style="margin-top:6px;font-size:12px;line-height:1.5">
              ${i.emergency_text?.substring(0, 100) || 'Emergency in progress'}
              ${i.eta_minutes ? `<br/>⏱ ETA: ~${i.eta_minutes} min` : ''}
            </div>
          </div>
        `, { maxWidth: 240 })
        .addTo(map);
    });

    // ── Route Polylines ──────────────────────────────────────────────────────
    incidents.filter(i => i.route_geojson).forEach((i) => {
      try {
        const coords = i.route_geojson.features[0].geometry.coordinates
          .map((c: [number, number]) => [c[1], c[0]] as [number, number]);
        L.polyline(coords, {
          color: '#ef4444',
          weight: 4,
          opacity: 0.75,
          dashArray: '12, 8',
        }).addTo(map);
      } catch { /* skip malformed routes silently */ }
    });

  }, [ambulances, hospitals, incidents, ready]);

  return <div ref={containerRef} className="w-full h-full" />;
}
