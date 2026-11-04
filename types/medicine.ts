export type DosageForm =
  | 'Tablet'
  | 'Capsule'
  | 'Syrup'
  | 'Injection'
  | 'Ointment'
  | 'Drops'
  | 'Inhaler'
  | 'Suspension'
  | 'Powder'
  | 'Other';

export type StockStatus = 'Available' | 'Low Stock' | 'Out of Stock';

export type ExpiryStatus = 'Valid' | 'Near Expiry' | 'Expired';

export type MovementType =
  | 'Purchase'
  | 'Dispensing'
  | 'Stock Adjustment'
  | 'Return'
  | 'Expired Stock'
  | 'Damaged Stock';

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone: string;
  address?: string;
  gstin?: string;
  lastPurchaseDate?: string;
  lastPurchasePrice?: number;
  createdAt?: string;
}

export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  initialQuantity: number;
  availableQuantity: number;
  supplierId?: string;
  supplierName?: string;
  createdAt?: string;
}

export interface PurchaseRecord {
  id: string;
  medicineId: string;
  medicineName?: string;
  supplierId: string;
  supplierName: string;
  batchNumber: string;
  purchaseDate: string;
  quantityPurchased: number;
  purchasePrice: number;
  totalPurchaseAmount: number;
  invoiceNumber: string;
  expiryDate?: string;
  createdAt?: string;
}

export interface StockMovement {
  id: string;
  medicineId: string;
  medicineName?: string;
  batchId?: string;
  batchNumber?: string;
  movementType: MovementType;
  quantity: number;
  referenceNumber: string;
  responsibleUser: string;
  date: string;
  notes?: string;
  createdAt?: string;
}

export interface MedicineMaster {
  id: string;
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
  batches: MedicineBatch[];
  totalStock: number;
  stockStatus: StockStatus;
  expiryStatus: ExpiryStatus;
  supplier?: Supplier;
  lastPurchaseDate?: string;
  lastPurchasePrice?: number;
  sellingPrice?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CsvValidationError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

export interface CsvParsedRow {
  rowNumber: number;
  sku: string;
  brandName: string;
  genericName: string;
  manufacturer: string;
  category: string;
  dosageForm: DosageForm;
  strength: string;
  unit: string;
  barcode?: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  minStockLevel: number;
  supplierName?: string;
  supplierPhone?: string;
  invoiceNumber?: string;
  errors: CsvValidationError[];
  isValid: boolean;
  isDuplicate: boolean;
  isExisting: boolean;
}

export interface CsvImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  newMedicinesCount: number;
  updatedMedicinesCount: number;
  successfullyImported: number;
  skippedRows: number;
  failedRows: number;
  errors: CsvValidationError[];
}

