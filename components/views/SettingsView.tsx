'use client';

import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
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
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useClinic } from '@/context/ClinicContext';
import {
  AppConfig,
  DEFAULT_APP_CONFIG,
  SETTINGS_METADATA,
} from '@/data/default-config';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';
import { staggerContainer, fadeScale } from '@/lib/constants';

interface SettingsViewProps {
  isMobile?: boolean;
  onLogout?: () => void;
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

export function SettingsView({ isMobile = false, onLogout }: SettingsViewProps) {
  const { config, updateAllConfigs, resetConfigToDefaults } = useClinic();
  
  // Track modified fields
  const [edits, setEdits] = useState<Partial<AppConfig>>({});
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0].id);
  const [searchFilter, setSearchFilter] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived effective configuration
  const formData = useMemo(() => ({ ...config, ...edits }), [config, edits]);

  // Compute changed keys
  const changedKeys = useMemo(() => {
    return (Object.keys(edits) as (keyof AppConfig)[]).filter(
      (k) => edits[k] !== undefined && edits[k] !== config[k]
    );
  }, [edits, config]);

  const hasUnsavedChanges = changedKeys.length > 0;

  // Active controls count (e.g. booleans currently enabled)
  const activeControlsCount = useMemo(() => {
    return Object.values(formData).filter((v) => v === true).length;
  }, [formData]);

  // Filtered parameters by active category or search query
  const filteredParameters = useMemo(() => {
    return SETTINGS_METADATA.filter((meta) => {
      const matchesSearch =
        searchFilter.trim() === '' ||
        meta.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        meta.description.toLowerCase().includes(searchFilter.toLowerCase());

      if (searchFilter.trim() !== '') {
        return matchesSearch;
      }
      return meta.category === activeCategory;
    });
  }, [activeCategory, searchFilter]);

  const handleFieldChange = (key: keyof AppConfig, value: unknown) => {
    setEdits((prev) => ({ ...prev, [key]: value as never }));
    setIsSaved(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleFieldChange('logo_url', reader.result);
      }
    };
    reader.readAsDataURL(file);
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className={`space-y-6 ${isMobile ? 'pb-24' : 'pb-6'}`}
    >
      {/* 1. TOP SUMMARY METRIC CARDS (Exact Dashboard Style) */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6"
      >
        <motion.div
          variants={fadeScale}
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] flex justify-between items-start shadow-sm cursor-default min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-xs sm:text-sm font-semibold text-[#16191E] block mb-2 sm:mb-4 truncate">
              Total Parameters Configured
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#16191E] tracking-tight block">
              <AnimatedCounter target={SETTINGS_METADATA.length} />
            </span>
            <span className="text-xs text-[#8A909D] font-medium tracking-wide mt-1 block">
              Parameters Active
            </span>
          </div>
          <motion.div
            whileHover={{ rotate: 12, scale: 1.1 }}
            className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-sm shadow-blue-500/20 flex-shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
          </motion.div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] flex justify-between items-start shadow-sm cursor-default min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-xs sm:text-sm font-semibold text-[#16191E] block mb-2 sm:mb-4 truncate">
              Active Controls & Safeguards
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#16191E] tracking-tight block">
              <AnimatedCounter target={activeControlsCount} />
            </span>
            <span className="text-xs text-[#8A909D] font-medium tracking-wide mt-1 block">
              Rules Enforced
            </span>
          </div>
          <motion.div
            whileHover={{ rotate: -12, scale: 1.1 }}
            className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-sm shadow-blue-500/20 flex-shrink-0"
          >
            <ShieldCheck className="w-4 h-4 stroke-[2]" />
          </motion.div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] sm:col-span-2 xl:col-span-1 flex justify-between items-start shadow-sm cursor-default min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-xs sm:text-sm font-semibold text-[#16191E] block mb-2 sm:mb-4 truncate">
              Authorization Authority
            </span>
            <span className="text-base sm:text-lg font-bold text-[#16191E] tracking-tight block mt-1">
              Admin & Doctor
            </span>
            <span className="text-xs text-[#8A909D] font-medium tracking-wide mt-1 block">
              Privileges Enforced
            </span>
          </div>
          <motion.div
            whileHover={{ rotate: 12, scale: 1.1 }}
            className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-sm shadow-blue-500/20 flex-shrink-0"
          >
            <Lock className="w-4 h-4 stroke-[2]" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* 2. SECTION HEADER & ACTION BUTTONS (Exact Dashboard Pattern) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-bold text-[#16191E] tracking-tight truncate">
            Clinic Settings & Operational Controls
          </h2>
          <p className="text-xs text-[#8A909D] font-medium">
            Configure clinic profile, daily consultation rules, queue behavior, and automation settings
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-auto">
          {hasUnsavedChanges && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleDiscard}
              className="flex items-center space-x-1.5 text-xs font-semibold bg-white border border-[#ECEEF2] text-[#5E6470] hover:text-[#16191E] hover:bg-gray-50 px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs flex-shrink-0 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="whitespace-nowrap">Discard</span>
            </motion.button>
          )}

          <button
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 text-xs font-semibold bg-white border border-[#ECEEF2] text-[#5E6470] hover:text-red-600 hover:border-red-200 hover:bg-red-50/40 px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs flex-shrink-0 whitespace-nowrap"
            title="Reset to default settings"
          >
            <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Defaults</span>
          </button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={`flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer shadow-sm flex-shrink-0 whitespace-nowrap ${
              hasUnsavedChanges
                ? 'bg-[#2563EB] hover:bg-blue-700 text-white'
                : isSaved
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
            ) : isSaved ? (
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <Save className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span className="whitespace-nowrap">{isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save Changes'}</span>
          </motion.button>
        </div>
      </div>

      {/* 3. SEARCH & CATEGORY PILLS BAR */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#2563EB]">
            <Search className="w-4 h-4 stroke-[2]" />
          </span>
          <input
            type="text"
            placeholder="Search parameter..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white border border-[#ECEEF2] rounded-xl text-xs placeholder-gray-400 text-gray-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        {/* Category Filter Pills (When not searching) */}
        {!searchFilter && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-1.5 scroll-smooth">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'bg-white border border-[#ECEEF2] text-[#5E6470] hover:text-[#16191E] hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#8A909D]'}`} />
                  <span className="whitespace-nowrap">{cat.label}</span>
                  {cat.isProvision && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                        isActive
                          ? 'bg-blue-400 text-white'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      Provision
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. PARAMETERS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {filteredParameters.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-[#ECEEF2] shadow-sm">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-2 stroke-[1.5]" />
            <p className="text-sm font-bold text-[#16191E]">No parameters found</p>
            <p className="text-xs text-[#8A909D] mt-1">Try searching for keywords like quota, pin, or whatsapp.</p>
          </div>
        ) : (
          filteredParameters.map((meta) => {
            const val = formData[meta.key];
            const isDirty = formData[meta.key] !== config[meta.key];

            return (
              <motion.div
                key={meta.key}
                whileHover={{ y: -2, boxShadow: '0 8px 24px -4px rgba(0,0,0,0.06)' }}
                transition={{ type: 'spring', damping: 20 }}
                className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition-colors ${
                  isDirty
                    ? 'border-blue-400 bg-blue-50/[0.03]'
                    : 'border-[#ECEEF2]'
                }`}
              >
                <div>
                  {/* Title & Badge */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h3 className="text-sm font-bold text-[#16191E]">{meta.name}</h3>
                        {isDirty && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#2563EB]">
                            Modified
                          </span>
                        )}
                        {meta.isProvision && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Planned Provision</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8A909D] leading-relaxed">
                        {meta.description}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${
                        meta.paramType === 'Control Parameter'
                          ? 'bg-purple-50 text-purple-700 border border-purple-100'
                          : 'bg-blue-50 text-[#2563EB] border border-blue-100'
                      }`}
                    >
                      {meta.paramType === 'Control Parameter' ? 'Control Rule' : 'Setting'}
                    </span>
                  </div>

                  {/* Widget Control */}
                  <div className="mt-4 mb-2">
                    {/* 1. Toggle Switch */}
                    {meta.uiWidget === 'toggle' && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F9FB] border border-[#ECEEF2]">
                        <span className="text-xs font-semibold text-[#16191E]">
                          {val ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleFieldChange(meta.key, !val)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                            val ? 'bg-[#2563EB]' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              val ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    {/* 2. Number Stepper */}
                    {meta.uiWidget === 'number' && (
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center border border-[#ECEEF2] rounded-xl overflow-hidden bg-white shadow-2xs">
                          <button
                            type="button"
                            onClick={() => {
                              const curr = Number(val) || 0;
                              const min = meta.min ?? 0;
                              if (curr > min) handleFieldChange(meta.key, curr - 1);
                            }}
                            className="px-3.5 py-2 hover:bg-gray-100 font-bold text-gray-600 transition cursor-pointer text-sm"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={Number(val)}
                            min={meta.min}
                            max={meta.max}
                            onChange={(e) => handleFieldChange(meta.key, Number(e.target.value))}
                            className="w-16 text-center text-xs font-bold py-2 focus:outline-none text-[#16191E]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const curr = Number(val) || 0;
                              const max = meta.max ?? 9999;
                              if (curr < max) handleFieldChange(meta.key, curr + 1);
                            }}
                            className="px-3.5 py-2 hover:bg-gray-100 font-bold text-gray-600 transition cursor-pointer text-sm"
                          >
                            +
                          </button>
                        </div>
                        {meta.min !== undefined && meta.max !== undefined && (
                          <span className="text-xs text-[#8A909D] font-medium">
                            Range: {meta.min} – {meta.max}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 3. Dropdown Select */}
                    {meta.uiWidget === 'select' && (
                      <select
                        value={String(val)}
                        onChange={(e) => {
                          const rawVal = e.target.value;
                          const parsed = typeof DEFAULT_APP_CONFIG[meta.key] === 'number' ? Number(rawVal) : rawVal;
                          handleFieldChange(meta.key, parsed);
                        }}
                        className="w-full px-3.5 py-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs font-semibold text-[#16191E] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                      >
                        {meta.options?.map((opt) => (
                          <option key={String(opt)} value={String(opt)}>
                            {String(opt)}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* 4. Text Input & Phone */}
                    {(meta.uiWidget === 'text' || meta.uiWidget === 'phone') && (
                      <input
                        type={meta.uiWidget === 'phone' ? 'tel' : 'text'}
                        value={String(val ?? '')}
                        onChange={(e) => handleFieldChange(meta.key, e.target.value)}
                        placeholder={`Enter ${meta.name}...`}
                        className="w-full px-3.5 py-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs font-medium text-[#16191E] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                      />
                    )}

                    {/* 5. Textarea */}
                    {meta.uiWidget === 'textarea' && (
                      <div className="space-y-1.5">
                        <textarea
                          rows={2}
                          value={String(val ?? '')}
                          onChange={(e) => handleFieldChange(meta.key, e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs font-medium text-[#16191E] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                        />

                      </div>
                    )}

                    {/* 6. Clean File Upload for Clinic Logo */}
                    {meta.uiWidget === 'file' && (
                      <div className="space-y-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />

                        {val ? (
                          <div className="flex items-center space-x-3 p-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl">
                            <div className="w-14 h-14 rounded-xl border border-[#ECEEF2] bg-white overflow-hidden flex items-center justify-center p-1 flex-shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={String(val)}
                                alt="Clinic Logo"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold text-[#16191E] block truncate">
                                Logo Uploaded
                              </span>
                              <span className="text-[11px] text-[#8A909D]">
                                Used on header & prescription prints
                              </span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3 py-1.5 bg-white border border-[#ECEEF2] hover:bg-gray-100 rounded-lg text-xs font-semibold text-[#16191E] transition cursor-pointer"
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFieldChange(meta.key, '')}
                                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                                title="Remove logo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-[#ECEEF2] hover:border-[#2563EB] rounded-xl p-4 text-center cursor-pointer transition-colors bg-[#F8F9FB] hover:bg-blue-50/20"
                          >
                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto mb-2">
                              <Upload className="w-4 h-4 stroke-[2]" />
                            </div>
                            <span className="text-xs font-bold text-[#16191E] block">
                              Choose Clinic Logo
                            </span>
                            <span className="text-[11px] text-[#8A909D] mt-0.5 block">
                              PNG, JPG, SVG or WebP from your device
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 5. LOGOUT SECTION AT BOTTOM OF SETTINGS */}
      {onLogout && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="pt-6 border-t border-[#ECEEF2]"
        >
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#16191E]">Clinic Session</h3>
              <p className="text-xs text-[#8A909D] font-medium mt-0.5">
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
