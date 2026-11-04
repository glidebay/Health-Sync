'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  UserCog,
  UsersRound,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Save,
  RotateCcw,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  Lock,
  Upload,
  Trash2,
  LogOut,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useClinic } from '@/context/ClinicContext';
import EcgActionLoader from '@/components/loading/EcgActionLoader';
import {
  AppConfig,
  DEFAULT_APP_CONFIG,
  SETTINGS_METADATA,
} from '@/data/default-config';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';
import { staggerContainer, fadeScale } from '@/lib/constants';
import { PrescriptionTemplateCalibrator } from '@/components/settings/PrescriptionTemplateCalibrator';

interface SettingsViewProps {
  isMobile?: boolean;
  onLogout?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

interface CategoryConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  isProvision?: boolean;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'Clinic Identity & Branding', label: 'Identity & Branding', icon: Building2 },
  { id: 'Doctor & Quota Controls', label: 'Doctor & Quotas', icon: UserCog },
  { id: 'Queue & Patient Logistics', label: 'Queue Logistics', icon: UsersRound },
  { id: 'WhatsApp & Communication Automation', label: 'WhatsApp & Comms', icon: MessageSquare },
  { id: 'Pharmacy & Inventory Safeguards', label: 'Pharmacy Safeguards', icon: ShieldCheck },
  { id: 'System, Security & Data Privacy', label: 'Security & Access', icon: ShieldAlert, isProvision: true },
];

interface CustomDropdownInputProps {
  value: unknown;
  options: (string | number)[];
  isNumeric: boolean;
  placeholder?: string;
  onChange: (value: string | number) => void;
}

function CustomDropdownInput({
  value,
  options,
  isNumeric,
  placeholder,
  onChange,
}: CustomDropdownInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (isNumeric) {
      const digitsOnly = raw.replace(/[^0-9]/g, '');
      onChange(digitsOnly === '' ? 0 : Number(digitsOnly));
    } else {
      onChange(raw);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isNumeric) {
      if (
        !/[0-9]/.test(e.key) &&
        !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'].includes(e.key) &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          inputMode={isNumeric ? 'numeric' : 'text'}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || 'Enter custom value or choose preset...'}
          className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-800 transition cursor-pointer"
          aria-label="Toggle options"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {isOpen && options && options.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-100 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1">
          {options.map((opt) => {
            const strOpt = String(opt);
            const isSelected = String(value) === strOpt;
            return (
              <button
                key={strOpt}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const parsed = isNumeric && !isNaN(Number(opt)) ? Number(opt) : opt;
                  onChange(parsed);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-blue-50 text-blue-600 font-bold'
                    : 'text-slate-800 hover:bg-slate-50 hover:text-blue-600'
                }`}
              >
                <span>{strOpt}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SettingsView({ isMobile = false, onLogout, searchQuery = '' }: SettingsViewProps) {
  const { config, updateAllConfigs, resetConfigToDefaults } = useClinic();

  const [edits, setEdits] = useState<Partial<AppConfig>>({});
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0].id);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const formData = useMemo(() => ({ ...config, ...edits }), [config, edits]);

  const changedKeys = useMemo(() => {
    return (Object.keys(edits) as (keyof AppConfig)[]).filter(
      (k) => edits[k] !== undefined && edits[k] !== config[k]
    );
  }, [edits, config]);

  const hasUnsavedChanges = changedKeys.length > 0;

  const activeControlsCount = useMemo(() => {
    return Object.values(formData).filter((v) => v === true).length;
  }, [formData]);

  const filteredParameters = useMemo(() => {
    return SETTINGS_METADATA.filter((meta) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        (meta.name || '').toLowerCase().includes(q) ||
        (meta.description || '').toLowerCase().includes(q) ||
        (meta.key || '').toLowerCase().includes(q) ||
        (meta.category || '').toLowerCase().includes(q);

      if (q !== '') {
        return matchesSearch;
      }
      return meta.category === activeCategory;
    });
  }, [activeCategory, searchQuery]);

  const handleFieldChange = (key: keyof AppConfig, value: unknown) => {
    setEdits((prev) => ({ ...prev, [key]: value as never }));
    setIsSaved(false);
  };

  const handleFileUpload = (key: keyof AppConfig, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleFieldChange(key, reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateAllConfigs(formData);
      setEdits({});
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setEdits({});
  };

  const handleResetDefaults = async () => {
    if (window.confirm('Revert all clinic settings to original factory defaults?')) {
      await resetConfigToDefaults();
      setEdits({});
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  return (
    <motion.div
      key="settings-catalog"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className={`space-y-6 ${isMobile ? 'pb-24' : 'pb-6'}`}
    >
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4"
      >
        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5 truncate">
              Parameters Configured
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight block">
                <AnimatedCounter target={SETTINGS_METADATA.length} />
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Active</span>
            </div>
            <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 mt-1">
              <span>Operational controls</span>
              <span className="text-slate-400 font-normal">in chamber</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-blue-600 to-indigo-500 shadow-md shadow-blue-500/25 flex items-center justify-center text-white flex-shrink-0">
            <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5 truncate">
              Safeguards &amp; Controls
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight block">
                <AnimatedCounter target={activeControlsCount} />
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Rules</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <span>Automations</span>
              <span className="text-slate-400 font-normal">enforced</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-emerald-600 to-teal-500 shadow-md shadow-emerald-500/25 flex items-center justify-center text-white flex-shrink-0">
            <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] sm:col-span-2 xl:col-span-1 flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5 truncate">
              Authorization Authority
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight block">
                Admin &amp; Doctor
              </span>
            </div>
            <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 mt-1">
              <span>Security</span>
              <span className="text-slate-400 font-normal">privileges locked</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/25 flex items-center justify-center text-white flex-shrink-0">
            <Lock className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>
      </motion.section>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight truncate">
              Clinic Settings &amp; Operational Controls
            </h2>
            {hasUnsavedChanges && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs whitespace-nowrap"
              >
                {changedKeys.length} unsaved
              </motion.span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure clinic profile, daily consultation rules, queue behavior, and automation settings
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-auto">
          {hasUnsavedChanges && (
            <motion.button
              whileHover={{ y: -2, boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)' }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDiscard}
              className="flex items-center space-x-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs flex-shrink-0 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="whitespace-nowrap">Discard</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ y: -2, boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/40 px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs flex-shrink-0 whitespace-nowrap"
            title="Reset to default settings"
          >
            <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Defaults</span>
          </motion.button>

          <motion.button
            whileHover={{ y: -2, boxShadow: hasUnsavedChanges ? '0 4px 14px 0 rgba(37,99,235,0.3)' : undefined }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={`flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs flex-shrink-0 whitespace-nowrap ${
              hasUnsavedChanges
                ? 'bg-[#2563EB] hover:bg-blue-700 text-white ring-2 ring-blue-500/30'
                : isSaved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <svg className="w-4 h-3 text-white overflow-visible flex-shrink-0 animate-ecg-glow" viewBox="0 0 160 80" fill="none">
                <path d="M10 40 H45 L55 22 L65 58 L75 10 L88 70 L98 32 L106 44 L114 40 H150" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className="animate-ecg-draw" />
              </svg>
            ) : isSaved ? (
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <Save className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span className="whitespace-nowrap">
              {isSaving ? 'Saving...' : isSaved ? 'Saved' : hasUnsavedChanges ? `Save Changes (${changedKeys.length})` : 'Save Changes'}
            </span>
          </motion.button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 p-1 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto scrollbar-none max-w-full">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`relative flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex-shrink-0 select-none ${
                isActive
                  ? 'text-white'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSettingsCategory"
                  className="absolute inset-0 bg-[#2563EB] rounded-xl shadow-xs"
                  transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                />
              )}
              <Icon className={`relative z-10 w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="relative z-10 whitespace-nowrap">{cat.label}</span>
            </button>
          );
        })}
      </div>

      <div className="relative min-h-[160px]">
        <EcgActionLoader isLoading={isSaving} text="Saving configuration..." />
        <AnimatePresence mode="popLayout">
          {filteredParameters.length === 0 ? (
            <motion.div
              key="empty-params"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)]"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3 shadow-2xs border border-blue-100/60">
                <Search className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No parameters found</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No clinic parameters configured in this category.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={activeCategory}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5"
            >
              {filteredParameters.map((meta) => {
                const val = formData[meta.key];
                const isDirty = formData[meta.key] !== config[meta.key];

                return (
                  <motion.div
                    key={meta.key}
                    variants={fadeScale}
                    layout
                    whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.06)' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    className={`bg-white rounded-2xl p-5 border shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col justify-between transition-colors ${
                      isDirty
                        ? 'border-blue-400 bg-blue-50/[0.04] ring-1 ring-blue-400/20'
                        : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h3 className="text-sm font-bold text-slate-800">{meta.name}</h3>
                            {isDirty && (
                              <motion.span
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-600 border border-blue-200/60 shadow-2xs"
                              >
                                Modified
                              </motion.span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {meta.description}
                          </p>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${
                            meta.paramType === 'Control Parameter'
                              ? 'bg-purple-50 text-purple-700 border border-purple-100'
                              : 'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}
                        >
                          {meta.paramType === 'Control Parameter' ? 'Control Rule' : 'Setting'}
                        </span>
                      </div>

                      <div className="mt-4 mb-2">
                        {meta.uiWidget === 'toggle' && (
                          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                            <span className="text-xs font-semibold text-slate-800">
                              {val ? 'Enabled' : 'Disabled'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleFieldChange(meta.key, !val)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer p-0.5 shadow-2xs ${
                                val ? 'bg-[#2563EB]' : 'bg-slate-300'
                              }`}
                            >
                              <motion.span
                                layout
                                transition={{ type: 'spring', damping: 25, stiffness: 500 }}
                                className={`block h-5 w-5 rounded-full bg-white shadow-xs ${
                                  val ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        )}

                        {meta.uiWidget === 'number' && (
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                type="button"
                                onClick={() => {
                                  const curr = Number(val) || 0;
                                  const min = meta.min ?? 0;
                                  if (curr > min) handleFieldChange(meta.key, curr - 1);
                                }}
                                className="px-3.5 py-2 hover:bg-slate-100 font-bold text-slate-600 transition cursor-pointer text-sm select-none"
                              >
                                -
                              </motion.button>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={val === undefined || val === null ? '' : String(val)}
                                onKeyDown={(e) => {
                                  if (
                                    !/[0-9]/.test(e.key) &&
                                    !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'].includes(e.key) &&
                                    !e.ctrlKey &&
                                    !e.metaKey
                                  ) {
                                    e.preventDefault();
                                  }
                                }}
                                onChange={(e) => {
                                  const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                                  const numVal = digitsOnly === '' ? (meta.min ?? 0) : Number(digitsOnly);
                                  const max = meta.max ?? 9999;
                                  handleFieldChange(meta.key, Math.min(max, numVal));
                                }}
                                className="w-16 text-center text-xs font-bold py-2 focus:outline-none text-slate-800"
                              />
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                type="button"
                                onClick={() => {
                                  const curr = Number(val) || 0;
                                  const max = meta.max ?? 9999;
                                  if (curr < max) handleFieldChange(meta.key, curr + 1);
                                }}
                                className="px-3.5 py-2 hover:bg-slate-100 font-bold text-slate-600 transition cursor-pointer text-sm select-none"
                              >
                                +
                              </motion.button>
                            </div>
                            {meta.min !== undefined && meta.max !== undefined && (
                              <span className="text-xs text-slate-400 font-medium">
                                Range: {meta.min} – {meta.max}
                              </span>
                            )}
                          </div>
                        )}

                        {meta.uiWidget === 'select' && (
                          <CustomDropdownInput
                            value={val}
                            options={meta.options || []}
                            isNumeric={typeof DEFAULT_APP_CONFIG[meta.key] === 'number'}
                            placeholder={`Enter custom value or choose preset...`}
                            onChange={(newVal) => handleFieldChange(meta.key, newVal)}
                          />
                        )}

                        {(meta.uiWidget === 'text' || meta.uiWidget === 'phone') && (
                          <input
                            type={meta.uiWidget === 'phone' ? 'tel' : 'text'}
                            value={String(val ?? '')}
                            onChange={(e) => handleFieldChange(meta.key, e.target.value)}
                            placeholder={`Enter ${meta.name}...`}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}

                        {meta.uiWidget === 'textarea' && (
                          <div className="space-y-1.5">
                            <textarea
                              rows={2}
                              value={String(val ?? '')}
                              onChange={(e) => handleFieldChange(meta.key, e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        {meta.uiWidget === 'file' && (
                          <div className="space-y-3">
                            <input
                              ref={(el) => {
                                fileInputRefs.current[meta.key] = el;
                              }}
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(meta.key, e)}
                              className="hidden"
                            />

                            {val ? (
                              <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                <div className="w-14 h-14 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center p-1 flex-shrink-0">
                                  <img
                                    src={String(val)}
                                    alt={meta.name}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-bold text-slate-800 block truncate">
                                    {meta.key === 'prescription_page_url'
                                      ? 'Prescription Page Uploaded'
                                      : 'Logo Uploaded'}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    {meta.key === 'prescription_page_url'
                                      ? 'Used on prescription print layout & letterhead'
                                      : 'Used on header & prescription prints'}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="button"
                                    onClick={() => fileInputRefs.current[meta.key]?.click()}
                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 transition cursor-pointer"
                                  >
                                    Change
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="button"
                                    onClick={() => handleFieldChange(meta.key, '')}
                                    className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                                    title="Remove logo"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </motion.button>
                                </div>
                              </div>
                            ) : (
                              <motion.div
                                whileHover={{ scale: 1.01 }}
                                onClick={() => fileInputRefs.current[meta.key]?.click()}
                                className="border-2 border-dashed border-slate-200 hover:border-blue-600 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/60 hover:bg-blue-50/20"
                              >
                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                                  <Upload className="w-4 h-4 stroke-[2]" />
                                </div>
                                <span className="text-xs font-bold text-slate-800 block">
                                  {meta.key === 'prescription_page_url'
                                    ? 'Choose Prescription Printed Page'
                                    : 'Choose Clinic Logo'}
                                </span>
                                <span className="text-[11px] text-slate-400 mt-0.5 block">
                                  {meta.key === 'prescription_page_url'
                                    ? 'PNG, JPG, SVG or WebP letterhead or prescription pad'
                                    : 'PNG, JPG, SVG or WebP from your device'}
                                </span>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {(activeCategory === 'Clinic Identity & Branding' ||
        ['prescription', 'template', 'rx', 'pad', 'letterhead'].some((k) =>
          searchQuery.toLowerCase().includes(k)
        )) && (
        <motion.div
          variants={fadeScale}
          initial="hidden"
          animate="visible"
          className="pt-2"
        >
          <PrescriptionTemplateCalibrator
            templateUrl={formData.rx_template_url || ''}
            enabled={Boolean(formData.rx_template_enabled)}
            printBg={formData.rx_template_print_bg !== false}
            fieldsJson={formData.rx_template_fields || ''}
            onUpdateTemplate={(url) => handleFieldChange('rx_template_url', url)}
            onUpdateEnabled={(en) => handleFieldChange('rx_template_enabled', en)}
            onUpdatePrintBg={(bg) => handleFieldChange('rx_template_print_bg', bg)}
            onUpdateFields={(json) => handleFieldChange('rx_template_fields', json)}
            onSaveImmediate={handleSave}
            isSaving={isSaving}
            isSaved={isSaved}
          />
        </motion.div>
      )}

      {onLogout && (
        <motion.div
          variants={fadeScale}
          initial="hidden"
          animate="visible"
          className="pt-6 border-t border-slate-100"
        >
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Clinic Session</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Sign out of current chamber device and return to gateway
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onLogout}
              className="w-full sm:w-auto py-2.5 px-5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100/70 text-red-600 font-semibold text-xs sm:text-sm transition cursor-pointer shadow-2xs flex items-center justify-center space-x-2 whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 stroke-[2]" />
              <span>Log Out</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default SettingsView;
