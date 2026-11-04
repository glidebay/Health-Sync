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

export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_MEDICINES: MedicineMaster[] = [];
export const INITIAL_PURCHASES: PurchaseRecord[] = [];
export const INITIAL_MOVEMENTS: StockMovement[] = [];

export function isValidUuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str).trim());
}

export function generateSafeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function parseFlexibleDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const parts = s.split('-');
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }
  }

  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const dt = new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
    if (!isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }
  }

  const ymdSlash = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdSlash) {
    const dt = new Date(Number(ymdSlash[1]), Number(ymdSlash[2]) - 1, Number(ymdSlash[3]));
    if (!isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  return null;
}

export function parseCleanNumber(val: any, fallback = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? fallback : n;
}

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
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY_MEDICINES);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredMedicines(medicines: MedicineMaster[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_MEDICINES, JSON.stringify(medicines));
  } catch {}
}

export function loadStoredSuppliers(): Supplier[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY_SUPPLIERS);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredSuppliers(suppliers: Supplier[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(suppliers));
  } catch {}
}

export function loadStoredPurchases(): PurchaseRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY_PURCHASES);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredPurchases(purchases: PurchaseRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PURCHASES, JSON.stringify(purchases));
  } catch {}
}

export function loadStoredMovements(): StockMovement[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY_MOVEMENTS);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

    if (!medError && Array.isArray(dbMeds)) {
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
          lastPurchasePrice: batches[batches.length - 1]?.purchasePrice,
          lastPurchaseDate: batches[batches.length - 1]?.manufacturingDate,
          supplier: primarySupplier,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
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
    if (!error && Array.isArray(data)) {
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

  if (!supId || !isValidUuid(supId)) {
    const existing = currentSuppliers.find(
      (s) => s.name.toLowerCase() === data.name.trim().toLowerCase()
    );
    supId = existing?.id && isValidUuid(existing.id) ? existing.id : generateSafeUuid();
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
    let targetId = medicineId;
    if (!isValidUuid(targetId)) {
      const med = currentMeds[medIdx];
      if (med?.sku) {
        const { data: dbCheck } = await supabase.from('medicines').select('id').ilike('sku', med.sku).maybeSingle();
        if (dbCheck?.id) targetId = dbCheck.id;
      }
    }

    if (isValidUuid(targetId)) {
      await supabase
        .from('medicines')
        .update({
          supplier_id: isValidUuid(supplier.id) ? supplier.id : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);
    }
  } catch {}

  return updatedMed;
}

export async function fetchPurchaseHistory(medicineId?: string): Promise<PurchaseRecord[]> {
  try {
    let targetId = medicineId;
    if (medicineId && !isValidUuid(medicineId)) {
      const current = loadStoredMedicines().find((m) => m.id === medicineId || m.sku.toLowerCase() === medicineId.toLowerCase());
      if (current?.sku) {
        const { data: dbCheck } = await supabase.from('medicines').select('id').ilike('sku', current.sku).maybeSingle();
        targetId = dbCheck?.id;
      } else {
        targetId = undefined;
      }
    }

    let query = supabase.from('purchase_records').select('*').order('purchase_date', { ascending: false });
    if (targetId && isValidUuid(targetId)) {
      query = query.eq('medicine_id', targetId);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
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
    let targetId = medicineId;
    if (medicineId && !isValidUuid(medicineId)) {
      const current = loadStoredMedicines().find((m) => m.id === medicineId || m.sku.toLowerCase() === medicineId.toLowerCase());
      if (current?.sku) {
        const { data: dbCheck } = await supabase.from('medicines').select('id').ilike('sku', current.sku).maybeSingle();
        targetId = dbCheck?.id;
      } else {
        targetId = undefined;
      }
    }

    let query = supabase.from('stock_movements').select('*').order('date', { ascending: false });
    if (targetId && isValidUuid(targetId)) {
      query = query.eq('medicine_id', targetId);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
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
  const medId = generateSafeUuid();
  const batchId = generateSafeUuid();

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
        id: generateSafeUuid(),
        name: params.supplierName.trim(),
        phone: '',
        lastPurchaseDate: new Date().toISOString().split('T')[0],
        lastPurchasePrice: params.purchasePrice,
      }
    : undefined;

  if (supplierObj && !matchedSup) {
    saveStoredSuppliers([...currentSuppliers, supplierObj]);
  }

  const validSupplierId = supplierObj && isValidUuid(supplierObj.id)
    ? supplierObj.id
    : params.supplierId && isValidUuid(params.supplierId)
    ? params.supplierId
    : undefined;

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
    supplierId: validSupplierId,
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

  let actualMedId = medId;

  try {
    const { data: existingMed } = await supabase
      .from('medicines')
      .select('id')
      .ilike('sku', newMedicine.sku)
      .maybeSingle();

    if (existingMed && existingMed.id) {
      actualMedId = existingMed.id;
      await supabase
        .from('medicines')
        .update({
          brand_name: newMedicine.brandName,
          generic_name: newMedicine.genericName,
          manufacturer: newMedicine.manufacturer,
          category: newMedicine.category,
          dosage_form: newMedicine.dosageForm,
          strength: newMedicine.strength,
          unit: newMedicine.unit,
          barcode: newMedicine.barcode || undefined,
          minimum_stock_level: newMedicine.minimumStockLevel,
          selling_price: newMedicine.sellingPrice,
          supplier_id: validSupplierId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', actualMedId);
    } else {
      const { data: upsertData } = await supabase
        .from('medicines')
        .upsert(
          [
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
              supplier_id: validSupplierId || null,
            },
          ],
          { onConflict: 'sku' }
        )
        .select('id')
        .maybeSingle();

      if (upsertData && upsertData.id) {
        actualMedId = upsertData.id;
      }
    }

    const { error: rpcErr } = await supabase.rpc('procure_batch_atomic', {
      p_medicine_id: actualMedId,
      p_batch_number: newBatch.batchNumber,
      p_manufacturing_date: newBatch.manufacturingDate,
      p_expiry_date: newBatch.expiryDate,
      p_purchase_price: newBatch.purchasePrice,
      p_selling_price: newBatch.sellingPrice,
      p_quantity: newBatch.initialQuantity,
      p_supplier_id: validSupplierId || null,
      p_supplier_name: newBatch.supplierName || null,
      p_invoice_number: params.invoiceNumber || null,
      p_responsible_user: params.responsibleUser || 'Doctor/Pharmacist',
    });

    if (rpcErr) {
      await supabase.from('medicine_batches').upsert(
        [
          {
            id: batchId,
            medicine_id: actualMedId,
            batch_number: newBatch.batchNumber,
            manufacturing_date: newBatch.manufacturingDate,
            expiry_date: newBatch.expiryDate,
            purchase_price: newBatch.purchasePrice,
            selling_price: newBatch.sellingPrice,
            initial_quantity: newBatch.initialQuantity,
            available_quantity: newBatch.availableQuantity,
            supplier_id: validSupplierId || null,
            supplier_name: newBatch.supplierName || null,
          },
        ],
        { onConflict: 'medicine_id,batch_number' }
      );

      const invNo = params.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
      await supabase.from('purchase_records').insert([
        {
          id: generateSafeUuid(),
          medicine_id: actualMedId,
          medicine_name: `${newMedicine.brandName} (${newMedicine.genericName})`,
          supplier_id: validSupplierId || null,
          supplier_name: supplierObj?.name || 'Self-Procured',
          batch_number: newBatch.batchNumber,
          purchase_date: new Date().toISOString().split('T')[0],
          quantity_purchased: newBatch.initialQuantity,
          purchase_price: newBatch.purchasePrice,
          total_purchase_amount: newBatch.initialQuantity * newBatch.purchasePrice,
          invoice_number: invNo,
          expiry_date: newBatch.expiryDate,
        },
      ]);

      await supabase.from('stock_movements').insert([
        {
          id: generateSafeUuid(),
          medicine_id: actualMedId,
          batch_id: batchId,
          movement_type: 'Purchase',
          quantity: newBatch.initialQuantity,
          reference_number: invNo,
          responsible_user: params.responsibleUser || 'Doctor/Pharmacist',
          date: new Date().toISOString(),
          notes: 'Initial stock intake on medicine creation',
        },
      ]);
    }
  } catch {}

  const currentMeds = loadStoredMedicines();
  const existingIdx = currentMeds.findIndex(
    (m) => m.sku.toUpperCase() === newMedicine.sku.toUpperCase() || m.id === actualMedId
  );

  let updatedMeds: MedicineMaster[];
  let finalMedicine: MedicineMaster;

  if (existingIdx >= 0) {
    const existing = currentMeds[existingIdx];
    const existingBatches = [...existing.batches];
    const bIdx = existingBatches.findIndex(
      (b) => b.batchNumber.toLowerCase() === newBatch.batchNumber.toLowerCase()
    );

    if (bIdx >= 0) {
      existingBatches[bIdx] = {
        ...existingBatches[bIdx],
        availableQuantity: existingBatches[bIdx].availableQuantity + newBatch.availableQuantity,
        initialQuantity: existingBatches[bIdx].initialQuantity + newBatch.initialQuantity,
        purchasePrice: newBatch.purchasePrice,
        sellingPrice: newBatch.sellingPrice,
        expiryDate: newBatch.expiryDate,
        supplierId: validSupplierId || existingBatches[bIdx].supplierId,
        supplierName: newBatch.supplierName || existingBatches[bIdx].supplierName,
      };
    } else {
      existingBatches.push({ ...newBatch, medicineId: actualMedId });
    }

    const totalStock = existingBatches.reduce((s, b) => s + b.availableQuantity, 0);
    finalMedicine = {
      ...existing,
      id: actualMedId,
      brandName: newMedicine.brandName,
      genericName: newMedicine.genericName,
      manufacturer: newMedicine.manufacturer,
      category: newMedicine.category,
      dosageForm: newMedicine.dosageForm,
      strength: newMedicine.strength,
      unit: newMedicine.unit,
      barcode: newMedicine.barcode || existing.barcode,
      minimumStockLevel: newMedicine.minimumStockLevel,
      sellingPrice: newMedicine.sellingPrice,
      lastPurchasePrice: newMedicine.lastPurchasePrice,
      lastPurchaseDate: newMedicine.lastPurchaseDate,
      supplier: newMedicine.supplier || existing.supplier,
      batches: existingBatches,
      totalStock,
      stockStatus: calculateStockStatus(totalStock, newMedicine.minimumStockLevel),
      expiryStatus: calculateExpiryStatus(existingBatches),
    };
    updatedMeds = currentMeds.map((m, i) => (i === existingIdx ? finalMedicine : m));
  } else {
    finalMedicine = { ...newMedicine, id: actualMedId };
    updatedMeds = [finalMedicine, ...currentMeds];
  }
  saveStoredMedicines(updatedMeds);

  const purchaseRecord: PurchaseRecord = {
    id: generateSafeUuid(),
    medicineId: actualMedId,
    medicineName: `${finalMedicine.brandName} (${finalMedicine.genericName})`,
    supplierId: validSupplierId || '',
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
    id: generateSafeUuid(),
    medicineId: actualMedId,
    medicineName: finalMedicine.brandName,
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

  return finalMedicine;
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
  const batchId = generateSafeUuid();
  const currentMeds = loadStoredMedicines();
  const targetMed = currentMeds.find(
    (m) => m.id === params.medicineId || m.sku.toLowerCase() === params.medicineId.toLowerCase()
  );

  let targetMedId = params.medicineId;

  try {
    if (isValidUuid(params.medicineId)) {
      const { data: medCheck } = await supabase
        .from('medicines')
        .select('id')
        .or(`id.eq.${params.medicineId},sku.eq.${params.medicineId}`)
        .maybeSingle();

      if (medCheck && medCheck.id) {
        targetMedId = medCheck.id;
      }
    } else {
      const skuToSearch = targetMed?.sku || params.medicineId;
      const { data: medCheck } = await supabase
        .from('medicines')
        .select('id')
        .ilike('sku', skuToSearch)
        .maybeSingle();

      if (medCheck && medCheck.id) {
        targetMedId = medCheck.id;
      }
    }

    if (!isValidUuid(targetMedId) && targetMed) {
      const validMedId = generateSafeUuid();
      await supabase.from('medicines').upsert(
        [
          {
            id: validMedId,
            sku: targetMed.sku,
            brand_name: targetMed.brandName,
            generic_name: targetMed.genericName,
            manufacturer: targetMed.manufacturer,
            category: targetMed.category,
            dosage_form: targetMed.dosageForm,
            strength: targetMed.strength,
            unit: targetMed.unit,
            barcode: targetMed.barcode,
            minimum_stock_level: targetMed.minimumStockLevel,
            selling_price: targetMed.sellingPrice,
            supplier_id: isValidUuid(targetMed.supplier?.id) ? targetMed.supplier?.id : null,
          },
        ],
        { onConflict: 'sku' }
      );
      targetMedId = validMedId;
      targetMed.id = validMedId;
      saveStoredMedicines(currentMeds);
    }

    const validSupplierId = params.supplierId && isValidUuid(params.supplierId) ? params.supplierId : null;

    const { error: rpcErr } = await supabase.rpc('procure_batch_atomic', {
      p_medicine_id: targetMedId,
      p_batch_number: params.batchNumber.trim(),
      p_manufacturing_date: params.manufacturingDate,
      p_expiry_date: params.expiryDate,
      p_purchase_price: params.purchasePrice,
      p_selling_price: params.sellingPrice,
      p_quantity: params.quantity,
      p_supplier_id: validSupplierId,
      p_supplier_name: params.supplierName || null,
      p_invoice_number: params.invoiceNumber || null,
      p_responsible_user: params.responsibleUser || 'Doctor/Pharmacist',
    });

    if (rpcErr) {
      await supabase.from('medicine_batches').upsert(
        [
          {
            id: batchId,
            medicine_id: targetMedId,
            batch_number: params.batchNumber.trim(),
            manufacturing_date: params.manufacturingDate,
            expiry_date: params.expiryDate,
            purchase_price: params.purchasePrice,
            selling_price: params.sellingPrice,
            initial_quantity: params.quantity,
            available_quantity: params.quantity,
            supplier_id: validSupplierId,
            supplier_name: params.supplierName || null,
          },
        ],
        { onConflict: 'medicine_id,batch_number' }
      );

      const invNo = params.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
      await supabase.from('purchase_records').insert([
        {
          id: generateSafeUuid(),
          medicine_id: targetMedId,
          medicine_name: targetMed ? `${targetMed.brandName} (${targetMed.genericName})` : 'Medicine',
          supplier_id: validSupplierId,
          supplier_name: params.supplierName || 'Self-Procured',
          batch_number: params.batchNumber.trim(),
          purchase_date: new Date().toISOString().split('T')[0],
          quantity_purchased: params.quantity,
          purchase_price: params.purchasePrice,
          total_purchase_amount: params.quantity * params.purchasePrice,
          invoice_number: invNo,
          expiry_date: params.expiryDate,
        },
      ]);

      await supabase.from('stock_movements').insert([
        {
          id: generateSafeUuid(),
          medicine_id: targetMedId,
          batch_id: batchId,
          movement_type: 'Purchase',
          quantity: params.quantity,
          reference_number: invNo,
          responsible_user: params.responsibleUser || 'Doctor/Pharmacist',
          date: new Date().toISOString(),
          notes: `Procurement batch added: ${params.batchNumber.trim()}`,
        },
      ]);
    }
  } catch {}

  const newBatch: MedicineBatch = {
    id: batchId,
    medicineId: targetMedId,
    batchNumber: params.batchNumber.trim(),
    manufacturingDate: params.manufacturingDate,
    expiryDate: params.expiryDate,
    purchasePrice: params.purchasePrice,
    sellingPrice: params.sellingPrice,
    initialQuantity: params.quantity,
    availableQuantity: params.quantity,
    supplierId: params.supplierId && isValidUuid(params.supplierId) ? params.supplierId : undefined,
    supplierName: params.supplierName,
  };

  const updatedMeds = currentMeds.map((med) => {
    if (med.id !== params.medicineId && med.id !== targetMedId) return med;
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
      id: targetMedId,
      batches: updatedBatches,
      totalStock,
      stockStatus: calculateStockStatus(totalStock, med.minimumStockLevel),
      expiryStatus: calculateExpiryStatus(updatedBatches),
      lastPurchaseDate: new Date().toISOString().split('T')[0],
      lastPurchasePrice: params.purchasePrice,
    };
  });
  saveStoredMedicines(updatedMeds);

  const purchaseRecord: PurchaseRecord = {
    id: generateSafeUuid(),
    medicineId: targetMedId,
    medicineName: targetMed ? `${targetMed.brandName} (${targetMed.genericName})` : 'Medicine',
    supplierId: params.supplierId && isValidUuid(params.supplierId) ? params.supplierId : '',
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
    id: generateSafeUuid(),
    medicineId: targetMedId,
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
  const med = currentMeds.find((m) => m.id === params.medicineId || m.sku.toLowerCase() === params.medicineId.toLowerCase());
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
    id: generateSafeUuid(),
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
    let dbMedId = med.id;
    if (!isValidUuid(dbMedId)) {
      const { data: dbCheck } = await supabase.from('medicines').select('id').ilike('sku', med.sku).maybeSingle();
      if (dbCheck?.id) dbMedId = dbCheck.id;
    }

    if (isValidUuid(dbMedId)) {
      let dbBatchId = targetBatchId && isValidUuid(targetBatchId) ? targetBatchId : null;
      if (!dbBatchId && targetBatch?.batchNumber) {
        const { data: bCheck } = await supabase
          .from('medicine_batches')
          .select('id')
          .eq('medicine_id', dbMedId)
          .eq('batch_number', targetBatch.batchNumber)
          .maybeSingle();
        if (bCheck?.id) dbBatchId = bCheck.id;
      }

      const { error: rpcErr } = await supabase.rpc('record_stock_adjustment_atomic', {
        p_medicine_id: dbMedId,
        p_batch_id: dbBatchId,
        p_movement_type: params.movementType,
        p_quantity_change: params.quantityChange,
        p_reference_number: params.referenceNumber,
        p_responsible_user: params.responsibleUser,
        p_notes: params.notes || null,
      });

      if (rpcErr && dbBatchId) {
        const nextQty = Math.max(0, (targetBatch?.availableQuantity || 0) + params.quantityChange);
        await supabase
          .from('medicine_batches')
          .update({ available_quantity: nextQty })
          .eq('id', dbBatchId);

        await supabase.from('stock_movements').insert([
          {
            id: generateSafeUuid(),
            medicine_id: dbMedId,
            batch_id: dbBatchId,
            movement_type: params.movementType,
            quantity: params.quantityChange,
            reference_number: params.referenceNumber,
            responsible_user: params.responsibleUser,
            date: new Date().toISOString(),
            notes: params.notes || `Stock adjustment (${params.movementType})`,
          },
        ]);
      }
    }
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
      id: generateSafeUuid(),
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
    let dbMedId = med.id;
    if (!isValidUuid(dbMedId)) {
      supabase.from('medicines').select('id').ilike('sku', med.sku).maybeSingle().then(({ data }) => {
        if (data?.id) {
          supabase.rpc('dispense_fefo_atomic', {
            p_medicine_id: data.id,
            p_required_quantity: params.requestedQty,
            p_reference_number: params.referenceNumber,
            p_responsible_user: params.responsibleUser,
          }).then(() => {}, () => {});
        }
      }, () => {});
    } else {
      supabase
        .rpc('dispense_fefo_atomic', {
          p_medicine_id: dbMedId,
          p_required_quantity: params.requestedQty,
          p_reference_number: params.referenceNumber,
          p_responsible_user: params.responsibleUser,
        })
        .then(
          () => {},
          () => {}
        );
    }
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

  const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const headerIndices: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean) headerIndices[clean] = idx;
  });

  const getCol = (cells: string[], ...aliases: string[]): string => {
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headerIndices[cleanAlias];
      if (idx !== undefined && idx < cells.length) {
        const val = cells[idx].trim().replace(/^["']|["']$/g, '');
        if (val) return val;
      }
    }
    return '';
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

    let brandName = getCol(cells, 'brand_name', 'brand', 'medicine_name', 'product_name', 'name', 'item_name', 'medicine');
    let genericName = getCol(cells, 'generic_name', 'generic', 'composition', 'salt', 'formula', 'molecule', 'drug_name');

    if (!brandName && genericName) brandName = genericName;
    if (!genericName && brandName) genericName = brandName;

    let sku = (getCol(cells, 'sku', 'medicine_sku', 'medicine_code', 'medicine_id', 'code', 'id', 'item_code', 'product_code')).toUpperCase();
    if (!sku) {
      const cleanName = (brandName || 'MED').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      sku = `MED-${cleanName}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }

    const manufacturer = getCol(cells, 'manufacturer', 'mfg', 'company', 'brand_owner', 'maker', 'pharma', 'lab') || 'Standard Healthcare';
    const category = getCol(cells, 'category', 'cat', 'therapeutic_class', 'group', 'classification', 'department') || 'General Medicine';
    const rawDosage = getCol(cells, 'dosage_form', 'form', 'dosage_type', 'type', 'presentation');
    const strength = getCol(cells, 'strength', 'dosage', 'potency', 'power', 'concentration');
    const unit = getCol(cells, 'unit', 'unit_of_measure', 'uom', 'pack_unit', 'packaging', 'package', 'pack');
    const barcode = getCol(cells, 'barcode', 'ean', 'upc', 'gtin', 'qr');
    let batchNumber = getCol(cells, 'batch_number', 'batch', 'batch_no', 'lot_number', 'lot_no', 'lot');
    if (!batchNumber) {
      batchNumber = `BTH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    const rawMfgDate = getCol(cells, 'mfg_date', 'manufacturing_date', 'mfg', 'mfg_dt', 'production_date');
    const rawExpiryDate = getCol(cells, 'expiry_date', 'exp_date', 'expiry', 'exp', 'expiration_date', 'exp_dt');
    const rawPurchasePrice = getCol(cells, 'purchase_price', 'buy_price', 'cost_price', 'cost', 'purchase_rate', 'rate', 'cost_per_unit');
    const rawSellingPrice = getCol(cells, 'selling_price', 'sell_price', 'sale_price', 'retail_price', 'price');
    const rawMrp = getCol(cells, 'mrp', 'max_retail_price', 'selling_price', 'sell_price', 'retail_price');
    const rawQty = getCol(cells, 'quantity', 'qty', 'stock', 'initial_quantity', 'units', 'count', 'total_qty');
    const rawMinStock = getCol(cells, 'min_stock_level', 'reorder_level', 'reorder_qty', 'reorder', 'min_stock', 'minimum_stock', 'threshold', 'alert_level');
    const supplierName = getCol(cells, 'supplier_name', 'supplier', 'vendor_name', 'vendor', 'distributor_name', 'distributor', 'wholesaler');
    const supplierPhone = getCol(cells, 'supplier_phone', 'supplier_contact', 'contact', 'phone', 'phone_number', 'mobile', 'email', 'supplier_email');
    const invoiceNumber = getCol(cells, 'invoice_number', 'invoice', 'bill_number', 'bill_no', 'inv_no', 'reference_no', 'ref_no');

    if (seenSkusInFile.has(sku)) {
      rowErrors.push({ row: rowNum, field: 'sku', value: sku, reason: `Duplicate SKU "${sku}" found within the same CSV file` });
    } else {
      seenSkusInFile.add(sku);
    }

    if (!brandName) {
      rowErrors.push({ row: rowNum, field: 'brand_name', value: '', reason: 'Brand Name is required' });
    }

    if (barcode) {
      if (seenBarcodesInFile.has(barcode)) {
        rowErrors.push({ row: rowNum, field: 'barcode', value: barcode, reason: `Duplicate Barcode "${barcode}" in file` });
      } else {
        seenBarcodesInFile.add(barcode);
      }
    }

    let parsedExpiry = parseFlexibleDate(rawExpiryDate);
    if (!parsedExpiry) {
      rowErrors.push({ row: rowNum, field: 'expiry_date', value: rawExpiryDate, reason: 'Valid expiry date required (e.g. YYYY-MM-DD)' });
      parsedExpiry = '2028-12-31';
    }

    let parsedMfg = parseFlexibleDate(rawMfgDate);
    if (!parsedMfg) {
      const expDt = new Date(parsedExpiry);
      expDt.setFullYear(expDt.getFullYear() - 1);
      parsedMfg = `${expDt.getFullYear()}-${String(expDt.getMonth() + 1).padStart(2, '0')}-${String(expDt.getDate()).padStart(2, '0')}`;
    }

    if (parsedMfg && parsedExpiry && new Date(parsedExpiry) <= new Date(parsedMfg)) {
      const expDt = new Date(parsedExpiry);
      expDt.setFullYear(expDt.getFullYear() - 1);
      parsedMfg = `${expDt.getFullYear()}-${String(expDt.getMonth() + 1).padStart(2, '0')}-${String(expDt.getDate()).padStart(2, '0')}`;
    }

    const purchasePrice = parseCleanNumber(rawPurchasePrice, 0);
    let sellingPrice = parseCleanNumber(rawSellingPrice, 0);
    const mrp = parseCleanNumber(rawMrp, 0);
    if (sellingPrice <= 0 && mrp > 0) {
      sellingPrice = mrp;
    }
    if (sellingPrice <= 0 && purchasePrice > 0) {
      sellingPrice = Math.round(purchasePrice * 1.35 * 100) / 100;
    }

    const quantity = parseInt(rawQty || '0', 10);
    if (isNaN(quantity) || quantity < 0) {
      rowErrors.push({ row: rowNum, field: 'quantity', value: rawQty, reason: 'Quantity must be a positive whole integer' });
    }

    const minStockLevel = parseInt(rawMinStock || '20', 10);

    const isExisting = existingSkuMap.has(sku);
    const isBarcodeConflict = barcode && existingBarcodeMap.has(barcode) && existingBarcodeMap.get(barcode)?.sku !== sku;
    if (isBarcodeConflict) {
      rowErrors.push({ row: rowNum, field: 'barcode', value: barcode, reason: `Barcode "${barcode}" is already registered to another medicine (${existingBarcodeMap.get(barcode)?.brandName})` });
    }

    const validDosageForms: DosageForm[] = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Suspension', 'Powder', 'Other'];
    let matchedDosage = validDosageForms.find((f) => f.toLowerCase() === (rawDosage || '').toLowerCase());
    if (!matchedDosage) {
      const combined = `${rawDosage || ''} ${unit || ''} ${brandName || ''} ${genericName || ''}`.toLowerCase();
      if (combined.includes('cap')) matchedDosage = 'Capsule';
      else if (combined.includes('syr') || combined.includes('liq') || combined.includes('sol')) matchedDosage = 'Syrup';
      else if (combined.includes('inj') || combined.includes('vial') || combined.includes('amp')) matchedDosage = 'Injection';
      else if (combined.includes('drop')) matchedDosage = 'Drops';
      else if (combined.includes('oint') || combined.includes('gel') || combined.includes('cream')) matchedDosage = 'Ointment';
      else if (combined.includes('sachet') || combined.includes('powd')) matchedDosage = 'Powder';
      else if (combined.includes('inhal')) matchedDosage = 'Inhaler';
      else if (combined.includes('susp')) matchedDosage = 'Suspension';
      else matchedDosage = 'Tablet';
    }

    let matchedStrength = strength;
    if (!matchedStrength) {
      const strMatch = `${brandName} ${genericName}`.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|d3|%|iu\/ml|w\/v|w\/w))/i);
      matchedStrength = strMatch ? strMatch[0] : 'Standard';
    }

    let normalizedUnit = unit;
    if (!normalizedUnit || normalizedUnit.toLowerCase() === 'units') {
      if (matchedDosage === 'Tablet' || matchedDosage === 'Capsule') normalizedUnit = 'Strips';
      else if (matchedDosage === 'Syrup' || matchedDosage === 'Suspension') normalizedUnit = 'Bottles';
      else if (matchedDosage === 'Injection') normalizedUnit = 'Vials';
      else normalizedUnit = 'Units';
    } else {
      const lu = normalizedUnit.toLowerCase();
      if (lu.includes('tab')) normalizedUnit = 'Tablets';
      else if (lu.includes('cap')) normalizedUnit = 'Capsules';
      else if (lu.includes('strip')) normalizedUnit = 'Strips';
      else if (lu.includes('bot')) normalizedUnit = 'Bottles';
      else if (lu.includes('vial')) normalizedUnit = 'Vials';
      else if (lu.includes('sachet')) normalizedUnit = 'Sachets';
    }

    allErrors.push(...rowErrors);

    parsedRows.push({
      rowNumber: rowNum,
      sku,
      brandName: brandName || 'Unknown Brand',
      genericName: genericName || brandName || 'Unknown Generic',
      manufacturer,
      category,
      dosageForm: matchedDosage,
      strength: matchedStrength,
      unit: normalizedUnit,
      barcode: barcode || undefined,
      batchNumber,
      mfgDate: parsedMfg,
      expiryDate: parsedExpiry,
      purchasePrice,
      sellingPrice,
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

export async function executeCsvImport(
  parsedRows: CsvParsedRow[],
  updateExisting: boolean,
  responsibleUser: string
): Promise<CsvImportSummary> {
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

  const dbSkuToId = new Map<string, string>();
  const dbSupNameToId = new Map<string, string>();

  try {
    const [mRes, sRes] = await Promise.all([
      supabase.from('medicines').select('id, sku'),
      supabase.from('suppliers').select('id, name'),
    ]);
    if (Array.isArray(mRes.data)) {
      for (const dm of mRes.data) {
        if (dm.sku && dm.id) dbSkuToId.set(dm.sku.toUpperCase(), dm.id);
      }
    }
    if (Array.isArray(sRes.data)) {
      for (const ds of sRes.data) {
        if (ds.name && ds.id) dbSupNameToId.set(ds.name.toLowerCase().trim(), ds.id);
      }
    }
  } catch {}

  const newPurchases: PurchaseRecord[] = [];
  const newMovements: StockMovement[] = [];
  const dbMedsToUpsert: any[] = [];
  const dbBatchesToUpsert: any[] = [];
  const dbPurchasesToInsert: any[] = [];
  const dbMovementsToInsert: any[] = [];

  for (const row of parsedRows) {
    if (!row.isValid) {
      failedCount++;
      failureErrors.push(...row.errors);
      continue;
    }

    let supId: string | undefined = undefined;
    if (row.supplierName?.trim()) {
      const sName = row.supplierName.trim();
      const sKey = sName.toLowerCase();
      if (dbSupNameToId.has(sKey)) {
        supId = dbSupNameToId.get(sKey);
      } else {
        const localSup = currentSuppliers.find((s) => s.name.toLowerCase() === sKey);
        supId = localSup?.id && isValidUuid(localSup.id) ? localSup.id : generateSafeUuid();
        dbSupNameToId.set(sKey, supId);

        const newSup: Supplier = {
          id: supId,
          name: sName,
          phone: row.supplierPhone?.trim() || '+91 00000 00000',
          email: row.supplierPhone?.includes('@') ? row.supplierPhone.trim() : undefined,
          lastPurchaseDate: new Date().toISOString().split('T')[0],
          lastPurchasePrice: row.purchasePrice,
        };
        currentSuppliers.push(newSup);

        try {
          await supabase.from('suppliers').upsert({
            id: supId,
            name: newSup.name,
            phone: newSup.phone,
            email: newSup.email || null,
            last_purchase_date: newSup.lastPurchaseDate,
            last_purchase_price: newSup.lastPurchasePrice,
          });
        } catch {}
      }
    }

    const skuKey = row.sku.toUpperCase();
    const existingMed = medsMap.get(skuKey);
    let medId = dbSkuToId.get(skuKey);

    if (existingMed) {
      if (!updateExisting) {
        skippedCount++;
        continue;
      }

      if (!medId || !isValidUuid(medId)) {
        medId = isValidUuid(existingMed.id) ? existingMed.id : generateSafeUuid();
        dbSkuToId.set(skuKey, medId);
      }

      const existingBatches = [...existingMed.batches];
      const batchIdx = existingBatches.findIndex((b) => b.batchNumber.toLowerCase() === row.batchNumber.toLowerCase());

      const batchId = batchIdx >= 0 && isValidUuid(existingBatches[batchIdx].id)
        ? existingBatches[batchIdx].id
        : generateSafeUuid();

      const newBatch: MedicineBatch = {
        id: batchId,
        medicineId: medId,
        batchNumber: row.batchNumber,
        manufacturingDate: row.mfgDate,
        expiryDate: row.expiryDate,
        purchasePrice: row.purchasePrice,
        sellingPrice: row.sellingPrice,
        initialQuantity: row.quantity,
        availableQuantity: batchIdx >= 0 ? existingBatches[batchIdx].availableQuantity + row.quantity : row.quantity,
        supplierId: supId,
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
        id: medId,
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

      medsMap.set(skuKey, updatedMedicine);
      updatedCount++;

      const purId = generateSafeUuid();
      const invoiceNo = row.invoiceNumber || `CSV-IMP-${row.rowNumber}`;
      const purchaseRecord: PurchaseRecord = {
        id: purId,
        medicineId: medId,
        medicineName: `${row.brandName} (${row.genericName})`,
        supplierId: supId || '',
        supplierName: row.supplierName || 'Import Distributor',
        batchNumber: row.batchNumber,
        purchaseDate: new Date().toISOString().split('T')[0],
        quantityPurchased: row.quantity,
        purchasePrice: row.purchasePrice,
        totalPurchaseAmount: row.quantity * row.purchasePrice,
        invoiceNumber: invoiceNo,
        expiryDate: row.expiryDate,
      };
      newPurchases.push(purchaseRecord);

      const movId = generateSafeUuid();
      newMovements.push({
        id: movId,
        medicineId: medId,
        medicineName: row.brandName,
        batchId: batchId,
        batchNumber: row.batchNumber,
        movementType: 'Purchase',
        quantity: row.quantity,
        referenceNumber: invoiceNo,
        responsibleUser: responsibleUser || 'CSV Importer',
        date: new Date().toISOString(),
        notes: `CSV Master Data Import (Row ${row.rowNumber}) - Restock`,
      });

      dbBatchesToUpsert.push({
        id: batchId,
        medicine_id: medId,
        batch_number: row.batchNumber,
        manufacturing_date: row.mfgDate,
        expiry_date: row.expiryDate,
        purchase_price: row.purchasePrice,
        selling_price: row.sellingPrice,
        initial_quantity: newBatch.initialQuantity,
        available_quantity: newBatch.availableQuantity,
        supplier_id: supId || null,
        supplier_name: row.supplierName || null,
      });

      dbPurchasesToInsert.push({
        id: purId,
        medicine_id: medId,
        medicine_name: `${row.brandName} (${row.genericName})`,
        supplier_id: supId || null,
        supplier_name: row.supplierName || 'Import Distributor',
        batch_number: row.batchNumber,
        purchase_date: new Date().toISOString().split('T')[0],
        quantity_purchased: row.quantity,
        purchase_price: row.purchasePrice,
        total_purchase_amount: row.quantity * row.purchasePrice,
        invoice_number: invoiceNo,
      });

      dbMovementsToInsert.push({
        id: movId,
        medicine_id: medId,
        batch_id: batchId,
        movement_type: 'Purchase',
        quantity: row.quantity,
        reference_number: invoiceNo,
        responsibleUser: responsibleUser || 'CSV Importer',
        date: new Date().toISOString(),
        notes: `CSV Master Data Import (Row ${row.rowNumber}) - Restock`,
      });
    } else {
      if (!medId || !isValidUuid(medId)) {
        medId = generateSafeUuid();
        dbSkuToId.set(skuKey, medId);
      }

      const batchId = generateSafeUuid();
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
        supplierId: supId,
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

      medsMap.set(skuKey, newMed);
      importedCount++;

      const purId = generateSafeUuid();
      const invoiceNo = row.invoiceNumber || `CSV-IMP-${row.rowNumber}`;
      const purchaseRecord: PurchaseRecord = {
        id: purId,
        medicineId: medId,
        medicineName: `${row.brandName} (${row.genericName})`,
        supplierId: supId || '',
        supplierName: row.supplierName || 'Import Distributor',
        batchNumber: row.batchNumber,
        purchaseDate: new Date().toISOString().split('T')[0],
        quantityPurchased: row.quantity,
        purchasePrice: row.purchasePrice,
        totalPurchaseAmount: row.quantity * row.purchasePrice,
        invoiceNumber: invoiceNo,
        expiryDate: row.expiryDate,
      };
      newPurchases.push(purchaseRecord);

      const movId = generateSafeUuid();
      newMovements.push({
        id: movId,
        medicineId: medId,
        medicineName: row.brandName,
        batchId: batchId,
        batchNumber: row.batchNumber,
        movementType: 'Purchase',
        quantity: row.quantity,
        referenceNumber: invoiceNo,
        responsibleUser: responsibleUser || 'CSV Importer',
        date: new Date().toISOString(),
        notes: `CSV Master Data Import (Row ${row.rowNumber}) - New Master`,
      });

      dbBatchesToUpsert.push({
        id: batchId,
        medicine_id: medId,
        batch_number: row.batchNumber,
        manufacturing_date: row.mfgDate,
        expiry_date: row.expiryDate,
        purchase_price: row.purchasePrice,
        selling_price: row.sellingPrice,
        initial_quantity: newBatch.initialQuantity,
        available_quantity: newBatch.availableQuantity,
        supplier_id: supId || null,
        supplier_name: row.supplierName || null,
      });

      dbPurchasesToInsert.push({
        id: purId,
        medicine_id: medId,
        medicine_name: `${row.brandName} (${row.genericName})`,
        supplier_id: supId || null,
        supplier_name: row.supplierName || 'Import Distributor',
        batch_number: row.batchNumber,
        purchase_date: new Date().toISOString().split('T')[0],
        quantity_purchased: row.quantity,
        purchase_price: row.purchasePrice,
        total_purchase_amount: row.quantity * row.purchasePrice,
        invoice_number: invoiceNo,
      });

      dbMovementsToInsert.push({
        id: movId,
        medicine_id: medId,
        batch_id: batchId,
        movement_type: 'Purchase',
        quantity: row.quantity,
        reference_number: invoiceNo,
        responsible_user: responsibleUser || 'CSV Importer',
        date: new Date().toISOString(),
        notes: `CSV Master Data Import (Row ${row.rowNumber}) - New Master`,
      });
    }

    dbMedsToUpsert.push({
      id: medId,
      sku: row.sku,
      brand_name: row.brandName,
      generic_name: row.genericName,
      manufacturer: row.manufacturer,
      category: row.category,
      dosage_form: row.dosageForm,
      strength: row.strength,
      unit: row.unit,
      barcode: row.barcode || null,
      minimum_stock_level: row.minStockLevel,
      selling_price: row.sellingPrice,
      supplier_id: supId || null,
      updated_at: new Date().toISOString(),
    });
  }

  const finalMeds = Array.from(medsMap.values());
  saveStoredMedicines(finalMeds);
  saveStoredPurchases([...newPurchases, ...currentPurchases]);
  saveStoredMovements([...newMovements, ...currentMovements]);
  saveStoredSuppliers(currentSuppliers);

  try {
    if (dbMedsToUpsert.length > 0) {
      const { data: upsertedMeds } = await supabase
        .from('medicines')
        .upsert(dbMedsToUpsert, { onConflict: 'sku' })
        .select('id, sku');
      if (Array.isArray(upsertedMeds)) {
        for (const um of upsertedMeds) {
          if (um.sku && um.id) {
            dbSkuToId.set(um.sku.toUpperCase(), um.id);
          }
        }
      }
    }

    if (dbBatchesToUpsert.length > 0) {
      const alignedBatches = dbBatchesToUpsert.map((b) => {
        const med = finalMeds.find((m) => m.id === b.medicine_id);
        const realId = med?.sku ? dbSkuToId.get(med.sku.toUpperCase()) || b.medicine_id : b.medicine_id;
        return { ...b, medicine_id: realId };
      });
      await supabase
        .from('medicine_batches')
        .upsert(alignedBatches, { onConflict: 'medicine_id,batch_number' });
    }

    if (dbPurchasesToInsert.length > 0) {
      const alignedPurchases = dbPurchasesToInsert.map((p) => {
        const med = finalMeds.find((m) => m.id === p.medicine_id);
        const realId = med?.sku ? dbSkuToId.get(med.sku.toUpperCase()) || p.medicine_id : p.medicine_id;
        return { ...p, medicine_id: realId };
      });
      await supabase.from('purchase_records').insert(alignedPurchases);
    }

    if (dbMovementsToInsert.length > 0) {
      const alignedMovements = dbMovementsToInsert.map((mv) => {
        const med = finalMeds.find((m) => m.id === mv.medicine_id);
        const realId = med?.sku ? dbSkuToId.get(med.sku.toUpperCase()) || mv.medicine_id : mv.medicine_id;
        return { ...mv, medicine_id: realId };
      });
      await supabase.from('stock_movements').insert(alignedMovements);
    }

    await supabase.from('csv_import_logs').insert([
      {
        id: generateSafeUuid(),
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
