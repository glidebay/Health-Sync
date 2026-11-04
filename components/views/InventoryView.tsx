'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Boxes,
  Search,
  X,
  Plus,
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  Filter,
  Eye,
  Barcode,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Building,
  ChevronDown,
  Check,
} from 'lucide-react';
import { InventoryItem } from '@/types';
import { MedicineMaster, DosageForm, Supplier } from '@/types/medicine';
import { NumberedPagination } from '@/components/ui/pagination';
import { MedicineDetailsModal } from '@/components/inventory/MedicineDetailsModal';
import { MedicineCsvImportModal } from '@/components/inventory/MedicineCsvImportModal';
import { SupplierFormModal } from '@/components/inventory/SupplierFormModal';
import {
  fetchMedicinesMaster,
  fetchSuppliers,
  addMedicineWithInitialBatch,
  convertMasterToInventoryItems,
} from '@/lib/medicineService';

interface InventoryViewProps {
  inventory: InventoryItem[];
  newGeneric: string;
  setNewGeneric: (v: string) => void;
  newBrand: string;
  setNewBrand: (v: string) => void;
  newQty: string;
  setNewQty: (v: string) => void;
  stockUpdates: Record<string, string>;
  setStockUpdates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAddNewProcurement: (e: React.FormEvent) => void;
  onUpdateStock: (id: string | number) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isDoctorUnlocked?: boolean;
  onInventorySync?: (updatedItems: InventoryItem[]) => void;
}

const DEFAULT_CATEGORIES = [
  'Analgesics & Antipyretics',
  'Antibiotics',
  'Gastrointestinal',
  'Respiratory & Anti-Allergic',
  'Cardiovascular',
  'Dermatology',
  'Vitamins & Supplements',
  'Anti-Diabetic',
  'ENT & Ophthalmology',
  'Antihistamines',
  'Antifungal',
  'Neurology & Psychiatry',
  'Orthopedic & Musculoskeletal',
  'Gynecology & Women’s Health',
  'Pediatric Care',
  'General Medicine',
];

const ITEMS_PER_PAGE = 7;

export function InventoryView({
  inventory,
  newGeneric,
  setNewGeneric,
  newBrand,
  setNewBrand,
  newQty,
  setNewQty,
  stockUpdates,
  setStockUpdates,
  onAddNewProcurement,
  onUpdateStock,
  searchQuery = '',
  onSearchChange,
  isDoctorUnlocked = true,
  onInventorySync,
}: InventoryViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [internalSearch, setInternalSearch] = useState(searchQuery);

  const [medicines, setMedicines] = useState<MedicineMaster[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);

  const [selectedMedicine, setSelectedMedicine] = useState<MedicineMaster | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('All');
  const [expiryStatusFilter, setExpiryStatusFilter] = useState<string>('All');

  const [showFullAddForm, setShowFullAddForm] = useState(false);
  const [addSku, setAddSku] = useState('');
  const [addManufacturer, setAddManufacturer] = useState('');
  const [addCategory, setAddCategory] = useState('General Medicine');
  const [addDosageForm, setAddDosageForm] = useState<DosageForm>('Tablet');
  const [addStrength, setAddStrength] = useState('');
  const [addUnit, setAddUnit] = useState('Strips');
  const [addBarcode, setAddBarcode] = useState('');
  const [addBatchNo, setAddBatchNo] = useState('');
  const [addMfgDate, setAddMfgDate] = useState('');
  const [addExpDate, setAddExpDate] = useState('');
  const [addBuyPrice, setAddBuyPrice] = useState('');
  const [addSellPrice, setAddSellPrice] = useState('');
  const [addSupplierName, setAddSupplierName] = useState('');
  const [addSupplierId, setAddSupplierId] = useState('');
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<Supplier | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoadingMeds(true);
    try {
      const [data, sups] = await Promise.all([
        fetchMedicinesMaster(),
        fetchSuppliers(),
      ]);
      setMedicines(data);
      setSuppliersList(sups);
      if (onInventorySync) {
        onInventorySync(convertMasterToInventoryItems(data));
      }
    } finally {
      setLoadingMeds(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setInternalSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setInternalSearch(value);
    setCurrentPage(1);
    onSearchChange?.(value);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [medicines]);

  const allAvailableCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    medicines.forEach((m) => {
      if (m.category && m.category.trim()) {
        set.add(m.category.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [medicines]);

  const filteredCategories = useMemo(() => {
    const q = addCategory.trim().toLowerCase();
    if (!q) return allAvailableCategories;
    return allAvailableCategories.filter((c) => c.toLowerCase().includes(q));
  }, [allAvailableCategories, addCategory]);

  const totalMedicines = medicines.length;
  const adequateCount = medicines.filter((m) => m.stockStatus === 'Available').length;
  const lowStockCount = medicines.filter((m) => m.stockStatus === 'Low Stock').length;
  const outOfStockCount = medicines.filter((m) => m.stockStatus === 'Out of Stock').length;
  const nearExpiryCount = medicines.filter((m) => m.expiryStatus === 'Near Expiry').length;
  const expiredCount = medicines.filter((m) => m.expiryStatus === 'Expired').length;

  const filteredMedicines = useMemo(() => {
    const q = internalSearch.trim().toLowerCase();

    return medicines.filter((m) => {
      if (categoryFilter !== 'All' && m.category !== categoryFilter) return false;
      if (stockStatusFilter !== 'All' && m.stockStatus !== stockStatusFilter) return false;
      if (expiryStatusFilter !== 'All' && m.expiryStatus !== expiryStatusFilter) return false;

      if (!q) return true;

      const brand = (m.brandName || '').toLowerCase();
      const generic = (m.genericName || '').toLowerCase();
      const sku = (m.sku || '').toLowerCase();
      const barcode = (m.barcode || '').toLowerCase();
      const mfg = (m.manufacturer || '').toLowerCase();

      return (
        brand.includes(q) ||
        generic.includes(q) ||
        sku.includes(q) ||
        barcode.includes(q) ||
        mfg.includes(q)
      );
    });
  }, [medicines, internalSearch, categoryFilter, stockStatusFilter, expiryStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMedicines.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedMedicines = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMedicines.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMedicines, currentPage]);

  const handleOpenDetails = (med: MedicineMaster) => {
    setSelectedMedicine(med);
    setIsDetailsOpen(true);
  };

  const handleCreateFullMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand.trim() || !newGeneric.trim() || !newQty || !addExpDate) return;

    const qty = parseInt(newQty, 10);
    const buyPrice = parseFloat(addBuyPrice) || 0;
    const sellPrice = parseFloat(addSellPrice) || buyPrice * 1.4;

    const newMed = await addMedicineWithInitialBatch({
      sku: addSku.trim() || `MED-${newBrand.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      brandName: newBrand.trim(),
      genericName: newGeneric.trim(),
      manufacturer: addManufacturer.trim() || 'Standard Pharma Ltd',
      category: addCategory.trim() || 'General Medicine',
      dosageForm: addDosageForm,
      strength: addStrength.trim() || 'Standard',
      unit: addUnit.trim() || 'Strips',
      barcode: addBarcode.trim() || undefined,
      minimumStockLevel: 20,
      batchNumber: addBatchNo.trim() || `BAT-${Date.now().toString().slice(-5)}`,
      manufacturingDate: addMfgDate || new Date().toISOString().split('T')[0],
      expiryDate: addExpDate,
      purchasePrice: buyPrice,
      sellingPrice: sellPrice,
      quantity: qty,
      supplierId: addSupplierId && addSupplierId !== '__custom__' ? addSupplierId : undefined,
      supplierName: addSupplierName.trim() || undefined,
      responsibleUser: isDoctorUnlocked ? 'Dr. Sunny' : 'Staff Pharmacist',
    });

    setMedicines((prev) => [newMed, ...prev]);
    if (onInventorySync) {
      onInventorySync(convertMasterToInventoryItems([newMed, ...medicines]));
    }

    setNewBrand('');
    setNewGeneric('');
    setNewQty('');
    setAddSku('');
    setAddManufacturer('');
    setAddStrength('');
    setAddBarcode('');
    setAddBatchNo('');
    setAddMfgDate('');
    setAddExpDate('');
    setAddBuyPrice('');
    setAddSellPrice('');
    setAddSupplierName('');
    setAddSupplierId('');
    setShowFullAddForm(false);
  };

  const handleQuickRestockSubmit = (medId: string, currentBatchCount: number) => {
    const addVal = parseInt(stockUpdates[medId] || '0', 10);
    if (addVal <= 0) return;

    onUpdateStock(medId);

    setMedicines((prev) =>
      prev.map((m) => {
        if (m.id !== medId) return m;
        const nextStock = m.totalStock + addVal;
        const updatedBatches = m.batches.map((b, idx) =>
          idx === 0 ? { ...b, availableQuantity: b.availableQuantity + addVal } : b
        );
        return {
          ...m,
          totalStock: nextStock,
          batches: updatedBatches,
          stockStatus: nextStock > m.minimumStockLevel ? 'Available' : nextStock > 0 ? 'Low Stock' : 'Out of Stock',
        };
      })
    );
  };

  return (
    <motion.section
      key="inventory"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#16191E]">
            Pharmacy Stock & Medicine Master
          </h2>
          <p className="text-xs text-[#8A909D] font-medium mt-0.5">
            FEFO batch-wise inventory tracking, stock movements, and master data import
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDoctorUnlocked && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsCsvModalOpen(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>Import CSV Master</span>
            </motion.button>
          )}

          {isDoctorUnlocked && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedSupplierForModal(null);
                setIsSupplierModalOpen(true);
              }}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Building className="w-3.5 h-3.5 text-blue-600" />
              <span>Add Supplier</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowFullAddForm((prev) => !prev)}
            className="px-3.5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showFullAddForm ? 'Hide Procurement Form' : 'Add Medicine Master'}</span>
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#ECEEF2] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8A909D]">Total Medicines</span>
            <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-[#16191E]">{totalMedicines}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Active Molecules</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#ECEEF2] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700">Adequate Stocks</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-emerald-600">{adequateCount}</p>
            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Sufficient inventory</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#ECEEF2] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700">Low Stock Alert</span>
            <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-amber-600">{lowStockCount}</p>
            <p className="text-[10px] text-amber-700 font-medium mt-0.5">Needs reorder</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#ECEEF2] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-700">Stock Depleted</span>
            <div className="w-7 h-7 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-red-600">{outOfStockCount}</p>
            <p className="text-[10px] text-red-700 font-medium mt-0.5">0 units available</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#ECEEF2] shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-orange-700">Near Expiry / Expired</span>
            <div className="w-7 h-7 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-orange-600">
              {nearExpiryCount + expiredCount}
            </p>
            <p className="text-[10px] text-orange-700 font-medium mt-0.5">
              {nearExpiryCount} near expiry &bull; {expiredCount} expired
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showFullAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#ECEEF2] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#16191E] flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  Comprehensive Medicine Master & Batch Intake
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFullAddForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleCreateFullMedicine} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Brand Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dolo 650"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Generic Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Paracetamol 650mg"
                      value={newGeneric}
                      onChange={(e) => setNewGeneric(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">SKU / Medicine Code</label>
                    <input
                      type="text"
                      placeholder="e.g. MED-PAR-650"
                      value={addSku}
                      onChange={(e) => setAddSku(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="relative" ref={categoryDropdownRef}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-500 font-semibold">Category</label>
                      <span className="text-[10px] text-slate-400 font-medium">Select or type</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        list="category-suggestions-list"
                        placeholder="e.g. Analgesics & Antipyretics"
                        value={addCategory}
                        onChange={(e) => {
                          setAddCategory(e.target.value);
                          setIsCategoryDropdownOpen(true);
                        }}
                        onFocus={() => setIsCategoryDropdownOpen(true)}
                        className="w-full p-2.5 pr-8 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    <datalist id="category-suggestions-list">
                      {allAvailableCategories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>

                    {isCategoryDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 divide-y divide-slate-50">
                        {filteredCategories.length > 0 ? (
                          filteredCategories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setAddCategory(cat);
                                setIsCategoryDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between cursor-pointer ${
                                addCategory.trim().toLowerCase() === cat.toLowerCase()
                                  ? 'bg-blue-50 text-blue-700 font-bold'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>{cat}</span>
                              {addCategory.trim().toLowerCase() === cat.toLowerCase() && (
                                <Check className="w-3.5 h-3.5 text-blue-600" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-[11px] text-slate-400">
                            Custom category: &quot;{addCategory}&quot;
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Manufacturer</label>
                    <input
                      type="text"
                      placeholder="e.g. Micro Labs Ltd"
                      value={addManufacturer}
                      onChange={(e) => setAddManufacturer(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Dosage Form</label>
                    <select
                      value={addDosageForm}
                      onChange={(e) => setAddDosageForm(e.target.value as DosageForm)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    >
                      <option value="Tablet">Tablet</option>
                      <option value="Capsule">Capsule</option>
                      <option value="Syrup">Syrup</option>
                      <option value="Injection">Injection</option>
                      <option value="Ointment">Ointment</option>
                      <option value="Drops">Drops</option>
                      <option value="Suspension">Suspension</option>
                      <option value="Powder">Powder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Strength</label>
                    <input
                      type="text"
                      placeholder="e.g. 650 mg"
                      value={addStrength}
                      onChange={(e) => setAddStrength(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Unit of Measure</label>
                    <input
                      type="text"
                      placeholder="e.g. Strips, Bottles"
                      value={addUnit}
                      onChange={(e) => setAddUnit(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Batch Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. DL26J09"
                      value={addBatchNo}
                      onChange={(e) => setAddBatchNo(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Quantity (Units) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 100"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Expiry Date *</label>
                    <input
                      type="date"
                      required
                      value={addExpDate}
                      onChange={(e) => setAddExpDate(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Purchase Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 18.50"
                      value={addBuyPrice}
                      onChange={(e) => setAddBuyPrice(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Selling Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 32.00"
                      value={addSellPrice}
                      onChange={(e) => setAddSellPrice(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-slate-500 font-semibold">Supplier / Wholesaler</label>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierForModal(null);
                          setIsSupplierModalOpen(true);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                        title="Register brand new supplier"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Supplier</span>
                      </button>
                    </div>
                    <select
                      value={addSupplierId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddSupplierId(val);
                        if (val === '__custom__') {
                          setAddSupplierName('');
                        } else {
                          const sup = suppliersList.find((s) => s.id === val);
                          setAddSupplierName(sup ? sup.name : '');
                        }
                      }}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs truncate"
                    >
                      <option value="">-- Select Wholesaler --</option>
                      {suppliersList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                      <option value="__custom__">+ Enter Custom Wholesaler...</option>
                    </select>
                    {addSupplierId === '__custom__' && (
                      <input
                        type="text"
                        placeholder="Enter wholesaler name"
                        value={addSupplierName}
                        onChange={(e) => setAddSupplierName(e.target.value)}
                        className="w-full mt-1 p-2 bg-white border border-blue-300 rounded-xl font-medium outline-none focus:border-blue-500 text-xs"
                        autoFocus
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFullAddForm(false)}
                    className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl border border-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Save Medicine & Initial Batch
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={internalSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by brand, generic, SKU, barcode..."
                className="w-full pl-9 pr-8 py-2 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] placeholder:text-slate-400 outline-none focus:border-[#2563EB] focus:bg-white transition"
              />
              {internalSearch && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 inset-y-0 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-slate-700 font-semibold outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={stockStatusFilter}
                onChange={(e) => {
                  setStockStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-slate-700 font-semibold outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All">All Stock Levels</option>
                <option value="Available">Available Only</option>
                <option value="Low Stock">Low Stock Alert</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>

              <select
                value={expiryStatusFilter}
                onChange={(e) => {
                  setExpiryStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-slate-700 font-semibold outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All">All Expiry Statuses</option>
                <option value="Valid">Valid (Safe)</option>
                <option value="Near Expiry">Near Expiry (&le; 60 days)</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Showing {filteredMedicines.length} of {medicines.length} registered molecules
          </div>
        </div>

        <div className="space-y-3">
          {filteredMedicines.length === 0 ? (
            <div className="p-10 text-center bg-[#F8F9FB] rounded-2xl border border-[#ECEEF2]">
              <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-[1.5]" />
              <p className="text-sm font-bold text-slate-700">No medicines match your criteria</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Try clearing active search or filters, or import fresh medicine data from CSV.
              </p>
              {(internalSearch || categoryFilter !== 'All' || stockStatusFilter !== 'All' || expiryStatusFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    handleSearchChange('');
                    setCategoryFilter('All');
                    setStockStatusFilter('All');
                    setExpiryStatusFilter('All');
                  }}
                  className="mt-3 text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            paginatedMedicines.map((item) => {
              const nearestBatch =
                item.batches && item.batches.length > 0
                  ? [...item.batches].sort(
                      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
                    )[0]
                  : null;

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetails(item)}
                  className="p-4 bg-[#F8F9FB] hover:bg-slate-50/90 rounded-2xl border border-[#ECEEF2] flex flex-col md:flex-row md:items-center justify-between gap-4 transition cursor-pointer group shadow-2xs hover:shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                        {item.sku}
                      </span>
                      <h4 className="font-extrabold text-sm text-[#16191E] group-hover:text-blue-600 transition">
                        {item.brandName}
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          item.stockStatus === 'Available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.stockStatus === 'Low Stock'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.totalStock} {item.unit}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          item.expiryStatus === 'Valid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.expiryStatus === 'Near Expiry'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {item.expiryStatus}
                      </span>
                    </div>

                    <p className="text-xs text-[#8A909D] font-medium truncate">
                      {item.genericName} &bull; {item.dosageForm} ({item.strength}) &bull; {item.manufacturer}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 font-mono">
                        <Package className="w-3 h-3 text-slate-400" />
                        {item.batches.length} {item.batches.length === 1 ? 'batch' : 'batches'}
                      </span>
                      {nearestBatch && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Earliest Exp: {nearestBatch.expiryDate} (Batch {nearestBatch.batchNumber})
                        </span>
                      )}
                      <span className="font-semibold text-emerald-700">
                        MRP: ₹{Number(item.sellingPrice || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 self-end md:self-auto flex-shrink-0"
                  >
                    <input
                      type="number"
                      min="1"
                      placeholder="Add Qty"
                      value={stockUpdates[item.id] || ''}
                      onChange={(e) =>
                        setStockUpdates((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="w-20 p-2 bg-white border border-[#ECEEF2] rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 text-center font-bold"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleQuickRestockSubmit(item.id, item.batches.length)}
                      className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer flex-shrink-0 shadow-xs"
                    >
                      Restock
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => handleOpenDetails(item)}
                      className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center shadow-2xs"
                      title="View Complete Medicine Details"
                    >
                      <Eye className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <NumberedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredMedicines.length}
            itemsPerPage={ITEMS_PER_PAGE}
            itemName="medicines"
          />
        </div>
      </div>

      <MedicineDetailsModal
        medicine={selectedMedicine}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedMedicine(null);
        }}
        onMedicineUpdated={loadData}
        isDoctorUnlocked={isDoctorUnlocked}
      />

      <MedicineCsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        existingMedicines={medicines}
        onImportComplete={loadData}
        responsibleUser={isDoctorUnlocked ? 'Dr. Sunny' : 'Staff Pharmacist'}
      />

      <SupplierFormModal
        isOpen={isSupplierModalOpen}
        onClose={() => {
          setIsSupplierModalOpen(false);
          setSelectedSupplierForModal(null);
        }}
        supplier={selectedSupplierForModal}
        onSuccess={(savedSup) => {
          setSuppliersList((prev) => [savedSup, ...prev.filter((s) => s.id !== savedSup.id)]);
          setAddSupplierId(savedSup.id);
          setAddSupplierName(savedSup.name);
        }}
      />
    </motion.section>
  );
}

export default InventoryView;
