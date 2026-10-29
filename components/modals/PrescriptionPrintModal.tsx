'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, FileText } from 'lucide-react';
import { PrescriptionItem } from '@/types';
import { useClinic } from '@/context/ClinicContext';

interface PrescriptionPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  printRecord: {
    date: string;
    patientName: string;
    patientPhone?: string;
    demographics: string;
    diagnostics: string;
    items: PrescriptionItem[];
  } | null;
  doctorProfile: { name: string; title: string };
}

export function PrescriptionPrintModal({
  isOpen,
  onClose,
  printRecord,
  doctorProfile,
}: PrescriptionPrintModalProps) {
  const { config } = useClinic();
  const [useLetterhead, setUseLetterhead] = useState(true);

  const clinicName = config?.clinic_name || 'HealthSync Clinic';
  const clinicPhone = config?.clinic_phone;
  const clinicAddress = config?.clinic_address;
  const logoUrl = config?.logo_url;
  const prescriptionPageUrl = config?.prescription_page_url;
  const footerText = config?.rx_footer_text || 'Get well soon! Contact clinic for emergencies.';

  const showLetterheadImage = Boolean(prescriptionPageUrl && useLetterhead);

  return (
    <AnimatePresence>
      {isOpen && printRecord && (
        <div
          id="print-modal"
          className="fixed inset-0 bg-white z-50 flex flex-col overflow-y-auto p-4 sm:p-8"
        >
          <div className="max-w-2xl mx-auto w-full my-auto">
            {showLetterheadImage ? (
              <div className="mb-6">
                <div className="rounded-xl overflow-hidden border border-[#ECEEF2] bg-white flex items-center justify-center max-h-44 shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={prescriptionPageUrl}
                    alt="Prescription Letterhead"
                    className="w-full h-auto max-h-44 object-contain"
                  />
                </div>
                <div className="flex justify-between items-center border-b border-[#ECEEF2] pb-3 pt-2 text-xs">
                  <div>
                    <span className="font-bold text-[#16191E]">{doctorProfile.name}</span>
                    <span className="text-[#5E6470] ml-1.5">• {doctorProfile.title}</span>
                  </div>
                  <div className="text-[#8A909D]">
                    <span>Date: {printRecord.date}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start border-b-2 border-[#16191E] pb-4 mb-6">
                <div className="flex items-center gap-3.5">
                  {logoUrl && (
                    <div className="w-14 h-14 rounded-xl border border-[#ECEEF2] bg-white overflow-hidden flex items-center justify-center p-1 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoUrl}
                        alt={clinicName}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#16191E]">{clinicName}</h2>
                    <p className="text-xs text-[#5E6470] font-medium">
                      {doctorProfile.name} • {doctorProfile.title}
                    </p>
                    {(clinicAddress || clinicPhone) && (
                      <p className="text-[11px] text-[#8A909D] mt-0.5">
                        {[clinicAddress, clinicPhone].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-[#8A909D]">
                  <p>{printRecord.date}</p>
                </div>
              </div>
            )}

            <div className="mb-6 flex flex-col gap-1 text-sm border border-[#ECEEF2] p-4 rounded-xl bg-[#F8F9FB]">
              <p>
                <span className="font-bold text-[#16191E]">Patient:</span>
                <span className="ml-2">{printRecord.patientName}</span>
              </p>
              <p>
                <span className="font-bold text-[#16191E]">Demographics:</span>
                <span className="ml-2">
                  {printRecord.demographics} {printRecord.patientPhone ? `• Phone: ${printRecord.patientPhone}` : ''}
                </span>
              </p>
            </div>

            <div className="mb-6">
              <h3 className="font-bold text-[#16191E] border-b pb-1 mb-2 text-sm">Clinical Diagnostics</h3>
              <p className="text-sm text-[#5E6470] leading-relaxed">{printRecord.diagnostics}</p>
            </div>

            <div className="mb-8">
              <h3 className="font-bold text-[#16191E] border-b pb-1 mb-3 text-sm">Prescription (Rx)</h3>
              {printRecord.items.length > 0 ? (
                <ul className="space-y-3 text-sm text-[#16191E]">
                  {printRecord.items.map((p) => (
                    <li key={p.med.id} className="flex justify-between items-center border-b border-gray-100 pb-2 gap-2">
                      <div>
                        <span className="font-bold">{p.med.brand}</span>
                        <span className="text-xs text-[#8A909D] block uppercase">{p.med.generic}</span>
                      </div>
                      <span className="font-bold bg-gray-100 px-3 py-1 rounded-lg flex-shrink-0">
                        Dispense: {p.qty}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="italic text-xs text-[#8A909D]">No medication prescribed during this visit.</p>
              )}
            </div>

            {footerText && (
              <div className="mt-8 pt-3 border-t border-gray-200 text-center text-xs text-[#5E6470] italic">
                {footerText}
              </div>
            )}

            <div className="mt-10 sm:mt-12 text-right">
              <p className="border-t border-gray-400 inline-block pt-2 pr-16 text-sm font-semibold">
                Doctor's Signature
              </p>
            </div>

            <div className="mt-8 sm:mt-10 flex flex-wrap gap-3 sm:gap-4 no-print justify-center items-center">
              {prescriptionPageUrl && (
                <button
                  type="button"
                  onClick={() => setUseLetterhead(!useLetterhead)}
                  className={`font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center space-x-1.5 border ${
                    useLetterhead
                      ? 'bg-blue-50 text-[#2563EB] border-blue-200'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  title={
                    useLetterhead
                      ? 'Disable letterhead to print on physical pre-printed stationery'
                      : 'Enable letterhead image for plain paper'
                  }
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{useLetterhead ? 'Letterhead: ON' : 'Letterhead: OFF'}</span>
                </button>
              )}

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => window.print()}
                className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs px-6 sm:px-8 py-2.5 rounded-xl transition cursor-pointer flex items-center space-x-2 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print Rx</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold text-xs px-6 sm:px-8 py-2.5 rounded-xl transition cursor-pointer"
              >
                Close
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default PrescriptionPrintModal;
