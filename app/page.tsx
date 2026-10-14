'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Users,
  ClipboardList,
  Stethoscope,
  Boxes,
  BarChart3,
  Search,
} from 'lucide-react';

import { ClinicProvider, useClinic } from '@/context/ClinicContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  fetchQueueFromDb,
  fetchInventoryFromDb,
  registerWalkinPatientDb,
  reallocateSlotDb,
  updateAppointmentStatusDb,
  completeConsultationDb,
  addInventoryItemDb,
  restockInventoryItemDb,
  verifyDoctorPin,
  verifyClinicOrDoctorPin,
  getDoctors,
  subscribeToClinicUpdates,
  saveDoctorSessionLocal,
  getDoctorSessionLocal,
  clearDoctorSessionLocal,
  saveClinicSessionLocal,
  getClinicSessionLocal,
  clearClinicSessionLocal,
  logoutDoctorSessionDb,
} from '@/lib/supabaseService';
import {
  Patient,
  InventoryItem,
  PrescriptionItem,
  NavSection,
  PortalMode,
  ConfirmedToken,
} from '@/types';
import { DbDoctor } from '@/types/database';

// Reusable Components & Modals
import EcgLoadingScreen from '@/components/loading/EcgLoadingScreen';
import { SideMenu, NavItemConfig } from '@/components/layout/SideMenu';
import { AppHeader } from '@/components/layout/AppHeader';
import { NavigationDock } from '@/components/layout/NavigationDock';
import { DoctorAuthModal } from '@/components/auth/DoctorAuthModal';
import { WalkinRegisterModal } from '@/components/modals/WalkinRegisterModal';
import { PrescriptionPrintModal } from '@/components/modals/PrescriptionPrintModal';

// Screen Views
import { GatewayScreen } from '@/components/views/GatewayScreen';
import { SlotBookingView } from '@/components/views/SlotBookingView';
import { DashboardView } from '@/components/views/DashboardView';
import { AssistantView } from '@/components/views/AssistantView';
import { QueueView } from '@/components/views/QueueView';
import { ConsultationView } from '@/components/views/ConsultationView';
import { InventoryView } from '@/components/views/InventoryView';
import { AnalyticsView } from '@/components/views/AnalyticsView';

const INITIAL_QUEUE: Patient[] = [];
const INITIAL_INVENTORY: InventoryItem[] = [];

function DashboardContent() {
  const { isLoading } = useClinic();
  const isMobile = useIsMobile();
  const [portalMode, setPortalMode] = useState<PortalMode>(() => {
    if (typeof window !== 'undefined') {
      const clinicSession = getClinicSessionLocal();
      const docSession = getDoctorSessionLocal();
      if (clinicSession || docSession) return 'dashboard';
    }
    return 'gateway';
  });
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Slot Booking Form State
  const [availableDoctors, setAvailableDoctors] = useState<DbDoctor[]>([]);
  const [bookName, setBookName] = useState('');
  const [bookPhone, setBookPhone] = useState('');
  const [bookAge, setBookAge] = useState('');
  const [bookGender, setBookGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [bookPriority, setBookPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookSlotTime, setBookSlotTime] = useState('09:30 AM');
  const [bookReason, setBookReason] = useState('General Consultation');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [confirmedToken, setConfirmedToken] = useState<ConfirmedToken | null>(null);

  // Auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
    else setIsSidebarOpen(true);
  }, [isMobile]);

  // Doctor Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [intendedSection, setIntendedSection] = useState<NavSection | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Check saved session on mount
  useEffect(() => {
    const clinicSession = getClinicSessionLocal();
    const docSession = getDoctorSessionLocal();
    if (clinicSession || docSession) {
      setPortalMode('dashboard');
      if (docSession) {
        setIsLoggedIn(true);
        setDoctorProfile({
          name: docSession.name,
          title: docSession.title,
        });
      } else if (clinicSession) {
        setDoctorProfile({
          name: clinicSession.name || 'Clinic Assistant',
          title: 'Reception & Triage',
        });
      }
    }
  }, []);

  // Keyboard shortcut (Ctrl+B) to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Clinic Data
  const [queue, setQueue] = useState<Patient[]>(INITIAL_QUEUE);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<PrescriptionItem[]>([]);
  const [diagnosticNotes, setDiagnosticNotes] = useState('');
  const [, setIsDbSynced] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState<{ name: string; title: string }>({
    name: 'Doctor',
    title: 'General Medicine',
  });

  // Load initial data from Supabase DB and subscribe to live changes
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [dbQueue, dbInventory, dbDoctors] = await Promise.all([
          fetchQueueFromDb(),
          fetchInventoryFromDb(),
          getDoctors(),
        ]);

        if (isMounted) {
          setQueue(dbQueue || []);
          setInventory(dbInventory || []);
          if (dbDoctors && dbDoctors.length > 0) {
            setAvailableDoctors(dbDoctors);
            setBookDoctorId((prev) => prev || dbDoctors[0].id);

            const savedDoctorSession = getDoctorSessionLocal();
            const savedClinicSession = getClinicSessionLocal();

            if (savedDoctorSession) {
              const matched = dbDoctors.find((d) => d.id === savedDoctorSession.doctorId);
              if (matched) {
                setDoctorProfile({
                  name: matched.full_name,
                  title: matched.specialization || 'General Medicine',
                });
                setIsLoggedIn(true);
                setPortalMode('dashboard');
              }
            } else if (savedClinicSession) {
              setDoctorProfile({
                name: savedClinicSession.name || 'Clinic Assistant',
                title: 'Reception & Triage',
              });
              setIsLoggedIn(false);
              setPortalMode('dashboard');
            }
          }
          setIsDbSynced(true);
        }
      } catch (err) {
        console.warn('Failed to load initial Supabase data:', err);
      }
    }

    loadData();

    const unsubscribe = subscribeToClinicUpdates(() => {
      loadData();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Walk-in modal state
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinName, setWalkinName] = useState('');
  const [walkinAge, setWalkinAge] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinGender, setWalkinGender] = useState<'Male' | 'Female' | 'Other'>('Male');

  // Procurement form state
  const [newGeneric, setNewGeneric] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newQty, setNewQty] = useState('');
  const [stockUpdates, setStockUpdates] = useState<Record<string, string>>({});

  // Prescription builder form state
  const [selectedMedId, setSelectedMedId] = useState('');
  const [rxQty, setRxQty] = useState('');

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printRecord, setPrintRecord] = useState<{
    date: string;
    patientName: string;
    patientPhone?: string;
    demographics: string;
    diagnostics: string;
    items: PrescriptionItem[];
  } | null>(null);

  const navItems: NavItemConfig[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, reqAuth: false },
    { id: 'assistant', label: 'Assistant Desk', icon: ClipboardList, reqAuth: false },
    { id: 'queue', label: 'Doctor Queue', icon: Users, reqAuth: true },
    { id: 'consult', label: 'Consultation', icon: Stethoscope, reqAuth: true },
    { id: 'inventory', label: 'Pharmacy Stock', icon: Boxes, reqAuth: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, reqAuth: true },
  ];

  const handleNavClick = (section: NavSection, reqAuth: boolean) => {
    if (reqAuth && !isLoggedIn) {
      setIntendedSection(section);
      setShowPinModal(true);
      return;
    }
    setActiveSection(section);
  };

  const handlePinSubmit = async () => {
    const clean = pinInput.trim();
    if (!clean) {
      setPinError(true);
      return;
    }

    const res = await verifyClinicOrDoctorPin(clean);
    if (res.success) {
      // 1. Grant 8-Hour Clinic Session (Tier 1 Outer Gate)
      saveClinicSessionLocal({
        role: 'assistant',
        name: 'Clinic Assistant',
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      });

      // 2. If Doctor PIN was entered, unlock Doctor Session (Tier 2 Inner Gate)
      if (res.doctor) {
        saveDoctorSessionLocal({
          doctorId: res.doctor.id,
          name: res.doctor.full_name,
          title: res.doctor.specialization || 'General Medicine',
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        });

        setIsLoggedIn(true);
        setDoctorProfile({
          name: res.doctor.full_name,
          title: res.doctor.specialization || 'General Medicine',
        });
      } else {
        // Assistant PIN (2468) entered
        setIsLoggedIn(false);
        setDoctorProfile({
          name: 'Clinic Assistant',
          title: 'Reception & Triage',
        });
      }

      setShowPinModal(false);
      setPinError(false);
      setPinInput('');
      setPortalMode('dashboard');

      const target = intendedSection || 'dashboard';
      setActiveSection(target);
      setIntendedSection(null);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 2200);
    }
  };

  const handleLockDoctorSession = async () => {
    const savedDoc = getDoctorSessionLocal();
    clearDoctorSessionLocal();
    setIsLoggedIn(false);
    setDoctorProfile({
      name: 'Clinic Assistant',
      title: 'Reception & Triage',
    });
    // If currently on a doctor-restricted section, lock and return to dashboard
    if (['queue', 'consult', 'inventory', 'analytics'].includes(activeSection)) {
      setActiveSection('dashboard');
    }
    if (savedDoc?.doctorId) {
      await logoutDoctorSessionDb(savedDoc.doctorId);
    }
  };

  const handleFullLogout = async () => {
    const savedDoc = getDoctorSessionLocal();
    clearClinicSessionLocal();
    clearDoctorSessionLocal();
    setIsLoggedIn(false);
    setPortalMode('gateway');
    setActiveSection('dashboard');
    if (savedDoc?.doctorId) {
      await logoutDoctorSessionDb(savedDoc.doctorId);
    }
  };

  const handleRegisterWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinName.trim() || !walkinAge) return;

    const ageNum = parseInt(walkinAge, 10);
    const dbPat = await registerWalkinPatientDb({
      name: walkinName.trim(),
      age: ageNum,
      gender: walkinGender,
      phone: walkinPhone.trim() || undefined,
      priority: 'Normal',
    });

    if (dbPat) {
      setQueue((prev) => [
        { ...dbPat, tokenNumber: prev.length + 1 },
        ...prev,
      ]);
    }

    setWalkinName('');
    setWalkinAge('');
    setWalkinPhone('');
    setWalkinGender('Male');
    setShowWalkinModal(false);
  };

  const handleBookSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName.trim()) return;

    setIsBookingSubmitting(true);
    try {
      const selectedDoc = availableDoctors.find((d) => d.id === bookDoctorId);
      const docName = selectedDoc?.full_name || doctorProfile.name || 'Dr. Sunny';

      const dbPat = await registerWalkinPatientDb({
        name: bookName.trim(),
        age: parseInt(bookAge, 10) || 28,
        gender: bookGender,
        phone: bookPhone.trim() || undefined,
        priority: bookPriority,
      });

      const newTokNum = dbPat?.tokenNumber || queue.length + 1;

      if (dbPat) {
        setQueue((prev) => [
          {
            ...dbPat,
            time: bookSlotTime || dbPat.time,
          },
          ...prev,
        ]);
      } else {
        const fallbackId = `P-${String(Date.now()).slice(-4)}`;
        const fallbackPatient: Patient = {
          id: fallbackId,
          name: bookName.trim(),
          age: parseInt(bookAge, 10) || 28,
          gender: bookGender,
          phone: bookPhone.trim(),
          status: 'Waiting',
          time: bookSlotTime || 'Now',
        };
        setQueue((prev) => [fallbackPatient, ...prev]);
      }

      setConfirmedToken({
        tokenNumber: newTokNum,
        name: bookName.trim(),
        time: bookSlotTime,
        phone: bookPhone.trim(),
        doctorName: docName,
        priority: bookPriority,
      });

      setBookName('');
      setBookPhone('');
      setBookAge('');
      setBookPriority('Normal');
    } catch (err) {
      console.error('Error booking slot:', err);
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  const handleReallocate = async (id: string) => {
    const newTime = await reallocateSlotDb(id);
    setQueue((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            time:
              newTime ||
              new Date(Date.now() + 20 * 60000).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              }),
          };
        }
        return p;
      })
    );
  };

  const startConsultation = async (patientId: string) => {
    const patient = queue.find((p) => p.id === patientId);
    if (!patient) return;

    setActivePatient(patient);
    setCurrentPrescription([]);
    setDiagnosticNotes('');
    setSelectedMedId('');
    setRxQty('');

    await updateAppointmentStatusDb(patientId, 'In Progress');

    setQueue((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, status: 'In Progress' } : p))
    );

    setActiveSection('consult');
  };

  const addMedicineToRx = () => {
    if (!selectedMedId || !rxQty) return;
    const qtyNum = parseInt(rxQty, 10);
    if (qtyNum <= 0) return;

    const med = inventory.find((m) => String(m.id) === String(selectedMedId));
    if (!med) return;

    if (qtyNum > med.stock) {
      alert(`Only ${med.stock} units available in pharmacy.`);
      return;
    }

    const existing = currentPrescription.find((p) => String(p.med.id) === String(med.id));
    if (existing) {
      if (existing.qty + qtyNum > med.stock) {
        alert(`Combined total exceeds available stock of ${med.stock}.`);
        return;
      }
      setCurrentPrescription((prev) =>
        prev.map((p) => (String(p.med.id) === String(med.id) ? { ...p, qty: p.qty + qtyNum } : p))
      );
    } else {
      setCurrentPrescription((prev) => [...prev, { med, qty: qtyNum }]);
    }

    setSelectedMedId('');
    setRxQty('');
  };

  const removeRx = (index: number) => {
    setCurrentPrescription((prev) => prev.filter((_, i) => i !== index));
  };

  const completeConsultation = async () => {
    if (!activePatient) return;

    await completeConsultationDb({
      appointmentId: activePatient.id,
      notes: diagnosticNotes || 'Clinical examination normal. Prescription issued.',
      prescriptions: currentPrescription.map((p) => ({
        inventoryId: String(p.med.id),
        qty: p.qty,
      })),
    });

    setInventory((prevInv) =>
      prevInv.map((item) => {
        const prescribed = currentPrescription.find((p) => String(p.med.id) === String(item.id));
        if (prescribed) {
          return { ...item, stock: Math.max(0, item.stock - prescribed.qty) };
        }
        return item;
      })
    );

    setQueue((prevQueue) =>
      prevQueue.map((p) => (p.id === activePatient.id ? { ...p, status: 'Completed' } : p))
    );

    const dateStr = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    setPrintRecord({
      date: dateStr,
      patientName: activePatient.name,
      patientPhone: activePatient.phone,
      demographics: `${activePatient.age} Yrs / ${activePatient.gender}`,
      diagnostics: diagnosticNotes || 'Clinical examination normal. Prescription issued.',
      items: [...currentPrescription],
    });

    setShowPrintModal(true);
    setActivePatient(null);
  };

  const handleAddNewProcurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGeneric.trim() || !newBrand.trim() || !newQty) return;
    const qtyNum = parseInt(newQty, 10);
    if (qtyNum <= 0) return;

    const dbItem = await addInventoryItemDb({
      generic: newGeneric.trim(),
      brand: newBrand.trim(),
      stock: qtyNum,
    });

    if (dbItem) {
      setInventory((prev) => [dbItem, ...prev]);
    } else {
      setInventory((prev) => [
        ...prev,
        { id: `inv-${Date.now()}`, generic: newGeneric.trim(), brand: newBrand.trim(), stock: qtyNum },
      ]);
    }

    setNewGeneric('');
    setNewBrand('');
    setNewQty('');
  };

  const handleUpdateStock = async (id: string | number) => {
    const val = parseInt(stockUpdates[String(id)] || '0', 10);
    if (val > 0) {
      await restockInventoryItemDb(String(id), val);
      setInventory((prev) =>
        prev.map((item) => (String(item.id) === String(id) ? { ...item, stock: item.stock + val } : item))
      );
      setStockUpdates((prev) => ({ ...prev, [String(id)]: '' }));
    }
  };

  const filteredQueue = queue.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPatientsCount = queue.length;
  const waitingPatientsCount = queue.filter((p) => p.status === 'Waiting').length;
  const completedPatientsCount = queue.filter((p) => p.status === 'Completed').length;
  const inChamberPatient = queue.find((p) => p.status === 'In Progress');
  const nextWaitingPatient = queue.find((p) => p.status === 'Waiting');
  const totalStockUnits = inventory.reduce((acc, curr) => acc + curr.stock, 0);

  const activeSectionLabel = navItems.find((n) => n.id === activeSection)?.label || 'Dashboard';

  return (
    <>
      <EcgLoadingScreen />

      <AnimatePresence mode="wait">
        {!isLoading && portalMode === 'gateway' && (
          <GatewayScreen
            key="portal-gateway"
            onSelectBookSlot={() => {
              setPortalMode('booking');
              setActiveSection('booking');
            }}
            onSelectConsulting={() => {
              setIntendedSection('dashboard');
              setPinInput('');
              setPinError(false);
              setShowPinModal(true);
            }}
            waitingCount={waitingPatientsCount}
            doctorName={doctorProfile.name}
            doctorSpecialty={doctorProfile.title}
          />
        )}
      </AnimatePresence>

      {!isLoading && portalMode === 'booking' && (
        <SlotBookingView
          queue={queue}
          waitingPatientsCount={waitingPatientsCount}
          doctorProfile={doctorProfile}
          availableDoctors={availableDoctors}
          bookName={bookName}
          setBookName={setBookName}
          bookPhone={bookPhone}
          setBookPhone={setBookPhone}
          bookAge={bookAge}
          setBookAge={setBookAge}
          bookGender={bookGender}
          setBookGender={setBookGender}
          bookPriority={bookPriority}
          setBookPriority={setBookPriority}
          bookDoctorId={bookDoctorId}
          setBookDoctorId={setBookDoctorId}
          bookSlotTime={bookSlotTime}
          setBookSlotTime={setBookSlotTime}
          bookReason={bookReason}
          setBookReason={setBookReason}
          isBookingSubmitting={isBookingSubmitting}
          confirmedToken={confirmedToken}
          setConfirmedToken={setConfirmedToken}
          handleBookSlotSubmit={handleBookSlotSubmit}
          onBackToGateway={() => setPortalMode('gateway')}
          onGoToConsulting={() => {
            setIntendedSection('dashboard');
            setPinInput('');
            setPinError(false);
            setShowPinModal(true);
          }}
          isStandalone={true}
        />
      )}

      {!isLoading && portalMode === 'dashboard' && (
        <motion.div
          key="dashboard-app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={`h-screen bg-[#F8F9FB] flex antialiased select-none text-[#16191E] overflow-hidden ${isMobile ? 'flex-col' : 'flex-row'
            }`}
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #print-modal,
              #print-modal * {
                visibility: visible;
              }
              #print-modal {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background: white !important;
                z-index: 9999;
                padding: 30px;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          {!isMobile && (
            <SideMenu
              isOpen={isSidebarOpen}
              activeSection={activeSection}
              isLoggedIn={isLoggedIn}
              doctorProfile={doctorProfile}
              navItems={navItems}
              onNavClick={handleNavClick}
              onOpenPinModal={() => {
                setIntendedSection('queue');
                setShowPinModal(true);
              }}
              onLogout={handleLockDoctorSession}
            />
          )}

          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300">
            <AppHeader
              isMobile={isMobile}
              activeSection={activeSection}
              activeSectionLabel={activeSectionLabel}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isLoggedIn={isLoggedIn}
              doctorProfile={doctorProfile}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              onBackToGateway={handleFullLogout}
              onOpenPinModal={() => {
                setIntendedSection('queue');
                setShowPinModal(true);
              }}
              onLogout={handleLockDoctorSession}
            />

            <main
              className={`flex-1 overflow-y-auto no-print ${isMobile ? 'px-3.5 sm:px-6 pt-3 pb-28' : 'px-8 lg:px-10 pb-12'
                }`}
            >
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.45 }}
                className={`flex items-center mb-6 sm:mb-8 ${isMobile ? 'space-x-3' : 'space-x-4'}`}
              >
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className={`rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow-sm flex-shrink-0 cursor-pointer ${isMobile ? 'w-11 h-11' : 'w-14 h-14'
                    }`}
                >
                  <Image
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDAlmuC30xuMIZpBDfxi6DcXHu_Ks41P52MELsRuS7q4xgQhHJsRyIAU26SoUhZQ_v01dlHDlWrAAkh3wSZl04MBQqPlT6ErIF8M2Z-BxbP_LDZJwq1ggudaa_bfRN8YDWwtyWd28KCfQfIF40q_rF1P8xus-qeymY-ar5CmL4wz4tzlH8FI1FP7WZ-0sJDAW-0YLEq8Icg9Yn18bC_VJLV-Tv4XaPLEQViv7w4vOCY"
                    alt="Profile"
                    width={56}
                    height={56}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                </motion.div>
                <div>
                  <motion.h1
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className={`font-bold text-[#16191E] leading-snug ${isMobile ? 'text-base' : 'text-xl'}`}
                  >
                    Welcome Back {isLoggedIn ? doctorProfile.name : 'Jack (Assistant)'}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.28 }}
                    className="text-xs text-[#8A909D] font-medium"
                  >
                    {isLoggedIn
                      ? 'Clinical Chamber • OPD consultation worklist & stock link'
                      : "Here is an overview of today's patient queue & triage"}
                  </motion.p>
                </div>
              </motion.section>

              {isMobile && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="relative w-full mb-6"
                >
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#2563EB]">
                    <Search className="w-4 h-4 stroke-[2]" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search patient name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-2.5 pl-10 pr-4 bg-white border border-[#ECEEF2] rounded-xl text-xs placeholder-gray-400 text-gray-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {activeSection === 'booking' && (
                  <SlotBookingView
                    queue={queue}
                    waitingPatientsCount={waitingPatientsCount}
                    doctorProfile={doctorProfile}
                    availableDoctors={availableDoctors}
                    bookName={bookName}
                    setBookName={setBookName}
                    bookPhone={bookPhone}
                    setBookPhone={setBookPhone}
                    bookAge={bookAge}
                    setBookAge={setBookAge}
                    bookGender={bookGender}
                    setBookGender={setBookGender}
                    bookPriority={bookPriority}
                    setBookPriority={setBookPriority}
                    bookDoctorId={bookDoctorId}
                    setBookDoctorId={setBookDoctorId}
                    bookSlotTime={bookSlotTime}
                    setBookSlotTime={setBookSlotTime}
                    bookReason={bookReason}
                    setBookReason={setBookReason}
                    isBookingSubmitting={isBookingSubmitting}
                    confirmedToken={confirmedToken}
                    setConfirmedToken={setConfirmedToken}
                    handleBookSlotSubmit={handleBookSlotSubmit}
                    onBackToGateway={() => setPortalMode('gateway')}
                    onGoToConsulting={() => setActiveSection('queue')}
                    isStandalone={false}
                  />
                )}

                {activeSection === 'dashboard' && (
                  <DashboardView
                    totalPatientsCount={totalPatientsCount}
                    completedPatientsCount={completedPatientsCount}
                    totalStockUnits={totalStockUnits}
                    inChamberPatient={inChamberPatient}
                    nextWaitingPatient={nextWaitingPatient}
                    waitingPatientsCount={waitingPatientsCount}
                    filteredQueue={filteredQueue}
                    queue={queue}
                    isLoggedIn={isLoggedIn}
                    onRegisterWalkin={() => setShowWalkinModal(true)}
                    onViewAllQueue={() => setActiveSection('assistant')}
                    onReallocate={handleReallocate}
                    onStartConsultation={startConsultation}
                    onRequireLogin={() => {
                      setIntendedSection('queue');
                      setShowPinModal(true);
                    }}
                  />
                )}

                {activeSection === 'assistant' && (
                  <AssistantView
                    queue={queue}
                    onRegisterWalkin={() => setShowWalkinModal(true)}
                    onReallocate={handleReallocate}
                  />
                )}

                {activeSection === 'queue' && (
                  <QueueView
                    queue={queue}
                    onStartConsultation={startConsultation}
                  />
                )}

                {activeSection === 'consult' && (
                  <ConsultationView
                    activePatient={activePatient}
                    diagnosticNotes={diagnosticNotes}
                    setDiagnosticNotes={setDiagnosticNotes}
                    selectedMedId={selectedMedId}
                    setSelectedMedId={setSelectedMedId}
                    rxQty={rxQty}
                    setRxQty={setRxQty}
                    inventory={inventory}
                    currentPrescription={currentPrescription}
                    onAddMedicineToRx={addMedicineToRx}
                    onRemoveRx={removeRx}
                    onCompleteConsultation={completeConsultation}
                    onGoToQueue={() => setActiveSection('queue')}
                  />
                )}

                {activeSection === 'inventory' && (
                  <InventoryView
                    inventory={inventory}
                    newGeneric={newGeneric}
                    setNewGeneric={setNewGeneric}
                    newBrand={newBrand}
                    setNewBrand={setNewBrand}
                    newQty={newQty}
                    setNewQty={setNewQty}
                    stockUpdates={stockUpdates}
                    setStockUpdates={setStockUpdates}
                    onAddNewProcurement={handleAddNewProcurement}
                    onUpdateStock={handleUpdateStock}
                  />
                )}

                {activeSection === 'analytics' && (
                  <AnalyticsView totalPatientsCount={totalPatientsCount} />
                )}
              </AnimatePresence>
            </main>
          </div>

          <WalkinRegisterModal
            isOpen={showWalkinModal}
            onClose={() => setShowWalkinModal(false)}
            walkinName={walkinName}
            setWalkinName={setWalkinName}
            walkinPhone={walkinPhone}
            setWalkinPhone={setWalkinPhone}
            walkinAge={walkinAge}
            setWalkinAge={setWalkinAge}
            walkinGender={walkinGender}
            setWalkinGender={setWalkinGender}
            onSubmit={handleRegisterWalkin}
          />

          <PrescriptionPrintModal
            isOpen={showPrintModal}
            onClose={() => {
              setShowPrintModal(false);
              setActiveSection('queue');
            }}
            printRecord={printRecord}
            doctorProfile={doctorProfile}
          />
        </motion.div>
      )}

      {!isLoading && isMobile && portalMode === 'dashboard' && (
        <NavigationDock
          activeSection={activeSection}
          isLoggedIn={isLoggedIn}
          navItems={navItems}
          onNavClick={handleNavClick}
        />
      )}

      <DoctorAuthModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setIntendedSection(null);
          setPinInput('');
          setPinError(false);
        }}
        pinInput={pinInput}
        setPinInput={setPinInput}
        pinError={pinError}
        onPinSubmit={handlePinSubmit}
        title={portalMode === 'gateway' ? 'Clinic Gateway Security' : 'Doctor Security Verification'}
        subtitle={
          portalMode === 'gateway'
            ? 'Enter your 4-digit clinic security PIN'
            : 'Enter your 4-digit doctor security PIN'
        }
        buttonText={portalMode === 'gateway' ? 'Unlock Dashboard' : 'Verify & Access'}
      />
    </>
  );
}

export default function HealthSyncSkillUpTheme() {
  return (
    <ClinicProvider>
      <DashboardContent />
    </ClinicProvider>
  );
}
