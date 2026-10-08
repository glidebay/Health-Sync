import { Patient, InventoryItem } from '@/types';

export const INITIAL_PATIENTS: Patient[] = [
  { id: 'P01', tokenNumber: 1, name: 'Unnikrishnan Menon', age: 62, gender: 'Male', status: 'Waiting', time: '09:30 AM', priority: 'Normal' },
  { id: 'P02', tokenNumber: 2, name: 'Lakshmi Namboothiri', age: 45, gender: 'Female', status: 'In Progress', time: '09:45 AM', priority: 'Normal' },
  { id: 'P03', tokenNumber: 3, name: 'Abdul Rahman', age: 34, gender: 'Male', status: 'Waiting', time: '10:00 AM', priority: 'Normal' },
  { id: 'P04', tokenNumber: 4, name: 'Thomas Varghese', age: 55, gender: 'Male', status: 'Waiting', time: '10:15 AM', priority: 'Urgent' },
  { id: 'P05', tokenNumber: 5, name: 'Parvathy Nair', age: 28, gender: 'Female', status: 'Waiting', time: '10:30 AM', priority: 'Normal' },
  { id: 'P06', tokenNumber: 6, name: 'Sreenivasan Pillai', age: 71, gender: 'Male', status: 'Waiting', time: '10:45 AM', priority: 'Normal' }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 1, generic: 'Paracetamol 650mg', brand: 'Dolo 650', stock: 150, unit: 'Tablets', category: 'Analgesic', batchNo: 'DL-882' },
  { id: 2, generic: 'Amoxicillin 500mg', brand: 'Novamox', stock: 45, unit: 'Capsules', category: 'Antibiotic', batchNo: 'NV-104' },
  { id: 3, generic: 'Fexofenadine 120mg', brand: 'Allegra', stock: 12, unit: 'Tablets', category: 'Antihistamine', batchNo: 'AL-309' },
  { id: 4, generic: 'Pantoprazole 40mg', brand: 'Pan 40', stock: 0, unit: 'Tablets', category: 'Antacid', batchNo: 'PN-094' },
  { id: 5, generic: 'Azithromycin 500mg', brand: 'Azithral 500', stock: 68, unit: 'Tablets', category: 'Antibiotic', batchNo: 'AZ-441' },
  { id: 6, generic: 'Montelukast + Levocetirizine', brand: 'Montair LC', stock: 30, unit: 'Tablets', category: 'Respiratory', batchNo: 'ML-210' }
];

export const CLINIC_CONFIG = {
  clinicName: 'HealthSync Clinic',
  doctorName: 'Dr. Sunny',
  specialty: 'MBBS, MD - General Medicine',
  registrationNo: 'KMC-48291',
  productLine: 'A PRODUCT OF GLIDEBAY',
  address: 'Level 2, HealthSync Medical Pavilion, Kochi',
  contact: '+91 98460 12345 • support@glidebay.health'
};
