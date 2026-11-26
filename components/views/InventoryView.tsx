'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Boxes,
  Search,
  X,
  Plus,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  Eye,
  Barcode,
  Package,
  Layers,
  CheckCircle2,
  TrendingDown,
  Building,
  ChevronDown,
  Check,
  Pill,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { InventoryItem } from '@/types';
import { MedicineMaster, DosageForm, Supplier } from '@/types/medicine';
import { NumberedPagination } from '@/components/ui/pagination';
import { MedicineDetailsModal } from '@/components/inventory/MedicineDetailsModal';
import { EditMedicineModal } from '@/components/inventory/EditMedicineModal';
import { MedicineCsvImportModal } from '@/components/inventory/MedicineCsvImportModal';
import { SupplierFormModal } from '@/components/inventory/SupplierFormModal';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';
import { EcgActionLoader } from '@/components/loading/EcgActionLoader';
import { staggerContainer, fadeScale } from '@/lib/constants';
import {
  fetchMedicinesMaster,
  fetchSuppliers,
  addMedicineWithInitialBatch,
  recordStockAdjustment,
  convertMasterToInventoryItems,
} from '@/lib/medicineService';
import { supabase } from '@/lib/supabaseClient';

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
  clinicId?: string;
  locationId?: string;
  branchName?: string;
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

const ITEMS_PER_PAGE = 10;

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
  clinicId,
  locationId,
  branchName,
}: InventoryViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [internalSearch, setInternalSearch] = useState(searchQuery);
  const [syncingChunks, setSyncingChunks] = useState<boolean>(false);

  const [medicines, setMedicines] = useState<MedicineMaster[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);

  const [selectedMedicine, setSelectedMedicine] = useState<MedicineMaster | null>(null);
  const [selectedMedicineForEdit, setSelectedMedicineForEdit] = useState<MedicineMaster | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<Supplier | null>(null);

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
  const [addSupplierId, setAddSupplierId] = useState('');
  const [addSupplierName, setAddSupplierName] = useState('');

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

  const loadData = async (silent = false) => {
    if (!silent) setLoadingMeds(true);
    try {
      const [data, sups] = await Promise.all([
        fetchMedicinesMaster(
          (chunkMeds, totalCount) => {
            setMedicines(chunkMeds);
            if (chunkMeds.length < totalCount) {
              setSyncingChunks(true);
            } else {
              setSyncingChunks(false);
            }
          },
          clinicId,
          locationId
        ),
        fetchSuppliers(),
      ]);
      setMedicines(data);
      setSuppliersList(sups);
      setSyncingChunks(false);
      if (onInventorySync) {
        onInventorySync(convertMasterToInventoryItems(data));
      }
    } catch (err) {
      console.error('Failed to load medicines master:', err);
    } finally {
      if (!silent) setLoadingMeds(false);
      setSyncingChunks(false);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('realtime-inventory-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicines' }, () => {
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicine_batches' }, () => {
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, () => {
        loadData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, locationId]);

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
      clinicId,
      locationId,
    });

    const idx = medicines.findIndex(
      (m) => m.id === newMed.id || m.sku.toUpperCase() === newMed.sku.toUpperCase()
    );
    const nextMedicines =
      idx >= 0 ? medicines.map((m, i) => (i === idx ? newMed : m)) : [newMed, ...medicines];
    setMedicines(nextMedicines);
    if (onInventorySync) {
      onInventorySync(convertMasterToInventoryItems(nextMedicines));
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
    setAddSupplierId('');
    setAddSupplierName('');
    setShowFullAddForm(false);
  };

  const handleQuickRestockSubmit = async (medId: string, currentBatchCount: number) => {
    const addVal = parseInt(stockUpdates[medId] || '0', 10);
    if (addVal <= 0) return;

    onUpdateStock(medId);

    const med = medicines.find((m) => m.id === medId);
    if (med && med.batches.length > 0) {
      await recordStockAdjustment({
        medicineId: medId,
        batchId: med.batches[0].id,
        movementType: 'Purchase',
        quantityChange: addVal,
        referenceNumber: `RESTOCK-${Date.now().toString().slice(-6)}`,
        responsibleUser: isDoctorUnlocked ? 'Dr. Sunny' : 'Staff Pharmacist',
        notes: 'Quick restock from Pharmacy Stock table',
      });
    }

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
          stockStatus: nextStock > m.minimumStockLevel ? 'Available' : nextStock > 0 ? 'Low Stock' : 'Out of Stock',
          batches: updatedBatches,
        };
      })
    );

    setStockUpdates((prev) => ({ ...prev, [medId]: '' }));
  };

  return (
    <motion.section
      key="inventory-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 pb-12"
    >
      <EcgActionLoader isLoading={loadingMeds} fullscreen={true} text="Syncing pharmacy stock..." />

      {/* Editorial Header Card */}
      <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-8 shadow-2xs flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
            Pharmacy Inventory • {totalMedicines} {totalMedicines === 1 ? 'Medicine' : 'Medicines'}
          </span>
          <h2 className="mt-1.5 text-base sm:text-lg font-semibold text-[#16191E] flex items-center gap-2.5 flex-wrap">
            <span>Pharmacy Stock &amp; Medicine Master</span>
            {branchName && (
              <span className="rounded-full border border-blue-200/70 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                {branchName}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            FEFO batch-wise stock tracking, supplier links, and quick restocking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
          {isDoctorUnlocked && (
            <button
              type="button"
              onClick={() => {
                setSelectedSupplierForModal(null);
                setIsSupplierModalOpen(true);
              }}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-full transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <Building className="w-3.5 h-3.5 text-slate-500" />
              <span>Add Supplier</span>
            </button>
          )}

          {isDoctorUnlocked && (
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-full transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import CSV / Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowFullAddForm((prev) => !prev)}
            className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium rounded-full transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showFullAddForm ? 'Hide Intake Form' : 'Add Medicine Master'}</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Strip */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4"
      >
        <motion.div
          variants={fadeScale}
          className="bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Total Medicines
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-[#16191E] tabular-nums">
                <AnimatedCounter target={totalMedicines} />
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Active</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full border border-blue-100 bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Layers className="w-4 h-4 stroke-[1.9]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          className="bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Adequate Stock
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-[#16191E] tabular-nums">
                <AnimatedCounter target={adequateCount} />
              </span>
              <span className="text-[11px] text-emerald-600 font-medium">Safe</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 stroke-[1.9]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          className="bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Low Stock
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-[#16191E] tabular-nums">
                <AnimatedCounter target={lowStockCount} />
              </span>
              <span className="text-[11px] text-amber-600 font-medium">Reorder</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full border border-amber-100 bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 stroke-[1.9]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          className="bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Out of Stock
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-[#16191E] tabular-nums">
                <AnimatedCounter target={outOfStockCount} />
              </span>
              <span className="text-[11px] text-rose-600 font-medium">0 units</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full border border-rose-100 bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="w-4 h-4 stroke-[1.9]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          className="bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0 col-span-2 sm:col-span-1"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Expiry Watch
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-[#16191E] tabular-nums">
                <AnimatedCounter target={nearExpiryCount + expiredCount} />
              </span>
              <span className="text-[11px] text-slate-400">
                {nearExpiryCount} near • {expiredCount} exp
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 stroke-[1.9]" />
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showFullAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.99 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Comprehensive Medicine Master &amp; Batch Intake
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Register medicine molecule, initial stock batch, and procurement supplier
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullAddForm(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleCreateFullMedicine} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Brand Name *</label>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dolo 650"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Generic Name *</label>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Paracetamol 650mg"
                      value={newGeneric}
                      onChange={(e) => setNewGeneric(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">SKU / Medicine Code</label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. MED-PAR-650"
                      value={addSku}
                      onChange={(e) => setAddSku(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>

                  <div className="relative" ref={categoryDropdownRef}>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Category</label>
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
                        className="w-full h-10 px-3 pr-8 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Manufacturer</label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Micro Labs Ltd"
                      value={addManufacturer}
                      onChange={(e) => setAddManufacturer(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Dosage Form</label>
                    </div>
                    <select
                      value={addDosageForm}
                      onChange={(e) => setAddDosageForm(e.target.value as DosageForm)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white cursor-pointer"
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
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Strength</label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. 650 mg"
                      value={addStrength}
                      onChange={(e) => setAddStrength(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Unit of Measure</label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Strips, Bottles"
                      value={addUnit}
                      onChange={(e) => setAddUnit(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Batch Number *</label>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. DL26J09"
                      value={addBatchNo}
                      onChange={(e) => setAddBatchNo(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Quantity (Units) *</label>
                    </div>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 100"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Manufacturing Date</label>
                    </div>
                    <input
                      type="date"
                      value={addMfgDate}
                      onChange={(e) => setAddMfgDate(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Expiry Date *</label>
                    </div>
                    <input
                      type="date"
                      required
                      value={addExpDate}
                      onChange={(e) => setAddExpDate(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Purchase Price (₹)</label>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 18.50"
                      value={addBuyPrice}
                      onChange={(e) => setAddBuyPrice(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Selling Price (₹)</label>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 32.00"
                      value={addSellPrice}
                      onChange={(e) => setAddSellPrice(e.target.value)}
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Supplier / Wholesaler</label>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierForModal(null);
                          setIsSupplierModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        title="Register new wholesaler"
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
                      className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs truncate transition focus:bg-white cursor-pointer"
                    >
                      <option value="">-- Select Wholesaler --</option>
                      {suppliersList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.phone ? `(${s.phone})` : ''}
                        </option>
                      ))}
                      <option value="__custom__">+ Enter Custom Wholesaler...</option>
                    </select>
                    {addSupplierId === '__custom__' && (
                      <input
                        type="text"
                        placeholder="Type wholesaler name..."
                        value={addSupplierName}
                        onChange={(e) => setAddSupplierName(e.target.value)}
                        className="w-full mt-1.5 h-9 px-3 bg-white border border-blue-300 rounded-xl font-medium outline-none focus:border-blue-500 text-xs shadow-xs"
                        autoFocus
                      />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 truncate">Barcode (Optional)</label>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. 8901234567890"
                        value={addBarcode}
                        onChange={(e) => setAddBarcode(e.target.value)}
                        className="w-full h-10 px-3 pl-8 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl font-medium outline-none focus:border-blue-500 text-xs transition focus:bg-white"
                      />
                      <Barcode className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFullAddForm(false)}
                    className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl border border-slate-200 cursor-pointer transition text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs"
                  >
                    Save Medicine &amp; Initial Batch
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative space-y-5">
        <div className="bg-white rounded-2xl border border-[#ECEEF2] shadow-2xs p-6 sm:p-8 overflow-hidden space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-semibold text-[#16191E]">
                Medicine Directory
              </h3>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {medicines.length} Registered
              </span>
              {syncingChunks && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 bg-blue-50/80 px-2.5 py-0.5 rounded-full border border-blue-100">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                  Loading full catalog...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="relative w-full sm:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={internalSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search brand, generic, SKU..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50/70 border border-[#ECEEF2] rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white transition"
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

              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50/70 border border-[#ECEEF2] rounded-xl text-xs text-slate-700 font-medium outline-none focus:border-slate-400 cursor-pointer"
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
                className="px-3 py-2 bg-slate-50/70 border border-[#ECEEF2] rounded-xl text-xs text-slate-700 font-medium outline-none focus:border-slate-400 cursor-pointer"
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
                className="px-3 py-2 bg-slate-50/70 border border-[#ECEEF2] rounded-xl text-xs text-slate-700 font-medium outline-none focus:border-slate-400 cursor-pointer"
              >
                <option value="All">All Expiry Statuses</option>
                <option value="Valid">Valid (Safe)</option>
                <option value="Near Expiry">Near Expiry (&le; 60 days)</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>

          {filteredMedicines.length === 0 ? (
            <div className="border-y border-slate-200/80 py-12 text-center text-xs text-slate-400">
              <div className="w-11 h-11 rounded-full border border-slate-200 bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Boxes className="w-5 h-5 stroke-[1.75]" />
              </div>
              <p className="font-medium text-sm text-slate-700">No medicines match current filters</p>
              <p className="text-xs text-slate-400 mt-1">Try clearing search keywords or filters.</p>
              {(internalSearch || categoryFilter !== 'All' || stockStatusFilter !== 'All' || expiryStatusFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    handleSearchChange('');
                    setCategoryFilter('All');
                    setStockStatusFilter('All');
                    setExpiryStatusFilter('All');
                  }}
                  className="mt-4 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
              {paginatedMedicines.map((item, index) => {
                const nearestBatch =
                  item.batches && item.batches.length > 0
                    ? [...item.batches].sort(
                        (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
                      )[0]
                    : null;
                const rowNumber = String((currentPage - 1) * ITEMS_PER_PAGE + index + 1).padStart(2, '0');

                return (
                  <li key={item.id}>
                    <div
                      onClick={() => handleOpenDetails(item)}
                      className="group grid grid-cols-1 gap-4 py-5 sm:py-6 transition-colors sm:grid-cols-[2.75rem_1fr_auto] sm:gap-6 lg:grid-cols-[2.75rem_1.2fr_1.4fr_auto] lg:gap-8 items-start sm:items-center cursor-pointer hover:bg-slate-50/70 -mx-6 sm:-mx-8 px-6 sm:px-8"
                    >
                      {/* Index */}
                      <span className="text-xs font-medium text-slate-400 tabular-nums sm:pt-0.5">
                        {rowNumber}
                      </span>

                      {/* Medicine Identity */}
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-semibold text-[#16191E] group-hover:text-blue-600 transition-colors truncate">
                            {item.brandName}
                          </h4>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {item.sku}
                          </span>
                          {item.sellingPrice && item.sellingPrice > 0 ? (
                            <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              ₹{item.sellingPrice.toFixed(2)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMedicineForEdit(item);
                                setIsEditModalOpen(true);
                              }}
                              className="rounded-full border border-amber-200 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 cursor-pointer"
                            >
                              Set Price
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {item.genericName} • {item.manufacturer}
                        </p>
                      </div>

                      {/* Stock, Category & Expiry Pills */}
                      <div className="sm:col-start-2 lg:col-start-auto min-w-0 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span className="font-medium text-[#16191E]">
                            {item.totalStock} {item.unit}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span>
                            {item.dosageForm} ({item.strength})
                          </span>
                          <span className="text-slate-300">•</span>
                          <span>
                            Exp: {nearestBatch ? nearestBatch.expiryDate : 'N/A'}
                          </span>
                        </div>
                        <ul className="flex flex-wrap gap-2">
                          <li className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-600">
                            {item.category}
                          </li>
                          <li
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                              item.stockStatus === 'Available'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                                : item.stockStatus === 'Low Stock'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                                  : 'bg-rose-50 text-rose-700 border-rose-200/70'
                            }`}
                          >
                            {item.stockStatus}
                          </li>
                          {item.expiryStatus !== 'Valid' && (
                            <li
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                                item.expiryStatus === 'Near Expiry'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200/70'
                                  : 'bg-rose-50 text-rose-700 border-rose-200/70'
                              }`}
                            >
                              {item.expiryStatus}
                            </li>
                          )}
                        </ul>
                      </div>

                      {/* Quick Restock & Actions */}
                      <div
                        className="flex items-center justify-end gap-2 sm:col-start-3 sm:row-start-1 lg:col-start-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          min="1"
                          placeholder="+Qty"
                          value={stockUpdates[item.id] || ''}
                          onChange={(e) =>
                            setStockUpdates((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="w-16 h-8 text-xs px-2 text-center bg-slate-50 border border-slate-200 rounded-full outline-none focus:border-slate-400 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickRestockSubmit(item.id, item.batches.length)}
                          disabled={!stockUpdates[item.id] || parseInt(stockUpdates[item.id], 10) <= 0}
                          className="h-8 px-3 rounded-full border border-blue-200 bg-blue-50 hover:bg-[#2563EB] hover:text-white text-[#2563EB] disabled:opacity-35 disabled:pointer-events-none text-xs font-medium transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMedicineForEdit(item);
                            setIsEditModalOpen(true);
                          }}
                          className="h-8 px-3 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Edit Medicine Master & Pricing"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(item)}
                          className="h-8 px-3 rounded-full border border-slate-200 bg-white hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] text-slate-700 text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="View Full Details"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
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

      <EditMedicineModal
        medicine={selectedMedicineForEdit}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedMedicineForEdit(null);
        }}
        onMedicineUpdated={loadData}
        categories={allAvailableCategories}
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
