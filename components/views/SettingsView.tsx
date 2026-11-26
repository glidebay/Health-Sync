'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  FileText,
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
import { BranchLocationManager } from '@/components/settings/BranchLocationManager';
import { DbClinicLocation } from '@/types/database';
import {
  fetchUnifiedClinicSettings,
  saveUnifiedClinicSettings,
  resetBranchSettingsToDefaults,
} from '@/lib/clinicSettingsService';

interface SettingsViewProps {
  isMobile?: boolean;
  onLogout?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  currentLocation?: DbClinicLocation | null;
  onSelectLocation?: (loc: DbClinicLocation) => void;
  clinicId?: string;
  adminPin?: string;
  clinicLocations?: DbClinicLocation[];
  onRefreshLocations?: () => Promise<void>;
  isAdmin?: boolean;
}

interface CategoryConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  isProvision?: boolean;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'Clinic Identity & Branding', label: 'Identity & Branding', icon: Building2 },
  { id: 'Custom Prescription', label: 'Custom Prescription', icon: FileText },
  { id: 'Multi-Branch & Locations', label: 'Branches & Locations', icon: MapPin },
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
                className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition cursor-pointer flex items-center justify-between ${isSelected
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

export function SettingsView({
  isMobile = false,
  onLogout,
  searchQuery = '',
  currentLocation,
  onSelectLocation,
  clinicId,
  adminPin,
  clinicLocations = [],
  onRefreshLocations,
  isAdmin = true,
}: SettingsViewProps) {
  const { config, updateAllConfigs, refreshConfig, resetConfigToDefaults } = useClinic();

  const effectiveClinicId = currentLocation?.clinic_id || clinicId || '';
  const effectiveLocationId = currentLocation?.id || '';

  const [baseClinicConfig, setBaseClinicConfig] = useState<Partial<AppConfig>>({});
  const [edits, setEdits] = useState<Partial<AppConfig>>({});
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0].id);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isMultiBranch = Boolean(clinicLocations && clinicLocations.length > 1);

  const availableCategories = useMemo(() => {
    if (!isAdmin) {
      return CATEGORIES.filter((c) => c.id !== 'Multi-Branch & Locations');
    }
    return CATEGORIES;
  }, [isAdmin]);

  // Fetch unified branch & clinic settings from Supabase on mount / branch switch
  useEffect(() => {
    if (effectiveClinicId) {
      setEdits({});
      fetchUnifiedClinicSettings(effectiveClinicId, effectiveLocationId, adminPin).then((res) => {
        if (res.success && res.settings) {
          const s = res.settings;
          const isSingle = !clinicLocations || clinicLocations.length <= 1;
          const patch: Partial<AppConfig> = {
            clinic_name: s.clinic_name || '',
            clinic_phone: s.clinic_phone || '',
            clinic_address: s.clinic_address || '',
            logo_url: s.clinic_logo_url || '',
            branch_name: s.branch_name || '',
            branch_phone: s.branch_phone || (isSingle ? s.clinic_phone : '') || '',
            branch_address: s.branch_address || (isSingle ? s.clinic_address : '') || '',
            branch_landmark: s.branch_landmark || '',
            branch_logo_url: s.branch_logo_url || '',
            daily_quota: s.daily_quota ?? 40,
            slot_duration_mins: s.slot_duration_mins ?? 15,
            rx_template_url: s.pad_template_url || '',
            rx_template_enabled: Boolean(s.is_custom_pad_active),
            rx_template_print_bg: s.print_bg_graphic !== false,
            rx_footer_text: s.rx_footer_text || '',
          };
          if (s.rx_calibrations) {
            patch.rx_template_fields =
              typeof s.rx_calibrations === 'string'
                ? s.rx_calibrations
                : JSON.stringify(s.rx_calibrations);
          }
          setBaseClinicConfig(patch);
        }
      });
    }
  }, [effectiveClinicId, effectiveLocationId, adminPin, clinicLocations]);

  const menuScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (menuScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = menuScrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  const scrollMenu = (direction: 'left' | 'right') => {
    if (menuScrollRef.current) {
      menuScrollRef.current.scrollBy({
        left: direction === 'left' ? -220 : 220,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 300);
    }
  };

  const formData = useMemo(() => ({
    ...config,
    ...baseClinicConfig,
    ...edits,
  }), [config, baseClinicConfig, edits]);

  const changedKeys = useMemo(() => {
    return (Object.keys(edits) as (keyof AppConfig)[]).filter(
      (k) => edits[k] !== undefined && edits[k] !== (baseClinicConfig[k] ?? config[k])
    );
  }, [edits, baseClinicConfig, config]);

  const hasUnsavedChanges = changedKeys.length > 0;

  const filteredParameters = useMemo(() => {
    return SETTINGS_METADATA.filter((meta) => {
      if (!isAdmin) {
        // Branch-side users manage their own branch identity (name, logo, phone, address, landmark), not clinic-wide master identity
        if (['clinic_name', 'clinic_phone', 'clinic_address', 'logo_url'].includes(meta.key)) {
          return false;
        }
      } else if (!isMultiBranch) {
        // If single clinic (no multiple branches), hide duplicate branch-specific fields
        if (['branch_name', 'branch_phone', 'branch_address', 'branch_landmark', 'branch_logo_url'].includes(meta.key)) {
          return false;
        }
      } else {
        // If multi-branch Clinic Admin:
        // Hide clinic_phone and clinic_address in Identity & Branding because each branch has its own dedicated phone & address
        if (['clinic_phone', 'clinic_address'].includes(meta.key)) {
          return false;
        }
      }

      return meta.category === activeCategory;
    }).map((meta) => {
      // Contextual labels & descriptions for multi-branch vs single clinic
      if (isMultiBranch || !isAdmin) {
        const branchTitle = currentLocation?.branch_name || 'Active Branch';
        if (meta.key === 'clinic_name') {
          return {
            ...meta,
            name: 'Clinic Master Brand Name',
            description: 'Official master organization name across all hospital/clinic branches.',
          };
        }
        if (meta.key === 'logo_url') {
          return {
            ...meta,
            name: 'Clinic Master Logo Asset',
            description: 'Official branding logo displayed on headers and prescription prints across all branches.',
          };
        }
        if (meta.key === 'branch_logo_url') {
          return {
            ...meta,
            name: `Branch Logo (${branchTitle})`,
            description: `Dedicated logo image for ${branchTitle} displayed on branch headers, tokens, and prescriptions.`,
          };
        }
        if (meta.key === 'branch_phone') {
          return {
            ...meta,
            name: `WhatsApp & Contact Phone (${branchTitle})`,
            description: `Dedicated WhatsApp booking line and phone number for ${branchTitle}. Automated WhatsApp notifications and booking confirmations from this branch will use this number.`,
          };
        }
        if (meta.key === 'branch_address') {
          return {
            ...meta,
            name: `Physical Address (${branchTitle})`,
            description: `Physical clinic location address for ${branchTitle} printed on prescription headers and patient receipts.`,
          };
        }
        if (meta.key === 'daily_quota') {
          return {
            ...meta,
            name: `Daily Consultation Quota (${branchTitle})`,
            description: `Maximum daily consultation quota specifically for ${branchTitle}.`,
          };
        }
        if (meta.key === 'slot_duration_mins') {
          return {
            ...meta,
            name: `Slot Duration (${branchTitle})`,
            description: `Consultation slot duration for queue scheduling at ${branchTitle}.`,
          };
        }
      } else {
        if (meta.key === 'clinic_name') {
          return {
            ...meta,
            name: 'Clinic Name',
            description: 'Official display name of the medical clinic for header banners and receipts.',
          };
        }
        if (meta.key === 'clinic_phone') {
          return {
            ...meta,
            name: 'Clinic Phone / WhatsApp Contact',
            description: 'Primary contact phone and WhatsApp number displayed on patient receipts and communications.',
          };
        }
        if (meta.key === 'clinic_address') {
          return {
            ...meta,
            name: 'Clinic Address',
            description: 'Physical address printed on official prescription headers and patient receipts.',
          };
        }
      }
      return meta;
    });
  }, [activeCategory, isMultiBranch, isAdmin, currentLocation]);

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
      if (effectiveClinicId) {
        const isSingle = !clinicLocations || clinicLocations.length <= 1;
        const branchPhoneToSave = isSingle
          ? (formData.clinic_phone || formData.branch_phone)
          : formData.branch_phone;
        const branchAddressToSave = isSingle
          ? (formData.clinic_address || formData.branch_address)
          : formData.branch_address;

        const clinicPhoneToSave = isSingle
          ? (formData.clinic_phone || branchPhoneToSave)
          : formData.clinic_phone;
        const clinicAddressToSave = isSingle
          ? (formData.clinic_address || branchAddressToSave)
          : formData.clinic_address;

        // Enable custom pad automatically if user uploaded a template and saved inside Custom Prescription
        const customPadActiveToSave =
          activeCategory === 'Custom Prescription' && formData.rx_template_url && edits.rx_template_enabled === undefined
            ? true
            : Boolean(formData.rx_template_enabled);

        await saveUnifiedClinicSettings({
          clinic_id: effectiveClinicId,
          location_id: effectiveLocationId,
          admin_pin: adminPin,
          clinic_name: formData.clinic_name,
          clinic_phone: clinicPhoneToSave,
          clinic_address: clinicAddressToSave,
          clinic_logo_url: formData.logo_url,
          branch_name: formData.branch_name,
          branch_phone: branchPhoneToSave,
          branch_address: branchAddressToSave,
          branch_landmark: formData.branch_landmark,
          branch_logo_url: (isAdmin && isSingle) ? (formData.logo_url || formData.branch_logo_url) : formData.branch_logo_url,
          daily_quota: formData.daily_quota,
          slot_duration_mins: formData.slot_duration_mins,
          allow_quota_override: formData.allow_quota_override,
          auto_move_unattended: formData.auto_move_unattended,
          require_doctor_pin_for_rx: formData.require_doctor_pin,
          pin_autolock_minutes: parseInt(formData.pin_lock_timeout_mins, 10) || 10,
          whatsapp_enabled: formData.enable_whatsapp_autoresponder,
          pharmacy_realtime_stock: formData.auto_deduct_inventory,
          pharmacy_generic_alerts: true,
          pharmacy_expiry_threshold_days: formData.default_reorder_threshold,
          pad_template_url: formData.rx_template_url,
          rx_calibrations: formData.rx_template_fields,
          print_bg_graphic: formData.rx_template_print_bg,
          is_custom_pad_active: customPadActiveToSave,
          rx_footer_text: formData.rx_footer_text,
        });

        // Sync full Rx template + calibration state with AppConfig in ClinicContext
        await updateAllConfigs({
          ...edits,
          rx_template_url: formData.rx_template_url,
          rx_template_fields: formData.rx_template_fields,
          rx_template_print_bg: formData.rx_template_print_bg,
          rx_template_enabled: customPadActiveToSave,
          rx_footer_text: formData.rx_footer_text,
          branch_phone: branchPhoneToSave,
          branch_address: branchAddressToSave,
        });

        // Refresh branch config + parent locations from Supabase
        await Promise.all([
          refreshConfig(effectiveClinicId, effectiveLocationId),
          onRefreshLocations?.(),
        ]);
      }
      setBaseClinicConfig((prev) => ({ ...prev, ...edits }));
      setEdits({});
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save unified clinic settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setEdits({});
  };

  const handleResetDefaults = async () => {
    if (window.confirm('Revert all clinic settings to original factory defaults?')) {
      if (effectiveClinicId && effectiveLocationId) {
        await resetBranchSettingsToDefaults(effectiveClinicId, effectiveLocationId, adminPin);
      }
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
      <EcgActionLoader isLoading={isSaving} text="Saving configuration..." />

      <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-8 shadow-2xs flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
            Clinic Configuration • {activeCategory}
          </span>
          <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-semibold text-[#16191E] truncate">
              Clinic Settings &amp; Operational Controls
            </h2>
            {hasUnsavedChanges && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80 whitespace-nowrap"
              >
                {changedKeys.length} unsaved
              </motion.span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure clinic profile, custom prescription layout, branch locations, and automation rules.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0 self-start lg:self-auto flex-wrap">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleDiscard}
              className="flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-full transition cursor-pointer flex-shrink-0 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="whitespace-nowrap">Discard</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 px-4 py-2 rounded-full transition cursor-pointer flex-shrink-0 whitespace-nowrap"
            title="Reset to default settings"
          >
            <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={`flex items-center gap-1.5 text-xs font-medium px-5 py-2 rounded-full transition cursor-pointer flex-shrink-0 whitespace-nowrap ${hasUnsavedChanges
                ? 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-2xs'
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
          </button>
        </div>
      </div>

      <div className="relative w-full">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollMenu('left')}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white/95 shadow-md border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-600 cursor-pointer"
            aria-label="Scroll menu left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollMenu('right')}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white/95 shadow-md border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-600 cursor-pointer"
            aria-label="Scroll menu right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        <div
          ref={menuScrollRef}
          onScroll={checkScroll}
          onWheel={(e) => {
            if (e.deltaY !== 0 && menuScrollRef.current) {
              menuScrollRef.current.scrollLeft += e.deltaY;
              checkScroll();
            }
          }}
          className="flex items-center gap-1.5 p-1 bg-white/90 backdrop-blur-md rounded-xl border border-[#ECEEF2] shadow-2xs overflow-x-auto scroll-smooth w-full select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {availableCategories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={(e) => {
                  setActiveCategory(cat.id);
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }}
                className={`relative flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer flex-shrink-0 select-none ${
                  isActive
                    ? 'bg-[#2563EB] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className={`relative z-10 w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="relative z-10 whitespace-nowrap">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredParameters.length > 0 ? (
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5"
            >
              {filteredParameters.map((meta, index) => {
                const val = formData[meta.key];
                const cardNumber = String(index + 1).padStart(2, '0');

                return (
                  <div
                    key={meta.key}
                    className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between gap-4 transition-colors hover:border-slate-300"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[11px] font-medium text-slate-400 tabular-nums block mb-0.5">
                            {cardNumber}
                          </span>
                          <h3 className="text-sm sm:text-base font-medium text-[#16191E]">
                            {meta.name}
                          </h3>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap border flex-shrink-0 ${
                            meta.paramType === 'Control Parameter'
                              ? 'bg-slate-50 text-slate-700 border-slate-200'
                              : 'bg-blue-50/70 text-blue-700 border-blue-200/60'
                          }`}
                        >
                          {meta.paramType === 'Control Parameter' ? 'Control Rule' : 'Setting'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {meta.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 min-w-0">
                        {meta.uiWidget === 'toggle' && (
                          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                            <span className="text-xs font-medium text-slate-700">
                              {val ? 'Enabled' : 'Disabled'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleFieldChange(meta.key, !val)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer p-0.5 shadow-2xs ${
                                val ? 'bg-[#2563EB]' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`block h-5 w-5 rounded-full bg-white shadow-xs transition-transform duration-200 ease-out ${
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
                                className="px-3.5 py-2 hover:bg-slate-100 font-semibold text-slate-600 transition cursor-pointer text-sm select-none"
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
                                className="w-16 text-center text-xs font-semibold py-2 focus:outline-none text-slate-800"
                              />
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                type="button"
                                onClick={() => {
                                  const curr = Number(val) || 0;
                                  const max = meta.max ?? 9999;
                                  if (curr < max) handleFieldChange(meta.key, curr + 1);
                                }}
                                className="px-3.5 py-2 hover:bg-slate-100 font-semibold text-slate-600 transition cursor-pointer text-sm select-none"
                              >
                                +
                              </motion.button>
                            </div>
                            {meta.min !== undefined && meta.max !== undefined && (
                              <span className="text-xs text-slate-400">
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
                            className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition"
                          />
                        )}

                        {meta.uiWidget === 'textarea' && (
                          <div className="space-y-1.5">
                            <textarea
                              rows={2}
                              value={String(val ?? '')}
                              onChange={(e) => handleFieldChange(meta.key, e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition"
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
                              <div className="flex items-center space-x-3 p-3 bg-slate-50/70 border border-slate-200 rounded-xl">
                                <div className="w-14 h-14 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center p-1 flex-shrink-0">
                                  <img
                                    src={String(val)}
                                    alt={meta.name}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium text-slate-800 block truncate">
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
                                  <button
                                    type="button"
                                    onClick={() => fileInputRefs.current[meta.key]?.click()}
                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-full text-xs font-medium text-slate-700 transition cursor-pointer"
                                  >
                                    Change
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleFieldChange(meta.key, '')}
                                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-full transition cursor-pointer"
                                    title="Remove logo"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => fileInputRefs.current[meta.key]?.click()}
                                className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/60"
                              >
                                <div className="w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-600 flex items-center justify-center mx-auto mb-2">
                                  <Upload className="w-4 h-4 stroke-[1.75]" />
                                </div>
                                <span className="text-xs font-medium text-slate-800 block">
                                  {meta.key === 'prescription_page_url'
                                    ? 'Choose Prescription Printed Page'
                                    : 'Choose Clinic Logo'}
                                </span>
                                <span className="text-[11px] text-slate-400 mt-0.5 block">
                                  {meta.key === 'prescription_page_url'
                                    ? 'PNG, JPG, SVG or WebP letterhead or prescription pad'
                                    : 'PNG, JPG, SVG or WebP from your device'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {activeCategory === 'Custom Prescription' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
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

      {isAdmin && activeCategory === 'Multi-Branch & Locations' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="pt-2"
        >
          <BranchLocationManager
            currentLocationId={currentLocation?.id}
            onSelectLocation={onSelectLocation}
            clinicId={currentLocation?.clinic_id}
            clinicName={currentLocation?.clinic_name}
            onRefreshLocations={onRefreshLocations}
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
