'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Patient,
  InventoryItem,
  PrescriptionItem,
  ConsultationRecord,
  Role,
  TabType,
  PatientStatus
} from '@/types';
import { INITIAL_PATIENTS, INITIAL_INVENTORY, CLINIC_CONFIG } from '@/data/initial-data';

interface ClinicContextType {
  role: Role;
  isLoggedIn: boolean;
  activeTab: TabType;
  patients: Patient[];
  inventory: InventoryItem[];
  activePatient: Patient | null;
  currentPrescription: PrescriptionItem[];
  diagnosticNotes: string;
  completedConsultations: ConsultationRecord[];
  activePrintRecord: ConsultationRecord | null;
  isAuthModalOpen: boolean;
  isPrintModalOpen: boolean;
  isLoading: boolean;
  
  switchTab: (tab: TabType) => void;
  openAuthModal: (targetTab?: TabType) => void;
  closeAuthModal: () => void;
  authenticateDoctor: (pin: string) => boolean;
  logoutDoctor: () => void;
  
  registerPatient: (
    name: string,
    age: number,
    gender: 'Male' | 'Female' | 'Other',
    phone?: string,
    priority?: 'Normal' | 'Urgent'
  ) => void;
  updatePatientStatus: (patientId: string, status: PatientStatus) => void;
  reallocateSlot: (patientId: string) => void;
  
  startConsultation: (patientId: string) => void;
  setDiagnosticNotes: (notes: string) => void;
  addMedicineToRx: (medId: number, qty: number, dosage?: string) => { success: boolean; message?: string };
  removeMedicineFromRx: (index: number) => void;
  completeConsultation: () => boolean;
  closePrintModal: () => void;
  reprintConsultation: (record: ConsultationRecord) => void;
  
  addNewInventoryItem: (generic: string, brand: string, qty: number, unit?: string) => boolean;
  restockItem: (id: number, additionalQty: number) => boolean;
  
  dismissLoading: () => void;
  replayLoading: () => void;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('assistant');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('assistant');
  const [intendedTab, setIntendedTab] = useState<TabType | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<PrescriptionItem[]>([]);
  const [diagnosticNotes, setDiagnosticNotes] = useState<string>('');
  
  const [completedConsultations, setCompletedConsultations] = useState<ConsultationRecord[]>([]);
  const [activePrintRecord, setActivePrintRecord] = useState<ConsultationRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initial ECG splash screen delay simulation (1.8s for smooth Apple-style intro)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  const switchTab = (tab: TabType) => {
    const doctorOnlyTabs: TabType[] = ['queue', 'consult', 'inventory', 'analytics'];
    if (doctorOnlyTabs.includes(tab) && !isLoggedIn) {
      setIntendedTab(tab);
      setIsAuthModalOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  const openAuthModal = (targetTab?: TabType) => {
    if (targetTab) setIntendedTab(targetTab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setIntendedTab(null);
  };

  const authenticateDoctor = (pin: string): boolean => {
    if (pin === '1234') {
      setIsLoggedIn(true);
      setRole('doctor');
      setIsAuthModalOpen(false);
      if (intendedTab) {
        setActiveTab(intendedTab);
        setIntendedTab(null);
      } else {
        setActiveTab('queue');
      }
      return true;
    }
    return false;
  };

  const logoutDoctor = () => {
    setIsLoggedIn(false);
    setRole('assistant');
    setActiveTab('assistant');
  };

  const registerPatient = (
    name: string,
    age: number,
    gender: 'Male' | 'Female' | 'Other',
    phoneOrPriority?: string,
    optionalPriority: 'Normal' | 'Urgent' = 'Normal'
  ) => {
    let phone: string | undefined;
    let priority: 'Normal' | 'Urgent' = optionalPriority;

    if (phoneOrPriority === 'Normal' || phoneOrPriority === 'Urgent') {
      priority = phoneOrPriority;
      phone = undefined;
    } else {
      phone = phoneOrPriority;
    }

    const nextToken = patients.length + 1;
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const newPatient: Patient = {
      id: `P0${nextToken < 10 ? '0' + nextToken : nextToken}`,
      tokenNumber: nextToken,
      name,
      age,
      gender,
      phone: phone?.trim() || undefined,
      status: 'Waiting',
      time: timeString,
      priority
    };

    setPatients(prev => [newPatient, ...prev]);
  };

  const updatePatientStatus = (patientId: string, status: PatientStatus) => {
    setPatients(prev =>
      prev.map(p => (p.id === patientId ? { ...p, status } : p))
    );
  };

  const reallocateSlot = (patientId: string) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    const newSlotTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    setPatients(prev =>
      prev.map(p => (p.id === patientId ? { ...p, time: newSlotTime } : p))
    );
  };

  const startConsultation = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    setActivePatient(patient);
    setCurrentPrescription([]);
    setDiagnosticNotes('');
    updatePatientStatus(patientId, 'In Progress');
    setActiveTab('consult');
  };

  const addMedicineToRx = (
    medId: number,
    qty: number,
    dosage: string = '1-0-1 After Food'
  ): { success: boolean; message?: string } => {
    const item = inventory.find(m => m.id === medId);
    if (!item) return { success: false, message: 'Medicine not found' };

    if (qty > item.stock) {
      return {
        success: false,
        message: `Insufficient stock! Only ${item.stock} ${item.unit} available.`
      };
    }

    const existingIdx = currentPrescription.findIndex(p => p.med.id === medId);
    if (existingIdx !== -1) {
      const combinedQty = currentPrescription[existingIdx].qty + qty;
      if (combinedQty > item.stock) {
        return {
          success: false,
          message: `Total exceeds stock limit of ${item.stock} ${item.unit}.`
        };
      }
      const updated = [...currentPrescription];
      updated[existingIdx].qty = combinedQty;
      setCurrentPrescription(updated);
    } else {
      setCurrentPrescription(prev => [
        ...prev,
        { med: item, qty, dosage }
      ]);
    }

    return { success: true };
  };

  const removeMedicineFromRx = (index: number) => {
    setCurrentPrescription(prev => prev.filter((_, i) => i !== index));
  };

  const completeConsultation = (): boolean => {
    if (!activePatient) return false;

    // Deduct prescribed medication quantities from master inventory
    setInventory(prev =>
      prev.map(item => {
        const prescribed = currentPrescription.find(p => p.med.id === item.id);
        if (prescribed) {
          return {
            ...item,
            stock: Math.max(0, item.stock - prescribed.qty)
          };
        }
        return item;
      })
    );

    // Mark patient as completed in queue
    updatePatientStatus(activePatient.id, 'Completed');

    // Create consultation record for print and records
    const record: ConsultationRecord = {
      id: `RX-${Date.now().toString().slice(-6)}`,
      patientId: activePatient.id,
      patientName: activePatient.name,
      patientAge: activePatient.age,
      patientGender: activePatient.gender,
      patientPhone: activePatient.phone,
      doctorName: CLINIC_CONFIG.doctorName,
      date: new Date().toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      timestamp: Date.now(),
      diagnostics: diagnosticNotes.trim() || 'General health evaluation. Routine observation.',
      prescription: [...currentPrescription]
    };

    setCompletedConsultations(prev => [record, ...prev]);
    setActivePrintRecord(record);
    setIsPrintModalOpen(true);

    // Reset active consultation state
    setActivePatient(null);
    setCurrentPrescription([]);
    setDiagnosticNotes('');

    return true;
  };

  const closePrintModal = () => {
    setIsPrintModalOpen(false);
    setActivePrintRecord(null);
  };

  const reprintConsultation = (record: ConsultationRecord) => {
    setActivePrintRecord(record);
    setIsPrintModalOpen(true);
  };

  const addNewInventoryItem = (
    generic: string,
    brand: string,
    qty: number,
    unit: string = 'Tablets'
  ): boolean => {
    if (!generic.trim() || !brand.trim() || qty <= 0) return false;

    const newItem: InventoryItem = {
      id: Date.now(),
      generic: generic.trim(),
      brand: brand.trim(),
      stock: qty,
      unit,
      category: 'General',
      batchNo: `BT-${Math.floor(100 + Math.random() * 900)}`
    };

    setInventory(prev => [newItem, ...prev]);
    return true;
  };

  const restockItem = (id: number, additionalQty: number): boolean => {
    if (additionalQty <= 0) return false;
    setInventory(prev =>
      prev.map(item =>
        item.id === id ? { ...item, stock: item.stock + additionalQty } : item
      )
    );
    return true;
  };

  const dismissLoading = () => setIsLoading(false);
  const replayLoading = () => setIsLoading(true);

  return (
    <ClinicContext.Provider
      value={{
        role,
        isLoggedIn,
        activeTab,
        patients,
        inventory,
        activePatient,
        currentPrescription,
        diagnosticNotes,
        completedConsultations,
        activePrintRecord,
        isAuthModalOpen,
        isPrintModalOpen,
        isLoading,
        switchTab,
        openAuthModal,
        closeAuthModal,
        authenticateDoctor,
        logoutDoctor,
        registerPatient,
        updatePatientStatus,
        reallocateSlot,
        startConsultation,
        setDiagnosticNotes,
        addMedicineToRx,
        removeMedicineFromRx,
        completeConsultation,
        closePrintModal,
        reprintConsultation,
        addNewInventoryItem,
        restockItem,
        dismissLoading,
        replayLoading
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
}
