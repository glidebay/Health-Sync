'use client';

import React, { useState } from 'react';
import { useClinic } from '@/context/ClinicContext';
import {
  Stethoscope,
  Pill,
  Plus,
  Trash2,
  FileCheck2,
  User,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export default function ConsultationView() {
  const {
    activePatient,
    currentPrescription,
    diagnosticNotes,
    setDiagnosticNotes,
    inventory,
    addMedicineToRx,
    removeMedicineFromRx,
    completeConsultation,
    switchTab
  } = useClinic();

  const [selectedMedId, setSelectedMedId] = useState<string>('');
  const [qty, setQty] = useState<string>('10');
  const [dosage, setDosage] = useState<string>('1-0-1 After Food');
  const [rxError, setRxError] = useState<string | null>(null);

  const availableMeds = inventory.filter(m => m.stock > 0);

  const handleAddMed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedId) {
      setRxError('Please select a medicine');
      return;
    }
    const numQty = parseInt(qty, 10);
    if (!numQty || numQty <= 0) {
      setRxError('Quantity must be greater than 0');
      return;
    }

    const res = addMedicineToRx(parseInt(selectedMedId, 10), numQty, dosage);
    if (!res.success) {
      setRxError(res.message || 'Error adding medication');
    } else {
      setRxError(null);
      setSelectedMedId('');
      setQty('10');
    }
  };

  const quickSymptoms = [
    'Viral Fever & Chills',
    'Throat irritation / Dry Cough',
    'Gastric Reflux & Acidity',
    'Tension Headache & Fatigue',
    'Seasonal Rhinitis / Allergy'
  ];

  const handleAddSymptom = (text: string) => {
    if (diagnosticNotes) {
      setDiagnosticNotes(`${diagnosticNotes}, ${text}`);
    } else {
      setDiagnosticNotes(text);
    }
  };

  if (!activePatient) {
    return (
      <div className="apple-glass rounded-[24px] p-10 sm:p-12 border border-slate-200/80 apple-card-shadow text-center max-w-lg mx-auto my-8">
        <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-5 shadow-inner">
          <Stethoscope className="w-10 h-10" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-display font-semibold text-slate-600 mb-3">
          <span>Consultation Chamber</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
          No Active Consultation
        </h2>
        <p className="text-xs sm:text-sm font-sans text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
          Please select a waiting patient from the consultation queue to start clinical charting.
        </p>
        <button
          onClick={() => switchTab('queue')}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-display font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <span>Open Consultation Queue</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const selectedMedObject = inventory.find(m => m.id.toString() === selectedMedId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Patient Header Card (Nexuma Inspired) */}
      <div className="rounded-[22px] bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 sm:p-7 text-white shadow-xl shadow-blue-900/10 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col items-center justify-center shrink-0 shadow-2xs">
            <span className="text-[10px] text-blue-200 uppercase font-display font-bold">Tk</span>
            <span className="text-xl font-display font-bold">{activePatient.tokenNumber}</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight">
                {activePatient.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-display font-semibold bg-white/15 text-white border border-white/15">
                {activePatient.id}
              </span>
            </div>
            <p className="text-xs font-sans text-blue-100/85 mt-1 flex items-center gap-2 font-medium">
              <span>{activePatient.age} Yrs</span>
              <span className="text-white/40">•</span>
              <span>{activePatient.gender}</span>
              <span className="text-white/40">•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-300" />
                Slot: {activePatient.time}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-display font-semibold flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Active Chamber Session
          </span>
        </div>
      </div>

      {/* Clinical Notes Card */}
      <div className="apple-glass rounded-[20px] p-6 border border-slate-200/80 apple-card-shadow space-y-3.5">
        <div className="flex items-center justify-between pb-1">
          <h3 className="font-display font-bold text-slate-900 text-base tracking-tight flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-blue-600" />
            <span>Clinical Diagnostics & Observations</span>
          </h3>
          <span className="text-xs font-display font-medium text-slate-500">Dr. Sunny MD</span>
        </div>

        {/* Quick symptom pill tags */}
        <div className="flex flex-wrap gap-2 pt-1">
          {quickSymptoms.map((symptom, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleAddSymptom(symptom)}
              className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/80 font-display font-medium transition-all shadow-2xs cursor-pointer"
            >
              + {symptom}
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          value={diagnosticNotes}
          onChange={e => setDiagnosticNotes(e.target.value)}
          placeholder="Record primary clinical symptoms, physical vitals, provisional diagnosis, and advice..."
          className="w-full p-4 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-sm font-sans text-slate-800 transition-all resize-none shadow-2xs"
        />
      </div>

      {/* Prescription Builder (Live Inventory Linked) */}
      <div className="apple-glass rounded-[20px] p-6 border border-slate-200/80 apple-card-shadow space-y-4">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80 shadow-2xs">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base tracking-tight">Prescription Builder (Rx)</h3>
              <p className="text-xs font-sans text-slate-500">Live synced with pharmacy inventory stock</p>
            </div>
          </div>

          <span className="text-xs font-display font-semibold px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100 shadow-2xs">
            {availableMeds.length} Molecules in Stock
          </span>
        </div>

        {rxError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-display font-semibold flex items-center gap-2 shadow-2xs">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{rxError}</span>
          </div>
        )}

        <form onSubmit={handleAddMed} className="space-y-3 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Medicine Selector */}
            <div className="md:col-span-6">
              <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                Select Molecule / Brand
              </label>
              <select
                value={selectedMedId}
                onChange={e => {
                  setSelectedMedId(e.target.value);
                  setRxError(null);
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-sm text-slate-800 font-medium transition-all shadow-2xs"
              >
                <option value="">-- Choose from available inventory --</option>
                {availableMeds.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.brand} • {m.generic} ({m.stock} {m.unit} in stock)
                  </option>
                ))}
              </select>
              {selectedMedObject && (
                <p className="text-[11px] font-sans text-blue-600 font-medium mt-1">
                  Available in pharmacy: <strong>{selectedMedObject.stock} {selectedMedObject.unit}</strong>
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="md:col-span-2">
              <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                Dispense Qty
              </label>
              <input
                type="number"
                min="1"
                max={selectedMedObject ? selectedMedObject.stock : 999}
                value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="Qty"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-sm text-slate-800 transition-all shadow-2xs"
              />
            </div>

            {/* Dosage */}
            <div className="md:col-span-4">
              <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                Dosage & Schedule
              </label>
              <select
                value={dosage}
                onChange={e => setDosage(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-sm text-slate-800 transition-all shadow-2xs"
              >
                <option value="1-0-1 After Food">1-0-1 After Food (Morning & Night)</option>
                <option value="1-0-0 Before Food">1-0-0 Before Food (Morning Empty Stomach)</option>
                <option value="1-1-1 After Food">1-1-1 After Food (TID)</option>
                <option value="0-0-1 Night">0-0-1 Night At Bedtime</option>
                <option value="SOS / As Needed">SOS (When Needed)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medicine to Rx</span>
          </button>
        </form>

        {/* Current Prescribed Medication List */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-display font-bold uppercase tracking-wider text-slate-500 mb-3">
            Prescribed Items for this Visit ({currentPrescription.length})
          </h4>

          {currentPrescription.length === 0 ? (
            <div className="text-center py-6 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs italic font-sans">
              No medications added yet. Select a medicine above to include in the prescription.
            </div>
          ) : (
            <div className="space-y-2.5">
              {currentPrescription.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-4 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-display font-bold text-xs shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-slate-900 text-sm tracking-tight">
                          {item.med.brand}
                        </span>
                        <span className="text-[11px] font-sans font-medium text-slate-500">
                          {item.med.generic}
                        </span>
                      </div>
                      <p className="text-xs font-sans text-blue-600 font-medium mt-0.5">
                        Instructions: {item.dosage || 'As advised'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 text-xs font-display font-semibold border border-slate-200/80">
                      Dispense: {item.qty} {item.med.unit}
                    </span>
                    <button
                      onClick={() => removeMedicineFromRx(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Complete & Print Action Button */}
      <button
        onClick={completeConsultation}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-display font-bold text-base shadow-xl shadow-emerald-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <FileCheck2 className="w-5 h-5 text-emerald-100" />
        <span>Complete Consultation & Generate Print Rx</span>
      </button>
    </div>
  );
}
