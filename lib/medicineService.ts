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

export function formatYmd(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseFlexibleDate(dateStr?: string | null, fallbackYears: number = 3): string {
  const getFallback = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + fallbackYears);
    return formatYmd(d);
  };

  if (!dateStr) return getFallback();
  const s = String(dateStr).trim().replace(/^["']|["']$/g, '');
  if (!s || /^(na|n\/a|nil|null|none|-|unknown|\/)$/i.test(s)) return getFallback();

  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = Number(ymdMatch[1]), m = Number(ymdMatch[2]), d = Number(ymdMatch[3]);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) return formatYmd(dt);
  }

  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    let partA = Number(dmyMatch[1]), partB = Number(dmyMatch[2]), y = Number(dmyMatch[3]);
    let d = partA, m = partB;
    if (partA > 12 && partB <= 12) { d = partA; m = partB; }
    else if (partB > 12 && partA <= 12) { m = partA; d = partB; }
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) return formatYmd(dt);
  }

  const mmyyMatch = s.match(/^(\d{1,2})[-/.](\d{2,4})$/);
  if (mmyyMatch) {
    const m = Number(mmyyMatch[1]);
    let y = Number(mmyyMatch[2]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12) {
      const dt = new Date(y, m, 0);
      return formatYmd(dt);
    }
  }

  const monthMap: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  const mmmMatch = s.match(/^([a-zA-Z]{3,9})[-/\s.]+(\d{2,4})$/i);
  if (mmmMatch) {
    const monKey = mmmMatch[1].slice(0, 3).toLowerCase();
    const m = monthMap[monKey];
    let y = Number(mmmMatch[2]);
    if (y < 100) y += 2000;
    if (m) {
      const dt = new Date(y, m, 0);
      return formatYmd(dt);
    }
  }

  if (/^\d{4}$/.test(s)) {
    return `${s}-12-31`;
  }

  const num = Number(s);
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const dt = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(dt.getTime())) return formatYmd(dt);
  }

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return formatYmd(dt);

  return getFallback();
}

export function normalizeRawCsvText(rawText: string): string {
  if (!rawText) return '';
  let cleanText = rawText.replace(/^\uFEFF/, '');
  const sample = cleanText.slice(0, 4000).split(/\r?\n/).filter((l) => l.trim().length > 0);
  const isWholeLineQuoted =
    sample.length > 0 &&
    sample.slice(0, 5).every((l) => {
      const t = l.trim();
      return t.startsWith('"') && t.endsWith('"') && (t.includes(',') || t.includes(';') || t.includes('\t'));
    });

  if (isWholeLineQuoted) {
    cleanText = cleanText.replace(/^"(.*)"$/gm, '$1').replace(/""/g, '"');
  }
  return cleanText;
}

export function countTrueCsvRows(text: string): number {
  if (!text) return 0;
  let count = 0;
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === '\n' && !inQuote) count++;
  }
  if (text.length > 0 && !text.endsWith('\n')) count++;
  return count;
}

export function parseCsvRow(rowStr: string, delimiter: string = ','): string[] {
  const cells: string[] = [];
  let inQ = false;
  let curr = '';
  for (let c = 0; c < rowStr.length; c++) {
    const ch = rowStr[c];
    if (ch === '"') {
      if (inQ && rowStr[c + 1] === '"') {
        curr += '"';
        c++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === delimiter && !inQ) {
      cells.push(curr.trim().replace(/^["']|["']$/g, ''));
      curr = '';
    } else {
      curr += ch;
    }
  }
  cells.push(curr.trim().replace(/^["']|["']$/g, ''));
  return cells;
}

export const CSV_BRAND_ALIASES = [
  'brand_name', 'brand', 'medicine_name', 'med_name', 'product_name', 'product',
  'item_name', 'item', 'name', 'drug_name', 'drug', 'commercial_name', 'trade_name',
  'formulation_name', 'sku_name', 'medicine', 'title', 'description', 'substance_name',
  'label', 'proprietary_name', 'medicine_brand', 'drug_title'
];

export const CSV_GENERIC_ALIASES = [
  'generic_name', 'generic', 'composition', 'salt', 'salt_composition', 'salts',
  'molecule', 'active_ingredient', 'active_substance', 'formula', 'chemical_name',
  'constituents', 'inn', 'non_proprietary_name', 'molecule_name', 'drug_composition',
  'active_molecule', 'active_salt'
];

export function detectCsvFileMetadata(text: string): {
  totalEstimatedRows: number;
  isLargeDataset: boolean;
  isWholeLineQuoted: boolean;
  sampleColumns: string[];
} {
  const clean = normalizeRawCsvText(text);
  const sampleLines = clean.slice(0, 4000).split(/\r?\n/).filter((l) => l.trim().length > 0);
  const totalTrueRows = countTrueCsvRows(clean);
  const firstRow = sampleLines.length > 0 ? sampleLines[0].split(',') : [];
  return {
    totalEstimatedRows: Math.max(1, totalTrueRows),
    isLargeDataset: totalTrueRows > 2000,
    isWholeLineQuoted: text.slice(0, 500).trim().startsWith('"'),
    sampleColumns: firstRow.map((c) => c.trim().replace(/^["']|["']$/g, '')),
  };
}

export function parseCsvTextToRows(text: string, maxRows?: number): string[][] {
  if (!text || !text.trim()) return [];

  const cleanText = normalizeRawCsvText(text);

  const firstChunk = cleanText.slice(0, 4000);
  let delimiter = ',';
  const commaCount = (firstChunk.match(/,/g) || []).length;
  const semiCount = (firstChunk.match(/;/g) || []).length;
  const tabCount = (firstChunk.match(/\t/g) || []).length;
  const pipeCount = (firstChunk.match(/\|/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (pipeCount > commaCount && pipeCount > semiCount) delimiter = '|';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell.trim().replace(/^["']|["']$/g, ''));
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim().replace(/^["']|["']$/g, ''));
      currentCell = '';
      if (currentRow.length > 0 && currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
        if (maxRows && rows.length >= maxRows + 1) {
          break;
        }
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim().replace(/^["']|["']$/g, ''));
    if (currentRow.length > 0 && currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
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

export async function fetchMedicinesMaster(
  onProgressChunk?: (loadedMeds: MedicineMaster[], totalCount: number) => void
): Promise<MedicineMaster[]> {
  try {
    const PAGE_SIZE = 1000;
    const { data: firstSlice, count, error: firstErr } = await supabase
      .from('medicines')
      .select('*, batches:medicine_batches(*)', { count: 'exact' })
      .order('brand_name', { ascending: true })
      .range(0, PAGE_SIZE - 1);

    if (!firstErr && Array.isArray(firstSlice)) {
      const suppliers = await fetchSuppliers();
      const mapRawDbMed = (m: any): MedicineMaster => {
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
      };

      const allMapped: MedicineMaster[] = firstSlice.map(mapRawDbMed);
      const total = count || allMapped.length;

      if (onProgressChunk) {
        onProgressChunk([...allMapped], total);
      }

      // If there are more rows beyond the 1,000 limit, slice them lazily
      if (total > PAGE_SIZE) {
        let from = PAGE_SIZE;
        while (from < total) {
          const to = Math.min(from + PAGE_SIZE - 1, total - 1);
          const { data: slice, error: sliceErr } = await supabase
            .from('medicines')
            .select('*, batches:medicine_batches(*)')
            .order('brand_name', { ascending: true })
            .range(from, to);

          if (sliceErr || !Array.isArray(slice)) break;
          const sliceMapped = slice.map(mapRawDbMed);
          allMapped.push(...sliceMapped);

          if (onProgressChunk) {
            onProgressChunk([...allMapped], total);
          }
          from += PAGE_SIZE;
        }
      }

      saveStoredMedicines(allMapped);
      return allMapped;
    }
  } catch (err) {
    console.error('fetchMedicinesMaster range load error:', err);
  }

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

export async function updateMedicineMaster(params: {
  id: string;
  brandName?: string;
  genericName?: string;
  manufacturer?: string;
  category?: string;
  dosageForm?: DosageForm;
  strength?: string;
  unit?: string;
  sellingPrice?: number;
  lastPurchasePrice?: number;
  minimumStockLevel?: number;
  barcode?: string;
}): Promise<MedicineMaster | null> {
  const currentMeds = loadStoredMedicines();
  const medIndex = currentMeds.findIndex(
    (m) => m.id === params.id || m.sku.toLowerCase() === params.id.toLowerCase()
  );
  if (medIndex === -1) return null;

  const existing = currentMeds[medIndex];
  const updated: MedicineMaster = {
    ...existing,
    brandName: params.brandName !== undefined ? params.brandName : existing.brandName,
    genericName: params.genericName !== undefined ? params.genericName : existing.genericName,
    manufacturer: params.manufacturer !== undefined ? params.manufacturer : existing.manufacturer,
    category: params.category !== undefined ? params.category : existing.category,
    dosageForm: params.dosageForm !== undefined ? params.dosageForm : existing.dosageForm,
    strength: params.strength !== undefined ? params.strength : existing.strength,
    unit: params.unit !== undefined ? params.unit : existing.unit,
    sellingPrice: params.sellingPrice !== undefined ? params.sellingPrice : existing.sellingPrice,
    lastPurchasePrice: params.lastPurchasePrice !== undefined ? params.lastPurchasePrice : existing.lastPurchasePrice,
    minimumStockLevel: params.minimumStockLevel !== undefined ? params.minimumStockLevel : existing.minimumStockLevel,
    barcode: params.barcode !== undefined ? params.barcode : existing.barcode,
    updatedAt: new Date().toISOString(),
  };

  updated.stockStatus = calculateStockStatus(updated.totalStock, updated.minimumStockLevel);

  currentMeds[medIndex] = updated;
  saveStoredMedicines(currentMeds);

  try {
    if (isValidUuid(existing.id)) {
      await supabase
        .from('medicines')
        .update({
          brand_name: updated.brandName,
          generic_name: updated.genericName,
          manufacturer: updated.manufacturer,
          category: updated.category,
          dosage_form: updated.dosageForm,
          strength: updated.strength,
          unit: updated.unit,
          selling_price: updated.sellingPrice,
          minimum_stock_level: updated.minimumStockLevel,
          barcode: updated.barcode || null,
          updated_at: updated.updatedAt,
        })
        .eq('id', existing.id);
    }
  } catch (err) {
    console.warn('Supabase update medicine notice:', err);
  }

  return updated;
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

export function findHeaderRowIndex(rows: any[][]): number {
  if (!rows || rows.length === 0) return 0;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const cleanCells = row.map((c) => String(c ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''));

    const hasNameKey = cleanCells.some((c) =>
      c.includes('brand') || c.includes('name') || c.includes('product') || c.includes('item') || c.includes('medicine') || c.includes('drug')
    );
    const hasAttrKey = cleanCells.some((c) =>
      c.includes('code') || c.includes('sku') || c.includes('mrp') || c.includes('price') || c.includes('ptr') || c.includes('composition') || c.includes('pack') || c.includes('salt') || c.includes('category') || c.includes('rate') || c.includes('strength')
    );

    if (hasNameKey && hasAttrKey) {
      return i;
    }
  }
  return 0;
}

export function parseAndValidateCsv(
  csvOrRows: string | any[][],
  existingMedicines: MedicineMaster[],
  maxRows: number = 5000
): {
  rows: CsvParsedRow[];
  summary: CsvImportSummary;
} {
  const rawRows: any[][] = typeof csvOrRows === 'string'
    ? parseCsvTextToRows(csvOrRows, maxRows)
    : (maxRows ? csvOrRows.slice(0, maxRows + 15) : csvOrRows);

  if (rawRows.length < 2) {
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
        errors: [{ row: 0, field: 'file', value: '', reason: 'CSV/Excel file is empty or missing data rows' }],
      },
    };
  }

  const headerIndex = findHeaderRowIndex(rawRows);
  const rawHeaders = rawRows[headerIndex] || [];
  const headerIndices: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    const clean = String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean) headerIndices[clean] = idx;
  });

  const getCol = (cells: any[], ...aliases: string[]): string => {
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headerIndices[cleanAlias];
      if (idx !== undefined && idx < cells.length) {
        const val = String(cells[idx] ?? '').trim().replace(/^["']|["']$/g, '');
        if (val) return val;
      }
    }
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [hdr, idx] of Object.entries(headerIndices)) {
        if ((hdr.includes(cleanAlias) || cleanAlias.includes(hdr)) && idx < cells.length) {
          const val = String(cells[idx] ?? '').trim().replace(/^["']|["']$/g, '');
          if (val) return val;
        }
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

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const rowNum = i - headerIndex;
    const cells = rawRows[i];
    if (!cells || cells.length === 0 || cells.every((c) => c === '' || c === null || c === undefined)) continue;

    const isDiscontinued = getCol(cells, 'is_discontinued', 'discontinued', 'isdiscontinued').toLowerCase();
    if (isDiscontinued === 'true' || isDiscontinued === 'yes' || isDiscontinued === '1') {
      continue;
    }

    const rowErrors: CsvValidationError[] = [];

    let brandName = getCol(
      cells,
      'brand_name', 'brand', 'medicine_name', 'med_name', 'product_name', 'product',
      'item_name', 'item', 'name', 'drug_name', 'drug', 'commercial_name', 'trade_name',
      'formulation_name', 'sku_name', 'medicine', 'title', 'description', 'substance_name',
      'label', 'proprietary_name', 'medicine_brand', 'drug_title'
    );
    let genericName = getCol(
      cells,
      'generic_name', 'generic', 'composition', 'salt', 'salt_composition', 'salts',
      'molecule', 'active_ingredient', 'active_substance', 'formula', 'chemical_name',
      'constituents', 'inn', 'non_proprietary_name', 'molecule_name', 'drug_composition',
      'active_molecule', 'active_salt'
    );

    const comp1 = getCol(cells, 'short_composition1', 'shortcomposition1', 'composition1', 'salt1');
    const comp2 = getCol(cells, 'short_composition2', 'shortcomposition2', 'composition2', 'salt2');
    if (!genericName && (comp1 || comp2)) {
      genericName = [comp1, comp2].filter(Boolean).join(' + ');
    }

    if (!brandName && genericName) brandName = genericName;
    if (!genericName && brandName) genericName = brandName;

    if (genericName) {
      genericName = genericName.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (!brandName) {
      for (const cell of cells) {
        const trimmed = String(cell ?? '').trim().replace(/^["']|["']$/g, '');
        if (trimmed.length >= 3 && !/^\d+(\.\d+)?$/.test(trimmed)) {
          brandName = trimmed;
          if (!genericName) genericName = trimmed;
          break;
        }
      }
    }

    if (!brandName) {
      rowErrors.push({ row: rowNum, field: 'brand_name', value: '', reason: 'Medicine Name or Generic Composition is required' });
    }

    let sku = getCol(
      cells,
      'sku', 'medicine_sku', 'medicine_code', 'medicine_id', 'code',
      'item_code', 'product_code', 'drug_code', 'hsn_code', 'hsn', 'item_no'
    ).toUpperCase();

    const rawId = getCol(cells, 'id', 'item_id');
    if (!sku && rawId) {
      const cleanName = (brandName || 'MED').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
      sku = `MED-${cleanName}-${rawId}`;
    } else if (!sku) {
      const cleanName = (brandName || 'MED').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      sku = `MED-${cleanName}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }

    if (seenSkusInFile.has(sku)) {
      let suffix = 2;
      let disambiguated = `${sku}-B${suffix}`;
      while (seenSkusInFile.has(disambiguated)) {
        suffix++;
        disambiguated = `${sku}-B${suffix}`;
      }
      sku = disambiguated;
      seenSkusInFile.add(sku);
    } else {
      seenSkusInFile.add(sku);
    }

    const manufacturer = getCol(
      cells,
      'marketing_division', 'manufacturer', 'mfg', 'company', 'brand_owner', 'maker', 'pharma', 'lab',
      'marketer', 'marketed_by', 'manufacturer_name', 'mfg_by', 'mkt_by', 'producer', 'distributor'
    ) || 'Standard Healthcare';

    let category = getCol(
      cells,
      'category', 'cat', 'therapeutic_class', 'group', 'classification', 'department',
      'indication', 'drug_class', 'action_class', 'sub_category', 'therapeutic_group', 'use', 'uses'
    );

    if (!category || category === 'General Medicine') {
      const compLower = `${genericName} ${brandName}`.toLowerCase();
      if (compLower.match(/amox|azith|clav|cefix|cipro|cef|doxy|penicillin|antibiotic/)) {
        category = 'Antibiotics';
      } else if (compLower.match(/paracetamol|pcm|ibuprofen|diclofenac|aceclo|tramadol|analgesic/)) {
        category = 'Analgesics & Antipyretics';
      } else if (compLower.match(/ambroxol|fexo|montelukast|cetirizine|pheniramine|cough|cold|levosalbutamol/)) {
        category = 'Respiratory & Anti-Allergic';
      } else if (compLower.match(/panto|rabe|omep|ranitidine|antacid|domperidone|sucralfate/)) {
        category = 'Gastrointestinal';
      } else if (compLower.match(/metformin|glimepiride|vilda|insulin|diabet/)) {
        category = 'Endocrine & Diabetes';
      } else if (compLower.match(/atorvastatin|telmisartan|amlodipine|losartan|cardio|blood pressure/)) {
        category = 'Cardiovascular';
      } else {
        category = 'General Medicine';
      }
    }

    const packLabel = getCol(cells, 'pack_size_label', 'packsize', 'pack_size', 'package_size', 'pack');
    let rawDosage = getCol(cells, 'dosage_form', 'form', 'dosage_type', 'presentation', 'pack_form', 'dose_form', 'route');
    let strength = getCol(cells, 'strength', 'dosage', 'potency', 'power', 'concentration', 'dose', 'mg');
    let unit = getCol(cells, 'unit', 'unit_of_measure', 'uom', 'pack_unit', 'packaging', 'package', 'packing', 'size');

    if (packLabel) {
      const pl = packLabel.toLowerCase();
      if (!unit || unit.toLowerCase() === 'units') {
        if (pl.includes('strip')) unit = 'Strips';
        else if (pl.includes('bottle')) unit = 'Bottles';
        else if (pl.includes('vial')) unit = 'Vials';
        else if (pl.includes('amp')) unit = 'Ampoules';
        else if (pl.includes('tube')) unit = 'Tubes';
        else if (pl.includes('sachet') || pl.includes('packet')) unit = 'Sachets';
      }
      if (!rawDosage || rawDosage.toLowerCase() === 'allopathy') {
        if (pl.includes('tablet')) rawDosage = 'Tablet';
        else if (pl.includes('capsule')) rawDosage = 'Capsule';
        else if (pl.includes('syrup') || pl.includes('suspension')) rawDosage = 'Syrup';
        else if (pl.includes('injection')) rawDosage = 'Injection';
        else if (pl.includes('drop')) rawDosage = 'Drops';
        else if (pl.includes('powder')) rawDosage = 'Powder';
      }
    }
    let barcode: string | undefined = getCol(cells, 'barcode', 'ean', 'upc', 'gtin', 'qr', 'code128', 'barcode_no') || undefined;

    let batchNumber = getCol(cells, 'batch_number', 'batch', 'batch_no', 'lot_number', 'lot_no', 'lot', 'b_no', 'batch_id');
    if (!batchNumber) {
      batchNumber = `BTH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    const rawMfgDate = getCol(cells, 'mfg_date', 'manufacturing_date', 'mfg', 'mfg_dt', 'production_date', 'p_date', 'mfd');
    const rawExpiryDate = getCol(cells, 'expiry_date', 'exp_date', 'expiry', 'exp', 'expiration_date', 'exp_dt', 'valid_till', 'best_before', 'shelf_life');
    const rawPurchasePrice = getCol(cells, 'purchase_price', 'buy_price', 'cost_price', 'cost', 'purchase_rate', 'rate', 'ptr', 'cost_per_unit', 'net_rate');
    const rawSellingPrice = getCol(cells, 'selling_price', 'sell_price', 'sale_price', 'retail_price', 'price', 'pts', 'unit_price');
    const rawMrp = getCol(cells, 'mrp', 'max_retail_price', 'selling_price', 'sell_price', 'retail_price');
    const rawQty = getCol(cells, 'quantity', 'qty', 'stock', 'initial_quantity', 'units', 'count', 'total_qty', 'stock_qty', 'available_qty');
    const rawMinStock = getCol(cells, 'min_stock_level', 'reorder_level', 'reorder_qty', 'reorder', 'min_stock', 'minimum_stock', 'threshold', 'alert_level');
    const supplierName = getCol(cells, 'supplier_name', 'supplier', 'vendor_name', 'vendor', 'distributor_name', 'distributor', 'wholesaler', 'party_name');
    const supplierPhone = getCol(cells, 'supplier_phone', 'supplier_contact', 'contact', 'phone', 'phone_number', 'mobile', 'email', 'supplier_email');
    const invoiceNumber = getCol(cells, 'invoice_number', 'invoice', 'bill_number', 'bill_no', 'inv_no', 'reference_no', 'ref_no');

    if (barcode) {
      if (seenBarcodesInFile.has(barcode)) {
        barcode = undefined;
      } else {
        seenBarcodesInFile.add(barcode);
      }
    }

    const parsedExpiry = parseFlexibleDate(rawExpiryDate, 3);

    let parsedMfg = parseFlexibleDate(rawMfgDate, 1);
    if (!rawMfgDate) {
      const expDt = new Date(parsedExpiry);
      expDt.setFullYear(expDt.getFullYear() - 1);
      parsedMfg = formatYmd(expDt);
    }

    if (parsedMfg && parsedExpiry && new Date(parsedExpiry) <= new Date(parsedMfg)) {
      const expDt = new Date(parsedExpiry);
      expDt.setFullYear(expDt.getFullYear() - 1);
      parsedMfg = formatYmd(expDt);
    }

    const purchasePrice = parseCleanNumber(rawPurchasePrice, 0);
    const mrp = parseCleanNumber(rawMrp, 0);
    let sellingPrice = parseCleanNumber(rawSellingPrice, 0);
    if (sellingPrice <= 0 && mrp > 0) {
      sellingPrice = mrp;
    }
    if (sellingPrice < 0) {
      sellingPrice = 0;
    }

    let quantity = rawQty ? parseCleanNumber(rawQty, 0) : 0;
    if (isNaN(quantity) || quantity < 0) quantity = 0;

    const minStockLevel = parseInt(rawMinStock || '20', 10);

    const isExisting = existingSkuMap.has(sku);
    const isBarcodeConflict = barcode && existingBarcodeMap.has(barcode) && existingBarcodeMap.get(barcode)?.sku !== sku;
    if (isBarcodeConflict) {
      barcode = undefined;
    }

    const validDosageForms: DosageForm[] = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Suspension', 'Powder', 'Other'];
    let matchedDosage = validDosageForms.find((f) => f.toLowerCase() === (rawDosage || '').toLowerCase());
    if (!matchedDosage) {
      const combined = `${rawDosage || ''} ${unit || ''} ${brandName || ''} ${genericName || ''}`.toLowerCase();
      if (combined.includes('cap')) matchedDosage = 'Capsule';
      else if (combined.includes('syr') || combined.includes('liq') || combined.includes('sol') || combined.includes('syrup')) matchedDosage = 'Syrup';
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

  const totalAvailableRows = Array.isArray(csvOrRows)
    ? Math.max(parsedRows.length, csvOrRows.length - (headerIndex + 1))
    : parsedRows.length;

  return {
    rows: parsedRows,
    summary: {
      totalRows: totalAvailableRows,
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
  responsibleUser: string,
  onProgress?: (processed: number, total: number) => void
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

  for (let rIdx = 0; rIdx < parsedRows.length; rIdx++) {
    const row = parsedRows[rIdx];
    if (onProgress && (rIdx % 100 === 0 || rIdx === parsedRows.length - 1)) {
      onProgress(rIdx + 1, parsedRows.length);
    }
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
        sellingPrice: row.sellingPrice > 0 ? row.sellingPrice : (existingMed.sellingPrice || 0),
        lastPurchasePrice: row.purchasePrice > 0 ? row.purchasePrice : existingMed.lastPurchasePrice,
        lastPurchaseDate: new Date().toISOString().split('T')[0],
        batches: existingBatches,
        totalStock,
        stockStatus: calculateStockStatus(totalStock, row.minStockLevel),
        expiryStatus: calculateExpiryStatus(existingBatches),
      };

      medsMap.set(skuKey, updatedMedicine);
      updatedCount++;

      if (row.quantity > 0) {
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
          notes: `CSV Master Data Import (Row ${row.rowNumber}) - Restock`,
        });
      }

      dbBatchesToUpsert.push({
        id: batchId,
        medicine_id: medId,
        batch_number: row.batchNumber,
        manufacturing_date: row.mfgDate,
        expiry_date: row.expiryDate,
        purchase_price: row.purchasePrice > 0 ? row.purchasePrice : null,
        selling_price: row.sellingPrice > 0 ? row.sellingPrice : null,
        initial_quantity: newBatch.initialQuantity,
        available_quantity: newBatch.availableQuantity,
        supplier_id: supId || null,
        supplier_name: row.supplierName || null,
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

      if (row.quantity > 0) {
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

      dbBatchesToUpsert.push({
        id: batchId,
        medicine_id: medId,
        batch_number: row.batchNumber,
        manufacturing_date: row.mfgDate,
        expiry_date: row.expiryDate,
        purchase_price: row.purchasePrice > 0 ? row.purchasePrice : null,
        selling_price: row.sellingPrice > 0 ? row.sellingPrice : null,
        initial_quantity: newBatch.initialQuantity,
        available_quantity: newBatch.availableQuantity,
        supplier_id: supId || null,
        supplier_name: row.supplierName || null,
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
      selling_price: row.sellingPrice > 0 ? row.sellingPrice : null,
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
    const CHUNK_SIZE = 100;
    if (dbMedsToUpsert.length > 0) {
      for (let i = 0; i < dbMedsToUpsert.length; i += CHUNK_SIZE) {
        const rawChunk = dbMedsToUpsert.slice(i, i + CHUNK_SIZE);
        // Deduplicate chunk by SKU and omit client-generated id to prevent FK constraint violations
        const chunkMap = new Map<string, any>();
        for (const item of rawChunk) {
          const { id, ...medWithoutId } = item;
          chunkMap.set(item.sku.toUpperCase(), medWithoutId);
        }
        const chunk = Array.from(chunkMap.values());

        const { data: upsertedMeds, error: medError } = await supabase
          .from('medicines')
          .upsert(chunk, { onConflict: 'sku' })
          .select('id, sku');

        if (medError) {
          console.error('executeCsvImport: medicines upsert error:', medError);
          failedCount += chunk.length;
          failureErrors.push({
            row: i + 1,
            field: 'database',
            value: '',
            reason: medError.message || 'Database error during medicines upsert',
          });
        } else if (Array.isArray(upsertedMeds)) {
          for (const um of upsertedMeds) {
            if (um.sku && um.id) {
              dbSkuToId.set(um.sku.toUpperCase(), um.id);
            }
          }
        }
      }
    }

    if (dbBatchesToUpsert.length > 0) {
      const alignedBatches = dbBatchesToUpsert.map((b) => {
        const med = finalMeds.find((m) => m.id === b.medicine_id);
        const skuKey = med?.sku?.toUpperCase();
        const realId = (skuKey && dbSkuToId.get(skuKey)) || b.medicine_id;
        return { ...b, medicine_id: realId };
      });

      // Deduplicate batches by medicine_id + batch_number
      const batchMap = new Map<string, any>();
      for (const b of alignedBatches) {
        batchMap.set(`${b.medicine_id}::${b.batch_number}`, b);
      }
      const uniqueBatches = Array.from(batchMap.values());

      for (let i = 0; i < uniqueBatches.length; i += CHUNK_SIZE) {
        const chunk = uniqueBatches.slice(i, i + CHUNK_SIZE);
        const { error: batchErr } = await supabase
          .from('medicine_batches')
          .upsert(chunk, { onConflict: 'medicine_id,batch_number' });
        if (batchErr) {
          console.warn('executeCsvImport: medicine_batches notice:', batchErr);
        }
      }
    }

    if (dbPurchasesToInsert.length > 0) {
      const alignedPurchases = dbPurchasesToInsert.map((p) => {
        const med = finalMeds.find((m) => m.id === p.medicine_id);
        const skuKey = med?.sku?.toUpperCase();
        const realId = (skuKey && dbSkuToId.get(skuKey)) || p.medicine_id;
        return { ...p, medicine_id: realId };
      });
      for (let i = 0; i < alignedPurchases.length; i += CHUNK_SIZE) {
        const chunk = alignedPurchases.slice(i, i + CHUNK_SIZE);
        const { error: purErr } = await supabase.from('purchase_records').insert(chunk);
        if (purErr) {
          console.warn('executeCsvImport: purchase_records notice:', purErr);
        }
      }
    }

    if (dbMovementsToInsert.length > 0) {
      const alignedMovements = dbMovementsToInsert.map((mv) => {
        const med = finalMeds.find((m) => m.id === mv.medicine_id);
        const skuKey = med?.sku?.toUpperCase();
        const realId = (skuKey && dbSkuToId.get(skuKey)) || mv.medicine_id;
        return { ...mv, medicine_id: realId };
      });
      for (let i = 0; i < alignedMovements.length; i += CHUNK_SIZE) {
        const chunk = alignedMovements.slice(i, i + CHUNK_SIZE);
        const { error: movErr } = await supabase.from('stock_movements').insert(chunk);
        if (movErr) {
          console.warn('executeCsvImport: stock_movements notice:', movErr);
        }
      }
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
  } catch (err) {
    console.error('executeCsvImport outer error:', err);
  }

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

export interface StreamImportProgress {
  processed: number;
  total: number;
  percent: number;
  currentBatch: number;
  totalBatches: number;
  speedMedsPerSec: number;
  etaSeconds: number;
  currentMedicineName?: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';
  errorMessage?: string;
}

export interface StreamImportResult {
  totalProcessed: number;
  totalImported: number;
  totalSkipped: number;
  failedCount?: number;
  errors?: string[];
  durationMs: number;
  speedMedsPerSec: number;
}

export async function streamAndIngestCsvToSupabase(
  input: string | any[][],
  options: {
    updateExisting?: boolean;
    batchSize?: number;
    responsibleUser?: string;
    onProgress?: (progress: StreamImportProgress) => void;
    controlSignal?: { aborted: boolean; paused: boolean };
  } = {}
): Promise<StreamImportResult> {
  const {
    updateExisting = true,
    batchSize = 500,
    responsibleUser = 'Dr. Sunny',
    onProgress,
    controlSignal,
  } = options;

  const startTime = Date.now();
  let processedCount = 0;
  let importedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const batchErrors: string[] = [];

  // Branch A: Structured 2D Array (from Excel or in-memory grid)
  if (Array.isArray(input)) {
    const rawMatrix = input;
    if (rawMatrix.length < 2) {
      return { totalProcessed: 0, totalImported: 0, totalSkipped: 0, failedCount: 0, errors: [], durationMs: 0, speedMedsPerSec: 0 };
    }
    const hIdx = findHeaderRowIndex(rawMatrix);
    const rawHeaders = rawMatrix[hIdx] || [];
    const headers = rawHeaders.map((h) => String(h ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

    const getIndex = (...aliases: string[]): number => {
      for (const a of aliases) {
        const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, '');
        const idx = headers.findIndex((h) => h === cleanA || h.includes(cleanA));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const idIdx = getIndex('id', 'medid', 'code');
    const nameIdx = getIndex(...CSV_BRAND_ALIASES);
    const priceIdx = getIndex('mrp', 'price', 'priceinr', 'sellingprice', 'rate', 'unitprice', 'pts');
    const discIdx = getIndex('is_discontinued', 'discontinued', 'isdiscontinued');
    const mfgIdx = getIndex('marketingdivision', 'manufacturername', 'manufacturer', 'company', 'mfg');
    const typeIdx = getIndex('type', 'category');
    const packIdx = getIndex('packing', 'packsizelabel', 'packsize', 'package');
    const comp1Idx = getIndex(...CSV_GENERIC_ALIASES, 'short_composition1', 'shortcomposition1', 'composition1', 'salt1');
    const comp2Idx = getIndex('short_composition2', 'shortcomposition2', 'composition2', 'salt2');
    const skuIdx = getIndex('productcode', 'itemcode', 'sku', 'code');
    const dosageIdx = getIndex('dosageform', 'form', 'dosagetype');
    const strengthIdx = getIndex('strength', 'dosage', 'potency');
    const unitIdx = getIndex('unit', 'uom', 'packunit');
    const batchIdx = getIndex('batchnumber', 'batchno', 'batch', 'lotnumber', 'lot');
    const expIdx = getIndex('shelflife', 'expirydate', 'expdate', 'expiry', 'exp');
    const mfgDateIdx = getIndex('manufacturingdate', 'mfgdate', 'mfd');
    const qtyIdx = getIndex('quantity', 'qty', 'stock', 'initialquantity');
    const costIdx = getIndex('netptr', 'ptr', 'purchaseprice', 'buyprice', 'costprice', 'cost');
    const suppIdx = getIndex('suppliername', 'supplier', 'vendor', 'distributor');

    if (nameIdx === -1 && comp1Idx === -1) {
      batchErrors.push('Could not detect Medicine Name or Composition column in Excel headers.');
    }

    const dataRows = rawMatrix.slice(hIdx + 1);
    const totalDataRows = dataRows.length;
    const totalBatches = Math.ceil(totalDataRows / batchSize);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      if (controlSignal?.aborted) break;
      while (controlSignal?.paused) {
        if (controlSignal.aborted) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const chunkStart = batchIdx * batchSize;
      const chunkEnd = Math.min((batchIdx + 1) * batchSize, totalDataRows);
      const batchMedsMap = new Map<string, any>();
      const batchBatchesMap = new Map<string, any>();
      let lastBrandName = '';

      for (let r = chunkStart; r < chunkEnd; r++) {
        const cells = dataRows[r];
        if (!cells || cells.length === 0 || cells.every((c) => c === '' || c === null || c === undefined)) {
          skippedCount++;
          processedCount++;
          continue;
        }

        const rawDisc = discIdx !== -1 ? String(cells[discIdx] ?? '').trim().toLowerCase() : '';
        const isDisc = rawDisc === 'true' || rawDisc === 'yes' || rawDisc === '1';
        if (isDisc) {
          skippedCount++;
          processedCount++;
          continue;
        }

        let brand = nameIdx !== -1 ? String(cells[nameIdx] ?? '').trim() : '';
        const comp1 = comp1Idx !== -1 ? String(cells[comp1Idx] ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
        const comp2 = comp2Idx !== -1 ? String(cells[comp2Idx] ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
        let combinedGeneric = [comp1, comp2].filter(Boolean).join(' + ');

        if (!brand && combinedGeneric) brand = combinedGeneric;
        if (!combinedGeneric && brand) combinedGeneric = brand;

        if (!brand) {
          for (const cell of cells) {
            const trimmed = String(cell ?? '').trim().replace(/^["']|["']$/g, '');
            if (trimmed.length >= 3 && !/^\d+(\.\d+)?$/.test(trimmed)) {
              brand = trimmed;
              if (!combinedGeneric) combinedGeneric = trimmed;
              break;
            }
          }
        }

        if (!brand) {
          skippedCount++;
          processedCount++;
          continue;
        }
        lastBrandName = brand;

        const manufacturer = (mfgIdx !== -1 && cells[mfgIdx] ? String(cells[mfgIdx]).trim() : '') || 'Standard Healthcare';
        const packLabel = packIdx !== -1 ? String(cells[packIdx] ?? '').trim() : '';

        let dosageForm = dosageIdx !== -1 && cells[dosageIdx] ? String(cells[dosageIdx]).trim() : 'Tablet';
        let unit = unitIdx !== -1 && cells[unitIdx] ? String(cells[unitIdx]).trim() : 'Strips';
        const plLower = packLabel.toLowerCase();
        if (plLower.includes('tablet') || plLower.includes('tab')) {
          dosageForm = 'Tablet';
          unit = 'Strips';
        } else if (plLower.includes('capsule') || plLower.includes('cap')) {
          dosageForm = 'Capsule';
          unit = 'Strips';
        } else if (plLower.includes('syrup') || plLower.includes('suspension') || plLower.includes('liquid') || plLower.includes('bottle')) {
          dosageForm = 'Syrup';
          unit = 'Bottles';
        } else if (plLower.includes('injection') || plLower.includes('ampoule') || plLower.includes('vial')) {
          dosageForm = 'Injection';
          unit = 'Ampoules';
        } else if (plLower.includes('ointment') || plLower.includes('cream') || plLower.includes('gel') || plLower.includes('tube')) {
          dosageForm = 'Ointment';
          unit = 'Tubes';
        } else if (plLower.includes('drop')) {
          dosageForm = 'Drops';
          unit = 'Vials';
        }

        const rawPrice = priceIdx !== -1 ? cells[priceIdx] : '';
        const numPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || '').replace(/[^0-9.]/g, ''));
        const sellingPrice = isNaN(numPrice) ? 0 : numPrice;

        const explicitSku = skuIdx !== -1 ? String(cells[skuIdx] ?? '').trim() : '';
        const rowId = idIdx !== -1 ? String(cells[idIdx] ?? '').trim() : '';
        const cleanSlug = (brand.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)) || 'MED';
        const sku = (explicitSku ? (explicitSku.startsWith('MED-') ? explicitSku : `MED-${explicitSku}`) : (rowId ? `MED-${cleanSlug}-${rowId}` : `MED-${cleanSlug}-${r + 1}`)).toUpperCase();

        const batchNum = (batchIdx !== -1 && cells[batchIdx]) ? String(cells[batchIdx]).trim() : `BCH-${new Date().getFullYear()}-${(r + 1).toString().slice(-4)}`;
        const expiryDate = (expIdx !== -1 && cells[expIdx]) ? parseFlexibleDate(String(cells[expIdx]), 3) : `${new Date().getFullYear() + 2}-12-31`;
        const mfgDate = (mfgDateIdx !== -1 && cells[mfgDateIdx]) ? parseFlexibleDate(String(cells[mfgDateIdx]), 1) : formatYmd(new Date());
        const rawQty = qtyIdx !== -1 ? cells[qtyIdx] : '';
        const parsedQty = typeof rawQty === 'number' ? Math.max(0, rawQty) : Math.max(0, parseInt(String(rawQty || '').replace(/[^0-9]/g, ''), 10) || 0);
        const rawCost = costIdx !== -1 ? cells[costIdx] : '';
        const costNum = typeof rawCost === 'number' ? rawCost : parseFloat(String(rawCost || '').replace(/[^0-9.]/g, ''));
        const purchasePrice = !isNaN(costNum) && costNum > 0 ? costNum : (sellingPrice > 0 ? Math.round(sellingPrice * 0.7 * 100) / 100 : 0);
        const supplierName = (suppIdx !== -1 && cells[suppIdx]) ? String(cells[suppIdx]).trim() : null;

        batchMedsMap.set(sku, {
          sku,
          brand_name: brand,
          generic_name: combinedGeneric,
          manufacturer,
          category: typeIdx !== -1 && cells[typeIdx] ? String(cells[typeIdx]).trim() : 'Allopathy',
          dosage_form: dosageForm,
          strength: strengthIdx !== -1 && cells[strengthIdx] ? String(cells[strengthIdx]).trim() : 'Standard',
          unit,
          selling_price: sellingPrice > 0 ? sellingPrice : null,
          minimum_stock_level: 20,
          updated_at: new Date().toISOString(),
        });

        if (sellingPrice > 0 || parsedQty > 0) {
          batchBatchesMap.set(sku, {
            batch_number: batchNum,
            manufacturing_date: mfgDate,
            expiry_date: expiryDate,
            purchase_price: purchasePrice > 0 ? purchasePrice : null,
            selling_price: sellingPrice > 0 ? sellingPrice : null,
            initial_quantity: parsedQty,
            available_quantity: parsedQty,
            supplier_name: supplierName,
          });
        }

        processedCount++;
      }

      const dbBatchMeds = Array.from(batchMedsMap.values());
      if (dbBatchMeds.length > 0) {
        try {
          const { data: upsertedMeds, error: medErr } = await supabase
            .from('medicines')
            .upsert(dbBatchMeds, { onConflict: 'sku' })
            .select('id, sku');

          if (medErr) {
            console.error('Batch medicines upsert failed:', medErr);
            failedCount += dbBatchMeds.length;
            if (batchErrors.length < 5) batchErrors.push(medErr.message);
          } else {
            const actualCount = upsertedMeds?.length || dbBatchMeds.length;
            importedCount += actualCount;

            if (upsertedMeds && upsertedMeds.length > 0 && batchBatchesMap.size > 0) {
              const skuToId = new Map(upsertedMeds.map((m: any) => [m.sku.toUpperCase(), m.id]));
              const dbBatchBatches: any[] = [];
              for (const [bSku, bData] of batchBatchesMap.entries()) {
                const medId = skuToId.get(bSku.toUpperCase());
                if (medId) {
                  dbBatchBatches.push({ ...bData, medicine_id: medId });
                }
              }

              if (dbBatchBatches.length > 0) {
                const { error: batchErr } = await supabase
                  .from('medicine_batches')
                  .upsert(dbBatchBatches, { onConflict: 'medicine_id,batch_number' });
                if (batchErr) {
                  console.warn('Batch inventory upsert notice:', batchErr);
                }
              }
            }
          }
        } catch (err: any) {
          console.error('Batch upsert exception:', err);
          failedCount += dbBatchMeds.length;
          if (batchErrors.length < 5) batchErrors.push(err?.message || 'Database error');
        }
      }

      const elapsedSec = (Date.now() - startTime) / 1000;
      const speed = Math.round(processedCount / Math.max(0.1, elapsedSec));
      const remaining = Math.max(0, totalDataRows - processedCount);
      const etaSeconds = speed > 0 ? Math.round(remaining / speed) : 0;
      const percent = Math.min(100, Math.round((processedCount / totalDataRows) * 100));

      if (onProgress) {
        onProgress({
          processed: processedCount,
          total: totalDataRows,
          percent,
          currentBatch: batchIdx + 1,
          totalBatches,
          speedMedsPerSec: speed,
          etaSeconds,
          currentMedicineName: lastBrandName,
          status: batchIdx === totalBatches - 1 ? 'completed' : 'running',
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const durationMs = Date.now() - startTime;
    return {
      totalProcessed: processedCount,
      totalImported: importedCount,
      totalSkipped: skippedCount,
      failedCount,
      errors: batchErrors,
      durationMs,
      speedMedsPerSec: Math.round(processedCount / Math.max(0.1, durationMs / 1000)),
    };
  }

  // Branch B: Raw CSV Text
  const rawText = input;
  const cleanText = normalizeRawCsvText(rawText);

  const firstChunk = cleanText.slice(0, 4000);
  let delimiter = ',';
  const commaCount = (firstChunk.match(/,/g) || []).length;
  const semiCount = (firstChunk.match(/;/g) || []).length;
  const tabCount = (firstChunk.match(/\t/g) || []).length;
  const pipeCount = (firstChunk.match(/\|/g) || []).length;
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (pipeCount > commaCount && pipeCount > semiCount) delimiter = '|';

  const rowEnds: number[] = [];
  let inQuote = false;
  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === '\n' && !inQuote) {
      rowEnds.push(i);
    }
  }
  if (cleanText.length > 0 && (rowEnds.length === 0 || rowEnds[rowEnds.length - 1] < cleanText.length - 1)) {
    rowEnds.push(cleanText.length);
  }

  const totalLines = rowEnds.length;
  if (totalLines <= 1) {
    return { totalProcessed: 0, totalImported: 0, totalSkipped: 0, failedCount: 0, errors: [], durationMs: 0, speedMedsPerSec: 0 };
  }

  const sampleRows: string[][] = [];
  for (let i = 0; i < Math.min(15, rowEnds.length); i++) {
    const lStart = i === 0 ? 0 : rowEnds[i - 1] + 1;
    const lEnd = rowEnds[i];
    const lRaw = cleanText.slice(lStart, lEnd).replace(/\r$/, '');
    sampleRows.push(parseCsvRow(lRaw, delimiter));
  }
  const hIdx = findHeaderRowIndex(sampleRows);
  const rawHeaders = sampleRows[hIdx] || [];
  const headers = rawHeaders.map((h) => String(h ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const getIndex = (...aliases: string[]): number => {
    for (const a of aliases) {
      const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headers.findIndex((h) => h === cleanA || h.includes(cleanA));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idIdx = getIndex('id', 'medid', 'code');
  const nameIdx = getIndex(...CSV_BRAND_ALIASES);
  const priceIdx = getIndex('mrp', 'price', 'priceinr', 'sellingprice', 'rate', 'unitprice', 'pts');
  const discIdx = getIndex('is_discontinued', 'discontinued', 'isdiscontinued');
  const mfgIdx = getIndex('marketingdivision', 'manufacturername', 'manufacturer', 'company', 'mfg');
  const typeIdx = getIndex('type', 'category');
  const packIdx = getIndex('packing', 'packsizelabel', 'packsize', 'package');
  const comp1Idx = getIndex(...CSV_GENERIC_ALIASES, 'short_composition1', 'shortcomposition1', 'composition1', 'salt1');
  const comp2Idx = getIndex('short_composition2', 'shortcomposition2', 'composition2', 'salt2');
  const skuIdx = getIndex('productcode', 'itemcode', 'sku', 'code');
  const dosageIdx = getIndex('dosageform', 'form', 'dosagetype');
  const strengthIdx = getIndex('strength', 'dosage', 'potency');
  const unitIdx = getIndex('unit', 'uom', 'packunit');
  const batchIdx = getIndex('batchnumber', 'batchno', 'batch', 'lotnumber', 'lot');
  const expIdx = getIndex('shelflife', 'expirydate', 'expdate', 'expiry', 'exp');
  const mfgDateIdx = getIndex('manufacturingdate', 'mfgdate', 'mfd');
  const qtyIdx = getIndex('quantity', 'qty', 'stock', 'initialquantity');
  const costIdx = getIndex('netptr', 'ptr', 'purchaseprice', 'buyprice', 'costprice', 'cost');
  const suppIdx = getIndex('suppliername', 'supplier', 'vendor', 'distributor');

  if (nameIdx === -1 && comp1Idx === -1) {
    batchErrors.push('Could not detect Medicine Name or Composition column in CSV headers.');
  }

  const dataLineStart = hIdx + 1;
  const totalDataRows = totalLines - dataLineStart;
  const totalBatches = Math.ceil(totalDataRows / batchSize);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    if (controlSignal?.aborted) {
      if (onProgress) {
        onProgress({
          processed: processedCount,
          total: totalDataRows,
          percent: Math.round((processedCount / totalDataRows) * 100),
          currentBatch: batchIdx + 1,
          totalBatches,
          speedMedsPerSec: Math.round(processedCount / Math.max(1, (Date.now() - startTime) / 1000)),
          etaSeconds: 0,
          status: 'cancelled',
        });
      }
      break;
    }

    while (controlSignal?.paused) {
      if (controlSignal.aborted) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const startLineIdx = dataLineStart + batchIdx * batchSize;
    const endLineIdx = Math.min(dataLineStart + (batchIdx + 1) * batchSize - 1, totalLines - 1);

    const batchMedsMap = new Map<string, any>();
    const batchBatchesMap = new Map<string, any>();
    let lastBrandName = '';

    for (let lineNum = startLineIdx; lineNum <= endLineIdx; lineNum++) {
      const lineStart = lineNum === 0 ? 0 : rowEnds[lineNum - 1] + 1;
      const lineEnd = rowEnds[lineNum];
      const rawLine = cleanText.slice(lineStart, lineEnd).replace(/\r$/, '').trim();
      if (!rawLine) continue;

      const cells = parseCsvRow(rawLine, delimiter);
      if (!cells || cells.length === 0 || cells.every((c) => !c)) {
        skippedCount++;
        processedCount++;
        continue;
      }

      const rawDisc = discIdx !== -1 ? (cells[discIdx] || '').trim().toLowerCase() : '';
      const isDisc = rawDisc === 'true' || rawDisc === 'yes' || rawDisc === '1';
      if (isDisc) {
        skippedCount++;
        processedCount++;
        continue;
      }

      let brand = nameIdx !== -1 ? (cells[nameIdx] || '').trim() : '';
      const comp1 = comp1Idx !== -1 ? (cells[comp1Idx] || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
      const comp2 = comp2Idx !== -1 ? (cells[comp2Idx] || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
      let combinedGeneric = [comp1, comp2].filter(Boolean).join(' + ');

      if (!brand && combinedGeneric) brand = combinedGeneric;
      if (!combinedGeneric && brand) combinedGeneric = brand;

      if (!brand) {
        for (const cell of cells) {
          const trimmed = String(cell ?? '').trim().replace(/^["']|["']$/g, '');
          if (trimmed.length >= 3 && !/^\d+(\.\d+)?$/.test(trimmed)) {
            brand = trimmed;
            if (!combinedGeneric) combinedGeneric = trimmed;
            break;
          }
        }
      }

      if (!brand) {
        skippedCount++;
        processedCount++;
        continue;
      }
      lastBrandName = brand;

      const manufacturer = (mfgIdx !== -1 && cells[mfgIdx] ? cells[mfgIdx].trim() : '') || 'Standard Healthcare';
      const packLabel = packIdx !== -1 ? cells[packIdx] || '' : '';

      let dosageForm = dosageIdx !== -1 && cells[dosageIdx] ? cells[dosageIdx] : 'Tablet';
      let unit = unitIdx !== -1 && cells[unitIdx] ? cells[unitIdx] : 'Strips';
      const plLower = packLabel.toLowerCase();
      if (plLower.includes('tablet') || plLower.includes('tab')) {
        dosageForm = 'Tablet';
        unit = 'Strips';
      } else if (plLower.includes('capsule') || plLower.includes('cap')) {
        dosageForm = 'Capsule';
        unit = 'Strips';
      } else if (plLower.includes('syrup') || plLower.includes('suspension') || plLower.includes('liquid') || plLower.includes('bottle')) {
        dosageForm = 'Syrup';
        unit = 'Bottles';
      } else if (plLower.includes('injection') || plLower.includes('ampoule') || plLower.includes('vial')) {
        dosageForm = 'Injection';
        unit = 'Ampoules';
      } else if (plLower.includes('ointment') || plLower.includes('cream') || plLower.includes('gel') || plLower.includes('tube')) {
        dosageForm = 'Ointment';
        unit = 'Tubes';
      } else if (plLower.includes('drop')) {
        dosageForm = 'Drops';
        unit = 'Vials';
      }

      const rawPrice = priceIdx !== -1 ? cells[priceIdx] : '';
      const numPrice = rawPrice ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) : 0;
      const sellingPrice = isNaN(numPrice) ? 0 : numPrice;

      const explicitSku = skuIdx !== -1 ? cells[skuIdx]?.trim() : '';
      const rowId = idIdx !== -1 ? cells[idIdx]?.trim() : '';
      const cleanSlug = (brand.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)) || 'MED';
      const sku = (explicitSku || (rowId ? `MED-${cleanSlug}-${rowId}` : `MED-${cleanSlug}-${lineNum}`)).toUpperCase();

      const batchNum = (batchIdx !== -1 && cells[batchIdx]) ? cells[batchIdx].trim() : `BCH-${new Date().getFullYear()}-${lineNum.toString().slice(-4)}`;
      const expiryDate = (expIdx !== -1 && cells[expIdx]) ? parseFlexibleDate(cells[expIdx], 3) : `${new Date().getFullYear() + 2}-12-31`;
      const mfgDate = (mfgDateIdx !== -1 && cells[mfgDateIdx]) ? parseFlexibleDate(cells[mfgDateIdx], 1) : formatYmd(new Date());
      const rawQty = qtyIdx !== -1 ? cells[qtyIdx] : '';
      const parsedQty = rawQty ? Math.max(0, parseInt(rawQty.replace(/[^0-9]/g, ''), 10) || 0) : 0;
      const rawCost = costIdx !== -1 ? cells[costIdx] : '';
      const costNum = rawCost ? parseFloat(rawCost.replace(/[^0-9.]/g, '')) : (sellingPrice > 0 ? Math.round(sellingPrice * 0.7 * 100) / 100 : 0);
      const purchasePrice = isNaN(costNum) ? 0 : costNum;
      const supplierName = (suppIdx !== -1 && cells[suppIdx]) ? cells[suppIdx].trim() : null;

      // Deduplicate by SKU within batch: omit id so Postgres retains existing id or creates new id without FK violation
      batchMedsMap.set(sku, {
        sku,
        brand_name: brand,
        generic_name: combinedGeneric,
        manufacturer,
        category: typeIdx !== -1 && cells[typeIdx] ? cells[typeIdx] : 'Allopathy',
        dosage_form: dosageForm,
        strength: strengthIdx !== -1 && cells[strengthIdx] ? cells[strengthIdx] : 'Standard',
        unit,
        selling_price: sellingPrice > 0 ? sellingPrice : null,
        minimum_stock_level: 20,
        updated_at: new Date().toISOString(),
      });

      if (sellingPrice > 0 || parsedQty > 0) {
        batchBatchesMap.set(sku, {
          batch_number: batchNum,
          manufacturing_date: mfgDate,
          expiry_date: expiryDate,
          purchase_price: purchasePrice > 0 ? purchasePrice : null,
          selling_price: sellingPrice > 0 ? sellingPrice : null,
          initial_quantity: parsedQty,
          available_quantity: parsedQty,
          supplier_name: supplierName,
        });
      }

      processedCount++;
    }

    const dbBatchMeds = Array.from(batchMedsMap.values());
    if (dbBatchMeds.length > 0) {
      try {
        const { data: upsertedMeds, error: medErr } = await supabase
          .from('medicines')
          .upsert(dbBatchMeds, { onConflict: 'sku' })
          .select('id, sku');

        if (medErr) {
          console.error('Batch medicines upsert failed:', medErr);
          failedCount += dbBatchMeds.length;
          if (batchErrors.length < 5) {
            batchErrors.push(medErr.message || 'Medicines batch upsert error');
          }
        } else {
          const actualCount = upsertedMeds?.length || dbBatchMeds.length;
          importedCount += actualCount;

          if (upsertedMeds && upsertedMeds.length > 0 && batchBatchesMap.size > 0) {
            const skuToId = new Map(upsertedMeds.map((m: any) => [m.sku.toUpperCase(), m.id]));
            const dbBatchBatches: any[] = [];
            for (const [bSku, bData] of batchBatchesMap.entries()) {
              const medId = skuToId.get(bSku.toUpperCase());
              if (medId) {
                dbBatchBatches.push({
                  ...bData,
                  medicine_id: medId,
                });
              }
            }

            if (dbBatchBatches.length > 0) {
              const { error: batchErr } = await supabase
                .from('medicine_batches')
                .upsert(dbBatchBatches, { onConflict: 'medicine_id,batch_number' });
              if (batchErr) {
                console.warn('Batch inventory upsert notice:', batchErr);
              }
            }
          }
        }
      } catch (err: any) {
        console.error('Batch upsert exception:', err);
        failedCount += dbBatchMeds.length;
        if (batchErrors.length < 5) {
          batchErrors.push(err?.message || 'Network or database error');
        }
      }
    }

    const elapsedSec = (Date.now() - startTime) / 1000;
    const speed = Math.round(processedCount / Math.max(0.1, elapsedSec));
    const remaining = Math.max(0, totalDataRows - processedCount);
    const etaSeconds = speed > 0 ? Math.round(remaining / speed) : 0;
    const percent = Math.min(100, Math.round((processedCount / totalDataRows) * 100));

    if (onProgress) {
      onProgress({
        processed: processedCount,
        total: totalDataRows,
        percent,
        currentBatch: batchIdx + 1,
        totalBatches,
        speedMedsPerSec: speed,
        etaSeconds,
        currentMedicineName: lastBrandName,
        status: batchIdx === totalBatches - 1 ? 'completed' : 'running',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const durationMs = Date.now() - startTime;
  const speedMedsPerSec = Math.round(processedCount / Math.max(0.1, durationMs / 1000));

  return {
    totalProcessed: processedCount,
    totalImported: importedCount,
    totalSkipped: skippedCount,
    failedCount,
    errors: batchErrors,
    durationMs,
    speedMedsPerSec,
  };
}

export interface PaginatedMedicinesResult {
  items: MedicineMaster[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchMedicinesPaginated(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
}): Promise<PaginatedMedicinesResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize || 50));
  const search = (params.search || '').trim();
  const category = (params.category || '').trim();

  try {
    let query = supabase
      .from('medicines')
      .select('*, batches:medicine_batches(*)', { count: 'exact' });

    if (search) {
      query = query.or(`brand_name.ilike.%${search}%,generic_name.ilike.%${search}%,sku.ilike.%${search}%`);
    }
    if (category && category !== 'All' && category !== 'all') {
      query = query.eq('category', category);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: dbMeds, count, error } = await query
      .order('brand_name', { ascending: true })
      .range(from, to);

    if (error || !Array.isArray(dbMeds)) {
      const local = loadStoredMedicines();
      let filtered = local;
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (m) =>
            m.brandName.toLowerCase().includes(q) ||
            m.genericName.toLowerCase().includes(q) ||
            m.sku.toLowerCase().includes(q)
        );
      }
      if (category && category !== 'All') {
        filtered = filtered.filter((m) => m.category === category);
      }
      const totalCount = filtered.length;
      const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
      return {
        items: paged,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
      };
    }

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
      return {
        id: m.id,
        sku: m.sku,
        brandName: m.brand_name,
        genericName: m.generic_name,
        manufacturer: m.manufacturer,
        category: m.category || 'General Medicine',
        dosageForm: m.dosage_form || 'Tablet',
        strength: m.strength || 'Standard',
        unit: m.unit || 'Strips',
        barcode: m.barcode,
        minimumStockLevel: Number(m.minimum_stock_level) || 20,
        sellingPrice: Number(m.selling_price) || 0,
        lastPurchasePrice: 0,
        supplier: suppliers.find((s) => s.id === m.supplier_id),
        batches,
        totalStock,
        stockStatus: calculateStockStatus(totalStock, Number(m.minimum_stock_level) || 20),
        expiryStatus: calculateExpiryStatus(batches),
      };
    });

    return {
      items: mapped,
      totalCount: count || mapped.length,
      page,
      pageSize,
      totalPages: Math.ceil((count || mapped.length) / pageSize) || 1,
    };
  } catch {
    const local = loadStoredMedicines();
    return {
      items: local.slice(0, pageSize),
      totalCount: local.length,
      page: 1,
      pageSize,
      totalPages: Math.ceil(local.length / pageSize) || 1,
    };
  }
}
