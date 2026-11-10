export type Role = 'assistant' | 'doctor';

export type PatientStatus = 'Waiting' | 'In Progress' | 'Completed' | 'Cancelled';

export interface Patient {
  id: string;
  patientDbId?: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone?: string;
  status: PatientStatus;
  time: string;
  appointmentDate?: string;
  nextVisitDate?: string;
  tokenNumber?: number | string;
  queueTokenNo?: number;
  patientNumber?: number;
  displayId?: string;
  priority?: 'Normal' | 'Urgent';
  visitType?: 'Walk-in' | 'WhatsApp' | 'WhatsApp Link' | string;
  cancellationReason?: string;
  notes?: string;
  smsSent?: boolean;
  lastSmsType?: string;
  locationId?: string;
}

export interface InventoryItem {
  id: number | string;
  generic: string;
  brand: string;
  stock: number;
  locationId?: string;
  unit?: string;
  category?: string;
  batchNo?: string;
  manufacturer?: string;
  packSize?: string;
  purchasePrice?: number;
  expiryDate?: string;
  reorderThreshold?: number;
}

export interface PrescriptionItem {
  med: InventoryItem;
  qty: number;
  dosage?: string;
  instructions?: string;
}

export interface ConsultationRecord {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientPhone?: string;
  doctorName: string;
  date: string;
  timestamp?: number;
  diagnostics: string;
  nextVisitDate?: string;
  prescription?: PrescriptionItem[];
  items?: PrescriptionItem[];
  demographics?: string;
}

export type TabType = 'assistant' | 'tables' | 'queue' | 'consult' | 'inventory' | 'analytics' | 'settings' | 'admin_doctors';

export type NavSection = 'dashboard' | 'tables' | 'booking' | 'assistant' | 'queue' | 'consult' | 'inventory' | 'analytics' | 'settings' | 'admin_doctors';

export type { AppConfig } from '@/data/default-config';
export * from './medicine';

export type PortalMode = 'gateway' | 'booking' | 'dashboard';

export interface ConfirmedToken {
  tokenNumber: number | string;
  name: string;
  time: string;
  date?: string;
  phone?: string;
  doctorName: string;
  priority: string;
  channel?: string;
  appointmentId?: string;
  dailyQuotaStatus?: string;
  assignedSlot?: string;
  message?: string;
  status?: string;
  locationId?: string;
  branchName?: string;
}

export interface BranchLocation {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  status: 'Active' | 'Inactive';
  createdAt?: string;
}

export type { DbClinicLocation, DbDoctorLocation } from './database';
