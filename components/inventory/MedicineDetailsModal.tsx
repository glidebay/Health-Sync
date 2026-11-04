'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Package,
  Layers,
  Calendar,
  AlertTriangle,
  Clock,
  Truck,
  FileText,
  Activity,
  Plus,
  SlidersHorizontal,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Barcode,
  Building,
} from 'lucide-react';
import {
  MedicineMaster,
  MedicineBatch,
  PurchaseRecord,
  StockMovement,
  MovementType,
  Supplier,
} from '@/types/medicine';
import {
  fetchPurchaseHistory,
  fetchStockMovements,
  fetchSuppliers,
  addBatchToMedicine,
  recordStockAdjustment,
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

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicine || !batchNo.trim() || !expDate || !batchQty) return;

    const qty = parseInt(batchQty, 10);
    const buyPrice = parseFloat(batchBuyPrice) || medicine.lastPurchasePrice || 0;
    const sellPrice = parseFloat(batchSellPrice) || medicine.sellingPrice || 0;

    await addBatchToMedicine({
      medicineId: medicine.id,
      batchNumber: batchNo.trim(),
      manufacturingDate: mfgDate || new Date().toISOString().split('T')[0],
      expiryDate: expDate,
      purchasePrice: buyPrice,
      sellingPrice: sellPrice,
      quantity: qty,
      supplierName: supplierNameInput.trim() || undefined,
      invoiceNumber: invoiceNo.trim() || `INV-${Date.now().toString().slice(-6)}`,
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
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden"
        >
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-[#FAFBFD]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 text-[#2563EB] border border-blue-100 tracking-wider">
                  {medicine.sku}
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
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
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                    medicine.expiryStatus === 'Valid'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : medicine.expiryStatus === 'Near Expiry'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {medicine.expiryStatus}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#16191E] mt-1.5 truncate">
                {medicine.brandName}
              </h2>
              <p className="text-xs text-[#8A909D] font-medium mt-0.5">
                {medicine.genericName} &bull; {medicine.dosageForm} ({medicine.strength}) &bull; {medicine.manufacturer}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isDoctorUnlocked && (
                <>
                  <button
                    onClick={() => setShowAdjustModal(true)}
                    className="p-2 sm:px-3 sm:py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Stock Adjustment"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Adjust Stock</span>
                  </button>
                  <button
                    onClick={() => setShowAddBatchModal(true)}
                    className="p-2 sm:px-3 sm:py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8F9FB] p-4 rounded-2xl border border-slate-100 text-xs">
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Medicine SKU</p>
                      <p className="font-bold text-slate-800 mt-0.5">{medicine.sku}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Category</p>
                      <p className="font-bold text-slate-800 mt-0.5">{medicine.category}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Manufacturer</p>
                      <p className="font-bold text-slate-800 mt-0.5">{medicine.manufacturer}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Dosage Form</p>
                      <p className="font-bold text-slate-800 mt-0.5">
                        {medicine.dosageForm} ({medicine.strength})
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Unit of Measure</p>
                      <p className="font-bold text-slate-800 mt-0.5">{medicine.unit}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Minimum Threshold</p>
                      <p className="font-bold text-slate-800 mt-0.5">
                        {medicine.minimumStockLevel} {medicine.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Selling Price (MRP)</p>
                      <p className="font-bold text-emerald-700 mt-0.5">
                        ₹{Number(medicine.sellingPrice || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Barcode / EAN</p>
                      <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                        <Barcode className="w-3.5 h-3.5 text-slate-400" />
                        {medicine.barcode || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Batches & FEFO Inventory Allocation
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Batches are dispensed in First Expiry, First Out order to eliminate product expiration waste.
                      </p>
                    </div>
                    {isDoctorUnlocked && (
                      <button
                        onClick={() => setShowAddBatchModal(true)}
                        className="text-xs text-[#2563EB] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Add Batch
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8F9FB] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-3.5">Batch Number</th>
                          <th className="py-2.5 px-3">Mfg Date</th>
                          <th className="py-2.5 px-3">Expiry Date</th>
                          <th className="py-2.5 px-3">Available Qty</th>
                          <th className="py-2.5 px-3">Buy Price</th>
                          <th className="py-2.5 px-3">Sell Price</th>
                          <th className="py-2.5 px-3">Supplier Tag</th>
                          <th className="py-2.5 px-3">Expiry Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batches.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-400">
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
                                <td className="py-2.5 px-3.5 font-bold text-slate-800 flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-blue-500" />
                                  {b.batchNumber}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">{b.manufacturingDate || 'N/A'}</td>
                                <td className="py-2.5 px-3 font-semibold text-slate-700">{b.expiryDate}</td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`font-bold px-2 py-0.5 rounded-md ${
                                      b.availableQuantity > 10
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : b.availableQuantity > 0
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-red-50 text-red-700'
                                    }`}
                                  >
                                    {b.availableQuantity} units
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">₹{b.purchasePrice.toFixed(2)}</td>
                                <td className="py-2.5 px-3 text-slate-800 font-semibold">₹{b.sellingPrice.toFixed(2)}</td>
                                <td className="py-2.5 px-3 text-slate-600 truncate max-w-[120px]">
                                  {b.supplierName || 'Self-Procured'}
                                </td>
                                <td className="py-2.5 px-3">
                                  {isExp ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">
                                      Expired (Blocked)
                                    </span>
                                  ) : isNearExp ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                                      Near Expiry
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
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
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Procurement Invoices & Purchase Log
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    Total Invoiced: ₹{purchases.reduce((s, p) => s + p.totalPurchaseAmount, 0).toFixed(2)}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8F9FB] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-3.5">Invoice #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Supplier</th>
                        <th className="py-2.5 px-3">Batch</th>
                        <th className="py-2.5 px-3">Qty Purchased</th>
                        <th className="py-2.5 px-3">Unit Price</th>
                        <th className="py-2.5 px-3">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchases.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No purchase history found for this medicine.
                          </td>
                        </tr>
                      ) : (
                        purchases.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3.5 font-bold text-[#2563EB]">{p.invoiceNumber}</td>
                            <td className="py-2.5 px-3 text-slate-600">{p.purchaseDate}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{p.supplierName}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{p.batchNumber}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">+{p.quantityPurchased}</td>
                            <td className="py-2.5 px-3 text-slate-600">₹{p.purchasePrice.toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-bold text-emerald-700">₹{p.totalPurchaseAmount.toFixed(2)}</td>
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
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Comprehensive Stock Audit Movement Ledger
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    Chronological audit log
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8F9FB] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-3.5">Date & Time</th>
                        <th className="py-2.5 px-3">Movement Type</th>
                        <th className="py-2.5 px-3">Batch #</th>
                        <th className="py-2.5 px-3">Quantity</th>
                        <th className="py-2.5 px-3">Reference #</th>
                        <th className="py-2.5 px-3">Responsible User</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No stock movement records found.
                          </td>
                        </tr>
                      ) : (
                        movements.map((m) => {
                          const isAdd = m.quantity > 0;
                          return (
                            <tr key={m.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                                {new Date(m.date).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                                    m.movementType === 'Purchase'
                                      ? 'bg-blue-50 text-blue-700'
                                      : m.movementType === 'Dispensing'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : m.movementType === 'Expired Stock' || m.movementType === 'Damaged Stock'
                                      ? 'bg-red-50 text-red-700'
                                      : 'bg-purple-50 text-purple-700'
                                  }`}
                                >
                                  {m.movementType}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">{m.batchNumber || 'N/A'}</td>
                              <td className="py-2.5 px-3">
                                <span className={`font-bold flex items-center gap-1 ${isAdd ? 'text-blue-700' : 'text-slate-800'}`}>
                                  {isAdd ? <TrendingUp className="w-3 h-3 text-blue-600" /> : <TrendingDown className="w-3 h-3 text-slate-500" />}
                                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-700">{m.referenceNumber}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-medium">{m.responsibleUser}</td>
                              <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={m.notes}>
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
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Vendor & Procurement Logistics
                  </h3>
                  {activeSupplier && (
                    <span className="text-[11px] text-slate-500 font-medium">
                      Source: Batches & Purchase Invoices
                    </span>
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
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active Supplier
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium">Contact Person</p>
                          <p className="font-bold text-slate-700 mt-0.5">
                            {activeSupplier.contactPerson || 'Not provided'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium">Contact Phone</p>
                          <p className="font-bold text-slate-700 mt-0.5">
                            {activeSupplier.phone || 'Not provided'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium">Email Address</p>
                          <p className="font-bold text-slate-700 mt-0.5">
                            {activeSupplier.email || 'Not provided'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium">GSTIN Registration</p>
                          <p className="font-bold text-slate-700 mt-0.5">
                            {activeSupplier.gstin || 'Not provided'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium">Last Purchase Date</p>
                          <p className="font-bold text-slate-700 mt-0.5">
                            {activeSupplier.lastPurchaseDate || medicine.lastPurchaseDate || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium">Last Purchase Unit Price</p>
                          <p className="font-bold text-emerald-700 mt-0.5">
                            {activeSupplier.lastPurchasePrice || medicine.lastPurchasePrice
                              ? `₹${Number(activeSupplier.lastPurchasePrice || medicine.lastPurchasePrice).toFixed(2)}`
                              : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {activeSupplier.address && (
                        <div className="pt-2 border-t border-slate-200/60">
                          <p className="text-[11px] text-slate-400 font-medium">Registered Warehouse Address</p>
                          <p className="text-xs text-slate-700 font-medium mt-0.5">
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
                        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#F8F9FB] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100">
                              <tr>
                                <th className="py-2 px-3">Batch Number</th>
                                <th className="py-2 px-3">Mfg Date</th>
                                <th className="py-2 px-3">Expiry Date</th>
                                <th className="py-2 px-3">Available Qty</th>
                                <th className="py-2 px-3">Purchase Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {supplierBatches.map((b) => (
                                <tr key={b.id} className="hover:bg-slate-50/70 transition">
                                  <td className="py-2 px-3 font-mono font-bold text-slate-800">{b.batchNumber}</td>
                                  <td className="py-2 px-3 text-slate-500">{b.manufacturingDate || 'N/A'}</td>
                                  <td className="py-2 px-3 text-slate-700 font-semibold">{b.expiryDate}</td>
                                  <td className="py-2 px-3 font-bold text-slate-800">{b.availableQuantity} units</td>
                                  <td className="py-2 px-3 text-slate-600">₹{b.purchasePrice.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {allRecordedSuppliers.length > 1 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          All Wholesalers on Record for this Medicine
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {allRecordedSuppliers.map((s, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-[#F8F9FB] rounded-xl border border-slate-100 flex items-center justify-between"
                            >
                              <div>
                                <p className="font-bold text-slate-800">{s.name}</p>
                                <p className="text-[11px] text-slate-400">{s.count} batch procurements recorded</p>
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">
                                Last: {s.lastDate || 'Recent'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#F8F9FB] rounded-2xl border border-slate-100 p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">No Supplier Linked Yet</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        No vendor or distributor is currently linked to this medicine. When you add a new procurement batch, you can select or enter a supplier.
                      </p>
                    </div>
                    {isDoctorUnlocked && (
                      <button
                        onClick={() => setShowAddBatchModal(true)}
                        className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Procurement Batch</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-[#FAFBFD]">
            <div className="text-xs text-slate-500 font-medium">
              Medicine ID: <span className="font-mono text-slate-700">{medicine.id}</span>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer shadow-2xs"
            >
              Close Details
            </button>
          </div>
        </motion.div>

        {showAddBatchModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-800">
                  Register New Procurement Batch
                </h3>
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
                      className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
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
                      className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
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
                      className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Expiry Date *</label>
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
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
                      className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
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
                      className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
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
                      className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
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
                      className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                    <datalist id="suppliers-datalist">
                      {suppliersList.map((s) => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddBatchModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs cursor-pointer"
                  >
                    Save Batch & Record Purchase
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
                <h3 className="font-bold text-base text-slate-800">Record Stock Adjustment</h3>
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
                    className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
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
                      className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
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
                      className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
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
                    className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Reason / Clinical Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Explain the discrepancy or quarantine justification..."
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="w-full p-2.5 bg-[#F8F9FB] border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAdjustModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs cursor-pointer"
                  >
                    Commit Adjustment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
