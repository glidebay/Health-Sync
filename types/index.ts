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
  tokenNumber: number;
  priority?: 'Normal' | 'Urgent';
}

export interface InventoryItem {
  id: number;
  generic: string;
  brand: string;
  stock: number;
  unit: string;
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
  timestamp: number;
  diagnostics: string;
  prescription: PrescriptionItem[];
}

export type TabType = 'assistant' | 'queue' | 'consult' | 'inventory' | 'analytics';
