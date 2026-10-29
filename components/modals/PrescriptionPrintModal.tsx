'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Printer,
  X,
  FileText,
  Sparkles,
  Layers,
  HeartPulse,
} from 'lucide-react';
import { PrescriptionItem } from '@/types';
import { useClinic } from '@/context/ClinicContext';
import {
  RxTemplateFields,
  DEFAULT_RX_TEMPLATE_FIELDS,
} from '@/data/default-config';

interface PrescriptionPrintRecord {
  date: string;
  patientName: string;
  patientPhone?: string;
  demographics: string;
  diagnostics: string;
  items: PrescriptionItem[];
  patientAge?: number | string;
  patientGender?: string;
  tokenNumber?: string | number;
}

interface PrescriptionPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  printRecord: PrescriptionPrintRecord | null;
  doctorProfile: { name: string; title: string };
}

export function PrescriptionPrintModal({
  isOpen,
  onClose,
  printRecord,
  doctorProfile,
}: PrescriptionPrintModalProps) {
  const { config } = useClinic();

  const hasCustomTemplate = Boolean(config?.rx_template_url && config?.rx_template_enabled);

  const [activeLayout, setActiveLayout] = useState<'custom' | 'standard'>(() =>
    hasCustomTemplate ? 'custom' : 'standard'
  );

  const [printBackground, setPrintBackground] = useState<boolean>(() =>
    config?.rx_template_print_bg !== false
  );

  const parsedFields: RxTemplateFields = useMemo(() => {
    try {
      if (config?.rx_template_fields) {
        return {
          ...DEFAULT_RX_TEMPLATE_FIELDS,
          ...JSON.parse(config.rx_template_fields),
        };
      }
    } catch {
      // fallback
    }
    return DEFAULT_RX_TEMPLATE_FIELDS;
  }, [config?.rx_template_fields]);

  // Derived patient demographics
  const ageDisplay = useMemo(() => {
    if (printRecord?.patientAge) return `${printRecord.patientAge} Yrs`;
    if (printRecord?.demographics) {
      const match = printRecord.demographics.match(/(\d+)\s*(?:Yrs|Years|y\/o)?/i);
      if (match) return `${match[1]} Yrs`;
    }
    return '';
  }, [printRecord]);

  const genderDisplay = useMemo(() => {
    if (printRecord?.patientGender) return printRecord.patientGender;
    if (printRecord?.demographics) {
      if (/Female/i.test(printRecord.demographics)) return 'Female';
      if (/Male/i.test(printRecord.demographics)) return 'Male';
      if (/Other/i.test(printRecord.demographics)) return 'Other';
    }
    return 'Male';
  }, [printRecord]);

  if (!isOpen || !printRecord) return null;

  return (
    <AnimatePresence>
      <div
        id="print-modal-backdrop"
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex flex-col overflow-y-auto p-2 sm:p-6"
      >
        <div className="max-w-4xl mx-auto w-full my-auto flex flex-col space-y-4">
          {/* Top Control Bar (Hidden on print) */}
          <div className="no-print bg-white rounded-2xl p-4 border border-[#ECEEF2] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              {hasCustomTemplate && (
                <div className="flex bg-[#F8F9FB] p-1 rounded-xl border border-[#ECEEF2]">
                  <button
                    type="button"
                    onClick={() => setActiveLayout('custom')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      activeLayout === 'custom'
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'text-[#5E6470] hover:text-[#16191E]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Clinic Pad Design</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLayout('standard')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      activeLayout === 'standard'
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'text-[#5E6470] hover:text-[#16191E]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Standard Slip</span>
                  </button>
                </div>
              )}

              {activeLayout === 'custom' && (
                <label className="flex items-center space-x-2 text-xs font-semibold text-[#16191E] cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    checked={printBackground}
                    onChange={(e) => setPrintBackground(e.target.checked)}
                    className="rounded border-[#ECEEF2] text-[#2563EB] focus:ring-[#2563EB] w-4 h-4 cursor-pointer"
                  />
                  <span>Print Template Background Image</span>
                </label>
              )}
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => window.print()}
                className="bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition cursor-pointer flex items-center space-x-2 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print Prescription</span>
              </motion.button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Prescription Body */}
          <div
            id="print-modal-content"
            className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
          >
            {activeLayout === 'custom' && config?.rx_template_url ? (
              /* Custom Prescription Pad Layout with Calibrated Coordinates */
              <div
                id="printable-prescription-pad"
                className="relative w-full aspect-[1/1.414] min-h-[680px] sm:min-h-[900px] overflow-hidden"
                style={{
                  backgroundImage: printBackground ? `url(${config.rx_template_url})` : 'none',
                  backgroundSize: '100% 100%',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                }}
              >
                {/* 1. Patient Name */}
                {parsedFields.patientName?.visible !== false && (
                  <div
                    style={{
                      left: `${parsedFields.patientName.x}%`,
                      top: `${parsedFields.patientName.y}%`,
                      fontSize: `${parsedFields.patientName.fontSize || 13}px`,
                      fontWeight: parsedFields.patientName.fontWeight || 'bold',
                      color: parsedFields.patientName.color || '#16191E',
                      textAlign: parsedFields.patientName.align || 'left',
                    }}
                    className="absolute z-10 font-sans tracking-tight"
                  >
                    {printRecord.patientName}
                  </div>
                )}

                {/* 2. Patient Age */}
                {parsedFields.patientAge?.visible !== false && (
                  <div
                    style={{
                      left: `${parsedFields.patientAge.x}%`,
                      top: `${parsedFields.patientAge.y}%`,
                      fontSize: `${parsedFields.patientAge.fontSize || 13}px`,
                      fontWeight: parsedFields.patientAge.fontWeight || 'bold',
                      color: parsedFields.patientAge.color || '#16191E',
                      textAlign: parsedFields.patientAge.align || 'left',
                    }}
                    className="absolute z-10 font-sans"
                  >
                    {ageDisplay}
                  </div>
                )}

                {/* 3. Patient Gender / Sex */}
                {parsedFields.patientGender?.visible !== false && (
                  <div
                    style={{
                      left: `${parsedFields.patientGender.x}%`,
                      top: `${parsedFields.patientGender.y}%`,
                      fontSize: `${parsedFields.patientGender.fontSize || 13}px`,
                      fontWeight: parsedFields.patientGender.fontWeight || 'bold',
                      color: parsedFields.patientGender.color || '#16191E',
                      textAlign: parsedFields.patientGender.align || 'left',
                    }}
                    className="absolute z-10 font-sans"
                  >
                    {genderDisplay === 'Male' ? 'Male [ ✓ ]' : genderDisplay === 'Female' ? 'Female [ ✓ ]' : genderDisplay}
                  </div>
                )}

                {/* 4. Phone Number */}
                {parsedFields.patientPhone?.visible !== false && printRecord.patientPhone && (
                  <div
                    style={{
                      left: `${parsedFields.patientPhone.x}%`,
                      top: `${parsedFields.patientPhone.y}%`,
                      fontSize: `${parsedFields.patientPhone.fontSize || 12}px`,
                      fontWeight: parsedFields.patientPhone.fontWeight || 'medium',
                      color: parsedFields.patientPhone.color || '#16191E',
                      textAlign: parsedFields.patientPhone.align || 'left',
                    }}
                    className="absolute z-10 font-sans"
                  >
                    {printRecord.patientPhone}
                  </div>
                )}

                {/* 5. Token Number */}
                {parsedFields.tokenNumber?.visible !== false && printRecord.tokenNumber && (
                  <div
                    style={{
                      left: `${parsedFields.tokenNumber.x}%`,
                      top: `${parsedFields.tokenNumber.y}%`,
                      fontSize: `${parsedFields.tokenNumber.fontSize || 12}px`,
                      fontWeight: parsedFields.tokenNumber.fontWeight || 'bold',
                      color: parsedFields.tokenNumber.color || '#2563EB',
                      textAlign: parsedFields.tokenNumber.align || 'right',
                    }}
                    className="absolute z-10 font-sans uppercase tracking-wider"
                  >
                    Token: {printRecord.tokenNumber}
                  </div>
                )}

                {/* 6. Clinical Diagnostics & Advice */}
                {parsedFields.diagnostics?.visible !== false && (
                  <div
                    style={{
                      left: `${parsedFields.diagnostics.x}%`,
                      top: `${parsedFields.diagnostics.y}%`,
                      width: `${parsedFields.diagnostics.width || 72}%`,
                      fontSize: `${parsedFields.diagnostics.fontSize || 12}px`,
                      fontWeight: parsedFields.diagnostics.fontWeight || 'normal',
                      color: parsedFields.diagnostics.color || '#16191E',
                      textAlign: parsedFields.diagnostics.align || 'left',
                    }}
                    className="absolute z-10 font-sans leading-relaxed"
                  >
                    {printRecord.diagnostics}
                  </div>
                )}

                {/* 7. Prescribed Medicines (Rx) */}
                {parsedFields.medications?.visible !== false && (
                  <div
                    style={{
                      left: `${parsedFields.medications.x}%`,
                      top: `${parsedFields.medications.y}%`,
                      width: `${parsedFields.medications.width || 72}%`,
                      fontSize: `${parsedFields.medications.fontSize || 12}px`,
                      fontWeight: parsedFields.medications.fontWeight || 'normal',
                      color: parsedFields.medications.color || '#16191E',
                      textAlign: parsedFields.medications.align || 'left',
                    }}
                    className="absolute z-10 font-sans space-y-2.5"
                  >
                    {printRecord.items && printRecord.items.length > 0 ? (
                      printRecord.items.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-baseline gap-2 pb-1.5 border-b border-gray-100/60"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold">
                              {idx + 1}. {p.med.brand}
                            </span>
                            <span className="text-[11px] text-[#5E6470] ml-1.5 uppercase">
                              ({p.med.generic})
                            </span>
                            {p.dosage && (
                              <span className="text-[11px] text-[#2563EB] font-medium block mt-0.5">
                                • {p.dosage}
                              </span>
                            )}
                            {p.instructions && (
                              <span className="text-[10px] text-gray-500 block italic">
                                {p.instructions}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-xs bg-gray-50/80 px-2 py-0.5 rounded border border-gray-100 flex-shrink-0">
                            Qty: {p.qty}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="italic text-xs text-gray-400">No medication prescribed during this visit.</p>
                    )}
                  </div>
                )}

                {/* 8. Consultation Date */}
                {parsedFields.consultationDate?.visible !== false && (
                  <div
                    style={{
                      left: `${parsedFields.consultationDate.x}%`,
                      top: `${parsedFields.consultationDate.y}%`,
                      width: parsedFields.consultationDate.width ? `${parsedFields.consultationDate.width}%` : 'auto',
                      fontSize: `${parsedFields.consultationDate.fontSize || 12}px`,
                      fontWeight: parsedFields.consultationDate.fontWeight || 'bold',
                      color: parsedFields.consultationDate.color || '#16191E',
                      textAlign: parsedFields.consultationDate.align || 'center',
                    }}
                    className="absolute z-10 font-sans"
                  >
                    {printRecord.date}
                  </div>
                )}

                {/* 9. Doctor's Signature */}
                {parsedFields.doctorSignature?.visible !== false && (
                  <div
                    style={{
                      left: `${parsedFields.doctorSignature.x}%`,
                      top: `${parsedFields.doctorSignature.y}%`,
                      width: parsedFields.doctorSignature.width ? `${parsedFields.doctorSignature.width}%` : 'auto',
                      fontSize: `${parsedFields.doctorSignature.fontSize || 12}px`,
                      fontWeight: parsedFields.doctorSignature.fontWeight || 'semibold',
                      color: parsedFields.doctorSignature.color || '#16191E',
                      textAlign: parsedFields.doctorSignature.align || 'center',
                    }}
                    className="absolute z-10 font-sans"
                  >
                    {doctorProfile.name}
                  </div>
                )}
              </div>
            ) : (
              /* Standard HealthSync Clinic Prescription Slip */
              <div className="p-6 sm:p-10 max-w-2xl mx-auto font-sans">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-[#16191E] pb-4 mb-6">
                  <div className="flex items-center space-x-3">
                    {config?.logo_url ? (
                      <div className="w-12 h-12 rounded-xl border border-[#ECEEF2] overflow-hidden flex items-center justify-center p-1 bg-white flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={config.logo_url}
                          alt={config.clinic_name || 'Clinic Logo'}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center flex-shrink-0">
                        <HeartPulse className="w-6 h-6 stroke-[2.2]" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-[#16191E]">
                        {config?.clinic_name || 'HealthSync Clinic'}
                      </h2>
                      <p className="text-xs text-[#5E6470] font-medium">
                        {doctorProfile.name} • {doctorProfile.title}
                      </p>
                      {config?.clinic_address && (
                        <p className="text-[10px] text-[#8A909D] mt-0.5">
                          {[config.clinic_address, config.clinic_phone].filter(Boolean).join(' • ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-xs text-[#8A909D]">
                    <p className="font-bold text-[#16191E]">{printRecord.date}</p>
                    {printRecord.tokenNumber && (
                      <p className="font-bold text-[#2563EB] mt-0.5">Token: {printRecord.tokenNumber}</p>
                    )}
                  </div>
                </div>

                {/* Patient Information */}
                <div className="mb-6 flex flex-col gap-1 text-sm border border-[#ECEEF2] p-4 rounded-xl bg-[#F8F9FB]">
                  <p>
                    <span className="font-bold text-[#16191E]">Patient:</span>
                    <span className="ml-2 font-semibold text-[#16191E]">{printRecord.patientName}</span>
                  </p>
                  <p>
                    <span className="font-bold text-[#16191E]">Demographics:</span>
                    <span className="ml-2 text-[#5E6470]">
                      {printRecord.demographics}{' '}
                      {printRecord.patientPhone ? `• Phone: ${printRecord.patientPhone}` : ''}
                    </span>
                  </p>
                </div>

                {/* Clinical Diagnostics */}
                <div className="mb-6">
                  <h3 className="font-bold text-[#16191E] border-b pb-1 mb-2 text-sm uppercase tracking-wider">
                    Clinical Diagnostics & Notes
                  </h3>
                  <p className="text-sm text-[#5E6470] leading-relaxed">{printRecord.diagnostics}</p>
                </div>

                {/* Prescriptions */}
                <div className="mb-8">
                  <h3 className="font-bold text-[#16191E] border-b pb-1 mb-3 text-sm uppercase tracking-wider">
                    Prescription (Rx)
                  </h3>
                  {printRecord.items && printRecord.items.length > 0 ? (
                    <ul className="space-y-3 text-sm text-[#16191E]">
                      {printRecord.items.map((p, idx) => (
                        <li
                          key={idx}
                          className="flex justify-between items-center border-b border-gray-100 pb-2 gap-2"
                        >
                          <div>
                            <span className="font-bold">{p.med.brand}</span>
                            <span className="text-xs text-[#8A909D] block uppercase">{p.med.generic}</span>
                            {p.dosage && (
                              <span className="text-xs text-[#2563EB] font-medium block mt-0.5">
                                Dosage: {p.dosage}
                              </span>
                            )}
                          </div>
                          <span className="font-bold bg-gray-100 px-3 py-1 rounded-lg flex-shrink-0 text-xs">
                            Dispense: {p.qty}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="italic text-xs text-[#8A909D]">No medication prescribed during this visit.</p>
                  )}
                </div>

                {/* Signature */}
                <div className="mt-12 sm:mt-16 text-right">
                  <div className="border-t border-gray-400 inline-block pt-2 pr-16 text-sm font-semibold">
                    <p>{doctorProfile.name}</p>
                    <p className="text-xs text-[#8A909D] font-normal">Authorized Medical Practitioner</p>
                  </div>
                </div>

                {/* Footer Notice */}
                {config?.rx_footer_text && (
                  <div className="mt-8 pt-4 border-t border-[#ECEEF2] text-center text-xs text-[#8A909D]">
                    {config.rx_footer_text}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}

export default PrescriptionPrintModal;
