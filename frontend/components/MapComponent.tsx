'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';

// Custom icons using SVGs
const createAmbulanceIcon = (heading: number, status: string) => {
  const color = status === 'dispatched' ? '#ff3e3e' : '#4ade80';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="transform: rotate(${heading}deg); transition: transform 0.5s ease-in-out;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 10H19V19H5V10Z" fill="${color}" stroke="white" stroke-width="1"/>
          <path d="M19 14L22 14V18H19V14Z" fill="${color}" stroke="white" stroke-width="1"/>
          <path d="M7 19C7.55228 19 8 18.5523 8 18C8 17.4477 7.55228 17 7 17C6.44772 17 6 17.4477 6 18C6 18.5523 6.44772 19 7 19Z" fill="black"/>
          <path d="M17 19C17.5523 19 18 18.5523 18 18C18 17.4477 17.5523 17 17 17C16.4477 17 16 17.4477 16 18C16 18.5523 16.4477 19 17 19Z" fill="black"/>
          <rect x="9" y="12" width="6" height="4" fill="white" opacity="0.3"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const hospitalIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div class="bg-white border-2 border-blue-500 rounded-sm p-1 shadow-lg">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="blue" stroke-width="2">
        <path d="M3 21h18M3 7v14M21 7v14M10 21v-8h4v8M7 3h10M12 3v4"/>
        <path d="M10 11h4M12 9v4"/>
      </svg>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const incidentIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div class="animate-pulse-red bg-red-600 border-2 border-white rounded-full w-4 h-4 shadow-lg"></div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface MapProps {
  ambulances: any[];
  hospitals: any[];
  incidents: any[];
}

import { socket } from '../lib/socket';

function AmbulanceMarker({ ambulance }: { ambulance: any }) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    // Ensure socket is connected
    if (!socket.connected) socket.connect();

    const onLocationUpdate = (data: any) => {
      if (data.ambulance_id === ambulance.id && markerRef.current) {
        // Update position directly without triggering React re-render
        markerRef.current.setLatLng([data.lat, data.lng]);
        
        // Update heading rotation smoothly
        const el = markerRef.current.getElement();
        if (el) {
          const div = el.querySelector('div');
          if (div) {
            div.style.transform = `rotate(${data.heading || 0}deg)`;
          }
        }
      }
    };

    socket.on('ambulance:location', onLocationUpdate);
    return () => {
      socket.off('ambulance:location', onLocationUpdate);
    };
  }, [ambulance.id]);

  return (
    <Marker 
      ref={markerRef}
      position={[ambulance.lat || 19.0760, ambulance.lng || 72.8777]} 
      icon={createAmbulanceIcon(ambulance.heading || 0, ambulance.status)}
    >
      <Popup>
        <div className="p-1">
          <h3 className="font-bold">{ambulance.name}</h3>
          <p className="text-xs">Driver: {ambulance.driver_name}</p>
          <p className="text-xs uppercase font-mono">{ambulance.status}</p>
        </div>
      </Popup>
    </Marker>
  );
}

export default function MapComponent({ ambulances, hospitals, incidents }: MapProps) {
  const [center] = useState<[number, number]>([19.0760, 72.8777]); // Mumbai Center

  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom={true} zoomControl={false}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {/* Hospitals */}
      {hospitals.map((h) => (
        <Marker key={h.id} position={[h.lat, h.lng]} icon={hospitalIcon}>
          <Popup className="glass">
            <div className="p-2">
              <h3 className="font-bold text-blue-400">{h.name}</h3>
              <p className="text-xs">Beds: {h.available_beds}</p>
              <div className="flex gap-1 mt-1">
                {h.capabilities?.map((c: string) => (
                  <span key={c} className="text-[10px] bg-blue-900 px-1 rounded">{c}</span>
                ))}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Ambulances */}
      {ambulances.map((a) => (
        <AmbulanceMarker key={a.id} ambulance={a} />
      ))}

      {/* Incidents */}
      {incidents.map((i) => (
        <Marker key={i.id} position={[i.lat, i.lng]} icon={incidentIcon}>
          <Popup>
            <div className="p-2 min-w-[200px]">
              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-bold px-1 rounded ${
                  i.severity === 'CRITICAL' ? 'bg-red-600' : 'bg-orange-500'
                }`}>{i.severity}</span>
                <span className="text-[10px] text-gray-400">{new Date(i.created_at).toLocaleTimeString()}</span>
              </div>
              <h4 className="font-bold mt-1 text-sm">{i.emergency_text.substring(0, 50)}...</h4>
              <p className="text-xs text-gray-300 mt-1">{i.patient_summary}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Routes */}
      {incidents.filter(i => i.route_geojson).map(i => {
        const coords = i.route_geojson.features[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
        return (
          <Polyline 
            key={`route-${i.id}`} 
            positions={coords} 
            pathOptions={{ color: '#ff3e3e', weight: 4, opacity: 0.6, dashArray: '10, 10' }} 
          />
        );
      })}
    </MapContainer>
  );
}
