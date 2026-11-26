'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Building2,
  Phone,
  KeyRound,
  Plus,
  ExternalLink,
  Check,
  Copy,
  Edit3,
  RefreshCw,
  MessageSquare,
  Users,
  X,
  Upload,
  Trash2,
} from 'lucide-react';
import { DbClinicLocation } from '@/types/database';
import { fetchClinicLocations } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

interface BranchLocationManagerProps {
  currentLocationId?: string;
  onSelectLocation?: (loc: DbClinicLocation) => void;
  clinicId?: string | null;
  clinicName?: string | null;
  onRefreshLocations?: () => Promise<void>;
}

export function BranchLocationManager({
  currentLocationId,
  onSelectLocation,
  clinicId,
  clinicName,
  onRefreshLocations,
}: BranchLocationManagerProps = {}) {
  const [locations, setLocations] = useState<DbClinicLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal / Edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingLoc, setEditingLoc] = useState<DbClinicLocation | null>(null);

  // Form inputs (styled to match Walkin Register UI)
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formPin, setFormPin] = useState('1234');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWaPhoneId, setFormWaPhoneId] = useState('');
  const [formQuota, setFormQuota] = useState('40');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const logoInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadLocations = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const activeClinic =
        clinicId ||
        (typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_clinic_id') : null) ||
        undefined;
      let locs = await fetchClinicLocations(activeClinic);

      if (clinicId) {
        locs = locs.filter((l) => l.clinic_id === clinicId);
      }
      setLocations(locs);
      const elapsed = Date.now() - startTime;
      if (elapsed < 450) {
        await new Promise((r) => setTimeout(r, 450 - elapsed));
      }
    } catch (e) {
      console.warn('Failed loading branches:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, [clinicId]);

  const handleOpenAdd = () => {
    setEditingLoc(null);
    setFormName('');
    setFormCode(`HS-LOC-${Math.floor(100 + Math.random() * 900)}`);
    setFormPin('1234');
    setFormAddress('');
    setFormPhone('');
    setFormWaPhoneId('');
    setFormQuota('40');
    setFormLogoUrl('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (loc: DbClinicLocation) => {
    setEditingLoc(loc);
    setFormName(loc.branch_name || '');
    setFormCode(loc.branch_code || '');
    setFormPin(loc.gateway_pin || '1234');
    setFormAddress(loc.address || '');
    setFormPhone(loc.phone || '');
    setFormWaPhoneId(loc.whatsapp_phone_number_id || '');
    setFormQuota(String(loc.daily_quota || 40));
    setFormLogoUrl(loc.logo_url || '');
    setIsModalOpen(true);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getFullBookingUrl = (loc: DbClinicLocation): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://healthsync.in';
    const path =
      loc.booking_url ||
      (loc.branch_slug ? `/${loc.branch_slug}/booking` : `/booking?branch=${loc.branch_code || loc.id}`);
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const handleCopyUrl = (loc: DbClinicLocation) => {
    const fullUrl = getFullBookingUrl(loc);
    navigator.clipboard.writeText(fullUrl);
    setCopiedCode(loc.id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) return;

    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        branch_name: formName.trim(),
        branch_code: formCode.trim().toUpperCase(),
        gateway_pin: formPin.trim() || '1234',
        address: formAddress.trim() || null,
        phone: formPhone.trim() || null,
        whatsapp_phone_number_id: formWaPhoneId.trim() || null,
        daily_quota: parseInt(formQuota, 10) || 40,
        logo_url: formLogoUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingLoc) {
        await supabase
          .from('clinic_locations')
          .update(payload)
          .eq('id', editingLoc.id);

        if (editingLoc.id === currentLocationId && onSelectLocation) {
          onSelectLocation({
            ...editingLoc,
            ...payload,
          });
        }
      } else {
        const activeClinic =
          clinicId ||
          (typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_clinic_id') : null) ||
          'c714c4c3-e1ba-4f9c-bac9-ed20763d6f5c';
        const activeName = clinicName || 'HealthSync Clinic';
        const newId = `loc-${formCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        payload.id = newId;
        payload.clinic_id = activeClinic;
        payload.clinic_name = activeName;
        payload.is_active = true;
        await supabase.from('clinic_locations').insert([payload]);
      }

      await loadLocations();
      await onRefreshLocations?.();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save branch location:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <EcgActionLoader isLoading={isLoading || isSaving} fullscreen={true} />

      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/60 text-[#2563EB] flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-[#16191E] tracking-tight">
                Branches &amp; Clinic Locations
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {locations.length} {locations.length === 1 ? 'Location' : 'Locations'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage physical branches, dedicated WhatsApp lines, and assistant gateway credentials
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-4 h-4 stroke-[2.2]" />
          <span>Add New Branch</span>
        </button>
      </div>

      {/* Separate Branch Cards Grid */}
      {locations.length === 0 && !isLoading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#ECEEF2]">
          <MapPin className="w-9 h-9 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800">No branch locations registered yet</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Click &quot;Add New Branch&quot; to configure your first clinic location and gateway credentials.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {locations.map((loc) => {
            const code = loc.branch_code || loc.id;
            const isCopied = copiedCode === loc.id;
            const fullBookingUrl = getFullBookingUrl(loc);
            const isActive = currentLocationId === loc.id;

            return (
              <div
                key={loc.id}
                className={`bg-white rounded-2xl border transition-all duration-150 p-5 flex flex-col justify-between space-y-4 relative group shadow-2xs hover:border-slate-300 ${
                  isActive
                    ? 'border-blue-500 ring-1 ring-blue-500/20'
                    : 'border-[#ECEEF2]'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Icon/Logo & Status Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/60 text-[#2563EB] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {loc.logo_url ? (
                        <img
                          src={loc.logo_url}
                          alt={loc.branch_name}
                          className="w-full h-full object-contain p-1 bg-white"
                        />
                      ) : (
                        <MapPin className="w-5 h-5 stroke-[2.2]" />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {isActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      )}
                      {code && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                          {code}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Branch Name & Address */}
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-[#16191E] tracking-tight leading-snug">
                      {loc.branch_name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 flex items-start gap-1 line-clamp-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>{loc.address || 'Physical address not configured'}</span>
                    </p>
                  </div>

                  {/* Operational Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        WhatsApp Contact
                      </span>
                      <span className="font-bold text-slate-800 text-xs truncate block">
                        {loc.phone || <span className="text-slate-400 font-normal italic">Not set</span>}
                      </span>
                    </div>

                    <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Gateway PIN
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-xs flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                        {loc.gateway_pin || '1234'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Daily Consultation Quota</span>
                    <span className="font-bold text-slate-800">{loc.daily_quota || 40} patients / day</span>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(loc)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Copy online booking link for this branch"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Booking Link</span>
                      </>
                    )}
                  </button>

                  <a
                    href={fullBookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-xl text-xs transition cursor-pointer"
                    title="Open booking portal in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(loc)}
                    className="py-2 px-3.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-blue-100/60"
                    title="Edit branch details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POPUP MODAL: ADD / EDIT BRANCH */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] relative"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-800">
                  {editingLoc ? 'Edit Branch Location' : 'Add New Branch'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
                {/* Branch Logo Upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Branch Logo <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  {formLogoUrl ? (
                    <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="w-11 h-11 rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center p-1 flex-shrink-0">
                        <img src={formLogoUrl} alt="Branch logo" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-800 block truncate">Branch Logo Ready</span>
                        <span className="text-[11px] text-slate-400">Saved for this branch</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormLogoUrl('')}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Remove branch logo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="w-full border border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-slate-50/50 hover:bg-blue-50/30 transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Branch Logo (PNG, JPG, SVG)</span>
                    </button>
                  )}
                </div>

                {/* Branch Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Branch Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apollo Clinic - Ernakulam"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                {/* Branch Code & Assistant Gateway PIN */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Branch Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. APL-EKM"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Gateway PIN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="1234"
                      value={formPin}
                      onChange={(e) => setFormPin(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Physical Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    placeholder="Physical street address & landmark"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                {/* WhatsApp Contact & Daily Quota */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      WhatsApp Contact
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 98460 12345"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Daily Quota
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      placeholder="40"
                      value={formQuota}
                      onChange={(e) => setFormQuota(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* WhatsApp Cloud Phone Number ID (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp Cloud Phone Number ID <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 109823471029384"
                    value={formWaPhoneId}
                    onChange={(e) => setFormWaPhoneId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : editingLoc ? 'Save Changes' : 'Create Branch'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BranchLocationManager;
