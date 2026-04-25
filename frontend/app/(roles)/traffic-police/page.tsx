'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, CheckCircle, MapPin, Clock, Navigation } from 'lucide-react';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-neutral-900 animate-pulse flex items-center justify-center text-gray-500">
      Loading Map...
    </div>
  ),
});

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface Roadblock {
  id: string;
  lat: number;
  lng: number;
  description: string;
  createdAt: Date;
  cleared: boolean;
}

export default function TrafficPolicePage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [roadblocks, setRoadblocks] = useState<Roadblock[]>([]);
  const [greenCorridors, setGreenCorridors] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);

  useEffect(() => {
    fetchIncidents();

    const channel = supabase
      .channel('traffic-incidents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, fetchIncidents)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchIncidents = async () => {
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .in('status', ['active', 'dispatched'])
      .order('created_at', { ascending: false });

    const formatted = (data || []).map(i => ({
      ...i,
      lat: i.lat || (19.05 + Math.random() * 0.05),
      lng: i.lng || (72.82 + Math.random() * 0.05),
    }));
    setIncidents(formatted);
  };

  const handleFlagRoadblock = useCallback(async () => {
    setFlagging(true);
    // Get current location for roadblock pin
    const loc = await new Promise<{ lat: number; lng: number }>((resolve) => {
      navigator.geolocation?.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: 19.076 + Math.random() * 0.02 - 0.01, lng: 72.877 + Math.random() * 0.02 - 0.01 })
      );
    });

    const newBlock: Roadblock = {
      id: Date.now().toString(),
      lat: loc.lat,
      lng: loc.lng,
      description: 'Roadblock flagged by traffic officer',
      createdAt: new Date(),
      cleared: false,
    };

    try {
      await fetch(`${BACKEND_URL}/api/route/reroute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadblock_lat: loc.lat, roadblock_lng: loc.lng }),
      });
    } catch (e) {
      console.warn('Reroute API unreachable (demo resilient):', e);
    }

    setRoadblocks(prev => [newBlock, ...prev]);
    setFlagging(false);
  }, []);

  const handleClearRoadblock = (id: string) => {
    setRoadblocks(prev => prev.map(r => r.id === id ? { ...r, cleared: true } : r));
  };

  const handleGrantCorridor = async (incidentId: string) => {
    setActionLoading(incidentId);
    try {
      await fetch(`${BACKEND_URL}/api/corridor/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId }),
      });
    } catch (e) {
      console.warn('Corridor grant failed (demo resilient):', e);
    }
    setGreenCorridors(prev => [...prev, incidentId]);
    setActionLoading(null);
  };

  const activeRoadblocks = roadblocks.filter(r => !r.cleared);

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden flex-col">
      {/* Header */}
      <div className="glass border-b border-white/10 px-6 py-4 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-600 p-2 rounded-lg shadow-lg shadow-yellow-600/20">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">TRAFFIC CONTROL</h1>
            <p className="text-xs text-gray-500">Officer Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeRoadblocks.length > 0 && (
            <span className="text-[11px] bg-red-900/50 border border-red-800 text-red-400 px-2 py-1 rounded-full">
              {activeRoadblocks.length} active roadblock{activeRoadblocks.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Live
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <MapComponent
            ambulances={[]}
            hospitals={[]}
            incidents={incidents}
          />

          {/* Flag Roadblock FAB */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
            <motion.button
              onClick={handleFlagRoadblock}
              disabled={flagging}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 px-6 py-3.5 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold shadow-2xl shadow-red-600/40 text-sm transition-all"
            >
              <AlertTriangle className="w-5 h-5" />
              {flagging ? 'Flagging...' : 'Flag Roadblock Here'}
            </motion.button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 glass border-l border-white/10 flex flex-col z-10">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Active Roadblocks */}
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Active Roadblocks ({activeRoadblocks.length})
              </h2>
              <AnimatePresence>
                {activeRoadblocks.length === 0 ? (
                  <div className="text-center py-6 text-gray-600 text-xs italic">
                    No roadblocks flagged
                  </div>
                ) : (
                  activeRoadblocks.map(rb => (
                    <motion.div
                      key={rb.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                      className="bg-red-900/20 border border-red-800/50 rounded-xl p-3 mb-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-red-400">🚧 Roadblock</p>
                          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {rb.lat.toFixed(4)}, {rb.lng.toFixed(4)}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {rb.createdAt.toLocaleTimeString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleClearRoadblock(rb.id)}
                          className="flex-shrink-0 px-2 py-1 rounded-lg bg-green-800/50 hover:bg-green-700/50 text-green-400 text-[10px] font-semibold transition-all"
                        >
                          Clear
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Ambulances in Area */}
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Active Emergencies ({incidents.length})
              </h2>
              {incidents.length === 0 ? (
                <div className="text-center py-6 text-gray-600 text-xs italic">No active emergencies</div>
              ) : (
                incidents.map((inc) => (
                  <motion.div
                    key={inc.id}
                    className="glass p-3 rounded-xl mb-2"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            inc.severity === 'CRITICAL' ? 'bg-red-600 animate-pulse' : 'bg-orange-500'
                          }`}>
                            {inc.severity || 'MODERATE'}
                          </span>
                        </div>
                        <p className="text-xs font-medium truncate">{inc.emergency_text || 'Emergency'}</p>
                        {greenCorridors.includes(inc.id) && (
                          <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Green corridor active
                          </p>
                        )}
                      </div>
                      {!greenCorridors.includes(inc.id) && (
                        <button
                          onClick={() => handleGrantCorridor(inc.id)}
                          disabled={actionLoading === inc.id}
                          className="flex-shrink-0 px-2 py-1 rounded-lg bg-green-800/50 hover:bg-green-700/50 text-green-400 text-[10px] font-semibold transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          {actionLoading === inc.id ? '...' : 'Corridor'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 border-t border-white/10 bg-white/5">
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              System Active • {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
