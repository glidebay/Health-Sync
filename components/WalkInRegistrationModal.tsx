'use client';

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import EcgActionLoader from "@/components/loading/EcgActionLoader";
import { DbDoctor } from "@/types/database";
import { getDoctors, registerWalkinPatientDb } from "@/lib/supabaseService";
import { X } from "lucide-react";

interface WalkInRegistrationModalProps {
  doctorId?: string;
  locationId?: string;
  clinicId?: string;
  availableDoctors?: DbDoctor[];
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export function WalkInRegistrationModal({ doctorId, locationId, clinicId, availableDoctors: initialDoctors, onClose, onSuccess }: WalkInRegistrationModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [priority, setPriority] = useState<"Normal" | "Urgent">("Normal");
  const [doctorsList, setDoctorsList] = useState<DbDoctor[]>(initialDoctors || []);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctorId || (initialDoctors?.[0]?.id ?? ''));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialDoctors || initialDoctors.length === 0) {
      const storedLoc = typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_location_id') : null;
      const storedClinic = typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_clinic_id') : null;
      getDoctors(clinicId || storedClinic || undefined, locationId || storedLoc || undefined).then((data) => {
        if (data && data.length > 0) {
          setDoctorsList(data);
          if (!selectedDoctorId || !data.some((d) => d.id === selectedDoctorId)) {
            setSelectedDoctorId(data[0].id);
          }
        }
      });
    }
  }, [initialDoctors, selectedDoctorId, clinicId, locationId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    if (cleanName.length < 2) {
      alert("Registration Failed: Patient name must be at least 2 characters long.");
      return;
    }

    setLoading(true);

    const nowIso = new Date().toISOString();
    const cleanPhone = phone.trim();

    const storedLoc = typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_location_id') : null;
    const storedClinic = typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_clinic_id') : null;
    const effectiveLocId = locationId || storedLoc || null;
    const effectiveClinicId = clinicId || storedClinic || null;
    const targetDoctorId = selectedDoctorId || doctorId || null;

    const result = await registerWalkinPatientDb({
      name: cleanName,
      phone: cleanPhone,
      doctorId: targetDoctorId || undefined,
      locationId: effectiveLocId || undefined,
      clinicId: effectiveClinicId || undefined,
      age: age ? parseInt(age, 10) : 30,
      gender: gender as any,
      priority,
    });

    setLoading(false);

    if (!result || !result.success) {
      let errMsg = result?.message || "Failed to register walk-in patient.";
      if (errMsg.includes("chk_patient_name_valid")) {
        errMsg = "Patient full name must be at least 2 characters long.";
      }
      alert(`Registration Failed: ${errMsg}`);
      return;
    }

    const tokenDisplay = result.tokenNumber || `P${String(result.queueTokenNo || 1).padStart(3, '0')}`;
    const slot = result.time || "Immediate";
    alert(`✅ Walk-in Registered! Token #${tokenDisplay} at ${slot}`);
    onSuccess({ ...result, tokenDisplay });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] relative animate-in fade-in zoom-in-95 duration-200">
        <EcgActionLoader isLoading={loading} text="Registering walk-in patient..." />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800">
            Register Walk-in Patient
          </h3>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleRegister} className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Consulting Doctor <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDoctorId}
              onChange={e => setSelectedDoctorId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:outline-hidden"
            >
              {doctorsList.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Patient Full Name <span className="text-red-500">*</span>
            </label>
            <input 
              required
              minLength={2}
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
              placeholder="e.g. Ramesh Kumar" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Phone Number (10 digits) <span className="text-red-500">*</span>
            </label>
            <input 
              required
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
              placeholder="+919876543210" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Age
              </label>
              <input 
                type="number" 
                value={age} 
                onChange={e => setAge(e.target.value)} 
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden" 
                placeholder="e.g. 35"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Gender
              </label>
              <select 
                value={gender} 
                onChange={e => setGender(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:outline-hidden"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Priority
            </label>
            <select 
              value={priority} 
              onChange={e => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:outline-hidden"
            >
              <option value="Normal">Normal Queue</option>
              <option value="Urgent">Urgent (Quota Bypass)</option>
            </select>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Queueing...' : 'Queue Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WalkInRegistrationModal;
