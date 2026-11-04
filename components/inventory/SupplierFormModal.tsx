'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Building } from 'lucide-react';
import { Supplier } from '@/types/medicine';
import { saveOrUpdateSupplier } from '@/lib/medicineService';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
  onSuccess: (savedSupplier: Supplier) => void;
}

export function SupplierFormModal({
  isOpen,
  onClose,
  supplier,
  onSuccess,
}: SupplierFormModalProps) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (supplier) {
        setName(supplier.name || '');
        setContactPerson(supplier.contactPerson || '');
        setPhone(supplier.phone || '');
        setEmail(supplier.email || '');
        setGstin(supplier.gstin || '');
        setAddress(supplier.address || '');
      } else {
        setName('');
        setContactPerson('');
        setPhone('');
        setEmail('');
        setGstin('');
        setAddress('');
      }
    }
  }, [isOpen, supplier]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const saved = await saveOrUpdateSupplier({
        id: supplier?.id,
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || '+91 00000 00000',
        email: email.trim() || undefined,
        gstin: gstin.trim() || undefined,
        address: address.trim() || undefined,
        lastPurchaseDate: supplier?.lastPurchaseDate,
        lastPurchasePrice: supplier?.lastPurchasePrice,
      });

      onSuccess(saved);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl border border-slate-100"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">
                {supplier ? 'Edit Supplier Information' : 'Add New Supplier / Vendor'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Register authorized wholesale distributors and pharmaceutical logistics
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 mt-4 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Company / Supplier Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Pharma Distributors"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Rajesh Kumar"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Contact Phone</label>
              <input
                type="text"
                placeholder="e.g. +91 98450 12345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. orders@apexpharma.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">GSTIN Number</label>
              <input
                type="text"
                placeholder="e.g. 29ABCDE1234F1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Registered Warehouse Address</label>
            <textarea
              rows={2}
              placeholder="e.g. Plot 45, Industrial Area, Phase II, Bengaluru"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl border border-slate-200 cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : supplier ? 'Update Supplier' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

