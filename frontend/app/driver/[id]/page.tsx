"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Ambulance,
  MapPin,
  Building2,
  Clock,
  Navigation,
  Gauge,
  Radio,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Siren,
  ArrowLeft,
  LocateFixed,
  Route,
  Compass,
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import type {
  AmbulanceLocationEvent,
  RerouteEvent,
  OrsRouteResponse,
  MapMarker,
} from "@/types";
import Link from "next/link";

/* ── Lazy-load Leaflet (no SSR) ───────────────────────────── */
const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full rounded-2xl flex items-center justify-center"
      style={{ background: "var(--bg-secondary)", minHeight: 400 }}
    >
      <Loader2
        className="w-8 h-8 animate-spin"
        style={{ color: "var(--text-muted)" }}
      />
    </div>
  ),
});

/* ── Mock incident data (loaded via API in production) ────── */
// In production, this would be fetched from the backend based on the driver's assigned incident.
// For demo, we create mock data that matches the backend schema.

interface DriverIncident {
  incident_id: string;
  ambulance_id: string;
  ambulance_name: string;
  ambulance_type: "ALS" | "BLS";
  severity: string;
  patient_summary: string;
  patient_location: { lat: number; lng: number };
  hospital_name: string;
  hospital_location: { lat: number; lng: number };
  route_geojson: OrsRouteResponse | null;
  eta_minutes: number;
  status: "dispatched" | "en-route" | "at-scene" | "transporting" | "arrived";
}

/* ── Status step config ───────────────────────────────────── */
const STATUS_STEPS = [
  { key: "dispatched",   label: "Dispatched",   icon: Radio },
  { key: "en-route",     label: "En Route",     icon: Navigation },
  { key: "at-scene",     label: "At Scene",     icon: MapPin },
  { key: "transporting", label: "Transporting", icon: Ambulance },
  { key: "arrived",      label: "Arrived",      icon: CheckCircle2 },
] as const;

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MODERATE: "#eab308",
  LOW: "#22c55e",
};

/* ════════════════════════════════════════════════════════════ */
/*                     DRIVER PAGE                            */
/* ════════════════════════════════════════════════════════════ */

export default function DriverPage() {
  const params = useParams();
  const driverId = params.id as string;

  /* ── State ─────────────────────────────────────────────── */
  const [incident, setIncident] = useState<DriverIncident>({
    incident_id: "",
    ambulance_id: driverId,
    ambulance_name: `AMB-${driverId?.slice(0, 3)?.toUpperCase() || "001"}`,
    ambulance_type: "ALS",
    severity: "CRITICAL",
    patient_summary: "Awaiting dispatch assignment...",
    patient_location: { lat: 19.076, lng: 72.8777 },
    hospital_name: "Awaiting assignment",
    hospital_location: { lat: 19.076, lng: 72.8777 },
    route_geojson: null,
    eta_minutes: 0,
    status: "dispatched",
  });

  const [ambulancePos, setAmbulancePos] = useState<[number, number] | null>(null);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [progress, setProgress] = useState(0);
  const [followMode, setFollowMode] = useState(true);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [rerouteAlert, setRerouteAlert] = useState(false);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);

  /* ── Socket.IO — listen for dispatch, location, reroute ── */
  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    if (socket.connected) setSocketStatus("connected");

    // Listen for dispatch assignment
    socket.on("dispatch:ambulance", (data) => {
      if (!data.ambulance || !data.incident_id) return;
      
      setIncident((prev) => ({
        ...prev,
        incident_id: data.incident_id,
        ambulance_id: data.ambulance.id,
        ambulance_name: data.ambulance.name || prev.ambulance_name,
        ambulance_type: data.ambulance.type || prev.ambulance_type,
        route_geojson: data.route || prev.route_geojson,
        status: "en-route",
      }));
    });

    // Listen for live ambulance GPS from simulator
    socket.on("ambulance:location", (data: AmbulanceLocationEvent) => {
      setAmbulancePos([data.lat, data.lng]);
      setSpeed(Math.round(data.speed_kmh));
      setHeading(Math.round(data.heading));
      setProgress(data.progress);

      // Auto-advance status based on progress
      if (data.progress >= 100) {
        setIncident((prev) => ({ ...prev, status: "arrived" }));
      } else if (data.progress >= 50) {
        setIncident((prev) =>
          prev.status === "en-route" || prev.status === "at-scene"
            ? { ...prev, status: "transporting" }
            : prev
        );
      } else if (data.progress > 0) {
        setIncident((prev) =>
          prev.status === "dispatched" ? { ...prev, status: "en-route" } : prev
        );
      }
    });

    // Listen for route reroutes (from traffic police roadblock reports)
    socket.on("route:reroute", (data: RerouteEvent) => {
      setIncident((prev) => ({
        ...prev,
        route_geojson: data.route,
      }));
      setRerouteAlert(true);
      setTimeout(() => setRerouteAlert(false), 5000);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("dispatch:ambulance");
      socket.off("ambulance:location");
      socket.off("route:reroute");
    };
  }, []);

  /* ── Build map markers ─────────────────────────────────── */
  useEffect(() => {
    const markers: MapMarker[] = [
      {
        position: [incident.patient_location.lat, incident.patient_location.lng],
        type: "patient",
        label: "Patient Pickup",
      },
      {
        position: [incident.hospital_location.lat, incident.hospital_location.lng],
        type: "hospital",
        label: incident.hospital_name,
      },
    ];
    setMapMarkers(markers);
  }, [incident.patient_location, incident.hospital_location, incident.hospital_name]);

  /* ── Calculate remaining ETA based on progress ─────────── */
  const remainingEta = incident.eta_minutes > 0
    ? Math.max(1, Math.round(incident.eta_minutes * (1 - progress / 100)))
    : 0;

  /* ── Compass direction from heading ────────────────────── */
  const getCompassDir = (deg: number) => {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(((deg % 360 + 360) % 360) / 45) % 8];
  };

  /* ── Status step index ─────────────────────────────────── */
  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === incident.status);

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
          padding: "10px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "var(--text-muted)" }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ambulance className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
              {incident.ambulance_name}{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.75rem" }}>Driver View</span>
            </h1>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Speed indicator */}
          {speed > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Gauge className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#22c55e" }}>{speed} km/h</span>
            </div>
          )}
          {/* Socket status */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: socketStatus === "connected" ? "#22c55e" : socketStatus === "connecting" ? "#eab308" : "#ef4444",
              }}
            />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
              {socketStatus}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Layout ──────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left Panel: Dispatch Info ───────────────────── */}
        <aside
          className="glass-panel"
          style={{
            width: 360,
            minWidth: 360,
            display: "flex",
            flexDirection: "column",
            margin: 12,
            marginRight: 0,
            padding: 20,
            gap: 16,
            overflowY: "auto",
          }}
        >
          {/* ── Status Steps ─────────────────────────────── */}
          <div>
            <h2 style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Mission Status
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {STATUS_STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = i === currentStepIdx;
                const isDone = i < currentStepIdx;
                const isFuture = i > currentStepIdx;

                return (
                  <div key={step.key} style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
                    {/* Timeline line + dot */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: isDone
                            ? "#22c55e"
                            : isActive
                              ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                              : "var(--bg-secondary)",
                          border: isFuture ? "1px solid var(--border-subtle)" : "none",
                          boxShadow: isActive ? "0 0 12px rgba(59,130,246,0.4)" : "none",
                          flexShrink: 0,
                          transition: "all 0.3s ease",
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        ) : (
                          <Icon
                            className="w-3 h-3"
                            style={{ color: isActive ? "white" : "var(--text-muted)" }}
                          />
                        )}
                      </div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div
                          style={{
                            width: 2,
                            flex: 1,
                            minHeight: 16,
                            background: isDone ? "#22c55e" : "var(--border-subtle)",
                            transition: "background 0.3s ease",
                          }}
                        />
                      )}
                    </div>
                    {/* Label */}
                    <div style={{ paddingBottom: i < STATUS_STEPS.length - 1 ? 12 : 0, paddingTop: 2 }}>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: isActive ? 600 : 400,
                          color: isFuture ? "var(--text-muted)" : "var(--text-primary)",
                        }}
                      >
                        {step.label}
                        {isActive && (
                          <span
                            style={{
                              display: "inline-block",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#3b82f6",
                              marginLeft: 6,
                              verticalAlign: "middle",
                              animation: "pulse-emergency 1.5s infinite",
                            }}
                          />
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Severity Badge ────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 10,
              background: `${SEVERITY_COLORS[incident.severity] || "#eab308"}15`,
              border: `1px solid ${SEVERITY_COLORS[incident.severity] || "#eab308"}40`,
            }}
          >
            <Siren className="w-4 h-4" style={{ color: SEVERITY_COLORS[incident.severity] }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: SEVERITY_COLORS[incident.severity], textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {incident.severity} Priority
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "auto" }}>
              {incident.ambulance_type}
            </span>
          </div>

          {/* ── Patient Summary ───────────────────────────── */}
          <div className="glass-panel-sm" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#f97316" }} />
              <span style={{ fontSize: "0.7rem", fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Patient Info
              </span>
            </div>
            <p style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: 0, color: "var(--text-primary)" }}>
              {incident.patient_summary}
            </p>
          </div>

          {/* ── Pickup & Hospital cards ────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Pickup */}
            <div
              className="glass-panel-sm"
              style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: "rgba(239,68,68,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <MapPin className="w-4 h-4" style={{ color: "#ef4444" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Pickup Location
                </p>
                <p style={{ fontSize: "0.8rem", fontWeight: 500, margin: 0 }}>
                  {incident.patient_location.lat.toFixed(4)}°N, {incident.patient_location.lng.toFixed(4)}°E
                </p>
              </div>
            </div>

            {/* Hospital */}
            <div
              className="glass-panel-sm"
              style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: "rgba(59,130,246,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Building2 className="w-4 h-4" style={{ color: "#3b82f6" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Destination Hospital
                </p>
                <p style={{ fontSize: "0.8rem", fontWeight: 500, margin: 0 }}>
                  {incident.hospital_name}
                </p>
              </div>
            </div>
          </div>

          {/* ── Live Stats ────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {/* ETA */}
            <div
              className="glass-panel-sm"
              style={{ padding: "12px", textAlign: "center" }}
            >
              <Clock className="w-4 h-4 mx-auto mb-1" style={{ color: "#eab308" }} />
              <p style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 2px", color: "#eab308" }}>
                {remainingEta > 0 ? `${remainingEta}` : "--"}
              </p>
              <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", margin: 0, textTransform: "uppercase" }}>
                min ETA
              </p>
            </div>

            {/* Progress */}
            <div
              className="glass-panel-sm"
              style={{ padding: "12px", textAlign: "center" }}
            >
              <Route className="w-4 h-4 mx-auto mb-1" style={{ color: "#3b82f6" }} />
              <p style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 2px", color: "#3b82f6" }}>
                {progress.toFixed(0)}%
              </p>
              <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", margin: 0, textTransform: "uppercase" }}>
                Progress
              </p>
            </div>

            {/* Speed */}
            <div
              className="glass-panel-sm"
              style={{ padding: "12px", textAlign: "center" }}
            >
              <Gauge className="w-4 h-4 mx-auto mb-1" style={{ color: "#22c55e" }} />
              <p style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 2px", color: "#22c55e" }}>
                {speed > 0 ? speed : "--"}
              </p>
              <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", margin: 0, textTransform: "uppercase" }}>
                km/h
              </p>
            </div>

            {/* Heading */}
            <div
              className="glass-panel-sm"
              style={{ padding: "12px", textAlign: "center" }}
            >
              <Compass className="w-4 h-4 mx-auto mb-1" style={{ color: "#a78bfa" }} />
              <p style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 2px", color: "#a78bfa" }}>
                {speed > 0 ? getCompassDir(heading) : "--"}
              </p>
              <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", margin: 0, textTransform: "uppercase" }}>
                Heading
              </p>
            </div>
          </div>

          {/* ── Progress Bar ──────────────────────────────── */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Route Progress</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                {progress.toFixed(1)}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "var(--bg-secondary)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(progress, 100)}%`,
                  borderRadius: 3,
                  background: "linear-gradient(90deg, #22c55e, #3b82f6)",
                  transition: "width 0.8s ease",
                }}
              />
            </div>
          </div>
        </aside>

        {/* ── Map Area ───────────────────────────────────── */}
        <main style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
          <div className="glass-panel" style={{ flex: 1, overflow: "hidden", padding: 4 }}>
            <LeafletMap
              center={[19.076, 72.8777]}
              zoom={14}
              markers={mapMarkers}
              routeGeoJSON={incident.route_geojson}
              routeColor="#22c55e"
              ambulancePosition={ambulancePos}
              followAmbulance={followMode}
            />
          </div>

          {/* ── Follow toggle ────────────────────────────── */}
          <button
            onClick={() => setFollowMode(!followMode)}
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              zIndex: 500,
              width: 40,
              height: 40,
              borderRadius: 10,
              border: `1px solid ${followMode ? "#22c55e" : "var(--border-subtle)"}`,
              background: followMode ? "rgba(34,197,94,0.15)" : "var(--bg-panel)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            title={followMode ? "Following ambulance" : "Free camera"}
          >
            <LocateFixed
              className="w-4.5 h-4.5"
              style={{ color: followMode ? "#22c55e" : "var(--text-muted)" }}
            />
          </button>
        </main>
      </div>

      {/* ── Reroute Alert Toast ───────────────────────────── */}
      {rerouteAlert && (
        <div
          className="glass-panel animate-slide-in"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1000,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 340,
            borderLeft: "3px solid #f97316",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "rgba(249,115,22,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle className="w-5 h-5" style={{ color: "#f97316" }} />
          </div>
          <div>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0, color: "#f97316" }}>
              Route Updated
            </p>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
              A roadblock was reported. Your route has been recalculated.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
