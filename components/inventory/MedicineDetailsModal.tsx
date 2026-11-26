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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Editorial Modal Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  SKU {medicine.sku} • {medicine.dosageForm} ({medicine.strength})
                </span>
                <span
                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                    medicine.stockStatus === 'Available'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                      : medicine.stockStatus === 'Low Stock'
                      ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                      : 'bg-rose-50 text-rose-700 border-rose-200/70'
                  }`}
                >
                  {medicine.stockStatus} ({medicine.totalStock} {medicine.unit})
                </span>
                <span
                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                    medicine.expiryStatus === 'Valid'
                      ? 'bg-white text-slate-600 border-slate-200'
                      : medicine.expiryStatus === 'Near Expiry'
                      ? 'bg-orange-50 text-orange-700 border-orange-200/70'
                      : 'bg-rose-50 text-rose-700 border-rose-200/70'
                  }`}
                >
                  {medicine.expiryStatus}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-semibold text-[#16191E] truncate">
                {medicine.brandName}
              </h2>

              <p className="text-xs text-slate-500 truncate">
                {medicine.genericName} • {medicine.manufacturer}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center flex-wrap">
              {isDoctorUnlocked && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-full transition inline-flex items-center gap-1.5 cursor-pointer"
                    title="Edit Medicine Master & Pricing"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdjustModal(true)}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-full transition inline-flex items-center gap-1.5 cursor-pointer"
                    title="Stock Adjustment"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Adjust Stock</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddBatchModal(true)}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-full transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Procure Batch"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Batch</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pill Tab Navigation */}
          <div className="flex items-center border-b border-slate-100 px-6 py-3 bg-white gap-2 overflow-x-auto scrollbar-none">
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
                  type="button"
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Modal Body */}
          <div className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-7">
            {activeTab === 'overview' && (
              <div className="space-y-7">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-3">
                    Medicine Master Summary
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/70 p-5 rounded-2xl border border-[#ECEEF2] text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">SKU Code</span>
                      <span className="font-medium text-slate-800">{medicine.sku}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Category</span>
                      <span className="font-medium text-slate-800 block truncate">{medicine.category}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Manufacturer</span>
                      <span className="font-medium text-slate-800 block truncate">{medicine.manufacturer}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Form &amp; Strength</span>
                      <span className="font-medium text-slate-800 block truncate">
                        {medicine.dosageForm} ({medicine.strength})
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Unit of Measure</span>
                      <span className="font-medium text-slate-800">{medicine.unit}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Min Reorder Level</span>
                      <span className="font-medium text-slate-800">
                        {medicine.minimumStockLevel} {medicine.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Retail Price (MRP)</span>
                      <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        ₹{Number(medicine.sellingPrice || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Barcode / EAN</span>
                      <span className="font-medium text-slate-700 flex items-center gap-1 truncate">
                        <Barcode className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{medicine.barcode || 'N/A'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-[#16191E]">
                        Batches &amp; FEFO Allocation
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Dispensed in First Expiry, First Out order to prevent expiry waste.
                      </p>
                    </div>
                    {isDoctorUnlocked && (
                      <button
                        type="button"
                        onClick={() => setShowAddBatchModal(true)}
                        className="px-3.5 py-1.5 rounded-full border border-blue-200 bg-blue-50 hover:bg-[#2563EB] hover:text-white text-[#2563EB] text-xs font-medium transition-colors inline-flex items-center gap-1 cursor-pointer flex-shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Batch</span>
                      </button>
                    )}
                  </div>

                  {batches.length === 0 ? (
                    <div className="border-y border-slate-200/80 py-10 text-center text-xs text-slate-400">
                      No batches recorded yet. Add a batch to initiate inventory.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                      {batches.map((b, index) => {
                        const isExp = new Date(b.expiryDate) < new Date();
                        const sixtyDays = new Date();
                        sixtyDays.setDate(sixtyDays.getDate() + 60);
                        const isNearExp = !isExp && new Date(b.expiryDate) <= sixtyDays;
                        const rowNumber = String(index + 1).padStart(2, '0');

                        return (
                          <li
                            key={b.id}
                            className="py-4 grid grid-cols-1 sm:grid-cols-[2rem_1.2fr_1.4fr_auto] gap-3 sm:gap-5 items-start sm:items-center"
                          >
                            <span className="text-xs font-medium text-slate-400 tabular-nums">
                              {rowNumber}
                            </span>

                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="text-xs sm:text-sm font-medium text-[#16191E] truncate">
                                  Batch {b.batchNumber}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">
                                Mfg: {b.manufacturingDate || 'N/A'} • Exp: {b.expiryDate}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                                  b.availableQuantity > 10
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                                    : b.availableQuantity > 0
                                    ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                                    : 'bg-rose-50 text-rose-700 border-rose-200/70'
                                }`}
                              >
                                {b.availableQuantity} units left
                              </span>
                              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-600">
                                Buy ₹{b.purchasePrice.toFixed(2)} • Sell ₹{b.sellingPrice.toFixed(2)}
                              </span>
                              <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                                {b.supplierName || 'Self-Procured'}
                              </span>
                            </div>

                            <div className="flex items-center justify-end">
                              {isExp ? (
                                <span className="rounded-full bg-rose-50 border border-rose-200/70 px-3 py-0.5 text-[11px] font-medium text-rose-700">
                                  Expired (Blocked)
                                </span>
                              ) : isNearExp ? (
                                <span className="rounded-full bg-orange-50 border border-orange-200/70 px-3 py-0.5 text-[11px] font-medium text-orange-700">
                                  Near Expiry
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-50 border border-emerald-200/70 px-3 py-0.5 text-[11px] font-medium text-emerald-700">
                                  Valid
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'purchases' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-[#16191E]">
                      Procurement Invoices &amp; Purchase Log
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Historical procurement records logged for this medicine.
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-3.5 py-1 text-xs font-medium text-emerald-700">
                    Total Invoiced: ₹{purchases.reduce((s, p) => s + p.totalPurchaseAmount, 0).toFixed(2)}
                  </span>
                </div>

                {loadingHistory ? (
                  <p className="text-xs text-slate-400 py-8 border-y border-slate-200/80 text-center">
                    Loading purchase history...
                  </p>
                ) : purchases.length === 0 ? (
                  <div className="border-y border-slate-200/80 py-10 text-center text-xs text-slate-400">
                    No purchase history found for this medicine.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                    {purchases.map((p, index) => (
                      <li
                        key={p.id}
                        className="py-4 grid grid-cols-1 sm:grid-cols-[2rem_1.2fr_1.3fr_auto] gap-3 sm:gap-5 items-start sm:items-center"
                      >
                        <span className="text-xs font-medium text-slate-400 tabular-nums">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <span className="text-xs sm:text-sm font-medium text-[#16191E] block">
                            Invoice {p.invoiceNumber}
                          </span>
                          <p className="text-xs text-slate-500">
                            {p.purchaseDate} • Batch {p.batchNumber}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-slate-700 font-medium">{p.supplierName}</span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-600">
                            +{p.quantityPurchased} units @ ₹{p.purchasePrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-end">
                          <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 tabular-nums">
                            ₹{p.totalPurchaseAmount.toFixed(2)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'movements' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-[#16191E]">
                      Stock Audit Movement Ledger
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Chronological log of all additions, adjustments, and dispensings.
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    {movements.length} audit entries
                  </span>
                </div>

                {loadingHistory ? (
                  <p className="text-xs text-slate-400 py-8 border-y border-slate-200/80 text-center">
                    Loading stock movements...
                  </p>
                ) : movements.length === 0 ? (
                  <div className="border-y border-slate-200/80 py-10 text-center text-xs text-slate-400">
                    No stock movement records found.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                    {movements.map((m, index) => {
                      const isAdd = m.quantity > 0;
                      return (
                        <li
                          key={m.id}
                          className="py-4 grid grid-cols-1 sm:grid-cols-[2rem_1.2fr_1.4fr_auto] gap-3 sm:gap-5 items-start sm:items-center"
                        >
                          <span className="text-xs font-medium text-slate-400 tabular-nums">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                                  m.movementType === 'Purchase'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200/70'
                                    : m.movementType === 'Dispensing'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                                    : m.movementType === 'Expired Stock' || m.movementType === 'Damaged Stock'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200/70'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {m.movementType}
                              </span>
                              <span className="text-xs text-slate-500">
                                Ref: {m.referenceNumber}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              {new Date(m.date).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              • Batch {m.batchNumber || 'N/A'}
                            </p>
                          </div>

                          <div className="min-w-0 space-y-1 text-xs">
                            <span className="text-slate-700 font-medium block truncate">
                              By {m.responsibleUser}
                            </span>
                            {m.notes && (
                              <p className="text-[11px] text-slate-500 truncate" title={m.notes}>
                                {m.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-end">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium tabular-nums ${
                                isAdd
                                  ? 'bg-blue-50 text-blue-700 border-blue-200/70'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {isAdd ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'supplier' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-[#16191E]">
                      Vendor &amp; Procurement Logistics
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vendor records mapped to this medicine and its procurement batches.
                    </p>
                  </div>
                  {isDoctorUnlocked && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleOpenNewSupplier}
                        className="px-3.5 py-1.5 bg-blue-50 hover:bg-[#2563EB] hover:text-white text-[#2563EB] border border-blue-200 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Supplier</span>
                      </button>
                      {activeSupplier && (
                        <button
                          type="button"
                          onClick={handleOpenEditSupplier}
                          className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-full text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit Supplier</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowLinkSupplierModal(true)}
                        className="px-3.5 py-1.5 bg-white hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] border border-slate-200 text-slate-700 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>{activeSupplier ? 'Change Vendor' : 'Link Supplier'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {activeSupplier ? (
                  <div className="space-y-6">
                    <div className="bg-slate-50/70 rounded-2xl border border-[#ECEEF2] p-5 sm:p-6 space-y-5">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 flex items-center justify-center text-blue-600">
                            <Building className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm sm:text-base text-[#16191E]">
                              {activeSupplier.name}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Primary vendor mapped to this medicine
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                          Active Supplier
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs pt-2 border-t border-slate-200/70">
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-0.5">Contact Person</span>
                          <span className="font-medium text-slate-800">{activeSupplier.contactPerson || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-0.5">Phone Number</span>
                          <span className="font-medium text-slate-800">{activeSupplier.phone || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-0.5">Email Address</span>
                          <span className="font-medium text-slate-800">{activeSupplier.email || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-0.5">GSTIN</span>
                          <span className="font-medium text-slate-800">{activeSupplier.gstin || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-0.5">Last Purchase Date</span>
                          <span className="font-medium text-slate-800">
                            {activeSupplier.lastPurchaseDate || medicine.lastPurchaseDate || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-0.5">Last Unit Price</span>
                          <span className="font-medium text-emerald-700">
                            {activeSupplier.lastPurchasePrice || medicine.lastPurchasePrice
                              ? `₹${Number(activeSupplier.lastPurchasePrice || medicine.lastPurchasePrice).toFixed(2)}`
                              : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {activeSupplier.address && (
                        <div className="pt-3 border-t border-slate-200/70">
                          <span className="text-[11px] text-slate-400 block mb-0.5">Warehouse Address</span>
                          <p className="text-xs text-slate-700">{activeSupplier.address}</p>
                        </div>
                      )}
                    </div>

                    {supplierBatches.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">
                          Batches Procured from {activeSupplier.name} ({supplierBatches.length})
                        </h4>
                        <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                          {supplierBatches.map((sb, idx) => (
                            <li
                              key={sb.id}
                              className="py-3.5 grid grid-cols-1 sm:grid-cols-[2rem_1fr_1fr_auto] gap-2 sm:gap-4 items-center text-xs"
                            >
                              <span className="text-xs font-medium text-slate-400 tabular-nums">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <div>
                                <span className="font-medium text-[#16191E] block">Batch {sb.batchNumber}</span>
                                <span className="text-slate-500">Mfg: {sb.manufacturingDate} • Exp: {sb.expiryDate}</span>
                              </div>
                              <div>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-700">
                                  {sb.availableQuantity} units left
                                </span>
                              </div>
                              <div className="sm:text-right font-medium text-slate-700">
                                ₹{sb.purchasePrice.toFixed(2)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-[#ECEEF2] space-y-3">
                    <div className="w-11 h-11 rounded-full border border-slate-200 bg-white text-slate-400 flex items-center justify-center mx-auto">
                      <Building className="w-5 h-5 stroke-[1.75]" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-slate-800">No Supplier Linked Yet</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Link an existing vendor or register new supplier details for this medicine.
                      </p>
                    </div>
                    {isDoctorUnlocked && (
                      <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={handleOpenNewSupplier}
                          className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium rounded-full transition cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Supplier Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLinkSupplierModal(true)}
                          className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-full transition cursor-pointer inline-flex items-center gap-1.5"
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

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="text-xs text-slate-500">
              SKU: <span className="font-medium text-slate-700">{medicine.sku}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] border border-slate-200 rounded-full transition-colors cursor-pointer"
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
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-semibold text-sm text-[#16191E]">
                    Select Wholesaler / Vendor
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Choose a supplier to map to this medicine
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkSupplierModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-2 max-h-72 overflow-y-auto divide-y divide-slate-100">
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
                        className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-xs sm:text-sm text-[#16191E] truncate">{sup.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {sup.contactPerson || 'Vendor'} {sup.phone ? `• ${sup.phone}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectExistingSupplier(sup)}
                          className={`px-3.5 py-1.5 rounded-full font-medium transition text-xs cursor-pointer flex-shrink-0 ${
                            isSelected
                              ? 'bg-[#2563EB] text-white'
                              : 'bg-white hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] text-slate-700 border border-slate-200'
                          }`}
                        >
                          {isSelected ? 'Current Vendor' : 'Link'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkSupplierModal(false);
                    handleOpenNewSupplier();
                  }}
                  className="font-medium text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Supplier</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkSupplierModal(false)}
                  className="px-4 py-1.5 border border-slate-200 bg-white rounded-full font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddBatchModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-semibold text-sm text-[#16191E]">
                    Register Procurement Batch
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Add a new batch with expiry date and pricing
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddBatchModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateBatch} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1.5">Batch Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. DL26M01"
                      value={batchNo}
                      onChange={(e) => setBatchNo(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1.5">Quantity (Units) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 50"
                      value={batchQty}
                      onChange={(e) => setBatchQty(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1.5">Manufacturing Date</label>
                    <input
                      type="date"
                      value={mfgDate}
                      onChange={(e) => setMfgDate(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1.5">Expiry Date *</label>
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1.5">Purchase Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 18.50"
                      value={batchBuyPrice}
                      onChange={(e) => setBatchBuyPrice(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1.5">Selling Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 32.00"
                      value={batchSellPrice}
                      onChange={(e) => setBatchSellPrice(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1.5">Invoice Number</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-9021"
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1.5">Supplier / Wholesaler</label>
                    <input
                      type="text"
                      list="suppliers-datalist"
                      placeholder="e.g. Apex Pharma Distributors"
                      value={supplierNameInput}
                      onChange={(e) => setSupplierNameInput(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white"
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
                    className="px-4 py-2 border border-slate-200 rounded-full font-medium text-slate-600 hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-full font-medium shadow-2xs cursor-pointer text-xs"
                  >
                    Save Batch
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAdjustModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-semibold text-sm text-[#16191E]">Record Stock Adjustment</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Audit corrections, damages, or expired stock write-offs</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRecordAdjustment} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1.5">Adjustment Type *</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as MovementType)}
                    className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white cursor-pointer"
                  >
                    <option value="Stock Adjustment">Stock Adjustment (Audit Correction)</option>
                    <option value="Damaged Stock">Damaged Stock (Deduction)</option>
                    <option value="Expired Stock">Expired Stock (Quarantine Write-off)</option>
                    <option value="Return">Supplier Return (Deduction)</option>
                    <option value="Purchase">Procurement Inflow (+)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1.5">Target Batch</label>
                    <select
                      value={adjustBatchId}
                      onChange={(e) => setAdjustBatchId(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white cursor-pointer"
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
                    <label className="block text-slate-600 font-medium mb-1.5">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Units quantity"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1.5">Reference Number / Audit ID</label>
                  <input
                    type="text"
                    placeholder="e.g. AUDIT-2026-Q4"
                    value={adjustRef}
                    onChange={(e) => setAdjustRef(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1.5">Reason / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Explain the discrepancy or quarantine justification..."
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="w-full p-3 bg-slate-50/70 border border-slate-200 rounded-xl font-medium outline-none focus:border-slate-400 text-xs transition focus:bg-white resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAdjustModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-full font-medium text-slate-600 hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-full font-medium shadow-2xs cursor-pointer text-xs"
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
