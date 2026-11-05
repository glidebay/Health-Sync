'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Check, AlertCircle } from 'lucide-react';
import { MedicineMaster, DosageForm } from '@/types/medicine';
import { updateMedicineMaster } from '@/lib/medicineService';

interface EditMedicineModalProps {
  medicine: MedicineMaster | null;
  isOpen: boolean;
  onClose: () => void;
  onMedicineUpdated: () => void;
  categories?: string[];
}

const DOSAGE_FORMS: DosageForm[] = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Ointment',
  'Drops',
  'Inhaler',
  'Suspension',
  'Powder',
  'Other',
];

export function EditMedicineModal({
  medicine,
  isOpen,
  onClose,
  onMedicineUpdated,
}: EditMedicineModalProps) {
  const [brandName, setBrandName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [category, setCategory] = useState('');
  const [dosageForm, setDosageForm] = useState<DosageForm>('Tablet');
  const [strength, setStrength] = useState('');
  const [unit, setUnit] = useState('Strips');
  const [minimumStockLevel, setMinimumStockLevel] = useState('20');
  const [manufacturer, setManufacturer] = useState('');
  const [barcode, setBarcode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (medicine && isOpen) {
      setBrandName(medicine.brandName || '');
      setGenericName(medicine.genericName || '');
      setSellingPrice(
        medicine.sellingPrice && medicine.sellingPrice > 0 ? String(medicine.sellingPrice) : ''
      );
      setPurchasePrice(
        medicine.lastPurchasePrice && medicine.lastPurchasePrice > 0
          ? String(medicine.lastPurchasePrice)
          : ''
      );
      setCategory(medicine.category || 'General Medicine');
      setDosageForm(medicine.dosageForm || 'Tablet');
      setStrength(medicine.strength || '');
      setUnit(medicine.unit || 'Strips');
      setMinimumStockLevel(String(medicine.minimumStockLevel ?? 20));
      setManufacturer(medicine.manufacturer || '');
      setBarcode(medicine.barcode || '');
      setError(null);
    }
  }, [medicine, isOpen]);

  if (!isOpen || !medicine) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) {
      setError('Brand Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const parsedSellPrice = parseFloat(sellingPrice);
      const parsedBuyPrice = parseFloat(purchasePrice);
      const parsedMinStock = parseInt(minimumStockLevel, 10);

      await updateMedicineMaster({
        id: medicine.id,
        brandName: brandName.trim(),
        genericName: genericName.trim() || brandName.trim(),
        sellingPrice: !isNaN(parsedSellPrice) && parsedSellPrice >= 0 ? parsedSellPrice : 0,
        lastPurchasePrice: !isNaN(parsedBuyPrice) && parsedBuyPrice >= 0 ? parsedBuyPrice : 0,
        category: category.trim() || 'General Medicine',
        dosageForm,
        strength: strength.trim() || 'Standard',
        unit: unit.trim() || 'Strips',
        minimumStockLevel: !isNaN(parsedMinStock) && parsedMinStock >= 0 ? parsedMinStock : 20,
        manufacturer: manufacturer.trim() || 'Standard Healthcare',
        barcode: barcode.trim() || undefined,
      });

      onMedicineUpdated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update medicine');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden"
        >
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-[#FAFBFD]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#16191E]">
                  Edit Medicine &amp; Pricing
                </h2>
                <p className="text-xs text-[#8A909D] font-medium font-mono">
                  {medicine.sku} &bull; {medicine.brandName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Brand / Medicine Name *
                </label>
                <input
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 focus:bg-white text-xs transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Generic Composition / Molecule
                </label>
                <input
                  type="text"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 focus:bg-white text-xs transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Retail Selling Price (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00 (Unpriced)"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full h-10 pl-7 pr-3 bg-emerald-50/40 border border-emerald-200 rounded-xl font-bold text-emerald-800 outline-none focus:border-emerald-500 focus:bg-white text-xs transition"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Amount billed to patient per unit (leave blank if unpriced)
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Cost / Purchase Price (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full h-10 pl-7 pr-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 focus:bg-white text-xs transition"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Wholesale procurement cost per unit
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Dosage Form
                </label>
                <select
                  value={dosageForm}
                  onChange={(e) => setDosageForm(e.target.value as DosageForm)}
                  className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 focus:bg-white text-xs transition cursor-pointer"
                >
                  {DOSAGE_FORMS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Strength / Potency
                </label>
                <input
                  type="text"
                  placeholder="e.g. 650mg, 500mg, 10mg/5ml"
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 focus:bg-white text-xs transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Dispensing Packaging Unit
                </label>
                <input
                  type="text"
                  placeholder="e.g. Strips, Bottles, Vials"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 focus:bg-white text-xs transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Minimum Stock Alert Level
                </label>
                <input
                  type="number"
                  min="0"
                  value={minimumStockLevel}
                  onChange={(e) => setMinimumStockLevel(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 focus:bg-white text-xs transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Manufacturer / Pharma Company
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cipla, Sun Pharma, GSK"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 focus:bg-white text-xs transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Barcode / EAN / GTIN
                </label>
                <input
                  type="text"
                  placeholder="e.g. 8901234567890"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 focus:bg-white text-xs transition"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl border border-slate-200 cursor-pointer transition text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs flex items-center gap-2"
              >
                {saving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

