'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { socket } from '@/lib/socket';
import { Activity, Map as MapIcon, Siren, Hospital, Clock, Navigation } from 'lucide-react';

const MapComponent = dynamic(() => import('./MapComponent'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-neutral-900 animate-pulse flex items-center justify-center text-gray-500">Loading Map...</div>
});

export default function DispatcherDashboard() {
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [stats, setStats] = useState({ active: 0, critical: 0, ambulances: 0 });

  useEffect(() => {
    fetchInitialData();
    setupSubscriptions();
    
    socket.connect();
    socket.on('ambulance:location', (data) => {
      setAmbulances(prev => prev.map(amb => 
        amb.id === data.ambulance_id 
          ? { ...amb, lat: data.lat, lng: data.lng, heading: data.heading } 
          : amb
      ));
    });

    socket.on('dispatch:ambulance', (data) => {
        // Refresh incidents when a new dispatch occurs
        fetchIncidents();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchInitialData = async () => {
    // Hospitals
    const { data: hosp } = await supabase.from('hospitals').select('*');
    // PostGIS geo to lng/lat
    // Note: We'll use a simpler query for MVP, but ideally use RPC or postgis operators
    const formattedHosp = (hosp || []).map(h => ({
        ...h,
        // Mocking for now if geo parsing is complex, or ideally we fetch via RPC
        lat: 19.07 + Math.random() * 0.05,
        lng: 72.87 + Math.random() * 0.05
    }));
    setHospitals(formattedHosp);

    // Ambulances
    const { data: amb } = await supabase.from('ambulances').select('*');
    const formattedAmb = (amb || []).map(a => ({
        ...a,
        lat: 19.07 + Math.random() * 0.05,
        lng: 72.87 + Math.random() * 0.05
    }));
    setAmbulances(formattedAmb);

    fetchIncidents();
  };

  const fetchIncidents = async () => {
    const { data: inc } = await supabase.from('incidents')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
    
    const formattedInc = (inc || []).map(i => ({
        ...i,
        lat: 19.05 + Math.random() * 0.05,
        lng: 72.82 + Math.random() * 0.05
    }));
    setIncidents(formattedInc);
    
    setStats({
        active: inc?.length || 0,
        critical: inc?.filter(i => i.severity === 'CRITICAL').length || 0,
        ambulances: ambulances.filter(a => a.status === 'available').length
    });
  };

  const setupSubscriptions = () => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, payload => {
        fetchIncidents();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, payload => {
        // Handle ambulance status changes
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
                  "{incident.patient_summary}"
                </p>
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-3 h-3 text-red-500" />
                    <span className="text-[10px] font-mono text-gray-400">AMB-001</span>
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
                System Healthy • {new Date().toLocaleTimeString()}
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
