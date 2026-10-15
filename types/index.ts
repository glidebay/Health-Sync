export type Role = 'assistant' | 'doctor';

export type PatientStatus = 'Waiting' | 'In Progress' | 'Completed';

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone?: string;
  status: PatientStatus;
  time: string;
  tokenNumber?: number | string;
  patientNumber?: number;
  displayId?: string;
  priority?: 'Normal' | 'Urgent';
}

export interface InventoryItem {
  id: number | string;
  generic: string;
  brand: string;
  stock: number;
  unit?: string;
  category?: string;
  batchNo?: string;
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
  prescription?: PrescriptionItem[];
  items?: PrescriptionItem[];
  demographics?: string;
}

export type TabType = 'assistant' | 'queue' | 'consult' | 'inventory' | 'analytics' | 'settings';

export type NavSection = 'dashboard' | 'booking' | 'assistant' | 'queue' | 'consult' | 'inventory' | 'analytics' | 'settings';

export type { AppConfig } from '@/data/default-config';

export type PortalMode = 'gateway' | 'booking' | 'dashboard';

export interface ConfirmedToken {
  tokenNumber: number | string;
  name: string;
  time: string;
  phone?: string;
  doctorName: string;
  priority: string;
}
