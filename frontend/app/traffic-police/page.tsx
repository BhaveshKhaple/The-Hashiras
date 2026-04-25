"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ShieldAlert,
  ArrowLeft,
  AlertOctagon,
  CheckCircle2,
  Loader2,
  Navigation,
  Radio,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSocket } from "@/lib/socket";
import type { Incident, AmbulanceLocationEvent, MapMarker, OrsRouteResponse } from "@/types";

/* ── Lazy-load Leaflet (no SSR) ───────────────────────────── */
const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-2xl flex items-center justify-center bg-[var(--bg-secondary)] min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
    </div>
  ),
});

export default function TrafficPoliceDashboard() {
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [ambulancePos, setAmbulancePos] = useState<[number, number] | null>(null);
  const [roadblockPos, setRoadblockPos] = useState<[number, number] | null>(null);
  const [isFlagging, setIsFlagging] = useState(false);
  const [flagSuccess, setFlagSuccess] = useState(false);
  const [routeGeoJSON, setRouteGeoJSON] = useState<OrsRouteResponse | null>(null);

  /* ── Initial Load & Socket Listeners ───────────────────── */
  useEffect(() => {
    // Attempt to load the most recent active incident
    async function fetchActiveIncident() {
      // Check for config
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
        console.warn("Supabase not configured, bypassing initial fetch.");
        return;
      }
      
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (!error && data) {
        setActiveIncident(data);
        if (data.route_geojson) {
          setRouteGeoJSON(data.route_geojson as OrsRouteResponse);
        }
      }
    }
    
    fetchActiveIncident();

    const socket = getSocket();

    socket.on("dispatch:ambulance", (data) => {
      // Fetch fresh incident data
      supabase.from("incidents").select("*").eq("id", data.incident_id).single()
        .then(({ data: incidentData }) => {
          if (incidentData) {
            setActiveIncident(incidentData);
            if (incidentData.route_geojson) {
              setRouteGeoJSON(incidentData.route_geojson as OrsRouteResponse);
            }
          }
        });
    });

    socket.on("ambulance:location", (data: AmbulanceLocationEvent) => {
      // Update ambulance position on map
      setAmbulancePos([data.lat, data.lng]);
    });
    
    socket.on("route:reroute", (data) => {
      // If our current incident was rerouted, update the map route
      setActiveIncident((prev) => {
        if (prev && prev.id === data.incident_id) {
          setRouteGeoJSON(data.route);
          return { ...prev, route_geojson: data.route };
        }
        return prev;
      });
    });

    return () => {
      socket.off("dispatch:ambulance");
      socket.off("ambulance:location");
      socket.off("route:reroute");
    };
  }, []);

  /* ── Handle Map Click ──────────────────────────────────── */
  const handleMapClick = (lat: number, lng: number) => {
    setRoadblockPos([lat, lng]);
    setFlagSuccess(false); // Reset success state when a new roadblock is placed
  };

  /* ── Handle Flag Roadblock ─────────────────────────────── */
  const handleFlagRoadblock = async () => {
    if (!activeIncident || !roadblockPos) return;

    setIsFlagging(true);
    setFlagSuccess(false);

    try {
      const [lat, lng] = roadblockPos;
      
      // Create a bounding box polygon (~100m square)
      const d = 0.001; 
      const blocked_polygon = [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d]
      ];

      // Get current ambulance location as start, or fallback to the route's start
      let startLng, startLat;
      if (ambulancePos) {
        startLat = ambulancePos[0];
        startLng = ambulancePos[1];
      } else if (routeGeoJSON && routeGeoJSON.features[0]) {
        const coords = routeGeoJSON.features[0].geometry.coordinates;
        startLng = coords[0][0];
        startLat = coords[0][1];
      } else {
        throw new Error("Cannot determine start location for reroute");
      }

      // Get the final destination (end) from the current route GeoJSON
      let endLng, endLat;
      if (routeGeoJSON && routeGeoJSON.features[0]) {
        const coords = routeGeoJSON.features[0].geometry.coordinates;
        const lastCoord = coords[coords.length - 1];
        endLng = lastCoord[0];
        endLat = lastCoord[1];
      } else {
        throw new Error("Cannot determine destination for reroute");
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

      const res = await fetch(`${backendUrl}/api/route/reroute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambulance_id: activeIncident.assigned_ambulance_id,
          incident_id: activeIncident.id,
          blocked_polygon,
          start: [startLng, startLat],
          end: [endLng, endLat]
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to calculate reroute");
      }

      setFlagSuccess(true);
      setRoadblockPos(null); // Clear the roadblock after successful reroute
      
    } catch (err: any) {
      console.error("Flag roadblock error:", err);
      alert(`Error flagging roadblock: ${err.message}`);
    } finally {
      setIsFlagging(false);
    }
  };

  /* ── Prepare Map Markers ───────────────────────────────── */
  const mapMarkers: MapMarker[] = [];
  if (roadblockPos) {
    mapMarkers.push({
      position: roadblockPos,
      type: "roadblock",
      label: "Roadblock Selected",
    });
  }

  // If we have patient location, show it
  // (We use a simple check, the actual DB column is postgis, so we might need to parse it if we want exact patient pin,
  // but for the traffic dashboard, the route itself and the ambulance position are the most critical).

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-white overflow-hidden">
      {/* ── Top Header ────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[var(--text-muted)] hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight m-0">Traffic Command</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 uppercase tracking-wider">
              City Traffic Control
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-3">
          {activeIncident ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.15)]">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-sm font-bold text-green-400 tracking-wide">
                GREEN CORRIDOR ACTIVE
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-panel)] border border-[var(--border-subtle)]">
              <div className="w-3 h-3 rounded-full bg-slate-500"></div>
              <span className="text-sm font-semibold text-[var(--text-muted)] tracking-wide">
                STANDBY
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Layout ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ── Left Sidebar (Controls) ────────────────────── */}
        <aside className="w-[360px] flex-shrink-0 flex flex-col p-6 gap-6 glass-panel border-r border-[var(--border-subtle)] overflow-y-auto">
          
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold tracking-tight">Active Operation</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {activeIncident 
                ? "Monitor the ambulance route and report any sudden road closures to recalculate." 
                : "Waiting for emergency dispatch signals."}
            </p>
          </div>

          {activeIncident && (
            <div className="glass-panel-sm p-4 border-l-4 border-indigo-500 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                  Incident Tracker
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                {activeIncident.emergency_text}
              </p>
              <div className="flex justify-between items-center mt-2 pt-3 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-muted)] uppercase">Ambulance</span>
                </div>
                <span className="text-sm font-bold">{activeIncident.ambulance_type} Unit</span>
              </div>
            </div>
          )}

          <div className="h-px w-full bg-[var(--border-subtle)] my-2" />

          {/* Roadblock Tool */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Report Roadblock
              </h3>
            </div>
            
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Click anywhere on the map to place a roadblock marker. Once placed, flag it to instantly reroute the active ambulance.
            </p>

            {roadblockPos ? (
              <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-muted)] break-all mb-2">
                LAT: {roadblockPos[0].toFixed(5)} <br />
                LNG: {roadblockPos[1].toFixed(5)}
              </div>
            ) : (
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-xs font-medium text-red-400/80 text-center mb-2 italic">
                Click map to select location
              </div>
            )}

            <button
              onClick={handleFlagRoadblock}
              disabled={!roadblockPos || isFlagging || !activeIncident}
              className={`
                flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold transition-all shadow-lg
                ${(!roadblockPos || !activeIncident) 
                  ? "bg-[var(--bg-panel)] text-[var(--text-muted)] opacity-50 cursor-not-allowed" 
                  : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]"}
              `}
            >
              {isFlagging ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : flagSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Rerouted
                </>
              ) : (
                <>
                  <AlertOctagon className="w-5 h-5" />
                  FLAG ROADBLOCK
                </>
              )}
            </button>
            
            {!activeIncident && (
              <p className="text-[0.65rem] text-center text-[var(--text-muted)] uppercase mt-1">
                Requires active dispatch
              </p>
            )}
          </div>

        </aside>

        {/* ── Map Area ─────────────────────────────────────── */}
        <main className="flex-1 p-4 relative flex flex-col">
          <div className="glass-panel flex-1 overflow-hidden p-2 relative">
            {/* Pulsing indicator if active */}
            {activeIncident && (
              <div className="absolute top-6 left-6 z-[1000] px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg shadow-xl flex items-center gap-3 backdrop-blur-md">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Live Tracking
                </span>
              </div>
            )}

            <LeafletMap
              center={[18.52, 73.855]}
              zoom={13}
              markers={mapMarkers}
              routeGeoJSON={routeGeoJSON}
              routeColor="#6366f1" // Indigo to match traffic police theme
              ambulancePosition={ambulancePos}
              onMapClick={handleMapClick}
              followAmbulance={false}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
