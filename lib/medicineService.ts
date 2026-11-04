import { supabase } from './supabaseClient';
import {
  MedicineMaster,
  MedicineBatch,
  Supplier,
  PurchaseRecord,
  StockMovement,
  MovementType,
  DosageForm,
  StockStatus,
  ExpiryStatus,
  CsvParsedRow,
  CsvValidationError,
  CsvImportSummary,
} from '@/types/medicine';
import { InventoryItem } from '@/types';

const STORAGE_KEY_MEDICINES = 'healthsync_medicines_master_v1';
const STORAGE_KEY_SUPPLIERS = 'healthsync_suppliers_v1';
const STORAGE_KEY_PURCHASES = 'healthsync_purchases_v1';
const STORAGE_KEY_MOVEMENTS = 'healthsync_movements_v1';

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-001',
    name: 'Apex Pharma Distributors',
    contactPerson: 'Rajesh Kumar',
    email: 'orders@apexpharma.in',
    phone: '+91 98450 12345',
    address: 'Plot 45, Industrial Area, Phase II, Bengaluru',
    gstin: '29ABCDE1234F1Z5',
    lastPurchaseDate: '2026-10-15',
    lastPurchasePrice: 18.5,
  },
  {
    id: 'sup-002',
    name: 'MediCare Lifesciences',
    contactPerson: 'Sunita Sharma',
    email: 'supply@medicarelife.com',
    phone: '+91 98110 54321',
    address: '12 Medical Square, Andheri East, Mumbai',
    gstin: '27AABCM8765P1Z8',
    lastPurchaseDate: '2026-10-20',
    lastPurchasePrice: 42.0,
  },
  {
    id: 'sup-003',
    name: 'Global BioTech Logistics',
    contactPerson: 'Vikram Patel',
    email: 'support@globalbiotech.co',
    phone: '+91 99002 98765',
    address: '88 Tech Zone, GIDC, Ahmedabad',
    gstin: '24AAACG9999K1Z2',
    lastPurchaseDate: '2026-10-28',
    lastPurchasePrice: 65.0,
  },
];

export const INITIAL_MEDICINES: MedicineMaster[] = [
  {
    id: 'med-001',
    sku: 'MED-PAR-650',
    brandName: 'Dolo 650',
    genericName: 'Paracetamol 650mg',
    manufacturer: 'Micro Labs Ltd',
    category: 'Analgesics & Antipyretics',
    dosageForm: 'Tablet',
    strength: '650 mg',
    unit: 'Strips',
    barcode: '8901112223334',
    minimumStockLevel: 25,
    sellingPrice: 32.0,
    lastPurchasePrice: 18.5,
    lastPurchaseDate: '2026-10-15',
    totalStock: 85,
    stockStatus: 'Available',
    expiryStatus: 'Valid',
    supplier: INITIAL_SUPPLIERS[0],
    batches: [
      {
        id: 'bat-001-a',
        medicineId: 'med-001',
        batchNumber: 'DL26J01',
        manufacturingDate: '2026-01-10',
        expiryDate: '2027-12-31',
        purchasePrice: 18.5,
        sellingPrice: 32.0,
        initialQuantity: 100,
        availableQuantity: 50,
        supplierId: 'sup-001',
        supplierName: 'Apex Pharma Distributors',
      },
      {
        id: 'bat-001-b',
        medicineId: 'med-001',
        batchNumber: 'DL26K04',
        manufacturingDate: '2026-03-15',
        expiryDate: '2028-02-28',
        purchasePrice: 19.0,
        sellingPrice: 32.0,
        initialQuantity: 50,
        availableQuantity: 35,
        supplierId: 'sup-001',
        supplierName: 'Apex Pharma Distributors',
      },
    ],
  },
  {
    id: 'med-002',
    sku: 'MED-PAN-040',
    brandName: 'Pan 40',
    genericName: 'Pantoprazole 40mg',
    manufacturer: 'Alkem Laboratories',
    category: 'Gastrointestinal',
    dosageForm: 'Tablet',
    strength: '40 mg',
    unit: 'Strips',
    barcode: '8904445556667',
    minimumStockLevel: 20,
    sellingPrice: 95.0,
    lastPurchasePrice: 62.0,
    lastPurchaseDate: '2026-09-12',
    totalStock: 42,
    stockStatus: 'Available',
    expiryStatus: 'Valid',
    supplier: INITIAL_SUPPLIERS[1],
    batches: [
      {
        id: 'bat-002-a',
        medicineId: 'med-002',
        batchNumber: 'PN40-881',
        manufacturingDate: '2025-11-01',
        expiryDate: '2027-10-31',
        purchasePrice: 62.0,
        sellingPrice: 95.0,
        initialQuantity: 60,
        availableQuantity: 42,
        supplierId: 'sup-002',
        supplierName: 'MediCare Lifesciences',
      },
    ],
  },
  {
    id: 'med-003',
    sku: 'MED-AUG-625',
    brandName: 'Augmentin 625 Duo',
    genericName: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals',
    category: 'Antibiotics',
    dosageForm: 'Tablet',
    strength: '625 mg',
    unit: 'Strips',
    barcode: '8907778889990',
    minimumStockLevel: 15,
    sellingPrice: 205.0,
    lastPurchasePrice: 145.0,
    lastPurchaseDate: '2026-10-05',
    totalStock: 12,
    stockStatus: 'Low Stock',
    expiryStatus: 'Near Expiry',
    supplier: INITIAL_SUPPLIERS[1],
    batches: [
      {
        id: 'bat-003-a',
        medicineId: 'med-003',
        batchNumber: 'AG26-M19',
        manufacturingDate: '2025-05-10',
        expiryDate: '2026-11-28',
        purchasePrice: 145.0,
        sellingPrice: 205.0,
        initialQuantity: 30,
        availableQuantity: 12,
        supplierId: 'sup-002',
        supplierName: 'MediCare Lifesciences',
      },
    ],
  },
  {
    id: 'med-004',
    sku: 'MED-AZI-500',
    brandName: 'Azithral 500',
    genericName: 'Azithromycin 500mg',
    manufacturer: 'Alembic Pharmaceuticals',
    category: 'Antibiotics',
    dosageForm: 'Tablet',
    strength: '500 mg',
    unit: 'Strips',
    barcode: '8901234567891',
    minimumStockLevel: 20,
    sellingPrice: 120.0,
    lastPurchasePrice: 78.0,
    lastPurchaseDate: '2026-08-20',
    totalStock: 0,
    stockStatus: 'Out of Stock',
    expiryStatus: 'Expired',
    supplier: INITIAL_SUPPLIERS[2],
    batches: [
      {
        id: 'bat-004-a',
        medicineId: 'med-004',
        batchNumber: 'AZ25-X02',
        manufacturingDate: '2024-08-01',
        expiryDate: '2026-08-01',
        purchasePrice: 78.0,
        sellingPrice: 120.0,
        initialQuantity: 50,
        availableQuantity: 0,
        supplierId: 'sup-003',
        supplierName: 'Global BioTech Logistics',
      },
    ],
  },
  {
    id: 'med-005',
    sku: 'MED-MON-010',
    brandName: 'Montair LC',
    genericName: 'Montelukast 10mg + Levocetirizine 5mg',
    manufacturer: 'Cipla Ltd',
    category: 'Respiratory & Anti-Allergic',
    dosageForm: 'Tablet',
    strength: '10mg/5mg',
    unit: 'Strips',
    barcode: '8909876543210',
    minimumStockLevel: 20,
    sellingPrice: 165.0,
    lastPurchasePrice: 110.0,
    lastPurchaseDate: '2026-10-18',
    totalStock: 58,
    stockStatus: 'Available',
    expiryStatus: 'Valid',
    supplier: INITIAL_SUPPLIERS[0],
    batches: [
      {
        id: 'bat-005-a',
        medicineId: 'med-005',
        batchNumber: 'ML26-P09',
        manufacturingDate: '2026-02-14',
        expiryDate: '2028-01-31',
        purchasePrice: 110.0,
        sellingPrice: 165.0,
        initialQuantity: 70,
        availableQuantity: 58,
        supplierId: 'sup-001',
        supplierName: 'Apex Pharma Distributors',
      },
    ],
  },
];

export const INITIAL_PURCHASES: PurchaseRecord[] = [
  {
    id: 'pur-101',
    medicineId: 'med-001',
    medicineName: 'Dolo 650 (Paracetamol 650mg)',
    supplierId: 'sup-001',
    supplierName: 'Apex Pharma Distributors',
    batchNumber: 'DL26J01',
    purchaseDate: '2026-01-15',
    quantityPurchased: 100,
    purchasePrice: 18.5,
    totalPurchaseAmount: 1850.0,
    invoiceNumber: 'INV-APX-8821',
    expiryDate: '2027-12-31',
  },
  {
    id: 'pur-102',
    medicineId: 'med-001',
    medicineName: 'Dolo 650 (Paracetamol 650mg)',
    supplierId: 'sup-001',
    supplierName: 'Apex Pharma Distributors',
    batchNumber: 'DL26K04',
    purchaseDate: '2026-03-20',
    quantityPurchased: 50,
    purchasePrice: 19.0,
    totalPurchaseAmount: 950.0,
    invoiceNumber: 'INV-APX-9140',
    expiryDate: '2028-02-28',
  },
  {
    id: 'pur-103',
    medicineId: 'med-002',
    medicineName: 'Pan 40 (Pantoprazole 40mg)',
    supplierId: 'sup-002',
    supplierName: 'MediCare Lifesciences',
    batchNumber: 'PN40-881',
    purchaseDate: '2026-09-12',
    quantityPurchased: 60,
    purchasePrice: 62.0,
    totalPurchaseAmount: 3720.0,
    invoiceNumber: 'MCL-2026-551',
    expiryDate: '2027-10-31',
  },
  {
    id: 'pur-104',
    medicineId: 'med-003',
    medicineName: 'Augmentin 625 Duo',
    supplierId: 'sup-002',
    supplierName: 'MediCare Lifesciences',
    batchNumber: 'AG26-M19',
    purchaseDate: '2026-10-05',
    quantityPurchased: 30,
    purchasePrice: 145.0,
    totalPurchaseAmount: 4350.0,
    invoiceNumber: 'MCL-2026-789',
    expiryDate: '2026-11-28',
  },
  {
    id: 'pur-105',
    medicineId: 'med-005',
    medicineName: 'Montair LC',
    supplierId: 'sup-001',
    supplierName: 'Apex Pharma Distributors',
    batchNumber: 'ML26-P09',
    purchaseDate: '2026-10-18',
    quantityPurchased: 70,
    purchasePrice: 110.0,
    totalPurchaseAmount: 7700.0,
    invoiceNumber: 'INV-APX-9988',
    expiryDate: '2028-01-31',
  },
];

export const INITIAL_MOVEMENTS: StockMovement[] = [
  {
    id: 'mov-201',
    medicineId: 'med-001',
    medicineName: 'Dolo 650',
    batchId: 'bat-001-a',
    batchNumber: 'DL26J01',
    movementType: 'Purchase',
    quantity: 100,
    referenceNumber: 'INV-APX-8821',
    responsibleUser: 'Dr. Sunny',
    date: '2026-01-15T10:30:00Z',
    notes: 'Initial opening stock procurement',
  },
  {
    id: 'mov-202',
    medicineId: 'med-001',
    medicineName: 'Dolo 650',
    batchId: 'bat-001-a',
    batchNumber: 'DL26J01',
    movementType: 'Dispensing',
    quantity: -50,
    referenceNumber: 'RX-CLINIC-2026-01',
    responsibleUser: 'Dr. Sunny',
    date: '2026-04-10T14:15:00Z',
    notes: 'Outpatient prescription fulfillment',
  },
  {
    id: 'mov-203',
    medicineId: 'med-003',
    medicineName: 'Augmentin 625 Duo',
    batchId: 'bat-003-a',
    batchNumber: 'AG26-M19',
    movementType: 'Dispensing',
    quantity: -18,
    referenceNumber: 'RX-CLINIC-2026-89',
    responsibleUser: 'Dr. Sunny',
    date: '2026-10-22T16:00:00Z',
    notes: 'Dispensed for acute bronchitis treatment',
  },
  {
    id: 'mov-204',
    medicineId: 'med-004',
    medicineName: 'Azithral 500',
    batchId: 'bat-004-a',
    batchNumber: 'AZ25-X02',
    movementType: 'Expired Stock',
    quantity: -50,
    referenceNumber: 'EXP-AUDIT-2026-08',
    responsibleUser: 'Staff Admin',
    date: '2026-08-05T09:00:00Z',
    notes: 'Batch past expiry quarantine write-off',
  },
];

export function calculateStockStatus(totalStock: number, minStockLevel: number): StockStatus {
  if (totalStock <= 0) return 'Out of Stock';
  if (totalStock <= minStockLevel) return 'Low Stock';
  return 'Available';
}

export function calculateExpiryStatus(batches: MedicineBatch[]): ExpiryStatus {
  const activeBatches = batches.filter((b) => b.availableQuantity > 0);
  if (activeBatches.length === 0) {
    const hasBatches = batches.length > 0;
    if (hasBatches) {
      const now = new Date();
      const allPast = batches.every((b) => new Date(b.expiryDate) < now);
      if (allPast) return 'Expired';
    }
    return 'Valid';
  }

  const now = new Date();
  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(now.getDate() + 60);

  let hasExpired = false;
  let hasNearExpiry = false;

  for (const b of activeBatches) {
    const exp = new Date(b.expiryDate);
    if (exp < now) {
      hasExpired = true;
    } else if (exp <= sixtyDaysFromNow) {
      hasNearExpiry = true;
    }
  }

  if (hasExpired) return 'Expired';
  if (hasNearExpiry) return 'Near Expiry';
  return 'Valid';
}

export function loadStoredMedicines(): MedicineMaster[] {
  if (typeof window === 'undefined') return INITIAL_MEDICINES;
  try {
    const data = localStorage.getItem(STORAGE_KEY_MEDICINES);
    if (!data) {
      saveStoredMedicines(INITIAL_MEDICINES);
      return INITIAL_MEDICINES;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_MEDICINES;
  } catch {
    return INITIAL_MEDICINES;
  }
}

export function saveStoredMedicines(medicines: MedicineMaster[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_MEDICINES, JSON.stringify(medicines));
  } catch {}
}

export function loadStoredSuppliers(): Supplier[] {
  if (typeof window === 'undefined') return INITIAL_SUPPLIERS;
  try {
    const data = localStorage.getItem(STORAGE_KEY_SUPPLIERS);
    if (!data) {
      saveStoredSuppliers(INITIAL_SUPPLIERS);
      return INITIAL_SUPPLIERS;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SUPPLIERS;
  } catch {
    return INITIAL_SUPPLIERS;
  }
}

export function saveStoredSuppliers(suppliers: Supplier[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(suppliers));
  } catch {}
}

export function loadStoredPurchases(): PurchaseRecord[] {
  if (typeof window === 'undefined') return INITIAL_PURCHASES;
  try {
    const data = localStorage.getItem(STORAGE_KEY_PURCHASES);
    if (!data) {
      saveStoredPurchases(INITIAL_PURCHASES);
      return INITIAL_PURCHASES;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : INITIAL_PURCHASES;
  } catch {
    return INITIAL_PURCHASES;
  }
}

export function saveStoredPurchases(purchases: PurchaseRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PURCHASES, JSON.stringify(purchases));
  } catch {}
}

export function loadStoredMovements(): StockMovement[] {
  if (typeof window === 'undefined') return INITIAL_MOVEMENTS;
  try {
    const data = localStorage.getItem(STORAGE_KEY_MOVEMENTS);
    if (!data) {
      saveStoredMovements(INITIAL_MOVEMENTS);
      return INITIAL_MOVEMENTS;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : INITIAL_MOVEMENTS;
  } catch {
    return INITIAL_MOVEMENTS;
  }
}

export function saveStoredMovements(movements: StockMovement[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_MOVEMENTS, JSON.stringify(movements));
  } catch {}
}

export async function fetchMedicinesMaster(): Promise<MedicineMaster[]> {
  try {
    const { data: dbMeds, error: medError } = await supabase
      .from('medicines')
      .select('*, batches:medicine_batches(*)')
      .order('brand_name', { ascending: true });

    if (!medError && dbMeds && dbMeds.length > 0) {
      const suppliers = await fetchSuppliers();
      const mapped: MedicineMaster[] = dbMeds.map((m: any) => {
        const rawBatches: any[] = m.batches || [];
        const batches: MedicineBatch[] = rawBatches.map((b) => ({
          id: b.id,
          medicineId: b.medicine_id,
          batchNumber: b.batch_number,
          manufacturingDate: b.manufacturing_date,
          expiryDate: b.expiry_date,
          purchasePrice: Number(b.purchase_price) || 0,
          sellingPrice: Number(b.selling_price) || 0,
          initialQuantity: Number(b.initial_quantity) || 0,
          availableQuantity: Number(b.available_quantity) || 0,
          supplierId: b.supplier_id,
          supplierName: suppliers.find((s) => s.id === b.supplier_id)?.name,
        }));

        const totalStock = batches.reduce((sum, b) => sum + (b.availableQuantity || 0), 0);
        const minLevel = Number(m.minimum_stock_level) || 20;

        const primarySupplierId = m.supplier_id || batches.find((b) => b.supplierId)?.supplierId;
        const primarySupplierName = batches.find((b) => b.supplierName)?.supplierName;
        const primarySupplier = primarySupplierId
          ? suppliers.find((s) => s.id === primarySupplierId)
          : primarySupplierName
          ? suppliers.find((s) => s.name.toLowerCase() === primarySupplierName.toLowerCase())
          : undefined;

        return {
          id: m.id,
          sku: m.sku,
          brandName: m.brand_name,
          genericName: m.generic_name,
          manufacturer: m.manufacturer,
          category: m.category,
          dosageForm: (m.dosage_form as DosageForm) || 'Tablet',
          strength: m.strength || '',
          unit: m.unit || 'Units',
          barcode: m.barcode || undefined,
          minimumStockLevel: minLevel,
          batches,
          totalStock,
          stockStatus: calculateStockStatus(totalStock, minLevel),
          expiryStatus: calculateExpiryStatus(batches),
          sellingPrice: Number(m.selling_price) || 0,
          supplier: primarySupplier,
        };
      });

      saveStoredMedicines(mapped);
      return mapped;
    }
  } catch {}

  return loadStoredMedicines();
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  try {
    const { data, error } = await supabase.from('suppliers').select('*').order('name');
    if (!error && data && data.length > 0) {
      const mapped: Supplier[] = data.map((s: any) => ({
        id: s.id,
        name: s.name,
        contactPerson: s.contact_person,
        email: s.email,
        phone: s.phone,
        address: s.address,
        gstin: s.gstin,
        lastPurchaseDate: s.last_purchase_date,
        lastPurchasePrice: Number(s.last_purchase_price) || undefined,
      }));
      saveStoredSuppliers(mapped);
      return mapped;
    }
  } catch {}

  return loadStoredSuppliers();
}

export async function saveOrUpdateSupplier(data: {
  id?: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  gstin?: string;
  address?: string;
  lastPurchaseDate?: string;
  lastPurchasePrice?: number;
}): Promise<Supplier> {
  const currentSuppliers = loadStoredSuppliers();
  let supId = data.id;

  if (!supId) {
    const existing = currentSuppliers.find(
      (s) => s.name.toLowerCase() === data.name.trim().toLowerCase()
    );
    supId = existing?.id || `sup-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
  }

  const newSupplier: Supplier = {
    id: supId,
    name: data.name.trim(),
    contactPerson: data.contactPerson?.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim(),
    gstin: data.gstin?.trim(),
    address: data.address?.trim(),
    lastPurchaseDate: data.lastPurchaseDate,
    lastPurchasePrice: data.lastPurchasePrice,
    createdAt: new Date().toISOString(),
  };

  const idx = currentSuppliers.findIndex((s) => s.id === supId);
  let updatedSuppliers: Supplier[];
  if (idx >= 0) {
    updatedSuppliers = currentSuppliers.map((s, i) => (i === idx ? newSupplier : s));
  } else {
    updatedSuppliers = [newSupplier, ...currentSuppliers];
  }
  saveStoredSuppliers(updatedSuppliers);

  try {
    await supabase.from('suppliers').upsert({
      id: newSupplier.id,
      name: newSupplier.name,
      contact_person: newSupplier.contactPerson,
      phone: newSupplier.phone,
      email: newSupplier.email,
      gstin: newSupplier.gstin,
      address: newSupplier.address,
      last_purchase_date: newSupplier.lastPurchaseDate,
      last_purchase_price: newSupplier.lastPurchasePrice,
    });
  } catch {}

  return newSupplier;
}

export async function linkSupplierToMedicine(
  medicineId: string,
  supplier: Supplier
): Promise<MedicineMaster | null> {
  const currentMeds = loadStoredMedicines();
  const medIdx = currentMeds.findIndex((m) => m.id === medicineId);
  if (medIdx === -1) return null;

  const updatedMed: MedicineMaster = {
    ...currentMeds[medIdx],
    supplier,
  };
  currentMeds[medIdx] = updatedMed;
  saveStoredMedicines(currentMeds);

  try {
    await supabase
      .from('medicines')
      .update({ supplier_id: supplier.id, updated_at: new Date().toISOString() })
      .eq('id', medicineId);
  } catch {}

  return updatedMed;
}

export async function fetchPurchaseHistory(medicineId?: string): Promise<PurchaseRecord[]> {
  try {
    let query = supabase.from('purchase_records').select('*').order('purchase_date', { ascending: false });
    if (medicineId) {
      query = query.eq('medicine_id', medicineId);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      const mapped: PurchaseRecord[] = data.map((p: any) => ({
        id: p.id,
        medicineId: p.medicine_id,
        supplierId: p.supplier_id,
        supplierName: p.supplier_name || 'Vendor',
        batchNumber: p.batch_number,
        purchaseDate: p.purchase_date,
        quantityPurchased: Number(p.quantity_purchased) || 0,
        purchasePrice: Number(p.purchase_price) || 0,
        totalPurchaseAmount: Number(p.total_purchase_amount) || 0,
        invoiceNumber: p.invoice_number,
        expiryDate: p.expiry_date,
      }));
      return mapped;
    }
  } catch {}

  const all = loadStoredPurchases();
  if (medicineId) {
    return all.filter((p) => p.medicineId === medicineId);
  }
  return all;
}

export async function fetchStockMovements(medicineId?: string): Promise<StockMovement[]> {
  try {
    let query = supabase.from('stock_movements').select('*').order('date', { ascending: false });
    if (medicineId) {
      query = query.eq('medicine_id', medicineId);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      const mapped: StockMovement[] = data.map((m: any) => ({
        id: m.id,
        medicineId: m.medicine_id,
        batchId: m.batch_id,
        batchNumber: m.batch_number,
        movementType: m.movement_type as MovementType,
        quantity: Number(m.quantity) || 0,
        referenceNumber: m.reference_number,
        responsibleUser: m.responsible_user,
        date: m.date,
        notes: m.notes,
      }));
      return mapped;
    }
  } catch {}

  const all = loadStoredMovements();
  if (medicineId) {
    return all.filter((m) => m.medicineId === medicineId);
  }
  return all;
}

export async function addMedicineWithInitialBatch(params: {
  sku: string;
  brandName: string;
  genericName: string;
  manufacturer: string;
  category: string;
  dosageForm: DosageForm;
  strength: string;
  unit: string;
  barcode?: string;
  minimumStockLevel: number;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  supplierId?: string;
  supplierName?: string;
  invoiceNumber?: string;
  responsibleUser: string;
}): Promise<MedicineMaster> {
  const medId = `med-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const batchId = `bat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const currentSuppliers = loadStoredSuppliers();
  const matchedSup = params.supplierId
    ? currentSuppliers.find((s) => s.id === params.supplierId)
    : params.supplierName
    ? currentSuppliers.find((s) => s.name.toLowerCase() === params.supplierName?.toLowerCase())
    : undefined;

  const supplierObj: Supplier | undefined = matchedSup
    ? matchedSup
    : params.supplierName?.trim()
    ? {
        id: `sup-${Date.now().toString(36)}`,
        name: params.supplierName.trim(),
        phone: '',
        lastPurchaseDate: new Date().toISOString().split('T')[0],
        lastPurchasePrice: params.purchasePrice,
      }
    : undefined;

  if (supplierObj && !matchedSup) {
    saveStoredSuppliers([...currentSuppliers, supplierObj]);
  }

  const newBatch: MedicineBatch = {
    id: batchId,
    medicineId: medId,
    batchNumber: params.batchNumber.trim(),
    manufacturingDate: params.manufacturingDate,
    expiryDate: params.expiryDate,
    purchasePrice: params.purchasePrice,
    sellingPrice: params.sellingPrice,
    initialQuantity: params.quantity,
    availableQuantity: params.quantity,
    supplierId: supplierObj?.id || params.supplierId,
    supplierName: supplierObj?.name || params.supplierName,
  };

  const newMedicine: MedicineMaster = {
    id: medId,
    sku: params.sku.trim().toUpperCase(),
    brandName: params.brandName.trim(),
    genericName: params.genericName.trim(),
    manufacturer: params.manufacturer.trim(),
    category: params.category.trim(),
    dosageForm: params.dosageForm,
    strength: params.strength.trim(),
    unit: params.unit.trim() || 'Units',
    barcode: params.barcode?.trim(),
    minimumStockLevel: params.minimumStockLevel,
    sellingPrice: params.sellingPrice,
    lastPurchasePrice: params.purchasePrice,
    lastPurchaseDate: new Date().toISOString().split('T')[0],
    supplier: supplierObj,
    batches: [newBatch],
    totalStock: params.quantity,
    stockStatus: calculateStockStatus(params.quantity, params.minimumStockLevel),
    expiryStatus: calculateExpiryStatus([newBatch]),
  };

  try {
    await supabase.from('medicines').insert([
      {
        id: medId,
        sku: newMedicine.sku,
        brand_name: newMedicine.brandName,
        generic_name: newMedicine.genericName,
        manufacturer: newMedicine.manufacturer,
        category: newMedicine.category,
        dosage_form: newMedicine.dosageForm,
        strength: newMedicine.strength,
        unit: newMedicine.unit,
        barcode: newMedicine.barcode,
        minimum_stock_level: newMedicine.minimumStockLevel,
        selling_price: newMedicine.sellingPrice,
        supplier_id: supplierObj?.id || params.supplierId || null,
      },
    ]);

    const { error: rpcErr } = await supabase.rpc('procure_batch_atomic', {
      p_medicine_id: medId,
      p_batch_number: newBatch.batchNumber,
      p_manufacturing_date: newBatch.manufacturingDate,
      p_expiry_date: newBatch.expiryDate,
      p_purchase_price: newBatch.purchasePrice,
      p_selling_price: newBatch.sellingPrice,
      p_quantity: newBatch.initialQuantity,
      p_supplier_id: newBatch.supplierId || null,
      p_supplier_name: newBatch.supplierName || null,
      p_invoice_number: params.invoiceNumber || null,
      p_responsible_user: params.responsibleUser || 'Doctor/Pharmacist',
    });

    if (rpcErr) {
      await supabase.from('medicine_batches').insert([
        {
          id: batchId,
          medicine_id: medId,
          batch_number: newBatch.batchNumber,
          manufacturing_date: newBatch.manufacturingDate,
          expiry_date: newBatch.expiryDate,
          purchase_price: newBatch.purchasePrice,
          selling_price: newBatch.sellingPrice,
          initial_quantity: newBatch.initialQuantity,
          available_quantity: newBatch.availableQuantity,
          supplier_id: newBatch.supplierId,
          supplier_name: newBatch.supplierName,
        },
      ]);
    }
  } catch {}

  const currentMeds = loadStoredMedicines();
  const updatedMeds = [newMedicine, ...currentMeds];
  saveStoredMedicines(updatedMeds);

  const purchaseRecord: PurchaseRecord = {
    id: `pur-${Date.now().toString(36)}`,
    medicineId: medId,
    medicineName: `${newMedicine.brandName} (${newMedicine.genericName})`,
    supplierId: supplierObj?.id || params.supplierId || '',
    supplierName: supplierObj?.name || params.supplierName || 'Self-Procured',
    batchNumber: newBatch.batchNumber,
    purchaseDate: new Date().toISOString().split('T')[0],
    quantityPurchased: params.quantity,
    purchasePrice: params.purchasePrice,
    totalPurchaseAmount: params.quantity * params.purchasePrice,
    invoiceNumber: params.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
    expiryDate: newBatch.expiryDate,
  };
  const purchases = [purchaseRecord, ...loadStoredPurchases()];
  saveStoredPurchases(purchases);

  const movement: StockMovement = {
    id: `mov-${Date.now().toString(36)}`,
    medicineId: medId,
    medicineName: newMedicine.brandName,
    batchId: batchId,
    batchNumber: newBatch.batchNumber,
    movementType: 'Purchase',
    quantity: params.quantity,
    referenceNumber: purchaseRecord.invoiceNumber,
    responsibleUser: params.responsibleUser || 'Doctor/Pharmacist',
    date: new Date().toISOString(),
    notes: 'Initial stock intake on medicine creation',
  };
  const movements = [movement, ...loadStoredMovements()];
  saveStoredMovements(movements);

  return newMedicine;
}

export async function addBatchToMedicine(params: {
  medicineId: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  supplierId?: string;
  supplierName?: string;
  invoiceNumber?: string;
  responsibleUser: string;
}): Promise<MedicineBatch> {
  const batchId = `bat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const newBatch: MedicineBatch = {
    id: batchId,
    medicineId: params.medicineId,
    batchNumber: params.batchNumber.trim(),
    manufacturingDate: params.manufacturingDate,
    expiryDate: params.expiryDate,
    purchasePrice: params.purchasePrice,
    sellingPrice: params.sellingPrice,
    initialQuantity: params.quantity,
    availableQuantity: params.quantity,
    supplierId: params.supplierId,
    supplierName: params.supplierName,
  };

  try {
    const { error: rpcErr } = await supabase.rpc('procure_batch_atomic', {
      p_medicine_id: params.medicineId,
      p_batch_number: newBatch.batchNumber,
      p_manufacturing_date: newBatch.manufacturingDate,
      p_expiry_date: newBatch.expiryDate,
      p_purchase_price: newBatch.purchasePrice,
      p_selling_price: newBatch.sellingPrice,
      p_quantity: newBatch.initialQuantity,
      p_supplier_id: newBatch.supplierId || null,
      p_supplier_name: newBatch.supplierName || null,
      p_invoice_number: params.invoiceNumber || null,
      p_responsible_user: params.responsibleUser || 'Doctor/Pharmacist',
    });

    if (rpcErr) {
      await supabase.from('medicine_batches').insert([
        {
          id: batchId,
          medicine_id: params.medicineId,
          batch_number: newBatch.batchNumber,
          manufacturing_date: newBatch.manufacturingDate,
          expiry_date: newBatch.expiryDate,
          purchase_price: newBatch.purchasePrice,
          selling_price: newBatch.sellingPrice,
          initial_quantity: newBatch.initialQuantity,
          available_quantity: newBatch.availableQuantity,
          supplier_id: newBatch.supplierId,
          supplier_name: newBatch.supplierName,
        },
      ]);
    }
  } catch {}

  const currentMeds = loadStoredMedicines();
  const updatedMeds = currentMeds.map((med) => {
    if (med.id !== params.medicineId) return med;
    const existingBatches = med.batches || [];
    const batchIdx = existingBatches.findIndex((b) => b.batchNumber === newBatch.batchNumber);
    let updatedBatches: MedicineBatch[];
    if (batchIdx >= 0) {
      updatedBatches = existingBatches.map((b, i) =>
        i === batchIdx
          ? {
              ...b,
              availableQuantity: b.availableQuantity + params.quantity,
              initialQuantity: b.initialQuantity + params.quantity,
              purchasePrice: params.purchasePrice,
              sellingPrice: params.sellingPrice,
              expiryDate: params.expiryDate,
            }
          : b
      );
    } else {
      updatedBatches = [...existingBatches, newBatch];
    }

    const totalStock = updatedBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
    return {
      ...med,
      batches: updatedBatches,
      totalStock,
      stockStatus: calculateStockStatus(totalStock, med.minimumStockLevel),
      expiryStatus: calculateExpiryStatus(updatedBatches),
      lastPurchaseDate: new Date().toISOString().split('T')[0],
      lastPurchasePrice: params.purchasePrice,
    };
  });
  saveStoredMedicines(updatedMeds);

  const targetMed = currentMeds.find((m) => m.id === params.medicineId);
  const purchaseRecord: PurchaseRecord = {
    id: `pur-${Date.now().toString(36)}`,
    medicineId: params.medicineId,
    medicineName: targetMed ? `${targetMed.brandName} (${targetMed.genericName})` : 'Medicine',
    supplierId: params.supplierId || '',
    supplierName: params.supplierName || 'Self-Procured',
    batchNumber: newBatch.batchNumber,
    purchaseDate: new Date().toISOString().split('T')[0],
    quantityPurchased: params.quantity,
    purchasePrice: params.purchasePrice,
    totalPurchaseAmount: params.quantity * params.purchasePrice,
    invoiceNumber: params.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
    expiryDate: newBatch.expiryDate,
  };
  saveStoredPurchases([purchaseRecord, ...loadStoredPurchases()]);

  const movement: StockMovement = {
    id: `mov-${Date.now().toString(36)}`,
    medicineId: params.medicineId,
    medicineName: targetMed?.brandName || 'Medicine',
    batchId: batchId,
    batchNumber: newBatch.batchNumber,
    movementType: 'Purchase',
    quantity: params.quantity,
    referenceNumber: purchaseRecord.invoiceNumber,
    responsibleUser: params.responsibleUser || 'Doctor',
    date: new Date().toISOString(),
    notes: `Procurement batch added: ${newBatch.batchNumber}`,
  };
  saveStoredMovements([movement, ...loadStoredMovements()]);

  return newBatch;
}

export async function recordStockAdjustment(params: {
  medicineId: string;
  batchId?: string;
  movementType: MovementType;
  quantityChange: number;
  referenceNumber: string;
  responsibleUser: string;
  notes?: string;
}): Promise<boolean> {
  const currentMeds = loadStoredMedicines();
  const med = currentMeds.find((m) => m.id === params.medicineId);
  if (!med) return false;

  let targetBatchId = params.batchId;
  if (!targetBatchId && med.batches.length > 0) {
    targetBatchId = med.batches[0].id;
  }

  const updatedBatches = med.batches.map((batch) => {
    if (batch.id === targetBatchId) {
      const nextQty = Math.max(0, batch.availableQuantity + params.quantityChange);
      return {
        ...batch,
        availableQuantity: nextQty,
      };
    }
    return batch;
  });

  const totalStock = updatedBatches.reduce((s, b) => s + b.availableQuantity, 0);
  const updatedMeds = currentMeds.map((m) =>
    m.id === med.id
      ? {
          ...m,
          batches: updatedBatches,
          totalStock,
          stockStatus: calculateStockStatus(totalStock, m.minimumStockLevel),
          expiryStatus: calculateExpiryStatus(updatedBatches),
        }
      : m
  );
  saveStoredMedicines(updatedMeds);

  const targetBatch = med.batches.find((b) => b.id === targetBatchId);
  const movement: StockMovement = {
    id: `mov-${Date.now().toString(36)}`,
    medicineId: med.id,
    medicineName: med.brandName,
    batchId: targetBatchId,
    batchNumber: targetBatch?.batchNumber || 'N/A',
    movementType: params.movementType,
    quantity: params.quantityChange,
    referenceNumber: params.referenceNumber,
    responsibleUser: params.responsibleUser,
    date: new Date().toISOString(),
    notes: params.notes || `Stock adjustment (${params.movementType})`,
  };
  saveStoredMovements([movement, ...loadStoredMovements()]);

  try {
    await supabase.rpc('record_stock_adjustment_atomic', {
      p_medicine_id: params.medicineId,
      p_batch_id: targetBatchId || null,
      p_movement_type: params.movementType,
      p_quantity_change: params.quantityChange,
      p_reference_number: params.referenceNumber,
      p_responsible_user: params.responsibleUser,
      p_notes: params.notes || null,
    });
  } catch {}

  return true;
}

export function dispenseFefo(params: {
  medicineId: string;
  requestedQty: number;
  referenceNumber: string;
  responsibleUser: string;
}): { success: boolean; dispensedQty: number; reason?: string } {
  const currentMeds = loadStoredMedicines();
  const medIndex = currentMeds.findIndex(
    (m) => String(m.id) === String(params.medicineId) || m.brandName.toLowerCase() === params.medicineId.toLowerCase()
  );
  if (medIndex === -1) {
    return { success: false, dispensedQty: 0, reason: 'Medicine not found' };
  }

  const med = currentMeds[medIndex];
  const now = new Date();

  const validBatches = med.batches
    .filter((b) => b.availableQuantity > 0 && new Date(b.expiryDate) >= now)
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  const availableValidStock = validBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
  if (availableValidStock < params.requestedQty) {
    const expiredStock = med.batches
      .filter((b) => b.availableQuantity > 0 && new Date(b.expiryDate) < now)
      .reduce((sum, b) => sum + b.availableQuantity, 0);

    const reason =
      expiredStock > 0
        ? `Insufficient non-expired stock. (${expiredStock} units are expired and blocked from dispensing)`
        : `Insufficient stock: only ${availableValidStock} available, ${params.requestedQty} requested.`;

    return { success: false, dispensedQty: 0, reason };
  }

  let remainingNeeded = params.requestedQty;
  const newMovements: StockMovement[] = [];
  const updatedBatches = [...med.batches];

  for (const batch of validBatches) {
    if (remainingNeeded <= 0) break;
    const deduct = Math.min(batch.availableQuantity, remainingNeeded);
    remainingNeeded -= deduct;

    const bIndex = updatedBatches.findIndex((b) => b.id === batch.id);
    if (bIndex >= 0) {
      updatedBatches[bIndex] = {
        ...updatedBatches[bIndex],
        availableQuantity: updatedBatches[bIndex].availableQuantity - deduct,
      };
    }

    newMovements.push({
      id: `mov-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      medicineId: med.id,
      medicineName: med.brandName,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      movementType: 'Dispensing',
      quantity: -deduct,
      referenceNumber: params.referenceNumber,
      responsibleUser: params.responsibleUser,
      date: new Date().toISOString(),
      notes: `FEFO Dispensed from Batch ${batch.batchNumber} (Expires: ${batch.expiryDate})`,
    });
  }

  const totalStock = updatedBatches.reduce((s, b) => s + b.availableQuantity, 0);
  const updatedMed: MedicineMaster = {
    ...med,
    batches: updatedBatches,
    totalStock,
    stockStatus: calculateStockStatus(totalStock, med.minimumStockLevel),
    expiryStatus: calculateExpiryStatus(updatedBatches),
  };

  currentMeds[medIndex] = updatedMed;
  saveStoredMedicines(currentMeds);

  const existingMovements = loadStoredMovements();
  saveStoredMovements([...newMovements, ...existingMovements]);

  try {
    supabase
      .rpc('dispense_fefo_atomic', {
        p_medicine_id: med.id,
        p_required_quantity: params.requestedQty,
        p_reference_number: params.referenceNumber,
        p_responsible_user: params.responsibleUser,
      })
      .then(
        () => {},
        () => {}
      );
  } catch {}

  return { success: true, dispensedQty: params.requestedQty };
}

export function generateSampleCsvTemplate(): string {
  const headers = [
    'sku',
    'brand_name',
    'generic_name',
    'manufacturer',
    'category',
    'dosage_form',
    'strength',
    'unit',
    'barcode',
    'batch_number',
    'mfg_date',
    'expiry_date',
    'purchase_price',
    'selling_price',
    'quantity',
    'min_stock_level',
    'supplier_name',
    'supplier_phone',
    'invoice_number',
  ].join(',');

  const rows = [
    'MED-PCM-500,Calpol 500,Paracetamol 500mg,GSK India,Analgesics & Antipyretics,Tablet,500mg,Strips,8901234111222,CP26-001,2026-02-01,2028-01-31,14.50,28.00,100,20,Apex Pharma Distributors,+91 98450 12345,INV-APX-1011',
    'MED-CET-010,Cetzine 10,Cetirizine 10mg,Dr. Reddys Laboratories,Anti-Allergic,Tablet,10mg,Strips,8901234333444,CT26-881,2026-01-15,2027-12-31,18.00,35.00,80,25,MediCare Lifesciences,+91 98110 54321,MCL-2026-302',
    'MED-AMO-250,Mox 250,Amoxicillin 250mg,Sun Pharma,Antibiotics,Capsule,250mg,Strips,8901234555666,MX26-440,2026-03-01,2027-08-31,45.00,75.00,40,15,Apex Pharma Distributors,+91 98450 12345,INV-APX-1044',
    'MED-ORS-021,Electral Powder,Oral Rehydration Salts IP,FDC Limited,Electrolytes & Nutrition,Powder,21.8g,Sachet,8901234777888,EL26-902,2026-02-10,2028-02-28,12.00,22.00,150,30,Global BioTech Logistics,+91 99002 98765,GBL-2026-119',
  ].join('\n');

  return `${headers}\n${rows}`;
}

export function parseAndValidateCsv(
  csvText: string,
  existingMedicines: MedicineMaster[]
): {
  rows: CsvParsedRow[];
  summary: CsvImportSummary;
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      rows: [],
      summary: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        newMedicinesCount: 0,
        updatedMedicinesCount: 0,
        successfullyImported: 0,
        skippedRows: 0,
        failedRows: 0,
        errors: [{ row: 0, field: 'file', value: '', reason: 'CSV file is empty or missing data rows' }],
      },
    };
  }

  const rawHeaders = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const headerMap: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const getCol = (cells: string[], key: string): string => {
    const idx = headerMap[key];
    if (idx === undefined || idx >= cells.length) return '';
    return cells[idx].trim().replace(/^["']|["']$/g, '');
  };

  const parsedRows: CsvParsedRow[] = [];
  const seenSkusInFile = new Set<string>();
  const seenBarcodesInFile = new Set<string>();
  const allErrors: CsvValidationError[] = [];

  const existingSkuMap = new Map<string, MedicineMaster>();
  const existingBarcodeMap = new Map<string, MedicineMaster>();
  for (const m of existingMedicines) {
    if (m.sku) existingSkuMap.set(m.sku.toUpperCase(), m);
    if (m.barcode) existingBarcodeMap.set(m.barcode, m);
  }

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const cells = lines[i].split(',').map((c) => c.trim());
    if (cells.length === 0 || cells.every((c) => c === '')) continue;

    const rowErrors: CsvValidationError[] = [];

    const sku = (getCol(cells, 'sku') || getCol(cells, 'medicine_id') || getCol(cells, 'id')).toUpperCase();
    const brandName = getCol(cells, 'brand_name') || getCol(cells, 'brand') || getCol(cells, 'name');
    const genericName = getCol(cells, 'generic_name') || getCol(cells, 'generic');
    const manufacturer = getCol(cells, 'manufacturer') || getCol(cells, 'mfg');
    const category = getCol(cells, 'category');
    const rawDosage = getCol(cells, 'dosage_form') || getCol(cells, 'form') || 'Tablet';
    const strength = getCol(cells, 'strength') || getCol(cells, 'dosage');
    const unit = getCol(cells, 'unit') || 'Units';
    const barcode = getCol(cells, 'barcode');
    const batchNumber = getCol(cells, 'batch_number') || getCol(cells, 'batch') || getCol(cells, 'batch_no');
    const mfgDate = getCol(cells, 'mfg_date') || getCol(cells, 'manufacturing_date');
    const expiryDate = getCol(cells, 'expiry_date') || getCol(cells, 'exp_date') || getCol(cells, 'expiry');
    const rawPurchasePrice = getCol(cells, 'purchase_price') || getCol(cells, 'cost_price') || getCol(cells, 'buy_price');
    const rawSellingPrice = getCol(cells, 'selling_price') || getCol(cells, 'mrp') || getCol(cells, 'sale_price');
    const rawQty = getCol(cells, 'quantity') || getCol(cells, 'qty') || getCol(cells, 'stock');
    const rawMinStock = getCol(cells, 'min_stock_level') || getCol(cells, 'min_stock') || getCol(cells, 'threshold');
    const supplierName = getCol(cells, 'supplier_name') || getCol(cells, 'supplier');
    const supplierPhone = getCol(cells, 'supplier_phone') || getCol(cells, 'supplier_contact');
    const invoiceNumber = getCol(cells, 'invoice_number') || getCol(cells, 'invoice');

    if (!sku) {
      rowErrors.push({ row: rowNum, field: 'sku', value: '', reason: 'Medicine SKU is required' });
    } else if (seenSkusInFile.has(sku)) {
      rowErrors.push({ row: rowNum, field: 'sku', value: sku, reason: `Duplicate SKU "${sku}" found within the same CSV file` });
    } else {
      seenSkusInFile.add(sku);
    }

    if (!brandName) {
      rowErrors.push({ row: rowNum, field: 'brand_name', value: '', reason: 'Brand Name is required' });
    }

    if (!genericName) {
      rowErrors.push({ row: rowNum, field: 'generic_name', value: '', reason: 'Generic Name is required' });
    }

    if (!batchNumber) {
      rowErrors.push({ row: rowNum, field: 'batch_number', value: '', reason: 'Batch Number is required for inventory tracking' });
    }

    if (barcode) {
      if (seenBarcodesInFile.has(barcode)) {
        rowErrors.push({ row: rowNum, field: 'barcode', value: barcode, reason: `Duplicate Barcode "${barcode}" in file` });
      } else {
        seenBarcodesInFile.add(barcode);
      }
    }

    const parseDate = (dStr: string): boolean => {
      if (!dStr) return false;
      const d = new Date(dStr);
      return !isNaN(d.getTime());
    };

    if (!expiryDate || !parseDate(expiryDate)) {
      rowErrors.push({ row: rowNum, field: 'expiry_date', value: expiryDate, reason: 'Valid expiry date required (e.g. YYYY-MM-DD)' });
    }

    if (mfgDate && !parseDate(mfgDate)) {
      rowErrors.push({ row: rowNum, field: 'mfg_date', value: mfgDate, reason: 'Invalid manufacturing date format (e.g. YYYY-MM-DD)' });
    }

    if (mfgDate && expiryDate && parseDate(mfgDate) && parseDate(expiryDate)) {
      if (new Date(expiryDate) <= new Date(mfgDate)) {
        rowErrors.push({ row: rowNum, field: 'expiry_date', value: expiryDate, reason: 'Expiry date must be after manufacturing date' });
      }
    }

    const purchasePrice = parseFloat(rawPurchasePrice);
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      rowErrors.push({ row: rowNum, field: 'purchase_price', value: rawPurchasePrice, reason: 'Purchase price must be a non-negative number' });
    }

    const sellingPrice = parseFloat(rawSellingPrice);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      rowErrors.push({ row: rowNum, field: 'selling_price', value: rawSellingPrice, reason: 'Selling price must be a non-negative number' });
    }

    if (!isNaN(purchasePrice) && !isNaN(sellingPrice) && sellingPrice < purchasePrice) {
      rowErrors.push({ row: rowNum, field: 'selling_price', value: rawSellingPrice, reason: `Selling price (${sellingPrice}) cannot be lower than purchase price (${purchasePrice})` });
    }

    const quantity = parseInt(rawQty, 10);
    if (isNaN(quantity) || quantity < 0) {
      rowErrors.push({ row: rowNum, field: 'quantity', value: rawQty, reason: 'Quantity must be a positive whole integer' });
    }

    const minStockLevel = parseInt(rawMinStock || '20', 10);
    if (isNaN(minStockLevel) || minStockLevel < 0) {
      rowErrors.push({ row: rowNum, field: 'min_stock_level', value: rawMinStock, reason: 'Minimum stock level must be non-negative integer' });
    }

    const isExisting = existingSkuMap.has(sku);
    const isBarcodeConflict = barcode && existingBarcodeMap.has(barcode) && existingBarcodeMap.get(barcode)?.sku !== sku;
    if (isBarcodeConflict) {
      rowErrors.push({ row: rowNum, field: 'barcode', value: barcode, reason: `Barcode "${barcode}" is already registered to another medicine (${existingBarcodeMap.get(barcode)?.brandName})` });
    }

    const validDosageForms: DosageForm[] = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Suspension', 'Powder', 'Other'];
    const matchedDosage = validDosageForms.find((f) => f.toLowerCase() === rawDosage.toLowerCase()) || 'Tablet';

    allErrors.push(...rowErrors);

    parsedRows.push({
      rowNumber: rowNum,
      sku,
      brandName: brandName || 'Unknown Brand',
      genericName: genericName || 'Unknown Generic',
      manufacturer: manufacturer || 'Standard Pharma',
      category: category || 'General Medicine',
      dosageForm: matchedDosage,
      strength: strength || 'N/A',
      unit: unit || 'Units',
      barcode: barcode || undefined,
      batchNumber: batchNumber || `BATCH-${rowNum}`,
      mfgDate: mfgDate || new Date().toISOString().split('T')[0],
      expiryDate: expiryDate || '2027-12-31',
      purchasePrice: isNaN(purchasePrice) ? 0 : purchasePrice,
      sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
      quantity: isNaN(quantity) ? 0 : quantity,
      minStockLevel: isNaN(minStockLevel) ? 20 : minStockLevel,
      supplierName,
      supplierPhone,
      invoiceNumber,
      errors: rowErrors,
      isValid: rowErrors.length === 0,
      isDuplicate: isExisting,
      isExisting,
    });
  }

  const validRows = parsedRows.filter((r) => r.isValid).length;
  const invalidRows = parsedRows.filter((r) => !r.isValid).length;
  const duplicateRows = parsedRows.filter((r) => r.isExisting).length;
  const newMedicinesCount = parsedRows.filter((r) => r.isValid && !r.isExisting).length;
  const updatedMedicinesCount = parsedRows.filter((r) => r.isValid && r.isExisting).length;

  return {
    rows: parsedRows,
    summary: {
      totalRows: parsedRows.length,
      validRows,
      invalidRows,
      duplicateRows,
      newMedicinesCount,
      updatedMedicinesCount,
      successfullyImported: 0,
      skippedRows: 0,
      failedRows: invalidRows,
      errors: allErrors,
    },
  };
}

export function executeCsvImport(
  parsedRows: CsvParsedRow[],
  updateExisting: boolean,
  responsibleUser: string
): CsvImportSummary {
  const currentMeds = loadStoredMedicines();
  const currentPurchases = loadStoredPurchases();
  const currentMovements = loadStoredMovements();
  const currentSuppliers = loadStoredSuppliers();

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const failureErrors: CsvValidationError[] = [];

  const medsMap = new Map<string, MedicineMaster>();
  currentMeds.forEach((m) => medsMap.set(m.sku.toUpperCase(), m));

  const newPurchases: PurchaseRecord[] = [];
  const newMovements: StockMovement[] = [];

  for (const row of parsedRows) {
    if (!row.isValid) {
      failedCount++;
      failureErrors.push(...row.errors);
      continue;
    }

    const existingMed = medsMap.get(row.sku.toUpperCase());

    if (existingMed) {
      if (!updateExisting) {
        skippedCount++;
        continue;
      }

      const existingBatches = [...existingMed.batches];
      const batchIdx = existingBatches.findIndex((b) => b.batchNumber === row.batchNumber);

      const batchId = batchIdx >= 0 ? existingBatches[batchIdx].id : `bat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const newBatch: MedicineBatch = {
        id: batchId,
        medicineId: existingMed.id,
        batchNumber: row.batchNumber,
        manufacturingDate: row.mfgDate,
        expiryDate: row.expiryDate,
        purchasePrice: row.purchasePrice,
        sellingPrice: row.sellingPrice,
        initialQuantity: row.quantity,
        availableQuantity: batchIdx >= 0 ? existingBatches[batchIdx].availableQuantity + row.quantity : row.quantity,
        supplierName: row.supplierName,
      };

      if (batchIdx >= 0) {
        existingBatches[batchIdx] = newBatch;
      } else {
        existingBatches.push(newBatch);
      }

      const totalStock = existingBatches.reduce((s, b) => s + b.availableQuantity, 0);

      const updatedMedicine: MedicineMaster = {
        ...existingMed,
        brandName: row.brandName || existingMed.brandName,
        genericName: row.genericName || existingMed.genericName,
        manufacturer: row.manufacturer || existingMed.manufacturer,
        category: row.category || existingMed.category,
        dosageForm: row.dosageForm || existingMed.dosageForm,
        strength: row.strength || existingMed.strength,
        unit: row.unit || existingMed.unit,
        barcode: row.barcode || existingMed.barcode,
        minimumStockLevel: row.minStockLevel || existingMed.minimumStockLevel,
        sellingPrice: row.sellingPrice || existingMed.sellingPrice,
        lastPurchasePrice: row.purchasePrice,
        lastPurchaseDate: new Date().toISOString().split('T')[0],
        batches: existingBatches,
        totalStock,
        stockStatus: calculateStockStatus(totalStock, row.minStockLevel),
        expiryStatus: calculateExpiryStatus(existingBatches),
      };

      medsMap.set(row.sku.toUpperCase(), updatedMedicine);
      updatedCount++;

      const purchaseRecord: PurchaseRecord = {
        id: `pur-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        medicineId: existingMed.id,
        medicineName: `${row.brandName} (${row.genericName})`,
        supplierId: 'sup-import',
        supplierName: row.supplierName || 'Self-Procured',
        batchNumber: row.batchNumber,
        purchaseDate: new Date().toISOString().split('T')[0],
        quantityPurchased: row.quantity,
        purchasePrice: row.purchasePrice,
        totalPurchaseAmount: row.quantity * row.purchasePrice,
        invoiceNumber: row.invoiceNumber || `CSV-IMP-${row.rowNumber}`,
        expiryDate: row.expiryDate,
      };
      newPurchases.push(purchaseRecord);

      newMovements.push({
        id: `mov-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        medicineId: existingMed.id,
        medicineName: row.brandName,
        batchId: batchId,
        batchNumber: row.batchNumber,
        movementType: 'Purchase',
        quantity: row.quantity,
        referenceNumber: purchaseRecord.invoiceNumber,
        responsibleUser: responsibleUser || 'CSV Importer',
        date: new Date().toISOString(),
        notes: `CSV Master Data Import (Row ${row.rowNumber}) - Restock`,
      });
    } else {
      const medId = `med-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const batchId = `bat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      const newBatch: MedicineBatch = {
        id: batchId,
        medicineId: medId,
        batchNumber: row.batchNumber,
        manufacturingDate: row.mfgDate,
        expiryDate: row.expiryDate,
        purchasePrice: row.purchasePrice,
        sellingPrice: row.sellingPrice,
        initialQuantity: row.quantity,
        availableQuantity: row.quantity,
        supplierName: row.supplierName,
      };

      const newMed: MedicineMaster = {
        id: medId,
        sku: row.sku,
        brandName: row.brandName,
        genericName: row.genericName,
        manufacturer: row.manufacturer,
        category: row.category,
        dosageForm: row.dosageForm,
        strength: row.strength,
        unit: row.unit,
        barcode: row.barcode,
        minimumStockLevel: row.minStockLevel,
        batches: [newBatch],
        totalStock: row.quantity,
        stockStatus: calculateStockStatus(row.quantity, row.minStockLevel),
        expiryStatus: calculateExpiryStatus([newBatch]),
        lastPurchasePrice: row.purchasePrice,
        lastPurchaseDate: new Date().toISOString().split('T')[0],
        sellingPrice: row.sellingPrice,
      };

      medsMap.set(row.sku.toUpperCase(), newMed);
      importedCount++;

      const purchaseRecord: PurchaseRecord = {
        id: `pur-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        medicineId: medId,
        medicineName: `${row.brandName} (${row.genericName})`,
        supplierId: 'sup-import',
        supplierName: row.supplierName || 'Import Distributor',
        batchNumber: row.batchNumber,
        purchaseDate: new Date().toISOString().split('T')[0],
        quantityPurchased: row.quantity,
        purchasePrice: row.purchasePrice,
        totalPurchaseAmount: row.quantity * row.purchasePrice,
        invoiceNumber: row.invoiceNumber || `CSV-IMP-${row.rowNumber}`,
        expiryDate: row.expiryDate,
      };
      newPurchases.push(purchaseRecord);

      newMovements.push({
        id: `mov-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        medicineId: medId,
        medicineName: row.brandName,
        batchId: batchId,
        batchNumber: row.batchNumber,
        movementType: 'Purchase',
        quantity: row.quantity,
        referenceNumber: purchaseRecord.invoiceNumber,
        responsibleUser: responsibleUser || 'CSV Importer',
        date: new Date().toISOString(),
        notes: `CSV Master Data Import (Row ${row.rowNumber}) - New Master`,
      });
    }

    if (row.supplierName && !currentSuppliers.some((s) => s.name.toLowerCase() === row.supplierName?.toLowerCase())) {
      const newSup: Supplier = {
        id: `sup-${Date.now().toString(36)}`,
        name: row.supplierName,
        phone: row.supplierPhone || '+91 98000 00000',
        lastPurchaseDate: new Date().toISOString().split('T')[0],
        lastPurchasePrice: row.purchasePrice,
      };
      currentSuppliers.push(newSup);
    }
  }

  const finalMeds = Array.from(medsMap.values());
  saveStoredMedicines(finalMeds);
  saveStoredPurchases([...newPurchases, ...currentPurchases]);
  saveStoredMovements([...newMovements, ...currentMovements]);
  saveStoredSuppliers(currentSuppliers);

  try {
    supabase.from('csv_import_logs').insert([
      {
        filename: 'master_import.csv',
        total_rows: parsedRows.length,
        imported_rows: importedCount + updatedCount,
        failed_rows: failedCount,
        status: failedCount === 0 ? 'Success' : 'Partial Success',
        error_log: failureErrors,
      },
    ]);
  } catch {}

  return {
    totalRows: parsedRows.length,
    validRows: parsedRows.filter((r) => r.isValid).length,
    invalidRows: parsedRows.filter((r) => !r.isValid).length,
    duplicateRows: parsedRows.filter((r) => r.isExisting).length,
    newMedicinesCount: importedCount,
    updatedMedicinesCount: updatedCount,
    successfullyImported: importedCount + updatedCount,
    skippedRows: skippedCount,
    failedRows: failedCount,
    errors: failureErrors,
  };
}

export function generateCsvErrorReport(errors: CsvValidationError[]): string {
  const headers = ['Row_Number', 'Field_Name', 'Rejected_Value', 'Validation_Error_Reason'].join(',');
  const lines = errors.map((e) =>
    [e.row, `"${e.field}"`, `"${String(e.value || '').replace(/"/g, '""')}"`, `"${e.reason.replace(/"/g, '""')}"`].join(',')
  );
  return `${headers}\n${lines.join('\n')}`;
}

export function convertMasterToInventoryItems(medicines: MedicineMaster[]): InventoryItem[] {
  return medicines.map((m) => ({
    id: m.id,
    brand: m.brandName,
    generic: m.genericName,
    stock: m.totalStock,
    unit: m.unit,
    category: m.category,
    batchNo: m.batches && m.batches.length > 0 ? m.batches[0].batchNumber : undefined,
  }));
}

