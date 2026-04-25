'use client';

import { useEffect, useState, Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { socket } from '@/lib/socket';
import { Activity, Map as MapIcon, Siren, Clock, Navigation, RefreshCw, AlertTriangle } from 'lucide-react';

// P1-004: Error Boundary — catches runtime crashes in dashboard children (Leaflet, Supabase, sockets)
class DashboardErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  // BUG-T004 fix: log error details for dev visibility and debugging
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[DashboardErrorBoundary] Caught error:', error.message);
    console.error('[DashboardErrorBoundary] Component stack:', info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen bg-black text-white items-center justify-center flex-col gap-6">
          <div className="bg-red-900/20 border border-red-800 rounded-2xl p-8 max-w-md text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold">Dashboard Error</h2>
            <p className="text-sm text-gray-400">{(this.state.error as Error).message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const MapComponent = dynamic(() => import('./MapComponent'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-neutral-900 animate-pulse flex items-center justify-center text-gray-500">Loading Map...</div>
});


function DispatcherDashboardInner() {
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [stats, setStats] = useState({ active: 0, critical: 0, ambulances: 0 });
  const [currentTime, setCurrentTime] = useState('');

  // Client-only clock to avoid hydration mismatch
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchInitialData();
    const cleanupSubs = setupSubscriptions();
    
    socket.connect();
    socket.on('ambulance:location', (data) => {
      // Guard: skip if data is malformed
      if (!data || typeof data.ambulance_id === 'undefined') return;
      setAmbulances(prev => prev.map(amb => 
        amb.id === data.ambulance_id 
          ? { ...amb, lat: data.lat, lng: data.lng, heading: data.heading } 
          : amb
      ));
    });

    // BUG-005 fix: use the dispatch payload to immediately update ambulance status in local state
    socket.on('dispatch:ambulance', (data) => {
      if (data?.ambulance?.id) {
        setAmbulances(prev => prev.map(amb =>
          amb.id === data.ambulance.id
            ? { ...amb, status: 'dispatched' }
            : amb
        ));
      }
      fetchIncidents();
    });

    // Resilience: handle corridor:granted broadcast
    socket.on('corridor:granted', (data) => {
      if (!data?.incident_id) return;
      console.log(`🟢 Corridor granted for incident ${data.incident_id}`);
    });

    // Resilience: handle incident:updated broadcast — refresh active incidents
    socket.on('incident:updated', (data) => {
      if (!data?.incident_id) return;
      fetchIncidents();
    });

    return () => {
      socket.off('corridor:granted');
      socket.off('incident:updated');
      socket.disconnect();
      // BUG-006 fix: call the returned cleanup so Supabase channel is removed on unmount
      if (cleanupSubs) cleanupSubs();
    };
  }, []);

  /**
   * Parse PostGIS geography WKB hex string → { lat, lng }
   * Supabase returns GEOGRAPHY(POINT) columns as WKB hex, e.g.:
   *   "0101000020E6100000..." (little-endian WKB with SRID)
   * We decode bytes 5-12 (X = lng) and 13-20 (Y = lat) as little-endian float64.
   */
  const parsePostGISPoint = (wkb: string | null): { lat: number; lng: number } | null => {
    if (!wkb || typeof wkb !== 'string') return null;
    try {
      // Strip leading SRID flag bytes (WKB with SRID is 25 bytes, plain is 21)
      const hex = wkb.replace(/^[0-9a-f]{2}/i, '').replace(/^[0-9a-f]{8}/i, '').replace(/^[0-9a-f]{2}/i, '');
      // Remaining: type (8 hex) + X (16 hex) + Y (16 hex), might also have SRID prefix
      // Use a more reliable approach: look for 8-byte IEEE 754 float pairs
      const clean = wkb.replace(/^01/, ''); // strip byte order
      const withoutType = clean.slice(8);   // skip geometry type (4 bytes = 8 hex)
      const withoutSrid = wkb.startsWith('0120') || wkb.startsWith('01010000a0') || wkb.startsWith('0101000020')
        ? withoutType.slice(8) // skip SRID (4 bytes = 8 hex) for EWKB
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

  // Mumbai fallback coords for demo mode (varied per index)
  const MUMBAI_AMBULANCE_DEMOS = [
    { lat: 19.1136, lng: 72.8479 }, // Andheri
    { lat: 19.0596, lng: 72.8295 }, // Bandra
    { lat: 19.0178, lng: 72.8410 }, // Dadar
    { lat: 19.0730, lng: 72.8887 }, // Kurla
    { lat: 19.2183, lng: 72.9781 }, // Thane
    { lat: 19.0050, lng: 72.8178 }, // Worli
  ];
  const MUMBAI_HOSPITAL_DEMOS = [
    { lat: 19.0523, lng: 72.8264 }, // Lilavati
    { lat: 19.0019, lng: 72.8410 }, // KEM
    { lat: 19.0549, lng: 72.8411 }, // Hinduja
    { lat: 19.0974, lng: 72.8341 }, // Nanavati
    { lat: 19.0257, lng: 72.8100 }, // Jaslok
  ];

  const fetchInitialData = async () => {
    try {
      const { data: hosp } = await supabase.from('hospitals').select('*');
      const formattedHosp = (hosp || []).map((h, idx) => {
        const parsed = parsePostGISPoint(h.location);
        const demo = MUMBAI_HOSPITAL_DEMOS[idx % MUMBAI_HOSPITAL_DEMOS.length];
        return {
          ...h,
          lat: parsed?.lat ?? h.lat ?? demo.lat,
          lng: parsed?.lng ?? h.lng ?? demo.lng,
        };
      });
      setHospitals(formattedHosp);

      const { data: amb } = await supabase.from('ambulances').select('*');
      const formattedAmb = (amb || []).map((a, idx) => {
        const parsed = parsePostGISPoint(a.location);
        const demo = MUMBAI_AMBULANCE_DEMOS[idx % MUMBAI_AMBULANCE_DEMOS.length];
        return {
          ...a,
          lat: parsed?.lat ?? a.lat ?? demo.lat,
          lng: parsed?.lng ?? a.lng ?? demo.lng,
        };
      });
      setAmbulances(formattedAmb);
    } catch (err) {
      console.warn('Supabase not configured, running in demo mode:', err);
      // Demo mode: show mock data on Mumbai map
      setAmbulances([
        { id: 'demo-1', name: 'AMB-001', type: 'ALS', status: 'available', driver_name: 'Demo Driver', lat: 19.1136, lng: 72.8479 },
        { id: 'demo-2', name: 'AMB-002', type: 'BLS', status: 'available', driver_name: 'Demo Driver', lat: 19.0596, lng: 72.8295 },
        { id: 'demo-3', name: 'AMB-003', type: 'ALS', status: 'available', driver_name: 'Demo Driver', lat: 19.0178, lng: 72.8410 },
      ]);
      setHospitals([
        { id: 'demo-h1', name: 'Lilavati Hospital', available_beds: 18, lat: 19.0523, lng: 72.8264 },
        { id: 'demo-h2', name: 'KEM Hospital', available_beds: 45, lat: 19.0019, lng: 72.8410 },
      ]);
    }

    fetchIncidents();
  };

  const fetchIncidents = async () => {
    try {
      const { data: inc } = await supabase.from('incidents')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

      const formattedInc = (inc || []).map((i, idx) => {
        const parsed = parsePostGISPoint(i.patient_location);
        return {
          ...i,
          lat: parsed?.lat ?? i.lat ?? (19.05 + idx * 0.008),
          lng: parsed?.lng ?? i.lng ?? (72.82 + idx * 0.008),
        };
      });
      setIncidents(formattedInc);

      setStats({
          active: inc?.length || 0,
          critical: inc?.filter(i => i.severity === 'CRITICAL').length || 0,
          ambulances: ambulances.filter(a => a.status === 'available').length
      });
    } catch (err) {
      console.warn('Failed to fetch incidents:', err);
    }
  };

  const setupSubscriptions = () => {
    try {
      const channel = supabase
        .channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
          fetchIncidents();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, () => {
          // Refresh ambulance list on any status change
          fetchInitialData();
        })
        .subscribe();

      // BUG-006 fix: return the cleanup function so the caller can remove the channel on unmount
      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Supabase subscriptions not available:', err);
      return undefined;
    }
  };

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 glass border-r border-white/10 flex flex-col z-20">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-red-600 p-2 rounded-lg shadow-lg shadow-red-600/20">
              <Siren className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">DISPATCH CENTER</h1>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 p-2 rounded-md text-center">
              <p className="text-[10px] text-gray-400 uppercase">Active</p>
              <p className="text-lg font-bold">{stats.active}</p>
            </div>
            <div className="bg-red-900/20 p-2 rounded-md text-center border border-red-900/30">
              <p className="text-[10px] text-red-400 uppercase">Critical</p>
              <p className="text-lg font-bold text-red-500">{stats.critical}</p>
            </div>
            <div className="bg-green-900/20 p-2 rounded-md text-center border border-green-900/30">
              <p className="text-[10px] text-green-400 uppercase">AMB</p>
              <p className="text-lg font-bold text-green-500">{stats.ambulances}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-2">Active Incidents</h2>
          {incidents.length === 0 ? (
            <div className="text-center py-10 text-gray-600 italic">No active emergencies</div>
          ) : (
            incidents.map(incident => (
              <div key={incident.id} className="group glass p-4 rounded-xl cursor-pointer hover:border-white/30 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    incident.severity === 'CRITICAL' ? 'bg-red-600 animate-pulse' : 'bg-orange-500'
                  }`}>
                    {incident.severity}
                  </span>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {incident.eta_minutes}m
                  </span>
                </div>
                <h3 className="text-sm font-medium leading-snug group-hover:text-red-400 transition-colors">
                  {incident.emergency_text}
                </h3>
                <p className="text-[11px] text-gray-500 mt-2 line-clamp-2 italic">
                  &quot;{incident.patient_summary}&quot;
                </p>
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-3 h-3 text-red-500" />
                    {/* BUG-010 fix: dynamic ambulance name lookup instead of hardcoded AMB-001 */}
                    <span className="text-[10px] font-mono text-gray-400">
                      {ambulances.find(a => a.id === incident.assigned_ambulance_id)?.name || 'AMB-???'}
                    </span>
                  </div>
                  <button className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors">
                    Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5">
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                System Healthy {currentTime && `• ${currentTime}`}
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        <MapComponent 
            ambulances={ambulances} 
            hospitals={hospitals} 
            incidents={incidents} 
        />
        
        {/* Floating Controls */}
        <div className="absolute top-6 right-6 z-10 space-y-2">
          <button className="glass p-3 rounded-full hover:bg-white/10 transition-colors shadow-2xl">
            <Activity className="w-6 h-6" />
          </button>
          <button className="glass p-3 rounded-full hover:bg-white/10 transition-colors shadow-2xl">
            <MapIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DispatcherDashboard() {
  return (
    <DashboardErrorBoundary>
      <DispatcherDashboardInner />
    </DashboardErrorBoundary>
  );
}
