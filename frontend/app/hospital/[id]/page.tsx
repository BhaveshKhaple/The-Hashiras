"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  BedDouble,
  Activity,
  Clock,
  ArrowLeft,
  AlertTriangle,
  Siren,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import { supabase } from "@/lib/supabase";
import type { Incident, AmbulanceLocationEvent } from "@/types";

interface Hospital {
  id: string;
  name: string;
  total_beds: number;
  available_beds: number;
  capabilities: string[];
}

export default function HospitalDashboard() {
  const params = useParams();
  const hospitalIdParam = params.id as string;

  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [loading, setLoading] = useState(true);
  const [incomingPatients, setIncomingPatients] = useState<Record<string, Incident>>({});
  const [ambulanceLocations, setAmbulanceLocations] = useState<Record<string, AmbulanceLocationEvent>>({});
  const [newBedCount, setNewBedCount] = useState<string>("");
  const [updatingBeds, setUpdatingBeds] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  /* ── Load Hospital Data ────────────────────────────────── */
  useEffect(() => {
    async function loadHospital() {
      // Check if Supabase is actually configured
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
        console.warn("Supabase URL is missing or placeholder. Skipping load.");
        setLoading(false);
        return;
      }

      try {
        let data;
        let error;
        
        // Handle "demo" path by grabbing the first hospital
        if (hospitalIdParam === "demo") {
          const res = await supabase.from("hospitals").select("*").limit(1);
          data = res.data;
          error = res.error;
        } else {
          const res = await supabase.from("hospitals").select("*").eq("id", hospitalIdParam).single();
          data = res.data;
          error = res.error;
        }

        if (error) throw error;
        
        const hData = Array.isArray(data) ? data[0] : data;
        if (hData) {
          setHospital(hData);
          setNewBedCount(hData.available_beds.toString());
        }
      } catch (err) {
        console.error("Error loading hospital:", err);
      } finally {
        setLoading(false);
      }
    }
    loadHospital();
  }, [hospitalIdParam]);

  /* ── Listen to Socket Events ───────────────────────────── */
  useEffect(() => {
    if (!hospital) return;

    const socket = getSocket();

    // Listen for new dispatches
    socket.on("dispatch:ambulance", async (data) => {
      // Fetch the incident to check if it's assigned to us
      const { data: incident, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("id", data.incident_id)
        .single();

      if (!error && incident && incident.assigned_hospital_id === hospital.id) {
        setIncomingPatients((prev) => ({
          ...prev,
          [incident.id]: incident,
        }));
      }
    });

    // Listen for live ambulance location updates to update ETA/progress
    socket.on("ambulance:location", (data: AmbulanceLocationEvent) => {
      setAmbulanceLocations((prev) => ({
        ...prev,
        [data.ambulance_id]: data,
      }));
    });

    return () => {
      socket.off("dispatch:ambulance");
      socket.off("ambulance:location");
    };
  }, [hospital]);

  /* ── Update Bed Count ──────────────────────────────────── */
  const handleUpdateBeds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospital) return;

    setUpdatingBeds(true);
    setUpdateSuccess(false);
    try {
      const beds = parseInt(newBedCount, 10);
      if (isNaN(beds)) throw new Error("Invalid number");

      const { error } = await supabase
        .from("hospitals")
        .update({ available_beds: beds })
        .eq("id", hospital.id);

      if (error) throw error;

      setHospital({ ...hospital, available_beds: beds });
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update beds:", err);
      alert("Failed to update bed count.");
    } finally {
      setUpdatingBeds(false);
    }
  };

  /* ── Render ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!hospital) {
    const isConfigMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] text-white p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold mb-2">
          {isConfigMissing ? "Supabase Not Configured" : "Hospital Not Found"}
        </h1>
        <p className="text-[var(--text-muted)] max-w-md">
          {isConfigMissing 
            ? "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file to enable hospital data and bed management."
            : "The hospital ID provided does not exist in the database. Please check the URL or contact the dispatcher."}
        </p>
        <Link href="/" className="mt-8 px-6 py-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--bg-panel)] transition">
          Return to Hub
        </Link>
      </div>
    );
  }

  const incomingList = Object.values(incomingPatients).filter((inc) => inc.status === "active");

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-white overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[var(--text-muted)] hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight m-0">{hospital.name}</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 uppercase tracking-wider">
              Emergency Department View
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto">
        
        {/* Left Column: Bed Management & Stats */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Bed Availability Card */}
          <div className="glass-panel p-6 flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -z-10" />
            
            <div className="flex items-center gap-3">
              <BedDouble className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Bed Management
              </h2>
            </div>

            <div className="flex items-end gap-4">
              <div className="flex flex-col">
                <span className="text-5xl font-black text-white">{hospital.available_beds}</span>
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide mt-1">
                  Available Beds
                </span>
              </div>
              <div className="flex flex-col mb-1">
                <span className="text-xl font-bold text-[var(--text-muted)]">/ {hospital.total_beds}</span>
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide opacity-0">
                  Total
                </span>
              </div>
            </div>

            {/* Update Form */}
            <form onSubmit={handleUpdateBeds} className="mt-4 flex gap-3">
              <input
                type="number"
                min="0"
                max={hospital.total_beds}
                value={newBedCount}
                onChange={(e) => setNewBedCount(e.target.value)}
                className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-medium"
              />
              <button
                type="submit"
                disabled={updatingBeds || newBedCount === hospital.available_beds.toString()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-[var(--bg-panel)] disabled:text-[var(--text-muted)] text-white font-semibold rounded-lg transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
              >
                {updatingBeds ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : updateSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  "Update"
                )}
              </button>
            </form>
          </div>

          {/* Capabilities Card */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-purple-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Registered Capabilities
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {hospital.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-md text-[var(--text-secondary)] uppercase"
                >
                  {cap.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Incoming Patients */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-panel p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Siren className="w-5 h-5 text-red-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Incoming Pre-Alerts
                </h2>
              </div>
              <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                {incomingList.length} Active
              </div>
            </div>

            {incomingList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] border-2 border-dashed border-[var(--border-subtle)] rounded-xl">
                <Clock className="w-10 h-10 mb-4 opacity-50" />
                <p>No incoming emergency patients at this time.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {incomingList.map((incident) => {
                  const ambLoc = incident.assigned_ambulance_id ? ambulanceLocations[incident.assigned_ambulance_id] : null;
                  
                  // Calculate dynamic ETA based on initial ETA and live progress
                  let displayEta = incident.eta_minutes;
                  if (ambLoc && displayEta > 0) {
                    displayEta = Math.max(1, Math.round(incident.eta_minutes * (1 - ambLoc.progress / 100)));
                  }

                  return (
                    <div
                      key={incident.id}
                      className="glass-panel-sm p-5 border-l-4"
                      style={{ borderLeftColor: incident.severity === "CRITICAL" ? "#ef4444" : "#f97316" }}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="px-2.5 py-1 text-xs font-bold rounded-md"
                            style={{
                              backgroundColor: incident.severity === "CRITICAL" ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.15)",
                              color: incident.severity === "CRITICAL" ? "#ef4444" : "#f97316",
                            }}
                          >
                            {incident.severity}
                          </span>
                          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                            {incident.ambulance_type} Ambulance En Route
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-[var(--bg-secondary)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)]">
                          <Clock className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-bold text-yellow-500">{displayEta > 0 ? `${displayEta} min` : "Arriving"}</span>
                        </div>
                      </div>

                      <div className="flex gap-4 items-start">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-[var(--text-muted)]" />
                        </div>
                        <div>
                          <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-3">
                            {incident.patient_summary}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {incident.suspected_conditions.map((cond, i) => (
                              <span key={i} className="px-2 py-1 bg-red-500/10 text-red-300 border border-red-500/20 text-xs rounded">
                                {cond}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Bar (if live data exists) */}
                      {ambLoc && (
                        <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-muted)]">Transport Progress</span>
                            <span className="text-blue-400 font-bold">{ambLoc.progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
                              style={{ width: `${Math.min(100, ambLoc.progress)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
