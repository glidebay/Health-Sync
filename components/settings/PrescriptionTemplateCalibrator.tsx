'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  RotateCcw,
  Move,
  Eye,
  EyeOff,
  Sliders,
  Trash2,
  FileImage,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Keyboard,
  Check,
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
    hint: 'Position beside "Name:" or patient header',
  },
  patientAge: {
    label: 'Patient Age',
    sample: '29 Yrs',
    hint: 'Position beside "Age:" field',
  },
  patientGender: {
    label: 'Gender / Sex',
    sample: 'Male [✓]',
    hint: 'Position beside "Sex:" or demographic box',
  },
  patientPhone: {
    label: 'Phone Number',
    sample: '+91 98765 43210',
    hint: 'Position for patient contact number',
  },
  tokenNumber: {
    label: 'Queue Token No',
    sample: 'Token: P001',
    hint: 'Position for consultation token ID',
  },
  consultationDate: {
    label: 'Consultation Date',
    sample: '29 Oct 2026',
    hint: 'Position above or beside "DATE" line',
  },
  diagnostics: {
    label: 'Diagnostics / Notes (Adv)',
    sample: 'Clinical examination normal. Advised rest & oral hydration.',
    hint: 'Position beside "Adv:" or clinical findings area',
  },
  medications: {
    label: 'Prescription (Rx Medicines)',
    sample: '1. Paracetamol 650mg — Qty: 10 (1-0-1 after meals)\n2. Cetirizine 10mg — Qty: 5 (0-0-1 at bedtime)\n3. Multivitamin Zinc — Qty: 15 (1-0-0 with breakfast)',
    hint: 'Position in the main body area for prescribed medicines & dosages',
  },
  doctorName: {
    label: 'Doctor Name',
    sample: 'Dr. Sunny, MBBS, MD',
    hint: 'Doctor name for signature block',
  },
  doctorSignature: {
    label: 'Doctor Signature',
    sample: 'Dr. Sunny (Authorized Signatory)',
    hint: 'Position above "SIGNATURE" line',
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

  // Arrow Keys Navigation to Nudge Active Field
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.2; // Shift gives larger steps, normal gives fine 0.2% steps
        const currentCoord = fields[activeField] || DEFAULT_RX_TEMPLATE_FIELDS[activeField];
        let newX = currentCoord.x;
        let newY = currentCoord.y;

        if (e.key === 'ArrowLeft') newX = Math.max(0, Math.min(95, newX - step));
        if (e.key === 'ArrowRight') newX = Math.max(0, Math.min(95, newX + step));
        if (e.key === 'ArrowUp') newY = Math.max(0, Math.min(95, newY - step));
        if (e.key === 'ArrowDown') newY = Math.max(0, Math.min(95, newY + step));

        updateSingleField(activeField, {
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeField, fields, updateSingleField]);

  // Nudge Helper Function
  const nudgeActiveField = (dx: number, dy: number) => {
    const currentCoord = fields[activeField] || DEFAULT_RX_TEMPLATE_FIELDS[activeField];
    const newX = Math.max(0, Math.min(95, currentCoord.x + dx));
    const newY = Math.max(0, Math.min(95, currentCoord.y + dy));
    updateSingleField(activeField, {
      x: Math.round(newX * 10) / 10,
      y: Math.round(newY * 10) / 10,
    });
  };

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

  const handleResetFields = () => {
    if (window.confirm('Reset all field positions to the default layout coordinates?')) {
      onUpdateFields(JSON.stringify(DEFAULT_RX_TEMPLATE_FIELDS));
    }
  };

  // Smooth Dragging with Cursor Offset to Prevent Jumping
  const handlePointerDown = (key: FieldKey, e: React.PointerEvent) => {
    e.stopPropagation();
    setActiveField(key);
    setDraggedField(key);
    setIsDragging(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentCoord = fields[key] || DEFAULT_RX_TEMPLATE_FIELDS[key];

    // Calculate current element position in pixels relative to canvas
    const initialElemLeftPx = (currentCoord.x / 100) * rect.width;
    const initialElemTopPx = (currentCoord.y / 100) * rect.height;

    // Offset of cursor relative to element's top-left corner
    const cursorOffsetX = e.clientX - (rect.left + initialElemLeftPx);
    const cursorOffsetY = e.clientY - (rect.top + initialElemTopPx);

    const onPointerMove = (moveEvt: PointerEvent) => {
      const newLeftPx = moveEvt.clientX - rect.left - cursorOffsetX;
      const newTopPx = moveEvt.clientY - rect.top - cursorOffsetY;

      const xPercent = Math.max(0, Math.min(95, (newLeftPx / rect.width) * 100));
      const yPercent = Math.max(0, Math.min(95, (newTopPx / rect.height) * 100));

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
      {/* Top Banner & Upload Controls */}
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
            Upload your clinic's custom prescription pad or letterhead image. Drag or use arrow keys to calibrate where
            patient details and prescribed medicines print on the page.
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
            className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{templateUrl ? 'Replace Pad Image' : 'Upload Prescription Pad'}</span>
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

      {/* Switches & Print Options */}
      {templateUrl && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-[#ECEEF2] shadow-xs">
            <div>
              <span className="text-xs font-bold text-[#16191E] block">Enable Custom Prescription Template</span>
              <span className="text-[11px] text-[#8A909D] block mt-0.5">
                Automatically formats all consultation prints onto this uploaded template
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
                  ? 'Prints background image (recommended for blank paper)'
                  : 'Transparent background (for physical pre-printed pad paper in printer)'}
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
                <span>Interactive Pad View</span>
                <span className="hidden sm:inline text-[10px] text-[#8A909D] font-normal">
                  (Drag markers or use Arrow keys ↑ ↓ ← → to position)
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetFields}
                className="text-[11px] font-semibold text-gray-500 hover:text-[#2563EB] flex items-center space-x-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Coordinates</span>
              </button>
            </div>

            {/* A4 Container (Aspect Ratio: 1 : 1.414) */}
            <div
              ref={canvasRef}
              className="relative w-full max-w-xl aspect-[1/1.414] bg-white rounded-2xl border-2 border-gray-300 shadow-xl overflow-hidden select-none"
            >
              {/* Background Image Element */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={templateUrl}
                alt="Prescription Template Background"
                className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
              />

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
                    className={`absolute cursor-move transition-all z-20 group p-1 rounded-md ${
                      isSelected
                        ? 'ring-2 ring-[#2563EB] bg-blue-500/15 shadow-md backdrop-blur-[1px]'
                        : 'hover:ring-1 hover:ring-blue-400 hover:bg-blue-50/20'
                    }`}
                  >
                    {/* Badge Pill for Field Identifier */}
                    <div
                      className={`absolute -top-3 left-0 px-1.5 py-0.2 rounded text-[8px] font-bold tracking-tight whitespace-nowrap shadow-xs pointer-events-none ${
                        isSelected
                          ? 'bg-[#2563EB] text-white ring-1 ring-white'
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

              {/* Help notification badge */}
              <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 text-white text-[10px] pointer-events-none flex items-center space-x-1 shadow-sm">
                <Keyboard className="w-3 h-3" />
                <span>Selected: {FIELD_LABELS[activeField].label} (Use Arrow Keys to Nudge)</span>
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
                <span className="text-[10px] text-[#2563EB] font-mono font-bold bg-blue-50 px-2 py-0.5 rounded-md">
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

              {/* Directional Nudge Pad (Arrow Keys) */}
              <div className="p-3 bg-[#F8F9FB] rounded-xl border border-[#ECEEF2] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#16191E]">
                  <span className="flex items-center space-x-1">
                    <Keyboard className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Nudge Position</span>
                  </span>
                  <span className="text-[9px] text-[#8A909D] font-normal">Use Arrow keys (↑ ↓ ← →) or Shift+Arrow</span>
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => nudgeActiveField(-0.5, 0)}
                    title="Nudge Left"
                    className="w-8 h-8 rounded-lg bg-white border border-[#ECEEF2] hover:bg-gray-100 flex items-center justify-center text-gray-700 transition cursor-pointer shadow-2xs font-bold"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => nudgeActiveField(0, -0.5)}
                      title="Nudge Up"
                      className="w-8 h-8 rounded-lg bg-white border border-[#ECEEF2] hover:bg-gray-100 flex items-center justify-center text-gray-700 transition cursor-pointer shadow-2xs font-bold"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeActiveField(0, 0.5)}
                      title="Nudge Down"
                      className="w-8 h-8 rounded-lg bg-white border border-[#ECEEF2] hover:bg-gray-100 flex items-center justify-center text-gray-700 transition cursor-pointer shadow-2xs font-bold"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => nudgeActiveField(0.5, 0)}
                    title="Nudge Right"
                    className="w-8 h-8 rounded-lg bg-white border border-[#ECEEF2] hover:bg-gray-100 flex items-center justify-center text-gray-700 transition cursor-pointer shadow-2xs font-bold"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Coordinates Sliders */}
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#16191E] mb-1">
                    <span>Horizontal Position (X)</span>
                    <span className="text-[#2563EB] font-mono">{activeCoord.x}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="95"
                    step="0.2"
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
                    step="0.2"
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
            will auto-fill each patient's details and medicines onto your custom design.
          </p>
          <div className="flex items-center justify-center">
            <button
              type="button"
              className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition shadow-xs flex items-center space-x-2 pointer-events-none"
            >
              <Upload className="w-4 h-4" />
              <span>Choose Image File</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PrescriptionTemplateCalibrator;
