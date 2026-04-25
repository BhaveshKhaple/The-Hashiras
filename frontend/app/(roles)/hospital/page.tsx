'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Hospital, BedDouble, Activity, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function HospitalPage() {
  const [incoming, setIncoming] = useState<any[]>([]);
  const [beds, setBeds] = useState({ available: 8, total: 12 });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchIncoming();

    // Real-time subscription for new dispatches
    const channel = supabase
      .channel('hospital-incidents')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, () => {
        fetchIncoming();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, () => {
        fetchIncoming();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchIncoming = async () => {
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .in('status', ['active', 'dispatched'])
      .order('created_at', { ascending: false });

    setIncoming(data || []);
  };

  const handleAdmit = async (incidentId: string) => {
    setActionLoading(incidentId);
    try {
      await fetch(`${BACKEND_URL}/api/incident/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId, status: 'resolved' }),
      });
      setBeds(prev => ({ ...prev, available: Math.max(0, prev.available - 1) }));
      await fetchIncoming();
    } catch (e) {
      console.warn('Admit failed (demo resilient):', e);
      // Still update local state for demo
      setIncoming(prev => prev.filter(i => i.id !== incidentId));
      setBeds(prev => ({ ...prev, available: Math.max(0, prev.available - 1) }));
    } finally {
      setActionLoading(null);
    }
  };

  const bedPct = Math.round((beds.available / beds.total) * 100);
  const bedColor = bedPct > 50 ? 'bg-green-500' : bedPct > 25 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="glass border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-600/20">
            <Hospital className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">HOSPITAL PORTAL</h1>
            <p className="text-xs text-gray-500">Lilavati Hospital • Mumbai</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
          Real-time updates active
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Bed Status Card */}
        <motion.div
          className="glass rounded-2xl p-6"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <BedDouble className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold">Bed Availability</h2>
          </div>
          <div className="flex items-end gap-4 mb-3">
            <span className="text-5xl font-bold text-blue-300">{beds.available}</span>
            <span className="text-gray-500 text-lg pb-1">/ {beds.total} beds free</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full ${bedColor} rounded-full transition-all duration-700`}
              style={{ width: `${bedPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">{bedPct}% capacity available</p>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Incoming', value: incoming.length, icon: Activity, color: 'text-orange-400' },
            { label: 'Critical', value: incoming.filter(i => i.severity === 'CRITICAL').length, icon: AlertTriangle, color: 'text-red-400' },
            { label: 'Admitted Today', value: beds.total - beds.available, icon: CheckCircle, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <motion.div
              key={label}
              className="glass rounded-xl p-4 text-center"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            >
              <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Incoming Patients */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            Incoming Patients ({incoming.length})
          </h2>

          {incoming.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center text-gray-600 italic">
              No incoming patients at this time
            </div>
          ) : (
            <div className="space-y-3">
              {incoming.map((inc, idx) => (
                <motion.div
                  key={inc.id}
                  className="glass rounded-xl p-5"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          inc.severity === 'CRITICAL' ? 'bg-red-600 animate-pulse' : 'bg-orange-500'
                        }`}>
                          {inc.severity || 'MODERATE'}
                        </span>
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {inc.eta_minutes ? `~${inc.eta_minutes} min ETA` : 'ETA unknown'}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug truncate">
                        {inc.emergency_text || 'Emergency patient inbound'}
                      </p>
                      {inc.patient_summary && (
                        <p className="text-xs text-gray-400 mt-1 italic line-clamp-2">
                          &ldquo;{inc.patient_summary}&rdquo;
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleAdmit(inc.id)}
                      disabled={actionLoading === inc.id || beds.available === 0}
                      className="flex-shrink-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
                    >
                      {actionLoading === inc.id ? '...' : 'Admit'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
