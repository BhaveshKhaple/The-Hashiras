'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { socket } from '@/lib/socket';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, User, CheckCircle, AlertTriangle, MapPin, Phone, Clock, Siren, Activity } from 'lucide-react';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-neutral-900 animate-pulse flex items-center justify-center text-gray-500">
      Loading Map...
    </div>
  ),
});

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

type DriverStatus = 'available' | 'en_route' | 'at_scene' | 'transporting';

export default function DriverPage() {
  const [status, setStatus] = useState<DriverStatus>('available');
  const [incident, setIncident] = useState<any>(null);
  const [driverAmbulance, setDriverAmbulance] = useState<any>(null);
  const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number; heading: number }>({
    lat: 19.076, lng: 72.877, heading: 0,
  });
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [eta, setEta] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  // Track the assigned ambulance UUID so we can match socket events
  const assignedAmbulanceId = useRef<string | null>(null);

  // ── Parse PostGIS WKB hex → {lat, lng} ────────────────────────────────────
  const parsePostGISPoint = (wkb: string | null): { lat: number; lng: number } | null => {
    if (!wkb || typeof wkb !== 'string') return null;
    try {
      const clean = wkb.replace(/^01/, '');
      const withoutType = clean.slice(8);
      const withoutSrid = wkb.startsWith('0101000020')
        ? withoutType.slice(8)
        : withoutType;
      const readF64LE = (h: string) => {
        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        for (let i = 0; i < 8; i++) view.setUint8(i, parseInt(h.slice(i*2, i*2+2), 16));
        return view.getFloat64(0, true);
      };
      const lng = readF64LE(withoutSrid.slice(0, 16));
      const lat = readF64LE(withoutSrid.slice(16, 32));
      if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      return { lat, lng };
    } catch { return null; }
  };

  // ── Clock (client-only) ───────────────────────────────────────────────────
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Fetch this driver's ambulance from Supabase ───────────────────────────
  useEffect(() => {
    const fetchDriverData = async () => {
      try {
        // Fetch the first available ambulance as "this driver's unit"
        // In production, this would use auth to look up the driver's assigned ambulance
        const { data: amb } = await supabase
          .from('ambulances')
          .select('*')
          .order('name', { ascending: true })
          .limit(1)
          .single();

        if (amb) {
          const parsed = parsePostGISPoint(amb.location);
          const driverAmb = {
            ...amb,
            lat: parsed?.lat ?? amb.lat ?? 19.076,
            lng: parsed?.lng ?? amb.lng ?? 72.877,
          };
          setDriverAmbulance(driverAmb);
          assignedAmbulanceId.current = amb.id;
          setDriverPosition({ lat: driverAmb.lat, lng: driverAmb.lng, heading: 0 });

          // If this ambulance is already dispatched, fetch its active incident
          if (amb.status === 'dispatched') {
            setStatus('en_route');
            const { data: activeInc } = await supabase
              .from('incidents')
              .select('*')
              .eq('assigned_ambulance_id', amb.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            if (activeInc) {
              const incParsed = parsePostGISPoint(activeInc.patient_location);
              setIncident({
                ...activeInc,
                lat: incParsed?.lat ?? 19.06,
                lng: incParsed?.lng ?? 72.84,
              });
              setEta(activeInc.eta_minutes || 6);
            }
          }
        }

        // Fetch hospitals for the map
        const { data: hosp } = await supabase.from('hospitals').select('*');
        const formattedHosp = (hosp || []).map((h) => {
          const parsed = parsePostGISPoint(h.location);
          return { ...h, lat: parsed?.lat ?? h.lat ?? 19.07, lng: parsed?.lng ?? h.lng ?? 72.87 };
        });
        setHospitals(formattedHosp);
      } catch (err) {
        console.warn('Driver: Supabase not configured, running demo mode:', err);
        const demoAmb = { id: 'AMB-001', name: 'AMB-001', type: 'ALS', status: 'available', driver_name: 'You', lat: 19.076, lng: 72.877 };
        setDriverAmbulance(demoAmb);
        assignedAmbulanceId.current = 'AMB-001';
        setDriverPosition({ lat: 19.076, lng: 72.877, heading: 0 });
      }
    };

    fetchDriverData();
  }, []);

  // ── Socket connections ────────────────────────────────────────────────────
  useEffect(() => {
    socket.connect();

    // When a dispatch comes in, check if it's for our ambulance
    socket.on('dispatch:ambulance', (data: any) => {
      const myAmbId = assignedAmbulanceId.current;
      const isForMe = data?.ambulance?.id === myAmbId || data?.ambulance?.name === driverAmbulance?.name;

      if (isForMe || !myAmbId) {
        // Extract patient location from the incident
        const patientLat = data.route?.features?.[0]?.geometry?.coordinates?.[data.route?.features?.[0]?.geometry?.coordinates?.length - 1]?.[1]
          ?? data.lat ?? 19.06;
        const patientLng = data.route?.features?.[0]?.geometry?.coordinates?.[data.route?.features?.[0]?.geometry?.coordinates?.length - 1]?.[0]
          ?? data.lng ?? 72.84;

        setIncident({
          ...data,
          lat: patientLat,
          lng: patientLng,
          route_geojson: data.route,
        });
        setStatus('en_route');
        setEta(data.eta_minutes || 6);
        setProgress(0);
      }
    });

    // Listen for live GPS location updates (from simulator)
    socket.on('ambulance:location', (data: any) => {
      const myAmbId = assignedAmbulanceId.current;
      if (data.ambulance_id === myAmbId) {
        setDriverPosition({
          lat: data.lat,
          lng: data.lng,
          heading: data.heading || 0,
        });
        if (typeof data.progress === 'number') {
          setProgress(data.progress);
        }
      }
    });

    // Listen for corridor grants
    socket.on('corridor:granted', (data: any) => {
      if (data?.incident_id === incident?.incident_id || data?.incident_id === incident?.id) {
        console.log('🟢 Green corridor granted for your route!');
      }
    });

    return () => {
      socket.off('dispatch:ambulance');
      socket.off('ambulance:location');
      socket.off('corridor:granted');
      socket.disconnect();
    };
  }, [driverAmbulance]);

  // ── Status update to backend ──────────────────────────────────────────────
  const postStatus = useCallback(async (newStatus: string) => {
    setActionLoading(true);
    try {
      await fetch(`${BACKEND_URL}/api/ambulance/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambulance_id: assignedAmbulanceId.current, status: newStatus }),
      });
    } catch (e) {
      console.warn('Status update failed (demo resilient):', e);
    } finally {
      setActionLoading(false);
    }
  }, []);

  const handleArrived = async () => {
    setStatus('at_scene');
    await postStatus('at_scene');
  };

  const handlePatientPickedUp = async () => {
    setStatus('transporting');
    await postStatus('transporting');
  };

  const handleJobComplete = async () => {
    setStatus('available');
    setIncident(null);
    setEta(null);
    setProgress(0);
    await postStatus('available');
  };

  // ── Prepare map data ──────────────────────────────────────────────────────
  const ambulancesForMap = driverAmbulance ? [{
    ...driverAmbulance,
    lat: driverPosition.lat,
    lng: driverPosition.lng,
    heading: driverPosition.heading,
    status: status === 'available' ? 'available' : 'dispatched',
  }] : [];

  const incidentsForMap = incident ? [{
    ...incident,
    lat: incident.lat || 19.06,
    lng: incident.lng || 72.84,
  }] : [];

  const statusConfig = {
    available: { color: 'text-green-400', bg: 'bg-green-900/20 border-green-800', label: 'Available', icon: CheckCircle },
    en_route: { color: 'text-red-400', bg: 'bg-red-900/20 border-red-800', label: 'En Route', icon: Navigation },
    at_scene: { color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800', label: 'At Scene', icon: MapPin },
    transporting: { color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800', label: 'Transporting', icon: User },
  };

  const cfg = statusConfig[status];

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden flex-col">
      {/* Top Status Bar */}
      <div className="glass border-b border-white/10 px-6 py-3 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg shadow-lg shadow-red-600/20">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">DRIVER CONSOLE</h1>
            <p className="text-xs text-gray-500">Unit: {driverAmbulance?.name || 'Loading...'} • {driverAmbulance?.type || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {progress > 0 && status === 'en_route' && (
            <div className="flex items-center gap-2">
              <div className="w-24 bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 font-mono">{progress.toFixed(0)}%</span>
            </div>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${cfg.bg} ${cfg.color}`}>
            <cfg.icon className="w-4 h-4" />
            {cfg.label}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <MapComponent
            ambulances={ambulancesForMap}
            hospitals={hospitals}
            incidents={incidentsForMap}
          />

          {/* Floating ETA badge */}
          {eta && status === 'en_route' && (
            <div className="absolute top-6 left-6 z-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass rounded-2xl px-5 py-3 flex items-center gap-3 border border-red-800/30 shadow-2xl shadow-red-600/10"
              >
                <Siren className="w-5 h-5 text-red-500 animate-pulse" />
                <div>
                  <p className="text-xs text-gray-400">ETA to Patient</p>
                  <p className="text-xl font-bold text-red-400">~{eta} min</p>
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-80 glass border-l border-white/10 flex flex-col z-10">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence mode="wait">
              {!incident ? (
                <motion.div
                  key="standby"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-60 gap-4"
                >
                  <div className="w-20 h-20 rounded-full bg-green-900/20 border-2 border-green-700/40 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                  <p className="text-gray-400 text-sm text-center">Standby — awaiting dispatch</p>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                    Connected to Dispatch
                  </div>
                  {driverAmbulance && (
                    <div className="glass rounded-xl p-3 w-full mt-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Your Unit</p>
                      <p className="text-sm font-semibold">{driverAmbulance.name}</p>
                      <p className="text-xs text-gray-400">
                        {driverAmbulance.type === 'ALS' ? '🔴 Advanced (ALS)' : '🟢 Standard (BLS)'}
                        {' • '}{driverAmbulance.driver_name}
                      </p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="dispatch" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Incident Card */}
                  <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                      <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
                        {incident.severity || 'EMERGENCY'}
                      </span>
                    </div>

                    <p className="text-sm font-medium leading-snug">
                      {incident.emergency_text || incident.patient_summary || 'Emergency dispatch'}
                    </p>

                    {incident.patient_summary && incident.emergency_text && (
                      <p className="text-xs text-gray-400 italic leading-snug">
                        &ldquo;{incident.patient_summary}&rdquo;
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      {eta && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>ETA ~{eta}m</span>
                        </div>
                      )}
                      {incident.lat && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />
                          <span>{incident.lat?.toFixed(4)}, {incident.lng?.toFixed(4)}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {status === 'en_route' && progress > 0 && (
                      <div className="pt-2">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>Route Progress</span>
                          <span className="font-mono">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full"
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Actions</p>

                    {status === 'en_route' && (
                      <button
                        onClick={handleArrived}
                        disabled={actionLoading}
                        className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <MapPin className="w-4 h-4" /> Arrived at Scene
                      </button>
                    )}
                    {status === 'at_scene' && (
                      <button
                        onClick={handlePatientPickedUp}
                        disabled={actionLoading}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <User className="w-4 h-4" /> Patient Picked Up
                      </button>
                    )}
                    {status === 'transporting' && (
                      <button
                        onClick={handleJobComplete}
                        disabled={actionLoading}
                        className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Activity className="w-4 h-4" /> Patient Delivered
                      </button>
                    )}

                    <a
                      href="tel:112"
                      className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm flex items-center justify-center gap-2 transition-all"
                    >
                      <Phone className="w-4 h-4 text-gray-400" />
                      Call Dispatch (112)
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 border-t border-white/10 bg-white/5">
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live GPS Active {currentTime && `• ${currentTime}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
