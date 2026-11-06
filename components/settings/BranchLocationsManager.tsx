'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
  Check,
  Star,
  AlertCircle,
} from 'lucide-react';
import { BranchLocation } from '@/types';

interface BranchLocationsManagerProps {
  defaultClinicName?: string;
  defaultClinicAddress?: string;
  defaultClinicPhone?: string;
}

const STORAGE_KEY = 'healthsync_branch_locations';

export function BranchLocationsManager({
  defaultClinicName = 'HealthSync Central Clinic',
  defaultClinicAddress = '123 Main St, Central Avenue, Kochi, Kerala 682001',
  defaultClinicPhone = '+91 98765 43210',
}: BranchLocationsManagerProps) {
  const [branches, setBranches] = useState<BranchLocation[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchLocation | null>(null);

  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState('');

  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBranches(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse branch locations from storage:', e);
    }

    const initialBranches: BranchLocation[] = [
      {
        id: 'branch-1',
        name: defaultClinicName || 'HealthSync Central Clinic',
        address: defaultClinicAddress || '123 Main St, Central Avenue, Kochi, Kerala 682001',
        phone: defaultClinicPhone || '+91 98765 43210',
        email: 'central@healthsync.clinic',
        isPrimary: true,
        status: 'Active',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'branch-2',
        name: 'HealthSync Downtown Speciality',
        address: '45 Marine Drive, Ernakulam, Kochi, Kerala 682031',
        phone: '+91 98765 43219',
        email: 'downtown@healthsync.clinic',
        isPrimary: false,
        status: 'Active',
        createdAt: new Date().toISOString(),
      },
    ];

    setBranches(initialBranches);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialBranches));
    } catch {}
  }, [defaultClinicName, defaultClinicAddress, defaultClinicPhone]);

  const saveBranches = (newBranches: BranchLocation[]) => {
    setBranches(newBranches);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newBranches));
    } catch (e) {
      console.warn('Failed to save branch locations to storage:', e);
    }
  };

  const handleOpenAdd = () => {
    setEditingBranch(null);
    setFormName('');
    setFormAddress('');
    setFormPhone('');
    setFormEmail('');
    setFormIsPrimary(branches.length === 0);
    setFormStatus('Active');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (branch: BranchLocation) => {
    setEditingBranch(branch);
    setFormName(branch.name);
    setFormAddress(branch.address);
    setFormPhone(branch.phone);
    setFormEmail(branch.email);
    setFormIsPrimary(branch.isPrimary);
    setFormStatus(branch.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Please enter a branch name.');
      return;
    }
    if (!formAddress.trim()) {
      setFormError('Please enter the complete branch address.');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('Please enter a contact phone number.');
      return;
    }

    if (editingBranch) {
      const updated = branches.map((b) => {
        if (b.id === editingBranch.id) {
          return {
            ...b,
            name: formName.trim(),
            address: formAddress.trim(),
            phone: formPhone.trim(),
            email: formEmail.trim(),
            isPrimary: formIsPrimary,
            status: formStatus,
          };
        }
        if (formIsPrimary) {
          return { ...b, isPrimary: false };
        }
        return b;
      });

      const hasPrimary = updated.some((b) => b.isPrimary);
      if (!hasPrimary && updated.length > 0) {
        updated[0].isPrimary = true;
      }

      saveBranches(updated);
    } else {
      const newBranch: BranchLocation = {
        id: `branch-${Date.now()}`,
        name: formName.trim(),
        address: formAddress.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        isPrimary: formIsPrimary || branches.length === 0,
        status: formStatus,
        createdAt: new Date().toISOString(),
      };

      let nextBranches = [...branches];
      if (newBranch.isPrimary) {
        nextBranches = nextBranches.map((b) => ({ ...b, isPrimary: false }));
      }
      nextBranches.push(newBranch);
      saveBranches(nextBranches);
    }

    setIsModalOpen(false);
  };

  const handleSetPrimary = (id: string) => {
    const updated = branches.map((b) => ({
      ...b,
      isPrimary: b.id === id,
    }));
    saveBranches(updated);
  };

  const handleDelete = (id: string) => {
    const toDelete = branches.find((b) => b.id === id);
    if (!toDelete) return;

    if (branches.length === 1) {
      if (!window.confirm('This is your only clinic branch. Are you sure you want to delete it?')) {
        return;
      }
    }

    const remaining = branches.filter((b) => b.id !== id);
    if (toDelete.isPrimary && remaining.length > 0) {
      remaining[0].isPrimary = true;
    }

    saveBranches(remaining);
    setBranchToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              Branch Locations
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              {branches.length} {branches.length === 1 ? 'Location' : 'Locations'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Manage multi-location clinic branches, satellite chambers, contact telephone lines, and designated primary facilities.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center space-x-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Add New Branch</span>
        </motion.button>
      </div>

      {branches.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-200 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6 stroke-[1.8]" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Branch Locations Configured</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Add primary and secondary consultation branch locations to display their contact coordinates here.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Branch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {branches.map((branch) => {
            const isPrimary = branch.isPrimary;
            const isActive = branch.status === 'Active';

            return (
              <motion.div
                key={branch.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white rounded-2xl p-5 border shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] hover:shadow-md transition-all flex flex-col justify-between relative group ${
                  isPrimary ? 'border-blue-200 ring-1 ring-blue-500/15' : 'border-slate-100'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isPrimary
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}
                      >
                        <Building2 className="w-5 h-5 stroke-[2]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 tracking-tight truncate" title={branch.name}>
                          {branch.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {isPrimary && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                              <Star className="w-2.5 h-2.5 fill-blue-600 text-blue-600" />
                              Primary Branch
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                              }`}
                            />
                            {branch.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => handleOpenEdit(branch)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                        title="Edit branch details"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => setBranchToDelete(branch.id)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete branch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
                    <div className="flex items-start gap-2.5 text-xs text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="leading-relaxed font-medium line-clamp-2" title={branch.address}>
                        {branch.address}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 text-xs text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <a
                        href={`tel:${branch.phone}`}
                        className="font-medium hover:text-blue-600 transition truncate"
                      >
                        {branch.phone}
                      </a>
                    </div>

                    <div className="flex items-center gap-2.5 text-xs text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      {branch.email ? (
                        <a
                          href={`mailto:${branch.email}`}
                          className="font-medium hover:text-blue-600 transition truncate"
                        >
                          {branch.email}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No email recorded</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  {isPrimary ? (
                    <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-blue-600 py-1 bg-blue-50/60 rounded-xl border border-blue-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 stroke-[2.2]" />
                      <span>Primary Medical Facility</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(branch.id)}
                      className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-50 py-1.5 rounded-xl border border-slate-200 transition cursor-pointer"
                    >
                      <Star className="w-3 h-3 text-amber-500" />
                      <span>Set as Primary Facility</span>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Building2 className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingBranch ? 'Edit Branch Location' : 'Add New Branch Location'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {editingBranch
                        ? 'Update facility location and contact information'
                        : 'Register a new clinical branch facility'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveBranch} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Branch Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. HealthSync Downtown Medical Center"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Complete Branch Address <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Building name, street, locality, city, state & postal PIN code"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Contact Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="branch@healthsync.clinic"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Operational Status</span>
                      <span className="text-[11px] text-slate-400">
                        {formStatus === 'Active' ? 'Branch actively accepts patient visits' : 'Temporarily closed or offline'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 bg-white p-1 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setFormStatus('Active')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                          formStatus === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormStatus('Inactive')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                          formStatus === 'Inactive'
                            ? 'bg-slate-200 text-slate-700'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Inactive
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Designate as Primary Branch</span>
                      <span className="text-[11px] text-slate-400">
                        Main headquarters for billing and prescription headers
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFormIsPrimary(!formIsPrimary)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        formIsPrimary ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formIsPrimary ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{editingBranch ? 'Update Branch' : 'Add Branch'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {branchToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5 stroke-[2]" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Delete Branch Location?</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to remove this branch from your clinic directory? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBranchToDelete(null)}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(branchToDelete)}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default BranchLocationsManager;

