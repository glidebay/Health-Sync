'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, Phone, Trash2, Printer } from 'lucide-react';
import { Patient, InventoryItem, PrescriptionItem } from '@/types';
import { MedicineSearchCombobox } from '@/components/common/MedicineSearchCombobox';

interface ConsultationViewProps {
  activePatient: Patient | null;
  diagnosticNotes: string;
  setDiagnosticNotes: (v: string) => void;
  selectedMedId: string;
  setSelectedMedId: (v: string) => void;
  rxQty: string;
  setRxQty: (v: string) => void;
  inventory: InventoryItem[];
  currentPrescription: PrescriptionItem[];
  onAddMedicineToRx: () => void;
  onRemoveRx: (index: number) => void;
  onCompleteConsultation: () => void;
  onGoToQueue: () => void;
}

export function ConsultationView({
  activePatient,
  diagnosticNotes,
  setDiagnosticNotes,
  selectedMedId,
  setSelectedMedId,
  rxQty,
  setRxQty,
  inventory,
  currentPrescription,
  onAddMedicineToRx,
  onRemoveRx,
  onCompleteConsultation,
  onGoToQueue,
}: ConsultationViewProps) {
  const qtyInputRef = useRef<HTMLInputElement>(null);

  return (
    <motion.section
      key="consult"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 sm:space-y-6"
    >
      {!activePatient ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-[#ECEEF2] shadow-sm">
          <Stethoscope className="w-12 h-12 text-[#2563EB] opacity-40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#16191E]">No Active Patient Selected</h3>
          <p className="text-xs text-[#8A909D] max-w-sm mx-auto mt-1 mb-5">
            Select a patient from the Doctor Queue to open diagnostic notes & prescription builder
          </p>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onGoToQueue}
            className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer"
          >
            Go to Queue
          </motion.button>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-[#16191E]">{activePatient.name}</h2>
                <span className="text-xs text-[#8A909D] font-semibold">
                  ({activePatient.displayId || (activePatient.tokenNumber ? `P${String(activePatient.tokenNumber).padStart(3, '0')}` : 'P001')})
                </span>
              </div>
              <p className="text-xs text-[#8A909D] font-medium mt-0.5 flex items-center flex-wrap gap-1.5">
                <span>{activePatient.age} Yrs • {activePatient.gender}</span>
                {activePatient.phone && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-[#16191E]">
                      <Phone className="w-3 h-3 text-[#2563EB]" />
                      {activePatient.phone}
                    </span>
                  </>
                )}
                <span>• Slot: {activePatient.time}</span>
              </p>
            </div>
            <span className="text-xs font-bold bg-[#EBECEF] text-[#16191E] px-3.5 py-1.5 rounded-xl self-start sm:self-auto">
              Active Chamber
            </span>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm">
            <h3 className="text-sm font-bold text-[#16191E] mb-3">Clinical Diagnostic Notes</h3>
            <textarea
              rows={3}
              value={diagnosticNotes}
              onChange={(e) => setDiagnosticNotes(e.target.value)}
              placeholder="Record patient complaints, clinical findings, and diagnosis..."
              className="w-full p-3.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm outline-none focus:ring-1 focus:ring-gray-300 transition"
            />
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
              <h3 className="text-sm font-bold text-[#16191E]">
                Prescription Builder
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <MedicineSearchCombobox
                inventory={inventory}
                selectedMedId={selectedMedId}
                onSelectMedId={setSelectedMedId}
                onSelectAndFocusQty={() => qtyInputRef.current?.focus()}
              />

              <div className="flex gap-2">
                <input
                  ref={qtyInputRef}
                  type="number"
                  placeholder="Qty"
                  min="1"
                  value={rxQty}
                  onChange={(e) => setRxQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddMedicineToRx();
                    }
                  }}
                  className="w-24 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm outline-none focus:ring-1 focus:ring-gray-300"
                />

                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onAddMedicineToRx}
                  className="flex-1 sm:flex-initial bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                >
                  Add to Rx
                </motion.button>
              </div>
            </div>

            <div className="border border-[#ECEEF2] rounded-xl p-3 sm:p-4 bg-[#F8F9FB] min-h-[100px]">
              {currentPrescription.length === 0 ? (
                <p className="text-xs text-[#8A909D] italic text-center py-4">
                  No medicines prescribed yet. Search and select a medicine from above.
                </p>
              ) : (
                <div className="space-y-2">
                  {currentPrescription.map((item, idx) => (
                    <div
                      key={item.med.id}
                      className="bg-white p-3 rounded-xl border border-[#ECEEF2] flex justify-between items-center gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-sm text-[#16191E] block truncate">{item.med.brand}</span>
                        <span className="text-[10px] text-[#8A909D] block truncate">{item.med.generic}</span>
                      </div>
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                        <span className="text-xs font-bold bg-[#F4F5F7] px-2.5 py-1 rounded-lg">
                          Qty: {item.qty}
                        </span>
                        <button
                          onClick={() => onRemoveRx(idx)}
                          className="text-red-500 hover:text-red-700 cursor-pointer p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onCompleteConsultation}
              className="w-full mt-6 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Complete & Print Rx</span>
            </motion.button>
          </div>
        </div>
      )}
    </motion.section>
  );
}

export default ConsultationView;
