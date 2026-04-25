'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { socket } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, User, CheckCircle, AlertTriangle, MapPin, Phone, Clock } from 'lucide-react';

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
  const [ambulances, setAmbulances] = useState<any[]>([{ id: 'AMB-001', lat: 19.076, lng: 72.877, heading: 0, status: 'available', name: 'AMB-001', driver_name: 'You' }]);
  const [eta, setEta] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // P1-003 fix: client-only clock to prevent hydration mismatch
  const [currentTime, setCurrentTime] = useState('');


  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    socket.connect();

    socket.on('dispatch:ambulance', (data: any) => {
      setIncident(data);
      setStatus('en_route');
      setEta(data.eta_minutes || 6);
    });

    socket.on('ambulance:location', (data: any) => {
      setAmbulances(prev =>
        prev.map(a => a.id === data.ambulance_id ? { ...a, lat: data.lat, lng: data.lng, heading: data.heading } : a)
      );
    });

    return () => { socket.disconnect(); };
  }, []);

  const postStatus = useCallback(async (newStatus: string, extraBody?: object) => {
    setActionLoading(true);
    try {
      await fetch(`${BACKEND_URL}/api/ambulance/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambulance_id: 'AMB-001', status: newStatus, ...extraBody }),
      });
    } catch (e) {
      console.warn('Status update failed (demo resilient):', e);
    } finally {
      setActionLoading(false);
    }
  }, []);

  const handlePatientPickedUp = async () => {
    setStatus('transporting');
    await postStatus('transporting');
  };

  const handleArrived = async () => {
    setStatus('at_scene');
    await postStatus('at_scene');
  };

  const handleJobComplete = async () => {
    setStatus('available');
    setIncident(null);
    setEta(null);
    await postStatus('available');
  };

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
      <div className="glass border-b border-white/10 px-6 py-4 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg shadow-lg shadow-red-600/20">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">DRIVER CONSOLE</h1>
            <p className="text-xs text-gray-500">Unit: AMB-001</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${cfg.bg} ${cfg.color}`}>
          <cfg.icon className="w-4 h-4" />
          {cfg.label}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map — left */}
        <div className="flex-1 relative">
          <MapComponent ambulances={ambulances} hospitals={[]} incidents={incident ? [{ ...incident, lat: incident.lat || 19.07, lng: incident.lng || 72.87 }] : []} />
        </div>

        {/* Right Panel */}
        <div className="w-80 glass border-l border-white/10 flex flex-col z-10">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence mode="wait">
              {!incident ? (
                <motion.div
                  key="standby"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-48 gap-4"
                >
                  <div className="w-16 h-16 rounded-full bg-green-900/30 border-2 border-green-700 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-gray-400 text-sm text-center">Standby — awaiting dispatch</p>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                    Connected to Dispatch
                  </div>
                </motion.div>
              ) : (
                <motion.div key="dispatch" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Incident Card */}
                  <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                      <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Incoming Dispatch</span>
                    </div>
                    <p className="text-sm font-medium leading-snug">{incident.emergency_text || incident.patient_summary || 'Emergency dispatch'}</p>
                    {eta && (
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                        <Clock className="w-3 h-3" />
                        <span>ETA: ~{eta} min</span>
                      </div>
                    )}
                    {incident.lat && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" />
                        <span>{incident.lat?.toFixed(4)}, {incident.lng?.toFixed(4)}</span>
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
                        className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
                      >
                        ✅ Arrived at Scene
                      </button>
                    )}
                    {status === 'at_scene' && (
                      <button
                        onClick={handlePatientPickedUp}
                        disabled={actionLoading}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
                      >
                        🚑 Patient Picked Up
                      </button>
                    )}
                    {status === 'transporting' && (
                      <button
                        onClick={handleJobComplete}
                        disabled={actionLoading}
                        className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
                      >
                        🏥 Patient Delivered
                      </button>
                    )}

                    {/* Emergency call placeholder */}
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
