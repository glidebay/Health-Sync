'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  RotateCcw,
  Printer,
  Sparkles,
  Move,
  Eye,
  EyeOff,
  Sliders,
  CheckCircle2,
  Trash2,
  FileImage,
  Info,
} from 'lucide-react';
import {
  RxTemplateFields,
  RxFieldCoord,
  DEFAULT_RX_TEMPLATE_FIELDS,
} from '@/data/default-config';

interface PrescriptionTemplateCalibratorProps {
  templateUrl: string;
  enabled: boolean;
  printBg: boolean;
  fieldsJson: string;
  onUpdateTemplate: (url: string) => void;
  onUpdateEnabled: (enabled: boolean) => void;
  onUpdatePrintBg: (printBg: boolean) => void;
  onUpdateFields: (fieldsJson: string) => void;
}

type FieldKey = keyof RxTemplateFields;

const FIELD_LABELS: Record<FieldKey, { label: string; sample: string; hint: string }> = {
  patientName: {
    label: 'Patient Name',
    sample: 'Praveen John',
    hint: 'Placed after "Name:" label',
  },
  patientAge: {
    label: 'Patient Age',
    sample: '29 Yrs',
    hint: 'Placed after "Age:" label',
  },
  patientGender: {
    label: 'Gender / Sex',
    sample: 'Male [✓]',
    hint: 'Checkmark or text for M / F',
  },
  patientPhone: {
    label: 'Phone / Contact',
    sample: '+91 98765 43210',
    hint: 'Contact number for pharmacy/OPD',
  },
  tokenNumber: {
    label: 'OPD Token No',
    sample: 'Token: P001',
    hint: 'Live queue token identifier',
  },
  consultationDate: {
    label: 'Consultation Date',
    sample: '29 Oct 2026',
    hint: 'Above the "DATE" line',
  },
  diagnostics: {
    label: 'Diagnosis / Advice (Adv)',
    sample: 'Mild gingival inflammation. Advised warm saline gargle & oral hygiene.',
    hint: 'Complaints, clinical findings or "Adv:" notes',
  },
  medications: {
    label: 'Prescription (Rx Medicines)',
    sample: '1. Amoxicillin 500mg — Qty: 15 (1-0-1 after food)\n2. Ibuprofen 400mg — Qty: 10 (1-0-1 SOS for pain)\n3. Chlorhexidine Mouthwash — Qty: 1 (10ml twice daily)',
    hint: 'Central body for prescribed medicine list & dosages',
  },
  doctorName: {
    label: 'Doctor Name',
    sample: 'Dr. Sunny, MBBS, MD',
    hint: 'Name above signature or header',
  },
  doctorSignature: {
    label: 'Doctor Signature',
    sample: 'Dr. Sunny (Authorized Signatory)',
    hint: 'Above the "SIGNATURE" line',
  },
};

export function PrescriptionTemplateCalibrator({
  templateUrl,
  enabled,
  printBg,
  fieldsJson,
  onUpdateTemplate,
  onUpdateEnabled,
  onUpdatePrintBg,
  onUpdateFields,
}: PrescriptionTemplateCalibratorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [activeField, setActiveField] = useState<FieldKey>('patientName');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedField, setDraggedField] = useState<FieldKey | null>(null);

  const fields: RxTemplateFields = useMemo(() => {
    try {
      if (fieldsJson) {
        const parsed = JSON.parse(fieldsJson);
        return { ...DEFAULT_RX_TEMPLATE_FIELDS, ...parsed };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_RX_TEMPLATE_FIELDS;
  }, [fieldsJson]);

  const updateSingleField = useCallback(
    (key: FieldKey, updates: Partial<RxFieldCoord>) => {
      const nextFields = {
        ...fields,
        [key]: {
          ...fields[key],
          ...updates,
        },
      };
      onUpdateFields(JSON.stringify(nextFields));
    },
    [fields, onUpdateFields]
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateTemplate(reader.result);
        onUpdateEnabled(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSample = () => {
    onUpdateTemplate('/images/sample-prescription-template.jpg');
    onUpdateEnabled(true);
    onUpdateFields(JSON.stringify(DEFAULT_RX_TEMPLATE_FIELDS));
  };

  const handleResetFields = () => {
    if (window.confirm('Reset all field positions to the standard prescription pad layout?')) {
      onUpdateFields(JSON.stringify(DEFAULT_RX_TEMPLATE_FIELDS));
    }
  };

  const handlePointerDown = (key: FieldKey, e: React.PointerEvent) => {
    e.stopPropagation();
    setActiveField(key);
    setDraggedField(key);
    setIsDragging(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    const onPointerMove = (moveEvt: PointerEvent) => {
      const xPercent = Math.max(0, Math.min(95, ((moveEvt.clientX - rect.left) / rect.width) * 100));
      const yPercent = Math.max(0, Math.min(95, ((moveEvt.clientY - rect.top) / rect.height) * 100));

      updateSingleField(key, {
        x: Math.round(xPercent * 10) / 10,
        y: Math.round(yPercent * 10) / 10,
      });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      setDraggedField(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const activeCoord = fields[activeField] || DEFAULT_RX_TEMPLATE_FIELDS[activeField];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h3 className="text-sm font-bold text-[#16191E]">Custom Prescription Pad / Letterhead Design</h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                enabled && templateUrl
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {enabled && templateUrl ? 'Active in Consultation' : 'Disabled'}
            </span>
          </div>
          <p className="text-xs text-[#8A909D] mt-1 max-w-xl">
            Upload any clinic letterhead or prescription pad design. Calibrate where patient name, age, phone, date,
            diagnostics, and prescribed medicines print on the page.
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload New Pad</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            className="px-3.5 py-2 bg-white border border-[#ECEEF2] hover:bg-blue-50/50 hover:border-blue-200 text-xs font-semibold text-[#16191E] rounded-xl flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
            title="Load sample Dental Clinic prescription pad design"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Load Dental Pad Sample</span>
          </button>

          {templateUrl && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Remove uploaded prescription pad template?')) {
                  onUpdateTemplate('');
                  onUpdateEnabled(false);
                }
              }}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
              title="Remove template"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Switches & Settings */}
      {templateUrl && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-[#ECEEF2] shadow-xs">
            <div>
              <span className="text-xs font-bold text-[#16191E] block">Enable Custom Prescription Template</span>
              <span className="text-[11px] text-[#8A909D] block mt-0.5">
                Automatically formats consultation prints onto this custom template
              </span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                enabled ? 'bg-[#2563EB]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-[#ECEEF2] shadow-xs">
            <div>
              <span className="text-xs font-bold text-[#16191E] block">Print Background Graphic</span>
              <span className="text-[11px] text-[#8A909D] block mt-0.5">
                {printBg
                  ? 'Printing graphic background (for blank paper)'
                  : 'Transparent background (for physical pre-printed pad stationery in printer)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onUpdatePrintBg(!printBg)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                printBg ? 'bg-[#2563EB]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  printBg ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Main Interactive Calibrator Workspace */}
      {templateUrl ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Canvas: A4 Visual Template Preview */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-2 mb-2 text-xs text-[#5E6470]">
              <div className="flex items-center space-x-1.5 font-bold text-[#16191E]">
                <Move className="w-4 h-4 text-[#2563EB]" />
                <span>Visual Interactive Calibrator</span>
                <span className="text-[10px] text-[#8A909D] font-normal">(Drag markers directly on pad to reposition)</span>
              </div>
              <button
                type="button"
                onClick={handleResetFields}
                className="text-[11px] font-semibold text-gray-500 hover:text-[#2563EB] flex items-center space-x-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Default</span>
              </button>
            </div>

            {/* A4 Container (Aspect Ratio: 1 : 1.414) */}
            <div
              ref={canvasRef}
              className="relative w-full max-w-xl aspect-[1/1.414] bg-white rounded-2xl border-2 border-gray-300 shadow-xl overflow-hidden select-none"
              style={{
                backgroundImage: `url(${templateUrl})`,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
              }}
            >
              {/* Overlay Fields */}
              {(Object.keys(fields) as FieldKey[]).map((key) => {
                const coord = fields[key];
                if (!coord || coord.visible === false) return null;

                const isSelected = activeField === key;
                const fieldInfo = FIELD_LABELS[key];

                return (
                  <div
                    key={key}
                    onPointerDown={(e) => handlePointerDown(key, e)}
                    style={{
                      left: `${coord.x}%`,
                      top: `${coord.y}%`,
                      width: coord.width ? `${coord.width}%` : 'max-content',
                      fontSize: `${coord.fontSize || 12}px`,
                      fontWeight: coord.fontWeight || 'normal',
                      textAlign: coord.align || 'left',
                      color: coord.color || '#16191E',
                    }}
                    className={`absolute cursor-move transition-shadow z-20 group p-1 rounded-md ${
                      isSelected
                        ? 'ring-2 ring-[#2563EB] bg-blue-500/10 shadow-lg'
                        : 'hover:ring-1 hover:ring-blue-300 hover:bg-blue-50/20'
                    }`}
                  >
                    {/* Badge Pill for Field Identifier */}
                    <div
                      className={`absolute -top-3 left-0 px-1.5 py-0.2 rounded text-[8px] font-bold tracking-tight whitespace-nowrap shadow-xs pointer-events-none ${
                        isSelected
                          ? 'bg-[#2563EB] text-white'
                          : 'bg-gray-800/80 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                      }`}
                    >
                      {fieldInfo.label}
                    </div>

                    {/* Live Sample Content */}
                    <div className="leading-snug whitespace-pre-line pointer-events-none font-sans">
                      {fieldInfo.sample}
                    </div>
                  </div>
                );
              })}

              {/* Watermark Helper notice */}
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[9px] pointer-events-none">
                Interactive A4 View
              </div>
            </div>
          </div>

          {/* Right Panel: Selected Field Fine-Tuning Controls */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#ECEEF2]">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-[#2563EB]" />
                  <h4 className="text-xs font-bold text-[#16191E]">Field Calibrator Controls</h4>
                </div>
                <span className="text-[10px] text-[#8A909D] font-mono font-semibold">
                  X: {activeCoord.x}% • Y: {activeCoord.y}%
                </span>
              </div>

              {/* Field Selector */}
              <div>
                <label className="text-[11px] font-bold text-[#16191E] block mb-1.5">Select Field to Adjust</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 bg-[#F8F9FB] rounded-xl border border-[#ECEEF2]">
                  {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => {
                    const isSelected = activeField === key;
                    const isVisible = fields[key]?.visible !== false;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveField(key)}
                        className={`text-left px-2.5 py-2 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#2563EB] text-white font-bold shadow-xs'
                            : 'bg-white hover:bg-gray-100 text-[#16191E] border border-gray-100'
                        }`}
                      >
                        <span className="truncate">{FIELD_LABELS[key].label}</span>
                        {!isVisible && <EyeOff className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#8A909D] mt-1.5 italic">
                  💡 {FIELD_LABELS[activeField].hint}
                </p>
              </div>

              {/* Coordinates Sliders */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#16191E] mb-1">
                    <span>Horizontal Position (X)</span>
                    <span className="text-[#2563EB] font-mono">{activeCoord.x}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="95"
                    step="0.5"
                    value={activeCoord.x}
                    onChange={(e) => updateSingleField(activeField, { x: parseFloat(e.target.value) })}
                    className="w-full accent-[#2563EB] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#16191E] mb-1">
                    <span>Vertical Position (Y)</span>
                    <span className="text-[#2563EB] font-mono">{activeCoord.y}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="95"
                    step="0.5"
                    value={activeCoord.y}
                    onChange={(e) => updateSingleField(activeField, { y: parseFloat(e.target.value) })}
                    className="w-full accent-[#2563EB] cursor-pointer"
                  />
                </div>

                {(activeField === 'medications' || activeField === 'diagnostics' || activeField === 'consultationDate' || activeField === 'doctorSignature') && (
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[#16191E] mb-1">
                      <span>Field Width (%)</span>
                      <span className="text-[#2563EB] font-mono">{activeCoord.width || 70}%</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="90"
                      step="1"
                      value={activeCoord.width || 70}
                      onChange={(e) => updateSingleField(activeField, { width: parseInt(e.target.value, 10) })}
                      className="w-full accent-[#2563EB] cursor-pointer"
                    />
                  </div>
                )}

                {/* Typography Controls */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-[#16191E] block mb-1">
                      Font Size ({activeCoord.fontSize || 12}px)
                    </label>
                    <input
                      type="range"
                      min="9"
                      max="20"
                      step="1"
                      value={activeCoord.fontSize || 12}
                      onChange={(e) => updateSingleField(activeField, { fontSize: parseInt(e.target.value, 10) })}
                      className="w-full accent-[#2563EB] cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#16191E] block mb-1">Font Weight</label>
                    <select
                      value={activeCoord.fontWeight || 'normal'}
                      onChange={(e) =>
                        updateSingleField(activeField, {
                          fontWeight: e.target.value as 'normal' | 'medium' | 'semibold' | 'bold',
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-lg text-xs font-semibold text-[#16191E]"
                    >
                      <option value="normal">Normal</option>
                      <option value="medium">Medium</option>
                      <option value="semibold">Semi-Bold</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-[#16191E] block mb-1">Text Alignment</label>
                    <div className="flex border border-[#ECEEF2] rounded-lg overflow-hidden bg-[#F8F9FB]">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => updateSingleField(activeField, { align })}
                          className={`flex-1 py-1 text-[10px] font-bold uppercase transition ${
                            (activeCoord.align || 'left') === align
                              ? 'bg-[#2563EB] text-white'
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#16191E] block mb-1">Visibility</label>
                    <button
                      type="button"
                      onClick={() => updateSingleField(activeField, { visible: activeCoord.visible === false ? true : false })}
                      className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 border transition ${
                        activeCoord.visible !== false
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}
                    >
                      {activeCoord.visible !== false ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Visible</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State / Initial Upload Prompt */
        <div
          onClick={() => fileInputRef.current?.click()}
          className="bg-white rounded-2xl p-10 sm:p-14 text-center border-2 border-dashed border-[#ECEEF2] hover:border-[#2563EB] transition-colors cursor-pointer shadow-sm group"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#2563EB] group-hover:scale-105 flex items-center justify-center mx-auto mb-4 transition-transform shadow-sm">
            <FileImage className="w-8 h-8 stroke-[1.8]" />
          </div>
          <h4 className="text-base font-bold text-[#16191E]">Upload Clinic Prescription Pad or Letterhead</h4>
          <p className="text-xs text-[#8A909D] max-w-md mx-auto mt-1 mb-5">
            Upload your clinic's designed prescription pad, letterhead, or stationery image (PNG, JPG). HealthSync
            will auto-fill each patient's details and medicines onto the page.
          </p>
          <div className="flex items-center justify-center space-x-3 flex-wrap gap-y-2">
            <button
              type="button"
              className="px-5 py-2.5 bg-[#2563EB] text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition shadow-xs flex items-center space-x-1.5 pointer-events-none"
            >
              <Upload className="w-4 h-4" />
              <span>Choose Image File</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadSample();
              }}
              className="px-5 py-2.5 bg-white border border-[#ECEEF2] hover:bg-blue-50/50 hover:border-blue-200 text-[#16191E] rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <span>Try Dental Clinic Pad Sample</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PrescriptionTemplateCalibrator;

