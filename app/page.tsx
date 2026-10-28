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
  SlidersHorizontal,
  Lock,
} from 'lucide-react';

import { ClinicProvider, useClinic } from '@/context/ClinicContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  fetchQueueFromDb,
  fetchInventoryFromDb,
  registerWalkinPatientDb,
  bookAppointmentSlotDb,
  reallocateSlotDb,
  cancelAppointmentDb,
  rescheduleAppointmentDb,
  rescheduleAppointmentAdvancedDb,
  swapPatientSlotsDb,
  cascadeDoctorDelayDb,
  updateAppointmentStatusDb,
  completeConsultationDb,
  addInventoryItemDb,
  restockInventoryItemDb,
  verifyDoctorPin,
  verifyClinicPin,
  verifyClinicOrDoctorPin,
  getDoctors,
  subscribeToClinicUpdates,
  subscribeToChatUpdates,
  fetchInboundChatThreads,
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
  PatientStatus,
  InventoryItem,
  PrescriptionItem,
  NavSection,
  PortalMode,
  ConfirmedToken,
} from '@/types';
import { DbDoctor } from '@/types/database';

import EcgLoadingScreen from '@/components/loading/EcgLoadingScreen';
import { SideMenu, NavItemConfig } from '@/components/layout/SideMenu';
import { AppHeader } from '@/components/layout/AppHeader';
import { GlobalPatientSearch } from '@/components/common/GlobalPatientSearch';
import { NavigationDock } from '@/components/layout/NavigationDock';
import { DoctorAuthModal } from '@/components/auth/DoctorAuthModal';
import { WalkinRegisterModal } from '@/components/modals/WalkinRegisterModal';
import { PrescriptionPrintModal } from '@/components/modals/PrescriptionPrintModal';
import { NotificationModal, NotificationState } from '@/components/modals/NotificationModal';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import { DoctorChatModal } from '@/components/chat/DoctorChatModal';
import { getReadThreadStates, countUnreadPersons } from '@/lib/chatStorage';
import { validateMobileNumber } from '@/lib/phoneValidation';

import { GatewayScreen } from '@/components/views/GatewayScreen';
import { SlotBookingView } from '@/components/views/SlotBookingView';
import { DashboardView } from '@/components/views/DashboardView';
import { AssistantView } from '@/components/views/AssistantView';
import { ReallocateStrategy } from '@/components/reception/RescheduleModal';
import { QueueView } from '@/components/views/QueueView';
import { ConsultationView } from '@/components/views/ConsultationView';
import { InventoryView } from '@/components/views/InventoryView';
import { AnalyticsView } from '@/components/views/AnalyticsView';
import { SettingsView } from '@/components/views/SettingsView';
import { ToastNotification, ToastMessage, ToastType } from '@/components/ui/ToastNotification';
import { getTodayIST } from '@/lib/utils';

function convertSlotToFutureIso(timeStr: string, dateStr?: string, fallbackDelayMins: number = 20): string {
  if (timeStr && timeStr.includes('T') && timeStr.includes('-')) {
    const d = new Date(timeStr);
    if (d.getTime() > Date.now()) return d.toISOString();
  }

  let hour = 10;
  let minute = 0;
  const match = (timeStr || '').match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (match) {
    hour = parseInt(match[1], 10);
    minute = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  }

  const target = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  target.setHours(hour, minute, 0, 0);

  if (target.getTime() <= Date.now()) {
    if (!dateStr) {
      target.setDate(target.getDate() + 1);
    } else {
      return new Date(Date.now() + fallbackDelayMins * 60000).toISOString();
    }
  }

  return target.toISOString();
}

const INITIAL_QUEUE: Patient[] = [];
const INITIAL_INVENTORY: InventoryItem[] = [];

const sortQueueWithCompletedAtEnd = (patients: Patient[]): Patient[] => {
  const parseFifoOrder = (p: Patient): number => {
    if (typeof p.queueTokenNo === 'number') return p.queueTokenNo;
    const raw = String(p.tokenNumber || p.displayId || '');
    const m = raw.match(/\d+/);
    if (m) return parseInt(m[0], 10);
    if (typeof p.patientNumber === 'number') return p.patientNumber;
    return 999999;
  };

  const inProgress = patients.filter((p) => p.status === 'In Progress');
  const waiting = patients.filter((p) => p.status === 'Waiting');
  const completed = patients.filter((p) => p.status === 'Completed');
  const cancelled = patients.filter((p) => p.status === 'Cancelled');

  waiting.sort((a, b) => {
    if (a.priority === 'Urgent' && b.priority !== 'Urgent') return -1;
    if (b.priority === 'Urgent' && a.priority !== 'Urgent') return 1;
    return parseFifoOrder(a) - parseFifoOrder(b);
  });

  return [...inProgress, ...waiting, ...completed, ...cancelled];
};

function DashboardContent() {
  const { isLoading, config, logoutDoctor } = useClinic();
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

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (type: ToastType, title: string, message?: string, duration: number = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const [availableDoctors, setAvailableDoctors] = useState<DbDoctor[]>([]);
  const [bookName, setBookName] = useState('');
  const [bookPhone, setBookPhone] = useState('');
  const [bookAge, setBookAge] = useState('');
  const [bookGender, setBookGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [bookPriority, setBookPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDate, setBookDate] = useState<string>('');
  const [bookSlotTime, setBookSlotTime] = useState('');
  const [bookReason, setBookReason] = useState('General Consultation');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [confirmedToken, setConfirmedToken] = useState<ConfirmedToken | null>(null);

  // Initialize date client-side to prevent Next.js prerender timing evaluation issues
  useEffect(() => {
    const today = new Date();
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setBookDate(ymd);
  }, []);

  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
    else setIsSidebarOpen(true);
  }, [isMobile]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [intendedSection, setIntendedSection] = useState<NavSection | null>(null);
  const [pendingConsultPatient, setPendingConsultPatient] = useState<Patient | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

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
        setIsLoggedIn(false);
        setDoctorProfile({
          name: clinicSession.name || 'Clinic Assistant',
          title: 'Reception & Triage',
        });
      }
    } else {
      setIsLoggedIn(false);
      setDoctorProfile({
        name: 'Clinic Assistant',
        title: 'Reception & Triage',
      });
      setPortalMode('gateway');
    }
  }, []);

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

  const isDoctorUnlocked = isLoggedIn || !config.require_doctor_pin;
  const effectiveDoctorProfile = React.useMemo(() => {
    if (isLoggedIn) return doctorProfile;
    if (!config.require_doctor_pin) {
      if (availableDoctors.length > 0) {
        return {
          name: availableDoctors[0].full_name,
          title: availableDoctors[0].specialization || 'General Medicine',
        };
      }
      return {
        name: 'Dr. Sunny',
        title: 'General Medicine',
      };
    }
    return doctorProfile;
  }, [isLoggedIn, config.require_doctor_pin, availableDoctors, doctorProfile]);

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
          setQueue(sortQueueWithCompletedAtEnd(dbQueue || []));
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

  const [searchQuery, setSearchQuery] = useState('');

  const [notification, setNotification] = useState<NotificationState | null>(null);

  const showNotification = (notif: Omit<NotificationState, 'isOpen'>) => {
    setNotification({ ...notif, isOpen: true });
  };

  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [isWalkinSubmitting, setIsWalkinSubmitting] = useState(false);
  const [walkinName, setWalkinName] = useState('');
  const [walkinAge, setWalkinAge] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinGender, setWalkinGender] = useState<'Male' | 'Female' | 'Other'>('Male');

  const [newGeneric, setNewGeneric] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newQty, setNewQty] = useState('');
  const [stockUpdates, setStockUpdates] = useState<Record<string, string>>({});

  const [selectedMedId, setSelectedMedId] = useState('');
  const [rxQty, setRxQty] = useState('');

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printRecord, setPrintRecord] = useState<{
    date: string;
    patientName: string;
    patientPhone?: string;
    demographics: string;
    diagnostics: string;
    items: PrescriptionItem[];
  } | null>(null);

  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // Real-time WhatsApp unread count tracking for floating button
  useEffect(() => {
    const updateUnread = async () => {
      try {
        const threads = await fetchInboundChatThreads();
        const readStates = getReadThreadStates();
        const unreadPersons = countUnreadPersons(threads, readStates);
        setChatUnreadCount(unreadPersons);
      } catch { }
    };

    updateUnread();
    const unsub = subscribeToChatUpdates(() => {
      updateUnread();
    });

    const onReadChange = () => {
      updateUnread();
    };
    window.addEventListener('healthsync_chat_read_change', onReadChange);

    return () => {
      unsub();
      window.removeEventListener('healthsync_chat_read_change', onReadChange);
    };
  }, []);

  const navItems: NavItemConfig[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, reqAuth: false },
    { id: 'assistant', label: 'Assistant Desk', icon: ClipboardList, reqAuth: false },
    { id: 'queue', label: 'Doctor Queue', icon: Users, reqAuth: true },
    { id: 'consult', label: 'Consultation', icon: Stethoscope, reqAuth: true },
    { id: 'inventory', label: 'Pharmacy Stock', icon: Boxes, reqAuth: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, reqAuth: true },
    { id: 'settings', label: 'Settings', icon: SlidersHorizontal, reqAuth: true },
  ];

  const handleNavClick = (section: NavSection, reqAuth: boolean) => {
    if (reqAuth && !isLoggedIn && config.require_doctor_pin) {
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

    if (portalMode === 'gateway') {
      const clinicRes = await verifyClinicPin(clean);
      if (clinicRes.success) {
        saveClinicSessionLocal({
          role: 'assistant',
          name: 'Clinic Assistant',
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        });

        clearDoctorSessionLocal();
        setIsLoggedIn(false);
        setDoctorProfile({
          name: 'Clinic Assistant',
          title: 'Reception & Triage',
        });

        setShowPinModal(false);
        setPinError(false);
        setPinInput('');
        setPortalMode('dashboard');
        setActiveSection(intendedSection || 'dashboard');
        setIntendedSection(null);
      } else {
        setPinError(true);
        setTimeout(() => setPinError(false), 2200);
      }
      return;
    }

    const docRes = await verifyDoctorPin(clean);
    if (docRes.success && docRes.doctor) {
      saveDoctorSessionLocal({
        doctorId: docRes.doctor.id,
        name: docRes.doctor.full_name,
        title: docRes.doctor.specialization || 'General Medicine',
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      });

      setIsLoggedIn(true);
      setDoctorProfile({
        name: docRes.doctor.full_name,
        title: docRes.doctor.specialization || 'General Medicine',
      });

      setShowPinModal(false);
      setPinError(false);
      setPinInput('');

      if (pendingConsultPatient) {
        const p = pendingConsultPatient;
        setPendingConsultPatient(null);
        setTimeout(() => {
          handleConsultFromSearch(p);
        }, 100);
      } else {
        const target = intendedSection || 'dashboard';
        setActiveSection(target);
        setIntendedSection(null);
      }
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
    try {
      logoutDoctor();
    } catch { }
    if (['queue', 'consult', 'inventory', 'analytics', 'settings'].includes(activeSection)) {
      setActiveSection('dashboard');
    }
    if (savedDoc?.doctorId) {
      await logoutDoctorSessionDb(savedDoc.doctorId);
    } else {
      await logoutDoctorSessionDb();
    }
  };

  const handleFullLogout = async () => {
    const savedDoc = getDoctorSessionLocal();
    clearClinicSessionLocal();
    clearDoctorSessionLocal();
    setIsLoggedIn(false);
    setDoctorProfile({
      name: 'Clinic Assistant',
      title: 'Reception & Triage',
    });
    setPortalMode('gateway');
    setActiveSection('dashboard');
    try {
      logoutDoctor();
    } catch { }
    if (savedDoc?.doctorId) {
      await logoutDoctorSessionDb(savedDoc.doctorId);
    } else {
      await logoutDoctorSessionDb();
    }
  };

  const handleRegisterWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinName.trim() || !walkinAge) return;

    if (walkinName.trim().length < 2) {
      showNotification({
        type: 'warning',
        title: 'Full Name Required',
        message: 'Patient name must be at least 2 characters long.',
      });
      return;
    }

    const phoneValidation = validateMobileNumber(walkinPhone);
    if (!phoneValidation.isValid) {
      showNotification({
        type: 'warning',
        title: 'Mobile Number Required',
        message: phoneValidation.errorMessage || 'A valid mobile number is mandatory to register a walk-in patient.',
      });
      return;
    }

    const ageNum = parseInt(walkinAge, 10);
    setIsWalkinSubmitting(true);
    try {
      const dbPat = await registerWalkinPatientDb({
        name: walkinName.trim(),
        age: ageNum,
        gender: walkinGender,
        phone: walkinPhone.trim(),
        priority: 'Normal',
      });

      if (dbPat) {
        setQueue((prev) => sortQueueWithCompletedAtEnd([...prev, { ...dbPat, visitType: 'Walk-in' }]));
        fetchQueueFromDb().then((fresh) => {
          if (fresh && fresh.length > 0) {
            setQueue(sortQueueWithCompletedAtEnd(fresh));
          }
        });
        setWalkinName('');
        setWalkinAge('');
        setWalkinPhone('');
        setWalkinGender('Male');
        setShowWalkinModal(false);
      } else {
        showNotification({
          type: 'error',
          title: 'Registration Notice',
          message: 'Could not register walk-in patient. Please ensure patient name has at least 2 characters.',
        });
      }
    } finally {
      setIsWalkinSubmitting(false);
    }
  };

  const handleBookSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName.trim()) return;

    if (bookName.trim().length < 2) {
      showNotification({
        type: 'warning',
        title: 'Full Name Required',
        message: 'Patient name must be at least 2 characters long.',
      });
      return;
    }

    const phoneValidation = validateMobileNumber(bookPhone);
    if (!phoneValidation.isValid) {
      showNotification({
        type: 'warning',
        title: 'Mobile Number Required',
        message: phoneValidation.errorMessage || 'A valid mobile number is mandatory to book an appointment slot.',
      });
      return;
    }

    setIsBookingSubmitting(true);
    try {
      const selectedDoc =
        availableDoctors.find((d) => d.id === bookDoctorId) || availableDoctors[0];
      const docId = selectedDoc?.id || bookDoctorId;
      const docName = selectedDoc?.full_name || doctorProfile.name || 'Dr. Sunny';

      const finalBookingDate =
        bookDate ||
        (() => {
          const today = new Date();
          return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        })();

      const bookingRes = await bookAppointmentSlotDb({
        name: bookName.trim(),
        phone: bookPhone.trim(),
        age: parseInt(bookAge, 10) || 28,
        gender: bookGender,
        priority: bookPriority,
        doctorId: docId,
        date: finalBookingDate,
        slotTime: bookSlotTime,
        reason: bookReason,
      });

      if (!bookingRes.success) {
        const msg = bookingRes.message || 'The selected slot could not be booked. Please choose another available slot.';
        const isQuotaReached = msg.toLowerCase().includes('quota');
        const canSwitchUrgent = msg.toLowerCase().includes('urgent');

        showNotification({
          type: 'warning',
          title: isQuotaReached ? 'Doctor Daily Quota Reached' : 'Slot Booking Notice',
          message: msg,
          actionLabel: canSwitchUrgent ? 'Urgent Priority' : undefined,
          onAction: canSwitchUrgent ? () => setBookPriority('Urgent') : undefined,
        });
        setIsBookingSubmitting(false);
        return;
      }

      const newTokNum = String(
        bookingRes.displayId ||
        bookingRes.tokenNumber ||
        `P${String(queue.length + 1).padStart(3, '0')}`
      );

      const newPatient: Patient = {
        id: bookingRes.appointmentId || `P-${String(Date.now()).slice(-4)}`,
        name: bookName.trim(),
        age: parseInt(bookAge, 10) || 28,
        gender: bookGender,
        phone: bookPhone.trim(),
        status: 'Waiting',
        time: bookSlotTime || 'Now',
        appointmentDate: finalBookingDate,
        tokenNumber: newTokNum,
        queueTokenNo: bookingRes.queueTokenNo,
        displayId: bookingRes.displayId || newTokNum,
        patientNumber: bookingRes.patientNumber,
        priority: bookPriority,
        visitType: 'Online',
      };

      const todayIST = getTodayIST();
      if (finalBookingDate === todayIST) {
        setQueue((prev) => sortQueueWithCompletedAtEnd([...prev, newPatient]));
      }

      fetchQueueFromDb().then((fresh) => {
        if (fresh && fresh.length > 0) {
          setQueue(sortQueueWithCompletedAtEnd(fresh));
        }
      });

      setConfirmedToken({
        tokenNumber: newTokNum,
        name: bookName.trim(),
        time: bookSlotTime,
        date: finalBookingDate,
        phone: bookPhone.trim(),
        doctorName: docName,
        priority: bookPriority,
        channel: 'Online',
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

  const calculateShiftedTimeStr = (baseTimeStr: string, minutes: number) => {
    try {
      const now = new Date();
      const match = baseTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let hour = parseInt(match[1], 10);
        const min = parseInt(match[2], 10);
        const meridiem = match[3].toUpperCase();
        if (meridiem === 'PM' && hour < 12) hour += 12;
        if (meridiem === 'AM' && hour === 12) hour = 0;
        now.setHours(hour, min, 0, 0);
      }
      const shifted = new Date(now.getTime() + minutes * 60000);
      return shifted.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return baseTimeStr;
    }
  };

  const handleCancelAppointment = async (patientId: string, reason: string) => {
    const result = await cancelAppointmentDb(patientId, reason);
    if (result.success) {
      showToast(
        'success',
        'Appointment Cancelled',
        result.freed_slot
          ? `Slot ${result.freed_slot} has been freed immediately.`
          : 'Time slot has been freed for new bookings.'
      );
      const dbQueue = await fetchQueueFromDb();
      if (dbQueue) {
        setQueue(sortQueueWithCompletedAtEnd(dbQueue));
      } else {
        setQueue((prev) =>
          prev.map((p) => {
            if (p.id === patientId) {
              return { ...p, status: 'Cancelled' as PatientStatus, cancellationReason: reason };
            }
            return p;
          })
        );
      }
    } else {
      showToast('error', 'Cancellation Failed', result.error || 'Could not cancel appointment.');
    }
  };

  const handleReschedulePatient = async (params: {
    patientId: string;
    strategy: ReallocateStrategy;
    newSlotTime: string;
    newDate?: string;
    reason: string;
    swapWithPatientId?: string;
    delayMinutes?: number;
    cascadeAll?: boolean;
    setUrgentPriority?: boolean;
  }) => {
    const {
      patientId,
      strategy,
      newSlotTime,
      newDate,
      reason,
      swapWithPatientId,
      delayMinutes = 20,
      cascadeAll = true,
      setUrgentPriority,
    } = params;

    const currentPatient = queue.find((p) => p.id === patientId);

    let targetIso: string | null = null;
    if (strategy === 'custom_slot' || (strategy as string) === 'new_slot') {
      targetIso = convertSlotToFutureIso(newSlotTime, newDate, delayMinutes);
    }

    const result = await rescheduleAppointmentAdvancedDb({
      appointmentId: patientId,
      mode: strategy,
      delayMinutes,
      newTimeIso: targetIso,
      fillPatientId: strategy === 'patient_late' ? (swapWithPatientId || null) : null,
      shiftAllRemaining: cascadeAll !== false,
      notes: reason,
    });

    if (result.success) {
      let toastTitle = 'Appointment Rescheduled';
      if (strategy === 'patient_late') {
        toastTitle = result.swapped_patient ? 'Slot Reallocated & Delayed' : 'Patient Delayed';
      } else if (strategy === 'doctor_delay') {
        toastTitle = 'Doctor Delay Applied';
      } else if (strategy === 'emergency_shift') {
        toastTitle = 'Emergency Priority Activated';
      }

      showToast(
        'success',
        toastTitle,
        result.message ||
        (result.new_slot
          ? `${result.patient_name || currentPatient?.name || 'Patient'} moved to ${result.new_slot}`
          : 'Appointment moved successfully!')
      );

      const dbQueue = await fetchQueueFromDb();
      if (dbQueue && dbQueue.length > 0) {
        setQueue(sortQueueWithCompletedAtEnd(dbQueue));
      } else {
        setQueue((prev) =>
          sortQueueWithCompletedAtEnd(
            prev.map((p) => {
              if (p.id === patientId) {
                return {
                  ...p,
                  time: result.new_slot || newSlotTime,
                  priority: setUrgentPriority ? 'Urgent' : p.priority,
                };
              }
              return p;
            })
          )
        );
      }
    } else {
      if (result.errorCode === 'SLOT_TAKEN') {
        showToast(
          'error',
          'Slot Already Booked',
          result.error || 'The requested time slot is already taken. Please choose an open slot.'
        );
      } else if (result.errorCode === 'APPOINTMENT_NOT_FOUND') {
        showToast('error', 'Appointment Not Found', result.error || 'The appointment could not be found.');
      } else {
        showToast('error', 'Reschedule Failed', result.error || 'Could not reschedule appointment.');
      }
      throw new Error(result.error || 'Reschedule failed');
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

  const handleConsultFromSearch = async (patient: Patient) => {
    if (config.require_doctor_pin && !isLoggedIn) {
      setPendingConsultPatient(patient);
      setIntendedSection('consult');
      setShowPinModal(true);
      return;
    }

    const inQueue = queue.find((p) => p.id === patient.id);
    if (inQueue) {
      await startConsultation(patient.id);
    } else {
      const activeP: Patient = {
        ...patient,
        status: 'In Progress',
        time: patient.time || 'Walk-in Today',
      };
      setQueue((prev) => [activeP, ...prev.filter((p) => p.id !== patient.id)]);
      setActivePatient(activeP);
      setCurrentPrescription([]);
      setDiagnosticNotes('');
      setSelectedMedId('');
      setRxQty('');
      try {
        await updateAppointmentStatusDb(patient.id, 'In Progress');
      } catch (e) {
        console.warn('Could not update appointment status in DB:', e);
      }
      setActiveSection('consult');
    }
  };

  const addMedicineToRx = () => {
    if (!selectedMedId || !rxQty) return;
    const qtyNum = parseInt(rxQty, 10);
    if (qtyNum <= 0) return;

    const med = inventory.find((m) => String(m.id) === String(selectedMedId));
    if (!med) return;

    if (qtyNum > med.stock) {
      showNotification({
        type: 'warning',
        title: 'Pharmacy Stock Notice',
        message: `Only ${med.stock} units available in pharmacy for ${med.brand || med.generic || 'this medicine'}.`,
      });
      return;
    }

    const existing = currentPrescription.find((p) => String(p.med.id) === String(med.id));
    if (existing) {
      if (existing.qty + qtyNum > med.stock) {
        showNotification({
          type: 'warning',
          title: 'Stock Exceeded',
          message: `Combined prescription total exceeds available stock of ${med.stock} units.`,
        });
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
      sortQueueWithCompletedAtEnd(
        prevQueue.map((p) => (p.id === activePatient.id ? { ...p, status: 'Completed' } : p))
      )
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

  const filteredQueue = React.useMemo(() => {
    const list = queue.filter(
      (p) =>
        p.status !== 'Cancelled' &&
        (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.id.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return sortQueueWithCompletedAtEnd(list);
  }, [queue, searchQuery]);

  const totalPatientsCount = queue.filter((p) => p.status !== 'Cancelled').length;
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
              if (config.require_doctor_pin) {
                setIntendedSection('dashboard');
                setPinInput('');
                setPinError(false);
                setShowPinModal(true);
              } else {
                setPortalMode('dashboard');
                setActiveSection('dashboard');
              }
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
          bookDate={bookDate}
          setBookDate={setBookDate}
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
            if (config.require_doctor_pin) {
              setIntendedSection('dashboard');
              setPinInput('');
              setPinError(false);
              setShowPinModal(true);
            } else {
              setPortalMode('dashboard');
              setActiveSection('dashboard');
            }
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
              isLoggedIn={isDoctorUnlocked}
              doctorProfile={effectiveDoctorProfile}
              navItems={navItems}
              onNavClick={handleNavClick}
              onOpenPinModal={() => {
                setIntendedSection('queue');
                setShowPinModal(true);
              }}
              onLogout={handleLockDoctorSession}
              onFullLogout={handleFullLogout}
              requireDoctorPin={config.require_doctor_pin}
            />
          )}

          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300">
            <AppHeader
              isMobile={isMobile}
              activeSection={activeSection}
              activeSectionLabel={activeSectionLabel}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isLoggedIn={isDoctorUnlocked}
              doctorProfile={effectiveDoctorProfile}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              onBackToGateway={handleFullLogout}
              onOpenPinModal={() => {
                setIntendedSection('queue');
                setShowPinModal(true);
              }}
              onLogout={handleLockDoctorSession}
              requireDoctorPin={config.require_doctor_pin}
              queue={queue}
              onSelectConsult={handleConsultFromSearch}
            />

            <main
              className={`flex-1 overflow-y-auto no-print ${isMobile ? 'px-3.5 sm:px-6 pt-3 pb-28' : 'px-4 sm:px-6 lg:px-8 xl:px-10 pt-4 sm:pt-6 pb-12'
                }`}
            >
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.45 }}
                className={`flex items-center mb-6 sm:mb-8 min-w-0 ${isMobile ? 'space-x-3' : 'space-x-4'}`}
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
                <div className="min-w-0 flex-1">
                  <motion.h1
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className={`font-bold text-[#16191E] leading-snug truncate ${isMobile ? 'text-base' : 'text-xl'}`}
                  >
                    Welcome Back {isDoctorUnlocked ? effectiveDoctorProfile.name : 'Jack (Assistant)'}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.28 }}
                    className="text-xs text-[#8A909D] font-medium truncate"
                  >
                    {isDoctorUnlocked
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
                  <GlobalPatientSearch
                    isMobile
                    queue={queue}
                    onSelectConsult={handleConsultFromSearch}
                    placeholder="Search patient, phone, age, gender (e.g. Menon, 90000, 20-50)..."
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
                    bookDate={bookDate}
                    setBookDate={setBookDate}
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
                    queue={queue.filter((p) => p.status !== 'Cancelled')}
                    isLoggedIn={isDoctorUnlocked}
                    onRegisterWalkin={() => setShowWalkinModal(true)}
                    onViewAllQueue={() => setActiveSection('assistant')}
                    onReallocate={handleReallocate}
                    onCancelAppointment={handleCancelAppointment}
                    onReschedulePatient={handleReschedulePatient}
                    onStartConsultation={startConsultation}
                    onRequireLogin={() => {
                      if (config.require_doctor_pin) {
                        setIntendedSection('queue');
                        setShowPinModal(true);
                      } else {
                        setActiveSection('queue');
                      }
                    }}
                  />
                )}

                {activeSection === 'assistant' && (
                  <AssistantView
                    queue={queue}
                    onRegisterWalkin={() => setShowWalkinModal(true)}
                    onReallocate={handleReallocate}
                    onCancelAppointment={handleCancelAppointment}
                    onReschedulePatient={handleReschedulePatient}
                    onStartConsultation={startConsultation}
                  />
                )}

                {activeSection === 'queue' && (
                  <QueueView
                    queue={queue.filter(
                      (p) =>
                        p.status !== 'Cancelled' &&
                        (!p.appointmentDate || p.appointmentDate === getTodayIST())
                    )}
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
                  <AnalyticsView
                    totalPatientsCount={totalPatientsCount}
                    queue={queue}
                    cancelledAppointments={queue.filter((p) => p.status === 'Cancelled')}
                  />
                )}

                {activeSection === 'settings' && (
                  isDoctorUnlocked ? (
                    <SettingsView isMobile={isMobile} onLogout={handleFullLogout} />
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
                        <Lock className="w-8 h-8 stroke-[2]" />
                      </div>
                      <h3 className="text-lg font-bold text-[#16191E] mb-1">Doctor Verification Required</h3>
                      <p className="text-xs text-[#8A909D] max-w-sm mb-6 leading-relaxed">
                        System configuration, daily doctor quotas, WhatsApp automation, and pharmacy safeguards require Doctor Authentication.
                      </p>
                      <button
                        onClick={() => {
                          setIntendedSection('settings');
                          setShowPinModal(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center space-x-2"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Unlock with Doctor PIN</span>
                      </button>
                    </motion.div>
                  )
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
          isLoggedIn={isDoctorUnlocked}
          requireDoctorPin={config.require_doctor_pin}
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
            ? 'Enter clinic security PIN to access dashboard'
            : 'Enter doctor security PIN to unlock access'
        }
        buttonText={portalMode === 'gateway' ? 'Unlock Dashboard' : 'Verify & Access'}
      />

      <NotificationModal
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {!isLoading && portalMode === 'dashboard' && (
        <>
          <FloatingChatButton
            isOpen={isChatModalOpen}
            unreadCount={chatUnreadCount}
            onToggle={() => setIsChatModalOpen((prev) => !prev)}
          />
          <DoctorChatModal
            isOpen={isChatModalOpen}
            onClose={() => setIsChatModalOpen(false)}
            availableDoctors={availableDoctors}
            currentDoctorName={effectiveDoctorProfile.name}
            onBookingSuccess={() => {
              fetchQueueFromDb().then((dbQueue) => {
                if (dbQueue) {
                  setQueue(sortQueueWithCompletedAtEnd(dbQueue));
                }
              });
            }}
          />
        </>
      )}

      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
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
