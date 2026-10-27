'use client';

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface WalkInRegistrationModalProps {
  doctorId?: string;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export function WalkInRegistrationModal({ doctorId, onClose, onSuccess }: WalkInRegistrationModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [priority, setPriority] = useState<"Normal" | "Urgent">("Normal");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const nowIso = new Date().toISOString();
    const cleanPhone = phone.trim();

    // Call backend RPC
    const { data, error } = await supabase.rpc("register_walk_in_patient", {
      p_full_name: name.trim(),
      p_phone_number: cleanPhone,
      p_doctor_id: doctorId || null,
      p_scheduled_time: nowIso,
      p_age: age ? parseInt(age, 10) : null,
      p_gender: gender,
      p_priority: priority,
    });

    setLoading(false);

    if (error || (data && data.success === false)) {
      const errMsg = data?.error_message || error?.message || "Failed to register walk-in patient.";
      alert(`Registration Failed: ${errMsg}`);
      return;
    }

    const tokenNo = data?.queue_token_no || data?.fifo_token_no || "1";
    const slot = data?.allocated_slot || data?.assigned_slot || "Immediate";

    alert(`✅ Walk-in Registered! Token #${tokenNo} at ${slot}`);
    onSuccess(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Register Walk-in Patient</h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">Patient Full Name</label>
            <input 
              required
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
              placeholder="e.g. Ramesh Kumar" 
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Phone Number (10 digits)</label>
            <input 
              required
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
              placeholder="+919876543210" 
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Age</label>
              <input 
                type="number" 
                value={age} 
                onChange={e => setAge(e.target.value)} 
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm" 
                placeholder="e.g. 35"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Gender</label>
              <select 
                value={gender} 
                onChange={e => setGender(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm bg-white"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Priority</label>
            <select 
              value={priority} 
              onChange={e => setPriority(e.target.value as any)}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm bg-white"
            >
              <option value="Normal">Normal</option>
              <option value="Urgent">🚨 Urgent (Emergency)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm cursor-pointer transition shadow-xs"
            >
              {loading ? "Allocating Slot..." : "Confirm & Assign Token"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WalkInRegistrationModal;
