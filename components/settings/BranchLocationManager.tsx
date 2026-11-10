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
  ShieldCheck,
  X,
} from 'lucide-react';
import { DbClinicLocation } from '@/types/database';
import { fetchClinicLocations } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';

interface BranchLocationManagerProps {
  currentLocationId?: string;
  onSelectLocation?: (loc: DbClinicLocation) => void;
  clinicId?: string | null;
  clinicName?: string | null;
}

export function BranchLocationManager({
  currentLocationId,
  onSelectLocation,
  clinicId,
  clinicName,
}: BranchLocationManagerProps = {}) {
  const [locations, setLocations] = useState<DbClinicLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal / Edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingLoc, setEditingLoc] = useState<DbClinicLocation | null>(null);

  // Form inputs
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formPin, setFormPin] = useState('1234');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWaPhoneId, setFormWaPhoneId] = useState('');
  const [formQuota, setFormQuota] = useState('40');

  const loadLocations = async () => {
    setIsLoading(true);
    try {
      const activeClinic = clinicId || (typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_clinic_id') : null) || undefined;
      const locs = await fetchClinicLocations(activeClinic);
      setLocations(locs);
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
    setFormPhone('+91 ');
    setFormWaPhoneId('');
    setFormQuota('40');
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
    setIsModalOpen(true);
  };

  const handleCopyUrl = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://healthsync.in';
    const url = `${origin}/book?branch=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
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
        address: formAddress.trim() || 'Kerala, India',
        phone: formPhone.trim() || undefined,
        whatsapp_phone_number_id: formWaPhoneId.trim() || null,
        daily_quota: parseInt(formQuota, 10) || 40,
        is_active: true,
      };

      if (editingLoc) {
        await supabase
          .from('clinic_locations')
          .update(payload)
          .eq('id', editingLoc.id);
      } else {
        const activeClinic = clinicId || (typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_clinic_id') : null) || '33ef6459-44ae-45b7-8726-ce71abf51832';
        const activeName = clinicName || (activeClinic === '22222222-2222-2222-2222-222222222222' ? 'Dreams Pharma & Clinic' : 'HealthSync Medical Center');
        const newId = `loc-${formCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        payload.id = newId;
        payload.clinic_id = activeClinic;
        payload.clinic_name = activeName;
        await supabase.from('clinic_locations').insert([payload]);
      }

      await loadLocations();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save branch location:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#ECEEF2] p-5 sm:p-6 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#2563EB]" />
              <span>Multi-Branch &amp; Location Registry</span>
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              {locations.length} Locations
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure physical clinic branches, Assistant Gateway PINs, and dedicated WhatsApp numbers
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Branch</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center text-xs text-slate-400 gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
          <span>Loading branch locations...</span>
        </div>
      ) : locations.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-600">No branch locations registered yet</p>
          <p className="text-slate-400 mt-0.5">Click &quot;Add New Branch&quot; to configure your first clinic location.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {locations.map((loc) => {
            const code = loc.branch_code || loc.id;
            const isCopied = copiedCode === code;

            return (
              <div
                key={loc.id}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-blue-200 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>{loc.branch_name}</span>
                        {code && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {code}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{loc.address || 'Kochi, Kerala'}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(loc)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    title="Edit branch parameters"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block font-medium">Assistant Gateway PIN</span>
                    <span className="font-mono font-bold text-slate-700 flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-amber-500" />
                      {loc.gateway_pin || '1234'}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-slate-400 block font-medium">WhatsApp Cloud Phone ID</span>
                    <span className="font-mono text-slate-700 truncate block">
                      {loc.whatsapp_phone_number_id ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-emerald-500" />
                          {loc.whatsapp_phone_number_id}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unlinked</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">
                      Quota: <strong className="text-slate-800">{loc.daily_quota || 40}</strong> / day
                    </span>
                    {currentLocationId === loc.id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active Branch
                      </span>
                    ) : onSelectLocation ? (
                      <button
                        type="button"
                        onClick={() => onSelectLocation(loc)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 transition cursor-pointer"
                        title="Switch active dashboard worklist to this branch"
                      >
                        <Building2 className="w-3 h-3" />
                        <span>Switch Here</span>
                      </button>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyUrl(code)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Booking URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD / EDIT BRANCH */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>{editingLoc ? 'Edit Branch Location' : 'Add New Branch Location'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Branch Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. HealthSync Central - Kochi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Branch Code (URL Slug)</label>
                    <input
                      type="text"
                      required
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      placeholder="e.g. HS-KOC"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Assistant Gateway PIN</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={formPin}
                      onChange={(e) => setFormPin(e.target.value)}
                      placeholder="1234"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Address &amp; Landmark</label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="e.g. Kakkanad, Kochi, Kerala"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Helpline Phone</label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+91 98470 12345"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Daily Max Token Quota</label>
                    <input
                      type="number"
                      value={formQuota}
                      onChange={(e) => setFormQuota(e.target.value)}
                      placeholder="40"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Meta WhatsApp Phone Number ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formWaPhoneId}
                    onChange={(e) => setFormWaPhoneId(e.target.value)}
                    placeholder="e.g. 109823471029384 from Meta Developer Portal"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Incoming WhatsApp messages to this phone number will route directly to this branch.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                  >
                    {isSaving ? 'Saving...' : editingLoc ? 'Update Branch' : 'Create Branch'}
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

