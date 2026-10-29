'use client';

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EcgActionLoader from "@/components/loading/EcgActionLoader";

interface DoctorCabinConsoleProps {
  doctorId?: string;
  currentPatient?: {
    appointment_id: string;
    patient_name: string;
    queue_token_no: number | string;
    gender?: string | null;
    age?: number | null;
    visit_type?: string;
    status?: string;
  } | null;
  onRefresh?: () => void;
}

export function DoctorCabinConsole({ doctorId, currentPatient, onRefresh }: DoctorCabinConsoleProps) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCallNext = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("call_next_patient", { 
        p_doctor_id: doctorId || null 
      });

      if (!error && data?.success) {
        if (onRefresh) onRefresh();
        setLoading(false);
        return;
      }

      const todayYmd = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      
      let query = supabase
        .from('appointments')
        .select('id, queue_token_no, patient:patients(full_name)')
        .eq('status', 'Waiting')
        .gte('scheduled_time', `${todayYmd}T00:00:00`)
        .order('queue_token_no', { ascending: true })
        .limit(1);

      if (doctorId) {
        query = query.eq('doctor_id', doctorId);
      }

      const { data: nextAppts } = await query;

      if (!nextAppts || nextAppts.length === 0) {
        alert("No patients currently waiting in queue.");
        setLoading(false);
        return;
      }

      const nextAppt = nextAppts[0];
      const { error: updateErr } = await supabase
        .from('appointments')
        .update({ 
          status: 'In Progress', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', nextAppt.id);

      if (updateErr) {
        alert(`Failed to admit patient: ${updateErr.message}`);
      } else {
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      alert(`Error calling next patient: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!currentPatient) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("complete_consultation", {
        p_appointment_id: currentPatient.appointment_id,
        p_clinical_notes: notes,
      });

      if (!error && data?.success) {
        setNotes("");
        alert(`Consultation completed! Duration: ${data.duration_minutes ?? 'Standard'} mins.`);
        if (onRefresh) onRefresh();
        setLoading(false);
        return;
      }

      const { error: compErr } = await supabase
        .from('appointments')
        .update({
          status: 'Completed',
          clinical_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentPatient.appointment_id);

      if (compErr) {
        alert(`Error completing consultation: ${compErr.message}`);
      } else {
        setNotes("");
        alert("Consultation marked as completed successfully!");
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      alert(`Error completing consultation: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
      <EcgActionLoader isLoading={loading} text="Processing cabin action..." />
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h3 className="text-xl font-bold">Doctor Cabin Console</h3>
          <p className="text-xs text-slate-400 mt-0.5">Real-time consultation flow & queue caller</p>
        </div>
        <button
          onClick={handleCallNext}
          disabled={loading}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl text-slate-950 transition cursor-pointer shadow-xs disabled:opacity-50"
        >
          📢 Call Next Patient
        </button>
      </div>

      {currentPatient ? (
        <div className="space-y-4">
          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Now Consulting</span>
              <h4 className="text-2xl font-black text-white">{currentPatient.patient_name}</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Token #{currentPatient.queue_token_no} • {currentPatient.gender || 'Patient'}{currentPatient.age ? `, ${currentPatient.age} yrs` : ''}
              </p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-bold">
              In Progress
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Clinical diagnosis and notes..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            rows={3}
          />
          <button
            onClick={handleComplete}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50"
          >
            ✅ Finish Consultation & Auto-Deduct Inventory
          </button>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <p className="font-semibold">No patient currently in cabin.</p>
          <p className="text-xs mt-1 text-slate-500">Click &quot;Call Next Patient&quot; to admit the next waiting token.</p>
        </div>
      )}
    </div>
  );
}

export default DoctorCabinConsole;
