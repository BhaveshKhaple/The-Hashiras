'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

interface MapProps {
  ambulances: any[];
  hospitals: any[];
  incidents: any[];
}

export default function MapComponent({ ambulances, hospitals, incidents }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Initialize map ONCE using raw Leaflet (avoids react-leaflet double-init bug)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [19.0760, 72.8777],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;
    setReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    const map = mapRef.current;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // Add ambulance markers
    ambulances.forEach((a) => {
      const color = a.status === 'dispatched' ? '#ff3e3e' : '#4ade80';
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="transform: rotate(${a.heading || 0}deg); transition: transform 0.5s;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M5 10H19V19H5V10Z" fill="${color}" stroke="white" stroke-width="1"/>
            <path d="M19 14L22 14V18H19V14Z" fill="${color}" stroke="white" stroke-width="1"/>
            <circle cx="7" cy="18" r="1" fill="black"/><circle cx="17" cy="18" r="1" fill="black"/>
          </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([a.lat || 19.076, a.lng || 72.877], { icon })
        .bindPopup(`<b>${a.name || 'Ambulance'}</b><br/>Driver: ${a.driver_name || 'N/A'}<br/>${a.status || 'idle'}`)
        .addTo(map);
    });

    // Add hospital markers
    hospitals.forEach((h) => {
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="bg-white border-2 border-blue-500 rounded-sm p-1 shadow-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="blue" stroke-width="2">
            <path d="M3 21h18M3 7v14M21 7v14M10 21v-8h4v8M7 3h10M12 3v4"/>
            <path d="M10 11h4M12 9v4"/>
          </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([h.lat, h.lng], { icon })
        .bindPopup(`<b>${h.name || 'Hospital'}</b><br/>Beds: ${h.available_beds || 'N/A'}`)
        .addTo(map);
    });

    // Add incident markers
    incidents.forEach((i) => {
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="animate-pulse-red bg-red-600 border-2 border-white rounded-full w-4 h-4 shadow-lg"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([i.lat, i.lng], { icon })
        .bindPopup(`<b>${i.severity || 'UNKNOWN'}</b><br/>${i.emergency_text?.substring(0, 80) || 'Emergency'}`)
        .addTo(map);
    });

    // Add route polylines
    incidents.filter(i => i.route_geojson).forEach((i) => {
      try {
        const coords = i.route_geojson.features[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
        L.polyline(coords, { color: '#ff3e3e', weight: 4, opacity: 0.6, dashArray: '10, 10' }).addTo(map);
      } catch { /* skip malformed routes */ }
    });
  }, [ambulances, hospitals, incidents, ready]);

  return <div ref={containerRef} className="w-full h-full" />;
}
