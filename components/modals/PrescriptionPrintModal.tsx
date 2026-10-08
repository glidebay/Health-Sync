'use client';

import React from 'react';
import { useClinic } from '@/context/ClinicContext';
import { CLINIC_CONFIG } from '@/data/initial-data';
import { Printer, X, CheckCircle, FileText } from 'lucide-react';

export default function PrescriptionPrintModal() {
  const {
    isPrintModalOpen,
    closePrintModal,
    activePrintRecord,
    switchTab
  } = useClinic();

  if (!isPrintModalOpen || !activePrintRecord) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDone = () => {
    closePrintModal();
    switchTab('queue');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col my-8 border border-slate-200/80">
        
        {/* Screen Toolbar (Hidden during print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-sky-400 shadow-2xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-white tracking-tight">Prescription Print Preview</h3>
              <p className="text-[11px] font-sans text-slate-400">Ready for clinical dispatch & pharmacy dispensing</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-display font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Rx Document</span>
            </button>
            <button
              onClick={handleDone}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Prescription Body */}
        <div id="print-portal" className="p-8 sm:p-10 bg-white text-slate-900 space-y-6">
          
          {/* Clinic Header / Letterhead */}
          <div className="flex justify-between items-start border-b-2 border-blue-700 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center font-black text-xs">
                  +
                </div>
                <h1 className="text-2xl font-black text-blue-900 tracking-tight">
                  {CLINIC_CONFIG.clinicName}
                </h1>
              </div>
              <p className="text-sm font-bold text-slate-800 mt-1">
                {CLINIC_CONFIG.doctorName}
              </p>
              <p className="text-xs text-slate-600">
                {CLINIC_CONFIG.specialty} • Reg: {CLINIC_CONFIG.registrationNo}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {CLINIC_CONFIG.address}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                {activePrintRecord.id}
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Date: <strong>{activePrintRecord.date}</strong>
              </p>
              <p className="text-[10px] text-slate-400 tracking-widest uppercase mt-0.5">
                {CLINIC_CONFIG.productLine}
              </p>
            </div>
          </div>

          {/* Patient Demographics Box */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Patient Name</span>
              <span className="font-extrabold text-slate-900 text-sm">{activePrintRecord.patientName}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Patient ID</span>
              <span className="font-bold text-slate-800">{activePrintRecord.patientId}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Age / Gender</span>
              <span className="font-bold text-slate-800">{activePrintRecord.patientAge} Yrs / {activePrintRecord.patientGender}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Doctor In-Charge</span>
              <span className="font-bold text-slate-800">{CLINIC_CONFIG.doctorName}</span>
            </div>
          </div>

          {/* Clinical Diagnostic Notes */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1 mb-2">
              Clinical Findings & Diagnostics
            </h3>
            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap bg-slate-50/50 p-3 rounded-lg border border-slate-100">
              {activePrintRecord.diagnostics}
            </p>
          </div>

          {/* Prescription (Rx) Section */}
          <div>
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1 mb-3">
              <span className="text-lg font-black text-slate-900 italic tracking-wider">℞ Medication Advice</span>
              <span className="text-[11px] text-slate-500 font-semibold">Pharmacy Dispense Order</span>
            </div>

            {activePrintRecord.prescription.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No systemic medication prescribed during this clinical review.
              </p>
            ) : (
              <div className="space-y-3">
                {activePrintRecord.prescription.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between py-2 border-b border-slate-100 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="font-bold text-blue-800 text-xs mt-0.5">
                        {idx + 1}.
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {item.med.brand}
                          </span>
                          <span className="text-[11px] text-slate-500 uppercase font-medium">
                            ({item.med.generic})
                          </span>
                        </div>
                        <p className="text-xs text-blue-700 font-semibold mt-0.5">
                          Directions: {item.dosage || 'Take as advised'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded-md">
                        Qty: {item.qty} {item.med.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Doctor's Signature Area */}
          <div className="pt-16 flex justify-between items-end">
            <div className="text-[10px] text-slate-400 space-y-0.5">
              <p>• Take medicines exactly as advised by the physician.</p>
              <p>• In case of unexpected allergy or symptoms, visit clinic immediately.</p>
              <p>• HealthSync CLMS digital signature certified.</p>
            </div>

            <div className="text-center">
              <div className="w-44 border-b border-slate-400 mb-1" />
              <p className="text-xs font-bold text-slate-800">{CLINIC_CONFIG.doctorName}</p>
              <p className="text-[10px] text-slate-500">{CLINIC_CONFIG.specialty}</p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Screen Footer */}
        <div className="no-print bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
          <span className="text-xs text-slate-500">
            Click <strong>Print Rx Document</strong> or press <strong>Ctrl+P</strong>
          </span>
          <button
            onClick={handleDone}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
          >
            Done & Return to Queue
          </button>
        </div>

      </div>
    </div>
  );
}
