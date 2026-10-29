'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Printer,
  X,
  HeartPulse,
} from 'lucide-react';
import { PrescriptionItem } from '@/types';
import { useClinic } from '@/context/ClinicContext';
import {
  RxTemplateFields,
  DEFAULT_RX_TEMPLATE_FIELDS,
} from '@/data/default-config';
import { getAppConfigLocal } from '@/lib/supabaseService';

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

// Dedicated Isolated Iframe Print Function - 100% Reliable, Never Blank
function printIsolatedPrescription(params: {
  templateUrl: string;
  printBg: boolean;
  fields: RxTemplateFields;
  printRecord: PrescriptionPrintRecord;
  doctorProfile: { name: string; title: string };
  ageDisplay: string;
  genderDisplay: string;
}) {
  let iframe = document.getElementById('rx-isolated-print-frame') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'rx-isolated-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-99999';
    iframe.style.opacity = '0.001';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);
  }

  const itemsHtml = (params.printRecord.items || [])
    .map((p, idx) => {
      const cleanDosage = p.dosage ? p.dosage.replace(/^\+\s*/, '') : '';
      const sig = cleanDosage ? `<div style="font-size: 11px; color: #2563EB; font-weight: 600; padding-left: 12px; margin-top: 2px;">Sig: ${cleanDosage}</div>` : '';
      const inst = p.instructions ? `<div style="font-size: 10px; color: #666; font-style: italic; padding-left: 12px;">${p.instructions}</div>` : '';
      return `
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <div>
              <span style="font-weight: bold; color: #16191E;">${idx + 1}. ${p.med.brand}</span>
              <span style="font-size: 11px; color: #555; text-transform: uppercase; margin-left: 6px;">(${p.med.generic})</span>
            </div>
            <span style="font-weight: bold; font-size: 12px; color: #16191E; white-space: nowrap;">Qty: ${p.qty}</span>
          </div>
          ${sig}
          ${inst}
        </div>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Prescription - ${params.printRecord.patientName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
      background: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .page-container {
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: white;
    }
    .bg-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: fill;
      display: block;
      z-index: 0;
    }
    .field {
      position: absolute;
      z-index: 10;
    }
  </style>
</head>
<body>
  <div class="page-container">
    ${params.printBg && params.templateUrl ? `<img src="${params.templateUrl}" class="bg-image" />` : ''}
    
    ${params.fields.patientName?.visible !== false ? `
      <div class="field" style="left: ${params.fields.patientName.x}%; top: ${params.fields.patientName.y}%; font-size: ${params.fields.patientName.fontSize || 13}px; font-weight: ${params.fields.patientName.fontWeight || 'bold'}; color: ${params.fields.patientName.color || '#16191E'}; text-align: ${params.fields.patientName.align || 'left'};">
        ${params.printRecord.patientName}
      </div>
    ` : ''}

    ${params.fields.patientAge?.visible !== false ? `
      <div class="field" style="left: ${params.fields.patientAge.x}%; top: ${params.fields.patientAge.y}%; font-size: ${params.fields.patientAge.fontSize || 13}px; font-weight: ${params.fields.patientAge.fontWeight || 'bold'}; color: ${params.fields.patientAge.color || '#16191E'}; text-align: ${params.fields.patientAge.align || 'left'};">
        ${params.ageDisplay}
      </div>
    ` : ''}

    ${params.fields.patientGender?.visible !== false ? `
      <div class="field" style="left: ${params.fields.patientGender.x}%; top: ${params.fields.patientGender.y}%; font-size: ${params.fields.patientGender.fontSize || 13}px; font-weight: ${params.fields.patientGender.fontWeight || 'bold'}; color: ${params.fields.patientGender.color || '#16191E'}; text-align: ${params.fields.patientGender.align || 'left'};">
        ${params.genderDisplay === 'Male' ? 'Male [ ✓ ]' : params.genderDisplay === 'Female' ? 'Female [ ✓ ]' : params.genderDisplay}
      </div>
    ` : ''}

    ${params.fields.patientPhone?.visible !== false && params.printRecord.patientPhone ? `
      <div class="field" style="left: ${params.fields.patientPhone.x}%; top: ${params.fields.patientPhone.y}%; font-size: ${params.fields.patientPhone.fontSize || 12}px; font-weight: ${params.fields.patientPhone.fontWeight || 'medium'}; color: ${params.fields.patientPhone.color || '#16191E'}; text-align: ${params.fields.patientPhone.align || 'left'};">
        ${params.printRecord.patientPhone}
      </div>
    ` : ''}

    ${params.fields.tokenNumber?.visible !== false && params.printRecord.tokenNumber ? `
      <div class="field" style="left: ${params.fields.tokenNumber.x}%; top: ${params.fields.tokenNumber.y}%; font-size: ${params.fields.tokenNumber.fontSize || 12}px; font-weight: ${params.fields.tokenNumber.fontWeight || 'bold'}; color: ${params.fields.tokenNumber.color || '#2563EB'}; text-align: ${params.fields.tokenNumber.align || 'right'}; text-transform: uppercase;">
        Token: ${params.printRecord.tokenNumber}
      </div>
    ` : ''}

    ${params.fields.diagnostics?.visible !== false && params.printRecord.diagnostics ? `
      <div class="field" style="left: ${params.fields.diagnostics.x}%; top: ${params.fields.diagnostics.y}%; width: ${params.fields.diagnostics.width || 72}%; font-size: ${params.fields.diagnostics.fontSize || 12}px; font-weight: ${params.fields.diagnostics.fontWeight || 'normal'}; color: ${params.fields.diagnostics.color || '#16191E'}; text-align: ${params.fields.diagnostics.align || 'left'}; line-height: 1.5; word-break: break-word; white-space: pre-wrap;">
        ${params.printRecord.diagnostics}
      </div>
    ` : ''}

    ${params.fields.medications?.visible !== false ? `
      <div class="field" style="left: ${params.fields.medications.x}%; top: ${params.fields.medications.y}%; width: ${params.fields.medications.width || 72}%; font-size: ${params.fields.medications.fontSize || 12}px; font-weight: ${params.fields.medications.fontWeight || 'normal'}; color: ${params.fields.medications.color || '#16191E'}; text-align: ${params.fields.medications.align || 'left'};">
        ${itemsHtml || '<p style="font-style: italic; color: #888;">No medication prescribed during this visit.</p>'}
      </div>
    ` : ''}

    ${params.fields.consultationDate?.visible !== false ? `
      <div class="field" style="left: ${params.fields.consultationDate.x}%; top: ${params.fields.consultationDate.y}%; width: ${params.fields.consultationDate.width ? params.fields.consultationDate.width + '%' : 'auto'}; font-size: ${params.fields.consultationDate.fontSize || 12}px; font-weight: ${params.fields.consultationDate.fontWeight || 'bold'}; color: ${params.fields.consultationDate.color || '#16191E'}; text-align: ${params.fields.consultationDate.align || 'center'};">
        ${params.printRecord.date}
      </div>
    ` : ''}

    ${params.fields.doctorSignature?.visible !== false ? `
      <div class="field" style="left: ${params.fields.doctorSignature.x}%; top: ${params.fields.doctorSignature.y}%; width: ${params.fields.doctorSignature.width ? params.fields.doctorSignature.width + '%' : 'auto'}; font-size: ${params.fields.doctorSignature.fontSize || 12}px; font-weight: ${params.fields.doctorSignature.fontWeight || 'semibold'}; color: ${params.fields.doctorSignature.color || '#16191E'}; text-align: ${params.fields.doctorSignature.align || 'center'};">
        ${params.doctorProfile.name}
      </div>
    ` : ''}
  </div>
</body>
</html>`;

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const printWindow = iframe.contentWindow;
  if (printWindow) {
    const trigger = () => {
      printWindow.focus();
      printWindow.print();
    };

    const img = doc.querySelector('img');
    if (img && !img.complete) {
      img.onload = () => setTimeout(trigger, 80);
      img.onerror = () => trigger();
    } else {
      setTimeout(trigger, 120);
    }
  }
}

export function PrescriptionPrintModal({
  isOpen,
  onClose,
  printRecord,
  doctorProfile,
}: PrescriptionPrintModalProps) {
  const { config } = useClinic();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check local storage first for latest immediate calibrator edits
  const localConfig = useMemo(() => getAppConfigLocal(), [isOpen]);

  const activeTemplateUrl = config?.rx_template_url || localConfig?.rx_template_url || '';
  const hasCustomTemplate = Boolean(activeTemplateUrl);

  const [printBackground, setPrintBackground] = useState<boolean>(() =>
    config?.rx_template_print_bg !== false
  );

  const parsedFields: RxTemplateFields = useMemo(() => {
    try {
      const raw = localConfig?.rx_template_fields || config?.rx_template_fields;
      if (raw) {
        return {
          ...DEFAULT_RX_TEMPLATE_FIELDS,
          ...JSON.parse(raw),
        };
      }
    } catch {
      // fallback
    }
    return DEFAULT_RX_TEMPLATE_FIELDS;
  }, [config?.rx_template_fields, localConfig?.rx_template_fields]);

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

  const handlePrintClick = () => {
    window.print();
  };

  if (!isOpen || !printRecord || !mounted) return null;

  const modalContent = (
    <AnimatePresence>
      <div
        id="print-modal-backdrop"
        className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[999999] flex flex-col overflow-y-auto p-2 sm:p-6"
      >
        <div className="max-w-2xl mx-auto w-full my-auto flex flex-col space-y-4">
          {/* Top Control Bar (Hidden on print) */}
          <div className="no-print bg-white rounded-2xl p-4 border border-[#ECEEF2] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-[#16191E] flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {hasCustomTemplate
                    ? 'Prescription Ready to Print'
                    : 'Standard Consultation Slip'}
                </span>
              </span>

              {hasCustomTemplate && (
                <label className="flex items-center space-x-2 text-xs font-medium text-[#5E6470] hover:text-[#16191E] cursor-pointer ml-2 border-l border-gray-200 pl-3">
                  <input
                    type="checkbox"
                    checked={printBackground}
                    onChange={(e) => setPrintBackground(e.target.checked)}
                    className="rounded border-[#ECEEF2] text-[#2563EB] focus:ring-[#2563EB] w-4 h-4 cursor-pointer"
                  />
                  <span>Print Template Background</span>
                </label>
              )}
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handlePrintClick}
                className="bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer flex items-center space-x-2 shadow-sm"
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
            {hasCustomTemplate ? (
              /* Custom Prescription Pad Layout with Exact A4 Aspect Ratio (210 : 297) */
              <div
                id="printable-prescription-pad"
                className="relative w-full max-w-xl mx-auto aspect-[210/297] bg-white overflow-hidden select-none"
              >
                {/* Background Image rendered as <img> for 100% reliable physical print output */}
                {printBackground && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={activeTemplateUrl}
                    alt="Prescription Letterhead Background"
                    className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
                    style={{
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact',
                    }}
                  />
                )}

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
                    className="absolute z-10 font-sans leading-relaxed break-words whitespace-pre-wrap"
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
                    className="absolute z-10 font-sans space-y-2"
                  >
                    {printRecord.items && printRecord.items.length > 0 ? (
                      printRecord.items.map((p, idx) => (
                        <div key={idx} className="mb-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-[#16191E]">
                                {idx + 1}. {p.med.brand}
                              </span>
                              <span className="text-[11px] text-[#5E6470] ml-1.5 uppercase font-medium">
                                ({p.med.generic})
                              </span>
                            </div>
                            <span className="font-bold text-xs text-[#16191E] flex-shrink-0 whitespace-nowrap">
                              Qty: {p.qty}
                            </span>
                          </div>
                          {p.dosage && (
                            <div className="text-[11px] text-[#2563EB] font-semibold pl-3 mt-0.5">
                              Sig: {p.dosage.replace(/^\+\s*/, '')}
                            </div>
                          )}
                          {p.instructions && (
                            <div className="text-[10px] text-gray-500 italic pl-3">
                              {p.instructions}
                            </div>
                          )}
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

                {/* 9. Doctor Name */}
                {parsedFields.doctorName?.visible !== false && (
                  <div
                    style={{
                      left: `${parsedFields.doctorName.x}%`,
                      top: `${parsedFields.doctorName.y}%`,
                      width: parsedFields.doctorName.width ? `${parsedFields.doctorName.width}%` : 'auto',
                      fontSize: `${parsedFields.doctorName.fontSize || 12}px`,
                      fontWeight: parsedFields.doctorName.fontWeight || 'bold',
                      color: parsedFields.doctorName.color || '#16191E',
                      textAlign: parsedFields.doctorName.align || 'center',
                    }}
                    className="absolute z-10 font-sans leading-normal"
                  >
                    {doctorProfile.name}
                  </div>
                )}

                {/* 10. Doctor's Signature */}
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
                    className="absolute z-10 font-sans leading-normal"
                  >
                    {doctorProfile.name}
                  </div>
                )}
              </div>
            ) : (
              /* Standard HealthSync Clinic Prescription Slip (Only if no custom template has been uploaded yet) */
              <div id="printable-prescription-pad" className="p-6 sm:p-10 max-w-2xl mx-auto font-sans bg-white">
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

  return createPortal(modalContent, document.body);
}

export default PrescriptionPrintModal;
