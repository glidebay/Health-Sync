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
import {
  fetchQueueFromDb,
  fetchInventoryFromDb,
  subscribeToClinicUpdates,
  registerWalkinPatientDb,
  reallocateSlotDb,
  updateAppointmentStatusDb,
  completeConsultationDb,
  addInventoryItemDb,
  restockInventoryItemDb,
  verifyDoctorPin,
  getDoctors,
  saveDoctorSessionLocal,
  getDoctorSessionLocal,
  clearDoctorSessionLocal,
  logoutDoctorSessionDb,
  fetchAppConfigDb,
  updateAppConfigDb,
  resetAppConfigDb,
  getAppConfigLocal,
} from '@/lib/supabaseService';
import { DbDoctor } from '@/types/database';
import { AppConfig, DEFAULT_APP_CONFIG } from '@/data/default-config';

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
  currentDoctor: { id: string; name: string; title: string; regNo?: string } | null;
  config: AppConfig;
  
  switchTab: (tab: TabType) => void;
  openAuthModal: (targetTab?: TabType) => void;
  closeAuthModal: () => void;
  authenticateDoctor: (pin: string) => Promise<boolean>;
  logoutDoctor: () => void;
  updateConfig: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => Promise<boolean>;
  updateAllConfigs: (newConfig: Partial<AppConfig>) => Promise<boolean>;
  resetConfigToDefaults: () => Promise<void>;
  
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
  addMedicineToRx: (medId: number | string, qty: number, dosage?: string) => { success: boolean; message?: string };
  removeMedicineFromRx: (index: number) => void;
  completeConsultation: () => boolean;
  closePrintModal: () => void;
  reprintConsultation: (record: ConsultationRecord) => void;
  
  addNewInventoryItem: (generic: string, brand: string, qty: number, unit?: string) => boolean;
  restockItem: (id: number | string, additionalQty: number) => boolean;
  
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
  const [currentDoctor, setCurrentDoctor] = useState<{
    id: string;
    name: string;
    title: string;
    regNo?: string;
  } | null>(null);
  
  const [config, setConfig] = useState<AppConfig>(getAppConfigLocal);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initial ECG splash screen delay simulation (1.8s for smooth Apple-style intro)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Fetch only DB data and subscribe to live updates
  useEffect(() => {
    let isMounted = true;

    async function loadDbData() {
      try {
        const [dbPatients, dbInventory, dbDoctors, dbConfig] = await Promise.all([
          fetchQueueFromDb(),
          fetchInventoryFromDb(),
          getDoctors(),
          fetchAppConfigDb(),
        ]);

        if (isMounted) {
          if (dbConfig) {
            setConfig(dbConfig);
          }
          if (dbPatients) {
            setPatients(dbPatients as unknown as Patient[]);
          }
          if (dbInventory) {
            setInventory(dbInventory as unknown as InventoryItem[]);
          }
          if (dbDoctors && dbDoctors.length > 0) {
            // Check if THIS browser client has an active authenticated session
            const savedSession = getDoctorSessionLocal();
            if (savedSession) {
              const matched = dbDoctors.find((d: DbDoctor) => d.id === savedSession.doctorId);
              if (
                matched &&
                matched.pin_session_until &&
                new Date(matched.pin_session_until).getTime() > Date.now()
              ) {
                // Restore session on page refresh for the specific logged-in doctor
                setCurrentDoctor({
                  id: matched.id,
                  name: matched.full_name,
                  title: matched.specialization || 'General Medicine',
                  regNo: matched.reg_no || undefined,
                });
                setIsLoggedIn(true);
                setRole('doctor');
              } else {
                // Expired session: clear local storage and stay locked
                clearDoctorSessionLocal();
                setIsLoggedIn(false);
                setRole('assistant');
                setCurrentDoctor(null);
              }
            } else {
              // First screen / fresh visit: strictly locked screen!
              setIsLoggedIn(false);
              setRole('assistant');
              setCurrentDoctor(null);
            }
          }
        }
      } catch (err) {
        console.warn('ClinicContext Supabase error:', err);
      }
    }

    loadDbData();

    const unsubscribe = subscribeToClinicUpdates(() => {
      loadDbData();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const switchTab = (tab: TabType) => {
    const doctorOnlyTabs: TabType[] = ['queue', 'consult', 'inventory', 'analytics', 'settings'];
    if (doctorOnlyTabs.includes(tab) && !isLoggedIn && config.require_doctor_pin) {
      setIntendedTab(tab);
      setIsAuthModalOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  const openAuthModal = (targetTab?: TabType) => {
    if (!config.require_doctor_pin) {
      if (targetTab) setActiveTab(targetTab);
      return;
    }
    if (targetTab) setIntendedTab(targetTab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setIntendedTab(null);
  };

  const authenticateDoctor = async (pin: string): Promise<boolean> => {
    const res = await verifyDoctorPin(pin);
    if (res.success && res.doctor) {
      // Save authenticated doctor session locally so page refresh preserves it
      saveDoctorSessionLocal({
        doctorId: res.doctor.id,
        name: res.doctor.full_name,
        title: res.doctor.specialization || 'General Medicine',
        expiresAt: Date.now() + 30 * 60 * 1000,
      });

      setIsLoggedIn(true);
      setRole('doctor');
      setCurrentDoctor({
        id: res.doctor.id,
        name: res.doctor.full_name,
        title: res.doctor.specialization || 'General Medicine',
        regNo: res.doctor.reg_no || undefined,
      });
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

  const logoutDoctor = async () => {
    const activeDocId = currentDoctor?.id;
    clearDoctorSessionLocal();
    setIsLoggedIn(false);
    setRole('assistant');
    setCurrentDoctor(null);
    setActiveTab('assistant');
    if (activeDocId) {
      await logoutDoctorSessionDb(activeDocId);
    }
  };

  const registerPatient = async (
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

    const dbPat = await registerWalkinPatientDb({
      name,
      age,
      gender,
      phone,
      priority,
    });

    if (dbPat) {
      setPatients(prev => {
        const next = [...prev, { ...dbPat }];
        return next.sort((a, b) => {
          const isDoneA = a.status === 'Completed' || a.status === 'Cancelled';
          const isDoneB = b.status === 'Completed' || b.status === 'Cancelled';
          if (isDoneA !== isDoneB) return isDoneA ? 1 : -1;
          if (a.status === 'In Progress' && b.status !== 'In Progress') return -1;
          if (b.status === 'In Progress' && a.status !== 'In Progress') return 1;

          const getFifoNum = (p: Patient): number => {
            if (typeof p.queueTokenNo === 'number') return p.queueTokenNo;
            const raw = String(p.tokenNumber || p.displayId || '');
            const m = raw.match(/\d+/);
            if (m) return parseInt(m[0], 10);
            if (typeof p.patientNumber === 'number') return p.patientNumber;
            return 999999;
          };

          return getFifoNum(a) - getFifoNum(b);
        });
      });
    }
  };

  const updatePatientStatus = async (patientId: string, status: PatientStatus) => {
    setPatients(prev =>
      prev.map(p => (p.id === patientId ? { ...p, status } : p))
    );
    await updateAppointmentStatusDb(patientId, status);
  };

  const reallocateSlot = async (patientId: string) => {
    const newTime = await reallocateSlotDb(patientId);
    if (newTime) {
      setPatients(prev =>
        prev.map(p => (p.id === patientId ? { ...p, time: newTime } : p))
      );
    }
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
    medId: number | string,
    qty: number,
    dosage: string = '1-0-1 After Food'
  ): { success: boolean; message?: string } => {
    const item = inventory.find(m => String(m.id) === String(medId));
    if (!item) return { success: false, message: 'Medicine not found' };

    if (qty > item.stock) {
      return {
        success: false,
        message: `Insufficient stock! Only ${item.stock} ${item.unit} available.`
      };
    }

    const existingIdx = currentPrescription.findIndex(p => String(p.med.id) === String(medId));
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

    // Call Supabase DB to record consultation, prescriptions, and deduct inventory
    completeConsultationDb({
      appointmentId: activePatient.id,
      prescriptions: currentPrescription.map(p => ({
        inventoryId: p.med.id,
        qty: p.qty,
      })),
      notes: diagnosticNotes.trim() || undefined,
    }).catch(err => console.warn('Consultation DB completion error:', err));

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
    addInventoryItemDb({
      generic: generic.trim(),
      brand: brand.trim(),
      stock: qty,
    }).catch(err => console.warn('Inventory DB addition error:', err));

    return true;
  };

  const restockItem = (id: number | string, additionalQty: number): boolean => {
    if (additionalQty <= 0) return false;
    setInventory(prev =>
      prev.map(item =>
        String(item.id) === String(id) ? { ...item, stock: item.stock + additionalQty } : item
      )
    );
    restockInventoryItemDb(id, additionalQty).catch(err => console.warn('Restock DB error:', err));
    return true;
  };

  const updateConfig = async <K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<boolean> => {
    setConfig(prev => ({ ...prev, [key]: value }));
    const res = await updateAppConfigDb({ [key]: value });
    if (res.config) setConfig(res.config);
    return res.success;
  };

  const updateAllConfigs = async (newConfig: Partial<AppConfig>): Promise<boolean> => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    const res = await updateAppConfigDb(newConfig);
    if (res.config) setConfig(res.config);
    return res.success;
  };

  const resetConfigToDefaults = async (): Promise<void> => {
    setConfig(DEFAULT_APP_CONFIG);
    await resetAppConfigDb();
  };

  const dismissLoading = () => setIsLoading(false);
  const replayLoading = () => setIsLoading(true);

  const isDoctorUnlocked = isLoggedIn || !config.require_doctor_pin;
  const effectiveDoctor = currentDoctor || (!config.require_doctor_pin ? { id: 'default', name: 'Dr. John Doe', title: 'Senior Consultant' } : null);

  return (
    <ClinicContext.Provider
      value={{
        role: isDoctorUnlocked ? 'doctor' : role,
        isLoggedIn: isDoctorUnlocked,
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
        currentDoctor: effectiveDoctor,
        config,
        switchTab,
        openAuthModal,
        closeAuthModal,
        authenticateDoctor,
        logoutDoctor,
        updateConfig,
        updateAllConfigs,
        resetConfigToDefaults,
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
