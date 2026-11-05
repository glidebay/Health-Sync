'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  SlidersHorizontal,
  Package,
  Layers,
  FileText,
  Activity,
  Truck,
  Building,
  Pencil,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Barcode,
  Pill,
} from 'lucide-react';
import {
  MedicineMaster,
  MedicineBatch,
  PurchaseRecord,
  StockMovement,
  MovementType,
  Supplier,
} from '@/types/medicine';
import { SupplierFormModal } from '@/components/inventory/SupplierFormModal';
import { EditMedicineModal } from '@/components/inventory/EditMedicineModal';
import {
  fetchPurchaseHistory,
  fetchStockMovements,
  fetchSuppliers,
  addBatchToMedicine,
  recordStockAdjustment,
  linkSupplierToMedicine,
} from '@/lib/medicineService';

interface MedicineDetailsModalProps {
  medicine: MedicineMaster | null;
  isOpen: boolean;
  onClose: () => void;
  onMedicineUpdated: () => void;
  isDoctorUnlocked?: boolean;
}

type TabKey = 'overview' | 'batches' | 'purchases' | 'movements' | 'supplier';

export function MedicineDetailsModal({
  medicine,
  isOpen,
  onClose,
  onMedicineUpdated,
  isDoctorUnlocked = true,
}: MedicineDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [batchNo, setBatchNo] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [batchQty, setBatchQty] = useState('');
  const [batchBuyPrice, setBatchBuyPrice] = useState('');
  const [batchSellPrice, setBatchSellPrice] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [supplierNameInput, setSupplierNameInput] = useState('');

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<MovementType>('Stock Adjustment');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustRef, setAdjustRef] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustBatchId, setAdjustBatchId] = useState('');

  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);
  const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<Supplier | null>(null);
  const [showLinkSupplierModal, setShowLinkSupplierModal] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (!medicine || !isOpen) return;

    setLoadingHistory(true);
    Promise.all([
      fetchPurchaseHistory(medicine.id),
      fetchStockMovements(medicine.id),
      fetchSuppliers(),
    ])
      .then(([pur, mov, sups]) => {
        setPurchases(pur);
        setMovements(mov);
        setSuppliersList(sups);
      })
      .finally(() => setLoadingHistory(false));
  }, [medicine, isOpen]);

  const batches = useMemo(() => medicine?.batches || [], [medicine]);

  const activeSupplier = useMemo<Supplier | null>(() => {
    if (medicine?.supplier && medicine.supplier.name) {
      const match = suppliersList.find(
        (s) =>
          s.id === medicine.supplier?.id ||
          s.name.toLowerCase() === medicine.supplier?.name.toLowerCase()
      );
      if (match) return match;
      return medicine.supplier;
    }

    const latestBatchWithSup = batches.find((b) => b.supplierId || b.supplierName);
    if (latestBatchWithSup) {
      if (latestBatchWithSup.supplierId) {
        const match = suppliersList.find((s) => s.id === latestBatchWithSup.supplierId);
        if (match) return match;
      }
      if (latestBatchWithSup.supplierName) {
        const match = suppliersList.find(
          (s) => s.name.toLowerCase() === latestBatchWithSup.supplierName?.toLowerCase()
        );
        if (match) return match;
        return {
          id: latestBatchWithSup.supplierId || 'sup-batch',
          name: latestBatchWithSup.supplierName,
          phone: '',
          lastPurchaseDate: latestBatchWithSup.manufacturingDate,
          lastPurchasePrice: latestBatchWithSup.purchasePrice,
        };
      }
    }

    const latestPurchase = purchases.find((p) => p.supplierName);
    if (latestPurchase && latestPurchase.supplierName) {
      const match = suppliersList.find(
        (s) => s.name.toLowerCase() === latestPurchase.supplierName.toLowerCase()
      );
      if (match) return match;
      return {
        id: latestPurchase.supplierId || 'sup-pur',
        name: latestPurchase.supplierName,
        phone: '',
        lastPurchaseDate: latestPurchase.purchaseDate,
        lastPurchasePrice: latestPurchase.purchasePrice,
      };
    }

    return null;
  }, [medicine, batches, purchases, suppliersList]);

  const supplierBatches = useMemo(() => {
    if (!activeSupplier) return [];
    return batches.filter(
      (b) =>
        (b.supplierId && b.supplierId === activeSupplier.id) ||
        (b.supplierName && b.supplierName.toLowerCase() === activeSupplier.name.toLowerCase())
    );
  }, [batches, activeSupplier]);

  const allRecordedSuppliers = useMemo(() => {
    const map = new Map<string, { name: string; count: number; lastDate: string }>();

    batches.forEach((b) => {
      if (b.supplierName) {
        const key = b.supplierName.toLowerCase();
        const prev = map.get(key);
        map.set(key, {
          name: b.supplierName,
          count: (prev?.count || 0) + 1,
          lastDate: b.manufacturingDate || prev?.lastDate || '',
        });
      }
    });

    purchases.forEach((p) => {
      if (p.supplierName) {
        const key = p.supplierName.toLowerCase();
        const prev = map.get(key);
        map.set(key, {
          name: p.supplierName,
          count: (prev?.count || 0) + 1,
          lastDate: p.purchaseDate || prev?.lastDate || '',
        });
      }
    });

    return Array.from(map.values());
  }, [batches, purchases]);

  const handleOpenNewSupplier = () => {
    setSelectedSupplierForModal(null);
    setIsSupplierFormOpen(true);
  };

  const handleOpenEditSupplier = () => {
    setSelectedSupplierForModal(activeSupplier || null);
    setIsSupplierFormOpen(true);
  };

  const handleSupplierFormSuccess = async (savedSup: Supplier) => {
    if (medicine) {
      await linkSupplierToMedicine(medicine.id, savedSup);
      const sups = await fetchSuppliers();
      setSuppliersList(sups);
      onMedicineUpdated();
    }
  };

  const handleSelectExistingSupplier = async (sup: Supplier) => {
    if (!medicine) return;
    await linkSupplierToMedicine(medicine.id, sup);
    const sups = await fetchSuppliers();
    setSuppliersList(sups);
    setShowLinkSupplierModal(false);
    onMedicineUpdated();
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicine || !batchNo.trim() || !expDate || !batchQty) return;

    const qty = parseInt(batchQty, 10);
    const buyPrice = parseFloat(batchBuyPrice) || medicine.lastPurchasePrice || 0;
    const sellPrice = parseFloat(batchSellPrice) || medicine.sellingPrice || buyPrice * 1.4;

    await addBatchToMedicine({
      medicineId: medicine.id,
      batchNumber: batchNo.trim(),
      manufacturingDate: mfgDate || new Date().toISOString().split('T')[0],
      expiryDate: expDate,
      purchasePrice: buyPrice,
      sellingPrice: sellPrice,
      quantity: qty,
      invoiceNumber: invoiceNo.trim() || undefined,
      supplierName: supplierNameInput.trim() || activeSupplier?.name || undefined,
      responsibleUser: isDoctorUnlocked ? 'Dr. Sunny' : 'Staff Pharmacist',
    });

    setBatchNo('');
    setMfgDate('');
    setExpDate('');
    setBatchQty('');
    setBatchBuyPrice('');
    setBatchSellPrice('');
    setInvoiceNo('');
    setSupplierNameInput('');
    setShowAddBatchModal(false);

    onMedicineUpdated();
    const [pur, mov, sups] = await Promise.all([
      fetchPurchaseHistory(medicine.id),
      fetchStockMovements(medicine.id),
      fetchSuppliers(),
    ]);
    setPurchases(pur);
    setMovements(mov);
    setSuppliersList(sups);
  };

  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicine || !adjustQty) return;

    const qtyNum = parseInt(adjustQty, 10);
    if (isNaN(qtyNum) || qtyNum === 0) return;

    const isNegative = ['Dispensing', 'Damaged Stock', 'Expired Stock'].includes(adjustType);
    const quantityDelta = isNegative ? -Math.abs(qtyNum) : Math.abs(qtyNum);

    await recordStockAdjustment({
      medicineId: medicine.id,
      batchId: adjustBatchId || undefined,
      movementType: adjustType,
      quantityChange: quantityDelta,
      referenceNumber: adjustRef.trim() || `ADJ-${Date.now().toString().slice(-6)}`,
      responsibleUser: isDoctorUnlocked ? 'Dr. Sunny' : 'Staff Pharmacist',
      notes: adjustNotes.trim(),
    });

    setAdjustQty('');
    setAdjustRef('');
    setAdjustNotes('');
    setAdjustBatchId('');
    setShowAdjustModal(false);

    onMedicineUpdated();
    const [pur, mov] = await Promise.all([
      fetchPurchaseHistory(medicine.id),
      fetchStockMovements(medicine.id),
    ]);
    setPurchases(pur);
    setMovements(mov);
  };

  if (!isOpen || !medicine) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden"
        >
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-[#FAFBFD]">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tl from-blue-700 to-blue-500 text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
                <Pill className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-[#2563EB] border border-blue-100">
                    {medicine.sku}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      medicine.stockStatus === 'Available'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : medicine.stockStatus === 'Low Stock'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {medicine.stockStatus} ({medicine.totalStock} {medicine.unit})
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      medicine.expiryStatus === 'Valid'
                        ? 'bg-slate-50 text-slate-700 border-slate-200'
                        : medicine.expiryStatus === 'Near Expiry'
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {medicine.expiryStatus}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-1 truncate">
                  {medicine.brandName}
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">
                  {medicine.genericName} &bull; {medicine.dosageForm} ({medicine.strength}) &bull; {medicine.manufacturer}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isDoctorUnlocked && (
                <>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Edit Medicine Master & Pricing"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Edit Details</span>
                  </button>
                  <button
                    onClick={() => setShowAdjustModal(true)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Stock Adjustment"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Adjust Stock</span>
                  </button>
                  <button
                    onClick={() => setShowAddBatchModal(true)}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Procure Batch"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">New Batch</span>
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-100 px-4 sm:px-6 bg-[#FAFBFD] gap-2 overflow-x-auto scrollbar-none">
            {[
              { key: 'overview', label: 'Basic Info & Batches', icon: Layers },
              { key: 'purchases', label: `Purchase History (${purchases.length})`, icon: FileText },
              { key: 'movements', label: `Stock Movements (${movements.length})`, icon: Activity },
              {
                key: 'supplier',
                label: activeSupplier ? `Supplier: ${activeSupplier.name}` : 'Supplier Info',
                icon: Truck,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Basic Medicine Master Data
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8F9FB] p-4 sm:p-5 rounded-2xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Medicine SKU
                      </span>
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block border border-blue-100">
                        {medicine.sku}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Category
                      </span>
                      <span className="font-bold text-xs text-slate-800 block truncate">
                        {medicine.category}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Manufacturer
                      </span>
                      <span className="font-bold text-xs text-slate-800 block truncate">
                        {medicine.manufacturer}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Dosage Form &amp; Strength
                      </span>
                      <span className="font-bold text-xs text-slate-800 block truncate">
                        {medicine.dosageForm} ({medicine.strength})
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Unit of Measure
                      </span>
                      <span className="font-bold text-xs text-slate-800 block">
                        {medicine.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Minimum Threshold
                      </span>
                      <span className="font-bold text-xs text-slate-800 block">
                        {medicine.minimumStockLevel} {medicine.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Selling Price (MRP)
                      </span>
                      <span className="font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block border border-emerald-100">
                        ₹{Number(medicine.sellingPrice || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Barcode / EAN
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-700 flex items-center gap-1 truncate">
                        <Barcode className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{medicine.barcode || 'N/A'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Batches &amp; FEFO Inventory Allocation
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Batches are dispensed in First Expiry, First Out order to eliminate product expiration waste
                      </p>
                    </div>
                    {isDoctorUnlocked && (
                      <button
                        onClick={() => setShowAddBatchModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-blue-100 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Batch</span>
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-[0_10px_25px_0_rgba(0,0,0,0.03)]">
                    <table className="w-full text-left text-xs min-w-[700px]">
                      <thead className="bg-[#F8F9FB] text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-3.5 whitespace-nowrap">Batch Number</th>
                          <th className="py-3 px-3 whitespace-nowrap">Mfg Date</th>
                          <th className="py-3 px-3 whitespace-nowrap">Expiry Date</th>
                          <th className="py-3 px-3 whitespace-nowrap">Available Qty</th>
                          <th className="py-3 px-3 whitespace-nowrap">Buy Price</th>
                          <th className="py-3 px-3 whitespace-nowrap">Sell Price</th>
                          <th className="py-3 px-3 whitespace-nowrap">Supplier Tag</th>
                          <th className="py-3 pr-3.5 text-right whitespace-nowrap">Expiry Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batches.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                              No batches recorded yet. Add a batch to initiate inventory.
                            </td>
                          </tr>
                        ) : (
                          batches.map((b) => {
                            const isExp = new Date(b.expiryDate) < new Date();
                            const sixtyDays = new Date();
                            sixtyDays.setDate(sixtyDays.getDate() + 60);
                            const isNearExp = !isExp && new Date(b.expiryDate) <= sixtyDays;

                            return (
                              <tr key={b.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-3.5 font-bold text-slate-800 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                    <span>{b.batchNumber}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-slate-500 whitespace-nowrap font-medium">
                                  {b.manufacturingDate || 'N/A'}
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">
                                  {b.expiryDate}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span
                                    className={`font-bold px-2 py-0.5 rounded-full text-[10px] border ${
                                      b.availableQuantity > 10
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : b.availableQuantity > 0
                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                        : 'bg-red-50 text-red-700 border-red-100'
                                    }`}
                                  >
                                    {b.availableQuantity} units
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                                  ₹{b.purchasePrice.toFixed(2)}
                                </td>
                                <td className="py-3 px-3 text-slate-800 font-bold whitespace-nowrap">
                                  ₹{b.sellingPrice.toFixed(2)}
                                </td>
                                <td className="py-3 px-3 text-slate-600 truncate max-w-[140px] whitespace-nowrap">
                                  {b.supplierName || 'Self-Procured'}
                                </td>
                                <td className="py-3 pr-3.5 text-right whitespace-nowrap">
                                  {isExp ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                                      Expired (Blocked)
                                    </span>
                                  ) : isNearExp ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                                      Near Expiry
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                      Valid
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'purchases' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Procurement Invoices &amp; Purchase Log
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Historical procurement records logged for this medicine
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
                    Total Invoiced: ₹{purchases.reduce((s, p) => s + p.totalPurchaseAmount, 0).toFixed(2)}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-[0_10px_25px_0_rgba(0,0,0,0.03)]">
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead className="bg-[#F8F9FB] text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">Invoice #</th>
                        <th className="py-3 px-3 whitespace-nowrap">Date</th>
                        <th className="py-3 px-3 whitespace-nowrap">Supplier</th>
                        <th className="py-3 px-3 whitespace-nowrap">Batch</th>
                        <th className="py-3 px-3 whitespace-nowrap">Qty Purchased</th>
                        <th className="py-3 px-3 whitespace-nowrap">Unit Price</th>
                        <th className="py-3 pr-3.5 text-right whitespace-nowrap">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchases.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                            No purchase history found for this medicine.
                          </td>
                        </tr>
                      ) : (
                        purchases.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3.5 font-bold text-[#2563EB] whitespace-nowrap">
                              {p.invoiceNumber}
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {p.purchaseDate}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              {p.supplierName}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                              {p.batchNumber}
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                              +{p.quantityPurchased}
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              ₹{p.purchasePrice.toFixed(2)}
                            </td>
                            <td className="py-3 pr-3.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                              ₹{p.totalPurchaseAmount.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'movements' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Stock Audit Movement Ledger
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Chronological traceability log of all additions, adjustments, and dispensings
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold">
                    {movements.length} audit entries
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-[0_10px_25px_0_rgba(0,0,0,0.03)]">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-[#F8F9FB] text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">Date &amp; Time</th>
                        <th className="py-3 px-3 whitespace-nowrap">Movement Type</th>
                        <th className="py-3 px-3 whitespace-nowrap">Batch #</th>
                        <th className="py-3 px-3 whitespace-nowrap">Quantity</th>
                        <th className="py-3 px-3 whitespace-nowrap">Reference #</th>
                        <th className="py-3 px-3 whitespace-nowrap">Responsible User</th>
                        <th className="py-3 pr-3.5 text-right whitespace-nowrap">Audit Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                            No stock movement records found.
                          </td>
                        </tr>
                      ) : (
                        movements.map((m) => {
                          const isAdd = m.quantity > 0;
                          return (
                            <tr key={m.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                                {new Date(m.date).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span
                                  className={`font-bold px-2 py-0.5 rounded-full text-[10px] border ${
                                    m.movementType === 'Purchase'
                                      ? 'bg-blue-50 text-blue-700 border-blue-100'
                                      : m.movementType === 'Dispensing'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                      : m.movementType === 'Expired Stock' || m.movementType === 'Damaged Stock'
                                      ? 'bg-red-50 text-red-700 border-red-100'
                                      : 'bg-purple-50 text-purple-700 border-purple-100'
                                  }`}
                                >
                                  {m.movementType}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                                {m.batchNumber || 'N/A'}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`font-bold flex items-center gap-1 ${isAdd ? 'text-blue-700' : 'text-slate-800'}`}>
                                  {isAdd ? <TrendingUp className="w-3 h-3 text-blue-600" /> : <TrendingDown className="w-3 h-3 text-slate-500" />}
                                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                                {m.referenceNumber}
                              </td>
                              <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                                {m.responsibleUser}
                              </td>
                              <td className="py-3 pr-3.5 text-right text-slate-500 max-w-xs truncate" title={m.notes}>
                                {m.notes || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'supplier' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Vendor &amp; Procurement Logistics
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Verified vendor records mapped to this medicine and its procurement batches
                    </p>
                  </div>
                  {isDoctorUnlocked && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenNewSupplier}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Supplier</span>
                      </button>
                      {activeSupplier && (
                        <button
                          type="button"
                          onClick={handleOpenEditSupplier}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-blue-600" />
                          <span>Edit Supplier</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowLinkSupplierModal(true)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
                        <span>{activeSupplier ? 'Change Vendor' : 'Link Supplier'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {activeSupplier ? (
                  <div className="space-y-4">
                    <div className="bg-[#F8F9FB] rounded-2xl border border-slate-100 p-5 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-[#2563EB]">
                            <Building className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-800">
                              {activeSupplier.name}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Primary Vendor mapped to this molecule
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active Supplier
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Contact Person
                          </span>
                          <span className="font-bold text-slate-700 block">
                            {activeSupplier.contactPerson || 'Not provided'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Contact Phone
                          </span>
                          <span className="font-bold text-slate-700 block">
                            {activeSupplier.phone || 'Not provided'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Email Address
                          </span>
                          <span className="font-bold text-slate-700 block">
                            {activeSupplier.email || 'Not provided'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            GSTIN Registration
                          </span>
                          <span className="font-bold text-slate-700 block">
                            {activeSupplier.gstin || 'Not provided'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Last Purchase Date
                          </span>
                          <span className="font-bold text-slate-700 block">
                            {activeSupplier.lastPurchaseDate || medicine.lastPurchaseDate || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Last Purchase Unit Price
                          </span>
                          <span className="font-bold text-emerald-700 block">
                            {activeSupplier.lastPurchasePrice || medicine.lastPurchasePrice
                              ? `₹${Number(activeSupplier.lastPurchasePrice || medicine.lastPurchasePrice).toFixed(2)}`
                              : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {activeSupplier.address && (
                        <div className="pt-2 border-t border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Registered Warehouse Address
                          </span>
                          <p className="text-xs text-slate-700 font-medium">
                            {activeSupplier.address}
                          </p>
                        </div>
                      )}
                    </div>

                    {supplierBatches.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Batches Procured from {activeSupplier.name} ({supplierBatches.length})
                        </h4>
                        <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-[0_10px_25px_0_rgba(0,0,0,0.03)]">
                          <table className="w-full text-left text-xs min-w-[500px]">
                            <thead className="bg-[#F8F9FB] text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100">
                              <tr>
                                <th className="py-2.5 px-3 whitespace-nowrap">Batch Number</th>
                                <th className="py-2.5 px-3 whitespace-nowrap">Mfg Date</th>
                                <th className="py-2.5 px-3 whitespace-nowrap">Expiry Date</th>
                                <th className="py-2.5 px-3 whitespace-nowrap">Available Qty</th>
                                <th className="py-2.5 pr-3 text-right whitespace-nowrap">Purchase Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {supplierBatches.map((sb) => (
                                <tr key={sb.id} className="hover:bg-slate-50/70 transition">
                                  <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                                    {sb.batchNumber}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                    {sb.manufacturingDate}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                                    {sb.expiryDate}
                                  </td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span className="font-bold text-slate-800">
                                      {sb.availableQuantity} units
                                    </span>
                                  </td>
                                  <td className="py-2.5 pr-3 text-right text-slate-600 whitespace-nowrap">
                                    ₹{sb.purchasePrice.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-[#F8F9FB] rounded-2xl border border-slate-100 space-y-3">
                    <Building className="w-10 h-10 text-slate-300 mx-auto stroke-[1.5]" />
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">No Supplier Linked Yet</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        No vendor or distributor is currently linked to this medicine. You can add supplier details or link an existing supplier below.
                      </p>
                    </div>
                    {isDoctorUnlocked && (
                      <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={handleOpenNewSupplier}
                          className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Supplier Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLinkSupplierModal(true)}
                          className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
                          <span>Link Existing Wholesaler</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-[#FAFBFD]">
            <div className="text-xs text-slate-500 font-medium">
              Medicine SKU: <span className="font-mono text-slate-700 font-bold">{medicine.sku}</span>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer shadow-2xs"
            >
              Close Details
            </button>
          </div>
        </motion.div>

        <SupplierFormModal
          isOpen={isSupplierFormOpen}
          onClose={() => setIsSupplierFormOpen(false)}
          supplier={selectedSupplierForModal}
          onSuccess={handleSupplierFormSuccess}
        />

        {showLinkSupplierModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-800">
                      Select Wholesaler / Vendor
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Choose an established supplier to map to this molecule
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkSupplierModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 mt-4 max-h-72 overflow-y-auto">
                {suppliersList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No suppliers currently in directory. Register one below.
                  </p>
                ) : (
                  suppliersList.map((sup) => {
                    const isSelected = activeSupplier?.id === sup.id;
                    return (
                      <div
                        key={sup.id}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-50/60 border-blue-200'
                            : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-slate-800 truncate">{sup.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {sup.contactPerson || 'Vendor'} &bull; {sup.phone}
                          </p>
                          {sup.gstin && (
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              GST: {sup.gstin}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectExistingSupplier(sup)}
                          className={`px-3 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer flex-shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {isSelected ? 'Current Vendor' : 'Link to Medicine'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkSupplierModal(false);
                    handleOpenNewSupplier();
                  }}
                  className="font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Brand New Supplier</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkSupplierModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddBatchModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-800">
                      Register Procurement Batch
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Add a new manufactured batch with expiry and procurement costs
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddBatchModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateBatch} className="space-y-3.5 mt-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Batch Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. DL26M01"
                      value={batchNo}
                      onChange={(e) => setBatchNo(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Quantity (Units) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 50"
                      value={batchQty}
                      onChange={(e) => setBatchQty(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Manufacturing Date</label>
                    <input
                      type="date"
                      value={mfgDate}
                      onChange={(e) => setMfgDate(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Expiry Date *</label>
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Purchase Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 18.50"
                      value={batchBuyPrice}
                      onChange={(e) => setBatchBuyPrice(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Selling Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 32.00"
                      value={batchSellPrice}
                      onChange={(e) => setBatchSellPrice(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Invoice Number</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-9021"
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Supplier / Wholesaler</label>
                    <input
                      type="text"
                      list="suppliers-datalist"
                      placeholder="e.g. Apex Pharma Distributors"
                      value={supplierNameInput}
                      onChange={(e) => setSupplierNameInput(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                    <datalist id="suppliers-datalist">
                      {suppliersList.map((s) => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddBatchModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer text-xs"
                  >
                    Save Batch &amp; Record Purchase
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAdjustModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-800">Record Stock Adjustment</h3>
                    <p className="text-[11px] text-slate-400">Audit corrections, damages, expired stock or manual adjustments</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAdjustModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordAdjustment} className="space-y-3.5 mt-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Adjustment Type *</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as MovementType)}
                    className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white cursor-pointer"
                  >
                    <option value="Stock Adjustment">Stock Adjustment (Audit Correction)</option>
                    <option value="Damaged Stock">Damaged Stock (Deduction)</option>
                    <option value="Expired Stock">Expired Stock (Quarantine Write-off)</option>
                    <option value="Return">Supplier Return (Deduction)</option>
                    <option value="Purchase">Procurement Inflow (+)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Target Batch</label>
                    <select
                      value={adjustBatchId}
                      onChange={(e) => setAdjustBatchId(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white cursor-pointer"
                    >
                      <option value="">Default (First Available)</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batchNumber} ({b.availableQuantity} units left)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Units quantity"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Reference Number / Audit ID</label>
                  <input
                    type="text"
                    placeholder="e.g. AUDIT-2026-Q4"
                    value={adjustRef}
                    onChange={(e) => setAdjustRef(e.target.value)}
                    className="w-full h-10 px-3 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Reason / Clinical Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Explain the discrepancy or quarantine justification..."
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAdjustModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer text-xs"
                  >
                    Commit Adjustment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {isEditModalOpen && (
          <EditMedicineModal
            medicine={medicine}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onMedicineUpdated={() => {
              onMedicineUpdated();
            }}
          />
        )}
      </div>
    </AnimatePresence>
  );
}
