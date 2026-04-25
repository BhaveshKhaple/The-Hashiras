"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Siren,
  Send,
  MapPin,
  Activity,
  Ambulance,
  Building2,
  Clock,
  AlertTriangle,
  Loader2,
  Zap,
  X,
  Crosshair,
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import type {
  IntakeResponse,
  TriageResult,
  DispatchEvent,
  MapMarker,
  OrsRouteResponse,
} from "@/types";

/* ── Lazy-load Leaflet (no SSR) ───────────────────────────── */
const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-secondary)", minHeight: 400 }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--text-muted)" }} />
    </div>
  ),
});

/* ── Constants ────────────────────────────────────────────── */
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; badge: string }> = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", badge: "badge-critical" },
  HIGH:     { color: "#f97316", bg: "rgba(249,115,22,0.12)", badge: "badge-high" },
  MODERATE: { color: "#eab308", bg: "rgba(234,179,8,0.12)",  badge: "badge-moderate" },
  LOW:      { color: "#22c55e", bg: "rgba(34,197,94,0.12)",  badge: "badge-low" },
};

/* ════════════════════════════════════════════════════════════ */
/*                    DISPATCHER PAGE                         */
/* ════════════════════════════════════════════════════════════ */

export default function DispatcherPage() {
  /* ── State ─────────────────────────────────────────────── */
  const [emergencyText, setEmergencyText] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<IntakeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [routeGeoJSON, setRouteGeoJSON] = useState<OrsRouteResponse | null>(null);
  const [dispatchAlerts, setDispatchAlerts] = useState<DispatchEvent[]>([]);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Socket.IO listener ────────────────────────────────── */
  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("disconnected"));

    socket.on("dispatch:ambulance", (data: DispatchEvent) => {
      setDispatchAlerts((prev) => [data, ...prev].slice(0, 5));

      // Auto-dismiss after 8s
      setTimeout(() => {
        setDispatchAlerts((prev) => prev.filter((a) => a.incident_id !== data.incident_id));
      }, 8000);
    });

    if (socket.connected) setSocketStatus("connected");

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("dispatch:ambulance");
    };
  }, []);

  /* ── Geolocation ───────────────────────────────────────── */
  const getMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      () => {
        // Fallback to Pune center
        setLat("18.5204");
        setLng("73.8567");
      }
    );
  }, []);

  /* ── Map click → set coordinates ───────────────────────── */
  const handleMapClick = useCallback((clickLat: number, clickLng: number) => {
    setLat(clickLat.toFixed(6));
    setLng(clickLng.toFixed(6));
    setMapMarkers([{ position: [clickLat, clickLng], type: "patient", label: "Patient Location" }]);
  }, []);

  /* ── Submit intake ─────────────────────────────────────── */
  const handleDispatch = async () => {
    if (!emergencyText.trim() || !lat || !lng) {
      setError("Please provide an emergency description and location.");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`${API_URL}/api/emergency/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emergency_text: emergencyText.trim(),
          lat: parseFloat(lat),
          lng: parseFloat(lng),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Server error: ${res.status}`);
      }

      const data: IntakeResponse = await res.json();
      setResponse(data);

      // Build markers
      const newMarkers: MapMarker[] = [
        { position: [parseFloat(lat), parseFloat(lng)], type: "patient", label: "Patient" },
      ];

      if (data.assigned_ambulance) {
        newMarkers.push({
          position: [data.assigned_ambulance.lat, data.assigned_ambulance.lng],
          type: "ambulance",
          label: data.assigned_ambulance.name || "Ambulance",
        });
      }

      if (data.assigned_hospital) {
        newMarkers.push({
          position: [data.assigned_hospital.lat, data.assigned_hospital.lng],
          type: "hospital",
          label: data.assigned_hospital.name || "Hospital",
        });
      }

      setMapMarkers(newMarkers);
      setRouteGeoJSON(data.route || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  /* ── Keyboard shortcut (Ctrl+Enter) ────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleDispatch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergencyText, lat, lng]);

  /* ══════════════════════════════════════════════════════════ */
  /*                         RENDER                           */
  /* ══════════════════════════════════════════════════════════ */

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-primary)" }}>
      {/* ── Top Bar ──────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Siren className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
              LifeLink <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.8rem" }}>Dispatcher</span>
            </h1>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: socketStatus === "connected" ? "#22c55e" : socketStatus === "connecting" ? "#eab308" : "#ef4444",
              }}
            />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
              {socketStatus}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left Sidebar: Intake Form ──────────────────── */}
        <aside
          className="glass-panel"
          style={{
            width: 400,
            minWidth: 400,
            display: "flex",
            flexDirection: "column",
            margin: 16,
            marginRight: 0,
            padding: 24,
            gap: 20,
            overflowY: "auto",
            borderRadius: 16,
          }}
        >
          {/* Form heading */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Zap className="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
            <h2 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>Emergency Intake</h2>
          </div>

          {/* Emergency text */}
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Emergency Description
            </label>
            <textarea
              ref={textareaRef}
              className="textarea-dark"
              value={emergencyText}
              onChange={(e) => setEmergencyText(e.target.value)}
              placeholder="Describe the emergency situation... e.g., 'Road accident at MG Road, two injured, one unconscious with head trauma'"
              rows={5}
            />
          </div>

          {/* Location inputs */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <MapPin className="w-3.5 h-3.5 inline mr-1" style={{ verticalAlign: "-2px" }} />
                Location
              </label>
              <button
                onClick={getMyLocation}
                style={{
                  background: "none",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontSize: "0.7rem",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
              >
                <Crosshair className="w-3 h-3" />
                My Location
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input-dark"
                type="number"
                step="any"
                placeholder="Latitude"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
              <input
                className="input-dark"
                type="number"
                step="any"
                placeholder="Longitude"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 6, margin: "6px 0 0" }}>
              Click on the map to set location, or use the button above.
            </p>
          </div>

          {/* Dispatch button */}
          <button
            className={`btn-dispatch ${loading ? "" : "animate-pulse-emergency"}`}
            onClick={handleDispatch}
            disabled={loading || !emergencyText.trim()}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing Emergency...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Dispatch Emergency
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div
              className="animate-fade-in"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: "0.8rem",
                color: "#fca5a5",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
              {error}
            </div>
          )}

          {/* ── Triage Result ──────────────────────────────── */}
          {response?.triage && (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
                <h3 style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>AI Triage Result</h3>
              </div>

              {/* Severity + Ambulance type */}
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  className={SEVERITY_CONFIG[response.triage.severity]?.badge || "badge-moderate"}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 8,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {response.triage.severity}
                </span>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 8,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    background: "rgba(59,130,246,0.12)",
                    color: "#60a5fa",
                    border: "1px solid rgba(59,130,246,0.3)",
                  }}
                >
                  {response.triage.ambulance_type}
                </span>
              </div>

              {/* Patient summary */}
              <div className="glass-panel-sm" style={{ padding: "12px 14px" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
                  Patient Summary
                </p>
                <p style={{ fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
                  {response.triage.patient_summary}
                </p>
              </div>

              {/* Conditions */}
              {response.triage.suspected_conditions?.length > 0 && (
                <div>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
                    Suspected Conditions
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {response.triage.suspected_conditions.map((c, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 6,
                          fontSize: "0.72rem",
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border-subtle)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Reasoning */}
              <div className="glass-panel-sm" style={{ padding: "10px 14px" }}>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
                  Triage Reasoning
                </p>
                <p style={{ fontSize: "0.8rem", margin: 0, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                  {response.triage.triage_reasoning}
                </p>
              </div>

              {/* Dispatch info cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {response.assigned_ambulance && (
                  <div
                    className="glass-panel-sm animate-slide-in"
                    style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <Ambulance className="w-5 h-5 flex-shrink-0" style={{ color: "#22c55e" }} />
                    <div>
                      <p style={{ fontSize: "0.8rem", fontWeight: 600, margin: 0 }}>
                        {response.assigned_ambulance.name}
                      </p>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: 0 }}>
                        {response.assigned_ambulance.type} • {(response.assigned_ambulance.distance_meters / 1000).toFixed(1)} km away
                      </p>
                    </div>
                  </div>
                )}

                {response.assigned_hospital && (
                  <div
                    className="glass-panel-sm animate-slide-in"
                    style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, animationDelay: "0.1s" }}
                  >
                    <Building2 className="w-5 h-5 flex-shrink-0" style={{ color: "#3b82f6" }} />
                    <div>
                      <p style={{ fontSize: "0.8rem", fontWeight: 600, margin: 0 }}>
                        {response.assigned_hospital.name}
                      </p>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: 0 }}>
                        {response.assigned_hospital.available_beds} beds • {(response.assigned_hospital.distance_meters / 1000).toFixed(1)} km away
                      </p>
                    </div>
                  </div>
                )}

                {response.incident?.eta_minutes > 0 && (
                  <div
                    className="glass-panel-sm animate-slide-in"
                    style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, animationDelay: "0.2s" }}
                  >
                    <Clock className="w-5 h-5 flex-shrink-0" style={{ color: "#eab308" }} />
                    <div>
                      <p style={{ fontSize: "0.8rem", fontWeight: 600, margin: 0 }}>
                        ETA: {response.incident.eta_minutes} min
                      </p>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: 0 }}>
                        Estimated arrival time
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ── Map Area ───────────────────────────────────── */}
        <main style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 0 }}>
          <div className="glass-panel" style={{ flex: 1, overflow: "hidden", padding: 4 }}>
            <LeafletMap
              markers={mapMarkers}
              routeGeoJSON={routeGeoJSON}
              onMapClick={handleMapClick}
            />
          </div>
        </main>
      </div>

      {/* ── Dispatch Alert Toasts ────────────────────────── */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "flex", flexDirection: "column", gap: 10 }}>
        {dispatchAlerts.map((alert) => (
          <div
            key={alert.incident_id}
            className="glass-panel animate-slide-in"
            style={{
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 320,
              borderLeft: "3px solid #22c55e",
            }}
          >
            <div
              className="animate-pulse-emergency"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(34,197,94,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Ambulance className="w-5 h-5" style={{ color: "#22c55e" }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, margin: 0, color: "#22c55e" }}>
                Ambulance Dispatched
              </p>
              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
                {alert.ambulance?.name || "Unit"} → Incident #{alert.incident_id?.slice(0, 8)}
              </p>
            </div>
            <button
              onClick={() => setDispatchAlerts((prev) => prev.filter((a) => a.incident_id !== alert.incident_id))}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
