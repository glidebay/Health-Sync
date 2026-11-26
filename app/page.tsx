'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Table,
  Users,
  ClipboardList,
  Stethoscope,
  Boxes,
  BarChart3,
  Search,
  SlidersHorizontal,
  Lock,
  UserCog,
  ShieldAlert,
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
  fetchClinicLocations,
  subscribeToClinicUpdates,
  subscribeToChatUpdates,
  fetchInboundChatThreads,
  saveDoctorSessionLocal,
  getDoctorSessionLocal,
  clearDoctorSessionLocal,
  saveClinicSessionLocal,
  getClinicSessionLocal,
  clearClinicSessionLocal,
  clearDoctorsCacheLocal,
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
import { DbDoctor, DbClinicLocation } from '@/types/database';

import EcgLoadingScreen from '@/components/loading/EcgLoadingScreen';
import { EcgActionLoader } from '@/components/loading/EcgActionLoader';
import { SideMenu, NavItemConfig } from '@/components/layout/SideMenu';
import { AppHeader } from '@/components/layout/AppHeader';
import { GlobalPatientSearch } from '@/components/common/GlobalPatientSearch';
import { GlobalAnalyticsSearch } from '@/components/common/GlobalAnalyticsSearch';
import { NavigationDock } from '@/components/layout/NavigationDock';
import { DoctorAuthModal } from '@/components/auth/DoctorAuthModal';
import { WalkinRegisterModal } from '@/components/modals/WalkinRegisterModal';
import { DoctorProfileEditModal } from '@/components/modals/DoctorProfileEditModal';
import { PrescriptionPrintModal, type PrescriptionPrintRecord } from '@/components/modals/PrescriptionPrintModal';
import { NotificationModal, NotificationState } from '@/components/modals/NotificationModal';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import { DoctorChatModal } from '@/components/chat/DoctorChatModal';
import { getReadThreadStates, countUnreadPersons } from '@/lib/chatStorage';
import { validateMobileNumber } from '@/lib/phoneValidation';

import { GatewayScreen, type GatewayPinSubmitPayload } from '@/components/views/GatewayScreen';
import { SlotBookingView } from '@/components/views/SlotBookingView';
import { DashboardView } from '@/components/views/DashboardView';
import { TablesView } from '@/components/views/TablesView';
import { AssistantView } from '@/components/views/AssistantView';
import { ReallocateStrategy } from '@/components/reception/RescheduleModal';
import { QueueView } from '@/components/views/QueueView';
import { ConsultationView } from '@/components/views/ConsultationView';
import { InventoryView } from '@/components/views/InventoryView';
import { dispenseFefo, fetchMedicinesMaster, convertMasterToInventoryItems } from '@/lib/medicineService';
import { AnalyticsView } from '@/components/views/AnalyticsView';
import { SettingsView } from '@/components/views/SettingsView';
import { DoctorManagementSettings } from '@/components/settings/DoctorManagementSettings';
import { verifyBranchGatewayLogin, verifyBranchDoctorPin, validateAccessPin } from '@/lib/doctorService';
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
  const { isLoading, config, refreshConfig, logoutDoctor } = useClinic();
  const isMobile = useIsMobile();
  const [portalMode, setPortalMode] = useState<PortalMode>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode') || urlParams.get('view');
      if (modeParam === 'booking' || modeParam === 'book') return 'booking';

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
  const [pinErrorMessage, setPinErrorMessage] = useState('');
  const [clinicLocations, setClinicLocations] = useState<DbClinicLocation[]>([]);
  const [currentLocation, setCurrentLocation] = useState<DbClinicLocation | null>(null);
  const currentLocationRef = useRef<DbClinicLocation | null>(null);
  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  const [switchingBranch, setSwitchingBranch] = useState<{
    branchName: string;
    branchCode?: string;
  } | null>(null);

  const [currentClinicId, setCurrentClinicId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('healthsync_active_clinic_id') || null;
    }
    return null;
  });

  const [isDoctorAdmin, setIsDoctorAdmin] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const doc = getDoctorSessionLocal();
      if (doc?.isAdmin) return true;
      if (doc?.doctorId === '7ff87d97-4c12-42c3-b1b3-44a7a5933a83' || doc?.doctorId === 'defefb30-c455-45e6-b524-d1bbe65bb696') return true;
    }
    return false;
  });

  const [adminPin, setAdminPin] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('healthsync_admin_pin') || '';
    }
    return '';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode') || urlParams.get('view');
      if (modeParam === 'booking' || modeParam === 'book') {
        setPortalMode('booking');
        return;
      }
    }
    const clinicSession = getClinicSessionLocal();
    const docSession = getDoctorSessionLocal();
    if (clinicSession || docSession) {
      setPortalMode('dashboard');
      if (docSession) {
        setIsLoggedIn(true);
        if (docSession.clinicId) setCurrentClinicId(docSession.clinicId);
        const adminFlag = Boolean(docSession.isAdmin || docSession.doctorId === '7ff87d97-4c12-42c3-b1b3-44a7a5933a83' || docSession.doctorId === 'defefb30-c455-45e6-b524-d1bbe65bb696');
        setIsDoctorAdmin(adminFlag);
        setDoctorProfile({
          name: docSession.name,
          title: docSession.title,
        });
      } else if (clinicSession) {
        setIsLoggedIn(false);
        setIsDoctorAdmin(false);
        if (clinicSession.clinicId) setCurrentClinicId(clinicSession.clinicId);
        setDoctorProfile({
          name: clinicSession.name || 'Clinic Assistant',
          title: 'Reception & Triage',
        });
      }
    } else {
      setIsLoggedIn(false);
      setIsDoctorAdmin(false);
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

  const [queue, setQueue] = useState<Patient[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isDashboardSyncing, setIsDashboardSyncing] = useState(false);
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
    if (isLoggedIn) {
      const doc = availableDoctors.find((d) => d.full_name === doctorProfile.name);
      return { ...doctorProfile, regNo: (doc as any)?.reg_no || 'KMC-45892' };
    }
    if (!config.require_doctor_pin) {
      if (availableDoctors.length > 0) {
        return {
          name: availableDoctors[0].full_name,
          title: availableDoctors[0].specialization || 'General Medicine',
          regNo: (availableDoctors[0] as any).reg_no || 'KMC-45892',
        };
      }
      return {
        name: 'Dr. Sunny',
        title: 'General Medicine',
        regNo: 'KMC-45892',
      };
    }
    return { ...doctorProfile, regNo: 'KMC-45892' };
  }, [isLoggedIn, config.require_doctor_pin, availableDoctors, doctorProfile]);

  const handleQueueUpdated = useCallback((updatedPatients: Patient[]) => {
    setQueue((prevQueue) => {
      if (
        prevQueue.length === updatedPatients.length &&
        prevQueue.every((p, i) => p.id === updatedPatients[i]?.id && p.status === updatedPatients[i]?.status)
      ) {
        return prevQueue;
      }
      return sortQueueWithCompletedAtEnd(updatedPatients);
    });
  }, []);

  const syncQueueOnly = useCallback(async () => {
    try {
      const loc = currentLocationRef.current;
      const locId = loc?.id;
      const activeClinic =
        currentClinicId ||
        loc?.clinic_id ||
        (typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_clinic_id') : null) ||
        undefined;
      const dbQueue = await fetchQueueFromDb(undefined, undefined, locId, activeClinic);
      if (dbQueue && Array.isArray(dbQueue)) {
        setQueue(sortQueueWithCompletedAtEnd(dbQueue));
      }
    } catch (err) {
      console.warn('Queue live sync error:', err);
    }
  }, [currentClinicId]);

  const syncBranchSessionData = useCallback(
    async (targetClinicId?: string, targetLocationId?: string, adminFlag: boolean = false) => {
      setIsDashboardSyncing(true);
      setQueue([]);
      setInventory([]);
      const startTime = Date.now();
      try {
        const [dbQueue, dbInventory, dbDoctors] = await Promise.all([
          fetchQueueFromDb(undefined, undefined, targetLocationId, targetClinicId),
          fetchInventoryFromDb(targetClinicId, targetLocationId),
          getDoctors(targetClinicId, adminFlag ? undefined : targetLocationId),
          refreshConfig(targetClinicId, targetLocationId),
        ]);

        if (dbQueue && Array.isArray(dbQueue)) {
          setQueue(sortQueueWithCompletedAtEnd(dbQueue));
        }
        setInventory(Array.isArray(dbInventory) ? dbInventory : []);
        if (dbDoctors && dbDoctors.length > 0) {
          setAvailableDoctors(dbDoctors);
          setBookDoctorId((prev) => (dbDoctors.some((d) => d.id === prev) ? prev : dbDoctors[0].id));
          setWalkinDoctorId((prev) => (dbDoctors.some((d) => d.id === prev) ? prev : dbDoctors[0].id));
        } else {
          setAvailableDoctors([]);
        }
        setIsDbSynced(true);
        const elapsed = Date.now() - startTime;
        if (elapsed < 350) {
          await new Promise((r) => setTimeout(r, 350 - elapsed));
        }
      } catch (err) {
        console.warn('Branch session sync error:', err);
      } finally {
        setIsDashboardSyncing(false);
      }
    },
    []
  );

  const syncClinicData = useCallback(async (silent: boolean = true) => {
    try {
      const loc = currentLocationRef.current;
      const activeClinic =
        currentClinicId ||
        loc?.clinic_id ||
        (typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_clinic_id') : null) ||
        undefined;
      const locId = loc?.id;
      const [dbQueue, dbInventory, dbDoctors, locs] = await Promise.all([
        fetchQueueFromDb(undefined, undefined, locId, activeClinic),
        fetchInventoryFromDb(activeClinic, locId),
        getDoctors(activeClinic, isDoctorAdmin ? undefined : locId),
        fetchClinicLocations(activeClinic),
      ]);

      if (locs && locs.length > 0) {
        setClinicLocations(locs);
        if (!currentLocationRef.current || !locs.find((l) => l.id === currentLocationRef.current?.id)) {
          const stored = typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_location_id') : null;
          const matched = locs.find((l) => l.id === stored) || locs[0];
          setCurrentLocation(matched);
          currentLocationRef.current = matched;
          if (typeof window !== 'undefined' && matched) {
            localStorage.setItem('healthsync_active_location_id', matched.id);
          }
        }
      }

      if (dbQueue) {
        setQueue(sortQueueWithCompletedAtEnd(dbQueue));
      }
      setInventory(Array.isArray(dbInventory) ? dbInventory : []);
      if (dbDoctors && dbDoctors.length > 0) {
        setAvailableDoctors(dbDoctors);
        setBookDoctorId((prev) => prev || dbDoctors[0].id);
      }
      setIsDbSynced(true);
    } catch (err) {
      if (!silent) console.warn('Failed to sync Supabase data:', err);
    }
  }, [currentClinicId]);

  const handleSelectLocation = useCallback(async (loc: DbClinicLocation) => {
    if (currentLocationRef.current?.id === loc.id) {
      return;
    }

    setSwitchingBranch({
      branchName: loc.branch_name,
      branchCode: loc.branch_code || undefined,
    });

    const activeClinic = loc.clinic_id || currentClinicId || undefined;
    if (loc.clinic_id && loc.clinic_id !== currentClinicId) {
      setCurrentClinicId(loc.clinic_id);
    }
    setCurrentLocation(loc);
    currentLocationRef.current = loc;

    if (typeof window !== 'undefined') {
      localStorage.setItem('healthsync_active_location_id', loc.id);
      if (activeClinic) {
        localStorage.setItem('healthsync_active_clinic_id', activeClinic);
      }
    }

    const startTime = Date.now();

    try {
      await Promise.all([
        fetchQueueFromDb(undefined, undefined, loc.id, activeClinic).then((fresh) => {
          if (fresh && Array.isArray(fresh)) {
            setQueue(sortQueueWithCompletedAtEnd(fresh));
          }
        }),
        fetchInventoryFromDb(activeClinic, loc.id).then((freshInv) => {
          if (freshInv && freshInv.length > 0) {
            setInventory(freshInv);
          } else {
            setInventory([]);
          }
        }),
        getDoctors(activeClinic, isDoctorAdmin ? undefined : loc.id).then((freshDocs) => {
          if (freshDocs && freshDocs.length > 0) {
            setAvailableDoctors(freshDocs);
            setBookDoctorId((prev) => (freshDocs.some((d) => d.id === prev) ? prev : freshDocs[0].id));
            setWalkinDoctorId((prev) => (freshDocs.some((d) => d.id === prev) ? prev : freshDocs[0].id));
          }
        }),
        refreshConfig(activeClinic, loc.id),
      ]);

      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
      }
    } catch (err) {
      console.warn('Failed to sync data while switching branch:', err);
    } finally {
      setSwitchingBranch(null);
    }
  }, [currentClinicId]);

  useEffect(() => {
    let isMounted = true;

    async function initialLoad() {
      try {
        const storedLoc = typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_location_id') : null;
        const storedClinic = typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_clinic_id') : null;
        const [dbQueue, dbInventory, dbDoctors, locs] = await Promise.all([
          fetchQueueFromDb(undefined, undefined, storedLoc || undefined, storedClinic || undefined),
          fetchInventoryFromDb(storedClinic || undefined, storedLoc || undefined),
          getDoctors(storedClinic || undefined, storedLoc || undefined),
          fetchClinicLocations(storedClinic || undefined),
        ]);

        if (isMounted) {
          if (locs && locs.length > 0) {
            setClinicLocations(locs);
            const matched = locs.find((l) => l.id === storedLoc) || locs[0];
            setCurrentLocation(matched);
            const activeClinic = matched?.clinic_id || storedClinic;
            if (activeClinic && activeClinic !== currentClinicId) {
              setCurrentClinicId(activeClinic);
            }
            if (matched) {
              getDoctors(activeClinic || undefined, isDoctorAdmin ? undefined : matched.id).then((branchDocs) => {
                if (isMounted && branchDocs && branchDocs.length > 0) {
                  setAvailableDoctors(branchDocs);
                  setBookDoctorId((prev) => (branchDocs.some((d) => d.id === prev) ? prev : branchDocs[0].id));
                  setWalkinDoctorId((prev) => (branchDocs.some((d) => d.id === prev) ? prev : branchDocs[0].id));
                }
              });
            }
          }
          if (dbQueue) {
            setQueue(sortQueueWithCompletedAtEnd(dbQueue));
          }
          setInventory(Array.isArray(dbInventory) ? dbInventory : []);
          if (dbDoctors && dbDoctors.length > 0) {
            setAvailableDoctors(dbDoctors);
            setBookDoctorId((prev) => prev || dbDoctors[0].id);
          }

          const savedDoctorSession = getDoctorSessionLocal();
          const savedClinicSession = getClinicSessionLocal();

          if (savedDoctorSession) {
            const matched = dbDoctors?.find((d) => d.id === savedDoctorSession.doctorId);
            if (matched) {
              setDoctorProfile({
                name: matched.full_name,
                title: matched.specialization || 'General Medicine',
              });
              setIsLoggedIn(true);
              setIsDoctorAdmin(Boolean(savedDoctorSession.isAdmin || matched.is_admin_doctor));
              setPortalMode('dashboard');
            } else if (savedDoctorSession.isAdmin || savedDoctorSession.doctorId === 'admin') {
              setDoctorProfile({
                name: savedDoctorSession.name || 'Clinic Admin',
                title: savedDoctorSession.title || 'Admin',
              });
              setIsLoggedIn(true);
              setIsDoctorAdmin(true);
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
          setIsDbSynced(true);
        }
      } catch (err) {
        console.warn('Failed to load initial Supabase data:', err);
      }
    }

    initialLoad();

    // Supabase Realtime WebSocket listener (instant updates, zero continuous polling)
    const unsubscribe = subscribeToClinicUpdates(() => {
      syncQueueOnly();
    });

    let lastFocusSync = 0;
    const handleVisibilityOrFocus = () => {
      const now = Date.now();
      // Throttle window focus refetch to at most once every 5 seconds
      if (now - lastFocusSync > 5000) {
        lastFocusSync = now;
        syncQueueOnly();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      isMounted = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');

  const [notification, setNotification] = useState<NotificationState | null>(null);

  const showNotification = (notif: Omit<NotificationState, 'isOpen'>) => {
    setNotification({ ...notif, isOpen: true });
  };

  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [showDoctorEditModal, setShowDoctorEditModal] = useState(false);

  // Ensure latest doctor roster is available whenever the walk-in registration modal opens
  useEffect(() => {
    if (showWalkinModal) {
      const activeClinic = currentClinicId || currentLocation?.clinic_id;
      if (activeClinic) {
        getDoctors(activeClinic, isDoctorAdmin ? undefined : currentLocation?.id).then((freshDocs) => {
          if (freshDocs && freshDocs.length > 0) {
            setAvailableDoctors(freshDocs);
          }
        });
      }
    }
  }, [showWalkinModal, currentClinicId, currentLocation?.clinic_id, currentLocation?.id, isDoctorAdmin]);
  const [isWalkinSubmitting, setIsWalkinSubmitting] = useState(false);
  const [walkinDoctorId, setWalkinDoctorId] = useState('');
  const [walkinName, setWalkinName] = useState('');
  const [walkinAge, setWalkinAge] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinGender, setWalkinGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [walkinPriority, setWalkinPriority] = useState<'Normal' | 'Urgent'>('Normal');

  const [newGeneric, setNewGeneric] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newQty, setNewQty] = useState('');
  const [stockUpdates, setStockUpdates] = useState<Record<string, string>>({});

  const [selectedMedId, setSelectedMedId] = useState('');
  const [rxQty, setRxQty] = useState('');
  const [rxDosage, setRxDosage] = useState('');

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [returnToQueueOnPrintClose, setReturnToQueueOnPrintClose] = useState(false);
  const [printRecord, setPrintRecord] = useState<PrescriptionPrintRecord | null>(null);

  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

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

  const allNavItems: NavItemConfig[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, reqAuth: false },
    { id: 'assistant', label: 'Assistant Desk', icon: ClipboardList, reqAuth: false },
    { id: 'queue', label: 'Doctor Queue', icon: Users, reqAuth: true },
    { id: 'consult', label: 'Consultation', icon: Stethoscope, reqAuth: true },
    { id: 'inventory', label: 'Pharmacy Stock', icon: Boxes, reqAuth: true },
    { id: 'tables', label: 'Visit Logs', icon: Table, reqAuth: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, reqAuth: true },
    {
      id: 'admin_doctors',
      label: 'Doctor Management',
      icon: Stethoscope,
      reqAuth: true,
      badge: isDoctorAdmin ? 'Admin' : undefined,
      description: 'Clinic & Branch Assignments, Quotas, PINs',
    },
    { id: 'settings', label: 'Settings', icon: SlidersHorizontal, reqAuth: true },
  ];

  const navItems = React.useMemo(() => {
    return allNavItems.filter((item) => {
      // Allow both Clinic Admin and unlocked Branch Doctors to access Settings & Doctor Management
      if (item.id === 'settings' || item.id === 'admin_doctors') {
        return isDoctorAdmin || isDoctorUnlocked;
      }
      return true;
    });
  }, [isDoctorAdmin, isDoctorUnlocked]);

  const handleNavClick = (section: NavSection, reqAuth: boolean) => {
    if (reqAuth && !isLoggedIn && config.require_doctor_pin) {
      setIntendedSection(section);
      setPinErrorMessage('');
      setShowPinModal(true);
      return;
    }
    setSearchQuery('');
    setActiveSection(section);
  };

  const handlePinSubmit = async () => {
    const clean = pinInput.trim();
    if (!clean) {
      setPinError(true);
      setPinErrorMessage('Please enter a PIN');
      return;
    }

    // 1. Primary: Validate via unified access_pins table RPC
    const pinRes = await validateAccessPin(clean);
    if (pinRes.success && pinRes.clinic_id) {
      const clinicId = pinRes.clinic_id;
      const clinicName = pinRes.clinic_name || 'Clinic';
      const locationId = pinRes.location_id || undefined;
      const doctorId = pinRes.doctor_id || undefined;
      const isDoctor = Boolean(pinRes.has_doctor && doctorId);
      const isDocAdmin = Boolean(pinRes.is_admin_doctor);
      const isAdmin = isDocAdmin || (!pinRes.has_branch && !pinRes.has_doctor);

      if (isDoctor) {
        saveDoctorSessionLocal({
          doctorId: doctorId!,
          name: pinRes.doctor_name || 'Doctor',
          title: isDocAdmin ? 'Admin' : 'Consultant',
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
          clinicId,
          clinicName,
          isAdmin: isDocAdmin,
        });
        setIsLoggedIn(true);
        setIsDoctorAdmin(isDocAdmin);
        if (isDocAdmin) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('healthsync_admin_pin', clean);
          }
          setAdminPin(clean);
        }
        setDoctorProfile({
          name: pinRes.doctor_name || 'Doctor',
          title: isDocAdmin ? 'Admin' : 'Consultant',
        });
      } else if (isAdmin) {
        saveDoctorSessionLocal({
          doctorId: 'admin',
          name: `${clinicName} Admin`,
          title: 'Admin',
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
          clinicId,
          clinicName,
          isAdmin: true,
        });
        setIsLoggedIn(true);
        setIsDoctorAdmin(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('healthsync_admin_pin', clean);
        }
        setAdminPin(clean);
        setDoctorProfile({
          name: `${clinicName} Admin`,
          title: 'Administrator',
        });
      } else {
        // Inside Dashboard "Unlock Doctor" modal: NEVER allow a Reception PIN to close the modal and enter locked clinical tabs
        if (portalMode !== 'gateway') {
          setPinError(true);
          setPinErrorMessage('Reception PIN cannot unlock Doctor views. Please enter a Doctor or Clinic Admin PIN.');
          showToast('error', 'Doctor PIN Required', 'Please enter a Doctor or Clinic Admin PIN to unlock clinical access.');
          setTimeout(() => setPinError(false), 2500);
          return;
        }
        saveClinicSessionLocal({
          role: 'assistant',
          name: pinRes.branch_name ? `${pinRes.branch_name} Reception` : 'Clinic Reception',
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
          clinicId,
          clinicName,
          locationId,
          isAdmin: false,
        });
        clearDoctorSessionLocal();
        setIsLoggedIn(false);
        setIsDoctorAdmin(false);
        setDoctorProfile({
          name: pinRes.branch_name ? `${pinRes.branch_name} Reception` : 'Clinic Reception',
          title: 'Reception & Triage',
        });
      }

      setCurrentClinicId(clinicId);
      const freshLocs = await fetchClinicLocations(clinicId);
      setClinicLocations(freshLocs);
      const keepActiveBranch =
        portalMode !== 'gateway' &&
        !locationId &&
        currentLocation?.id &&
        freshLocs.find((l) => l.id === currentLocation.id);
      const matched =
        (locationId && freshLocs.find((l) => l.id === locationId)) ||
        keepActiveBranch ||
        freshLocs[0];
      if (matched) {
        setCurrentLocation(matched);
        if (typeof window !== 'undefined') {
          localStorage.setItem('healthsync_active_location_id', matched.id);
          localStorage.setItem('healthsync_active_clinic_id', clinicId);
        }
      }

      const freshDocs = await getDoctors(clinicId, isAdmin ? undefined : (matched?.id || locationId));
      if (freshDocs && freshDocs.length > 0) {
        setAvailableDoctors(freshDocs);
        setBookDoctorId((prev) => (freshDocs.some((d) => d.id === prev) ? prev : freshDocs[0].id));
        setWalkinDoctorId((prev) => (freshDocs.some((d) => d.id === prev) ? prev : freshDocs[0].id));
      }

      setShowPinModal(false);
      setPinError(false);
      setPinErrorMessage('');
      setPinInput('');
      setPortalMode('dashboard');
      setActiveSection(intendedSection || 'dashboard');
      setIntendedSection(null);
      showToast('success', 'Access Granted', pinRes.label || 'Authenticated successfully');
      void syncBranchSessionData(clinicId, matched?.id || locationId, isAdmin);
      return;
    }

    if (portalMode === 'gateway') {
      const branchRes = await verifyBranchGatewayLogin(clean);
      if (branchRes.success && branchRes.branch_id) {
        const clinicId = branchRes.clinic_id || '9e8b98f5-e268-4b11-8ca1-ec1ce83292ea';
        const clinicName = branchRes.clinic_name || 'Clinic';
        const locationId = branchRes.branch_id;

        saveClinicSessionLocal({
          role: 'assistant',
          name: branchRes.branch_name ? `${branchRes.branch_name} Assistant` : 'Clinic Assistant',
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
          clinicId,
          clinicName,
          locationId,
          isAdmin: false,
        });

        clearDoctorSessionLocal();
        setIsLoggedIn(false);
        setIsDoctorAdmin(false);
        setCurrentClinicId(clinicId);

        const freshLocs = await fetchClinicLocations(clinicId);
        setClinicLocations(freshLocs);
        const matched = freshLocs.find((l) => l.id === locationId) || freshLocs[0];
        if (matched) {
          setCurrentLocation(matched);
          if (typeof window !== 'undefined') {
            localStorage.setItem('healthsync_active_location_id', matched.id);
            localStorage.setItem('healthsync_active_clinic_id', clinicId);
          }
        }

        setDoctorProfile({
          name: branchRes.branch_name ? `${branchRes.branch_name} Assistant` : 'Clinic Assistant',
          title: 'Reception & Triage',
        });

        setShowPinModal(false);
        setPinError(false);
        setPinErrorMessage('');
        setPinInput('');
        setPortalMode('dashboard');
        // When assistant opens with their branch PIN, route directly to Dashboard menu
        setActiveSection(intendedSection || 'dashboard');
        setIntendedSection(null);
        showToast('success', 'Branch Gateway Connected', `Active Location: ${branchRes.branch_name} (${branchRes.branch_code || 'HS'})`);
        void syncBranchSessionData(clinicId, matched?.id || locationId, false);
        return;
      }

      const fallbackDoc = await verifyDoctorPin(clean);
      if (fallbackDoc.success && fallbackDoc.doctor) {
        const docClinicId = fallbackDoc.doctor.clinic_id || '9e8b98f5-e268-4b11-8ca1-ec1ce83292ea';
        const isAdmin = Boolean(fallbackDoc.doctor.is_admin_doctor || fallbackDoc.doctor.is_admin);

        saveDoctorSessionLocal({
          doctorId: fallbackDoc.doctor.id,
          name: fallbackDoc.doctor.full_name,
          title: fallbackDoc.doctor.specialization || 'General Medicine',
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
          clinicId: docClinicId,
          clinicName: fallbackDoc.doctor.clinic_name || undefined,
          isAdmin,
        });

        setIsLoggedIn(true);
        setIsDoctorAdmin(isAdmin);
        if (isAdmin) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('healthsync_admin_pin', clean);
          }
          setAdminPin(clean);
        }
        setCurrentClinicId(docClinicId);

        const freshLocs = await fetchClinicLocations(docClinicId);
        setClinicLocations(freshLocs);
        if (freshLocs.length > 0) {
          setCurrentLocation(freshLocs[0]);
          if (typeof window !== 'undefined') {
            localStorage.setItem('healthsync_active_location_id', freshLocs[0].id);
            localStorage.setItem('healthsync_active_clinic_id', docClinicId);
          }
        }

        setDoctorProfile({
          name: fallbackDoc.doctor.full_name,
          title: fallbackDoc.doctor.specialization || 'General Medicine',
        });

        const freshDocs = await getDoctors(docClinicId, isAdmin ? undefined : freshLocs[0]?.id);
        if (freshDocs && freshDocs.length > 0) {
          setAvailableDoctors(freshDocs);
          setBookDoctorId((prev) => (freshDocs.some((d) => d.id === prev) ? prev : freshDocs[0].id));
          setWalkinDoctorId((prev) => (freshDocs.some((d) => d.id === prev) ? prev : freshDocs[0].id));
        }

        setShowPinModal(false);
        setPinError(false);
        setPinErrorMessage('');
        setPinInput('');
        setPortalMode('dashboard');
        setActiveSection(intendedSection || 'dashboard');
        setIntendedSection(null);
        showToast('success', 'Doctor Authenticated', `Welcome Dr. ${fallbackDoc.doctor.full_name} (${isAdmin ? 'Admin' : 'Attending Physician'})`);
        void syncBranchSessionData(docClinicId, freshLocs[0]?.id, isAdmin);
        return;
      }

      setPinError(true);
      setPinErrorMessage(branchRes.message || fallbackDoc.message || 'Invalid Branch Gateway or Doctor PIN');
      showToast('error', 'Authentication Failed', branchRes.message || fallbackDoc.message || 'Invalid Branch Gateway or Doctor PIN');
      setTimeout(() => setPinError(false), 2500);
      return;
    }

    const activeClinicId = currentClinicId || currentLocation?.clinic_id || (typeof window !== 'undefined' ? localStorage.getItem('healthsync_active_clinic_id') : null) || undefined;
    const activeBranchId = currentLocation?.id || '';

    const docRes = await verifyBranchDoctorPin(clean, activeBranchId, activeClinicId);

    if (!docRes.success || !docRes.doctor) {
      setPinError(true);
      setPinErrorMessage(docRes.message || 'Invalid Doctor Security PIN');
      showToast('error', 'Chamber Access Denied', docRes.message || 'Invalid Doctor Security PIN');
      setTimeout(() => setPinError(false), 2500);
      return;
    }

    if (activeClinicId && docRes.doctor.clinic_id && docRes.doctor.clinic_id !== activeClinicId) {
      setPinError(true);
      const msg = `Access Denied: Dr. ${docRes.doctor.full_name} is affiliated with a different clinic organization and cannot access this clinic.`;
      setPinErrorMessage(msg);
      showToast('error', 'Chamber Access Denied', msg);
      setTimeout(() => setPinError(false), 2500);
      return;
    }

    const docClinicId = activeClinicId || docRes.doctor.clinic_id || '9e8b98f5-e268-4b11-8ca1-ec1ce83292ea';
    const isAdmin = Boolean(docRes.is_admin_doctor);

    saveDoctorSessionLocal({
      doctorId: docRes.doctor.id,
      name: docRes.doctor.full_name,
      title: docRes.doctor.specialization || 'General Medicine',
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      clinicId: docClinicId,
      clinicName: docRes.doctor.clinic_name || undefined,
      isAdmin,
    });

    setIsLoggedIn(true);
    setIsDoctorAdmin(isAdmin);
    if (!currentClinicId && docClinicId) {
      setCurrentClinicId(docClinicId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('healthsync_active_clinic_id', docClinicId);
      }
    }

    setDoctorProfile({
      name: docRes.doctor.full_name,
      title: docRes.doctor.specialization || 'General Medicine',
    });

    setShowPinModal(false);
    setPinError(false);
    setPinErrorMessage('');
    setPinInput('');
    showToast('success', 'Chamber Unlocked', `Welcome Dr. ${docRes.doctor.full_name} (${isAdmin ? 'Admin' : 'Consultant'})`);

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
    void syncBranchSessionData(docClinicId, activeBranchId || undefined, isAdmin);
    return;
  };

  const handleLockDoctorSession = async () => {
    const savedDoc = getDoctorSessionLocal();
    clearDoctorSessionLocal();
    setIsLoggedIn(false);
    setIsDoctorAdmin(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('healthsync_admin_pin');
    }
    setAdminPin('');
    setDoctorProfile({
      name: 'Clinic Assistant',
      title: 'Reception & Triage',
    });
    try {
      logoutDoctor();
    } catch { }
    if (['queue', 'consult', 'inventory', 'analytics', 'settings', 'tables', 'admin_doctors'].includes(activeSection)) {
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
    clearDoctorsCacheLocal();
    setIsLoggedIn(false);
    setIsDoctorAdmin(false);
    setCurrentClinicId(null);
    setCurrentLocation(null);
    currentLocationRef.current = null;
    setClinicLocations([]);
    setAvailableDoctors([]);
    setQueue([]);
    setInventory([]);
    setActivePatient(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('healthsync_active_clinic_id');
      localStorage.removeItem('healthsync_active_location_id');
      localStorage.removeItem('healthsync_admin_pin');
    }
    setAdminPin('');
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
      const targetDocId = walkinDoctorId || bookDoctorId || availableDoctors[0]?.id || undefined;
      const res = await registerWalkinPatientDb({
        name: walkinName.trim(),
        age: ageNum,
        gender: walkinGender,
        phone: walkinPhone.trim(),
        priority: walkinPriority,
        doctorId: targetDocId,
        locationId: currentLocation?.id,
        clinicId: currentClinicId || currentLocation?.clinic_id || undefined,
      });

      if (res && res.success) {
        const entry = { ...res, visitType: 'Walk-in', locationId: currentLocation?.id };
        setQueue((prev) =>
          sortQueueWithCompletedAtEnd([
            ...prev.filter((p) => p.id !== entry.id),
            entry,
          ])
        );
        fetchQueueFromDb(undefined, undefined, currentLocation?.id).then((fresh) => {
          if (fresh && fresh.length > 0) {
            setQueue(sortQueueWithCompletedAtEnd(fresh));
          }
        });
        setWalkinName('');
        setWalkinAge('');
        setWalkinPhone('');
        setWalkinGender('Male');
        setWalkinPriority('Normal');
        setShowWalkinModal(false);

        if (res.alreadyInQueue || res.matchType === 'already_waiting') {
          const dupMsg =
            res.message ||
            `Patient ${res.name} is already waiting in queue today with Token ${res.tokenNumber}.`;
          showNotification({
            type: 'warning',
            title: 'Patient Already in Queue',
            message: dupMsg,
          });
          showToast('warning', 'Already in Queue', dupMsg);
        } else {
          showToast(
            'success',
            res.isReturningPatient ? 'Returning Patient Checked In' : 'Walk-in Registered',
            res.message || `${res.name} checked in with Token ${res.tokenNumber}.`
          );
        }
      } else {
        const msg = res?.message || 'Could not register walk-in patient.';
        const isQuotaReached = msg.toLowerCase().includes('quota');
        const canSwitchUrgent = msg.toLowerCase().includes('urgent') && config.allow_quota_override !== false;

        showNotification({
          type: isQuotaReached ? 'warning' : 'error',
          title: isQuotaReached ? 'Doctor Daily Quota Reached' : 'Registration Notice',
          message: msg,
          actionLabel: canSwitchUrgent ? 'Switch to Urgent' : undefined,
          onAction: canSwitchUrgent
            ? () => {
              setWalkinPriority('Urgent');
            }
            : undefined,
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

      const finalSlotTime = bookingRes.assignedSlot || bookSlotTime || 'Now';
      const confirmedDate = bookingRes.scheduledDate || finalBookingDate;
      const finalTokenNo = String(
        bookingRes.tokenNumber ||
        bookingRes.displayId ||
        `P${String(bookingRes.queueTokenNo || queue.length + 1).padStart(3, '0')}`
      );

      const newPatient: Patient = {
        id: bookingRes.appointmentId || `P-${String(Date.now()).slice(-4)}`,
        name: bookName.trim(),
        age: parseInt(bookAge, 10) || 28,
        gender: bookGender,
        phone: bookPhone.trim(),
        status: (bookingRes.status as PatientStatus) || 'Waiting',
        time: finalSlotTime,
        appointmentDate: confirmedDate,
        tokenNumber: finalTokenNo,
        queueTokenNo: bookingRes.queueTokenNo,
        displayId: finalTokenNo,
        patientNumber: bookingRes.patientNumber,
        priority: (bookingRes.priority as 'Normal' | 'Urgent') || bookPriority,
        visitType: 'Online',
      };

      const todayIST = getTodayIST();
      if (confirmedDate === todayIST) {
        setQueue((prev) => {
          const exists = prev.some((p) => p.id === newPatient.id);
          if (exists) {
            return prev.map((p) => (p.id === newPatient.id ? newPatient : p));
          }
          return sortQueueWithCompletedAtEnd([...prev, newPatient]);
        });
      }

      fetchQueueFromDb().then((fresh) => {
        if (fresh && fresh.length > 0) {
          setQueue(sortQueueWithCompletedAtEnd(fresh));
        }
      });

      setConfirmedToken({
        tokenNumber: finalTokenNo,
        name: bookName.trim(),
        time: finalSlotTime,
        date: confirmedDate,
        phone: bookPhone.trim(),
        doctorName: docName,
        priority: bookingRes.priority || bookPriority,
        channel: 'Online',
        dailyQuotaStatus: bookingRes.dailyQuotaStatus,
        appointmentId: bookingRes.appointmentId,
        message: bookingRes.message,
        status: bookingRes.status || 'Waiting',
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
      const activeClinic = currentClinicId || currentLocation?.clinic_id || undefined;
      const dbQueue = await fetchQueueFromDb(undefined, undefined, currentLocation?.id, activeClinic);
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
    newDoctorId?: string | null;
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
      newDoctorId,
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
      newDoctorId: newDoctorId || null,
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

      const activeClinic = currentClinicId || currentLocation?.clinic_id || undefined;
      const dbQueue = await fetchQueueFromDb(undefined, undefined, currentLocation?.id, activeClinic);
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

  const startConsultation = async (patientId: string, patientObj?: Patient) => {
    const patient = queue.find((p) => p.id === patientId) || patientObj;
    if (!patient) return;

    setActivePatient(patient);
    setCurrentPrescription([]);
    setDiagnosticNotes('');
    setSelectedMedId('');
    setRxQty('');

    await updateAppointmentStatusDb(patientId, 'In Progress');

    setQueue((prev) => {
      const exists = prev.some((p) => p.id === patientId);
      if (exists) {
        return prev.map((p) => (p.id === patientId ? { ...p, status: 'In Progress' } : p));
      } else {
        return [{ ...patient, status: 'In Progress' }, ...prev];
      }
    });

    setActiveSection('consult');
  };

  const handleRefreshDoctorQueue = useCallback(async () => {
    try {
      const fresh = await fetchQueueFromDb();
      if (fresh && fresh.length > 0) {
        setQueue(sortQueueWithCompletedAtEnd(fresh));
      }
    } catch (e) {
      console.warn('Error refreshing doctor queue in page:', e);
    }
  }, []);

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
        prev.map((p) =>
          String(p.med.id) === String(med.id)
            ? { ...p, qty: p.qty + qtyNum, dosage: rxDosage.trim() || p.dosage }
            : p
        )
      );
    } else {
      setCurrentPrescription((prev) => [
        ...prev,
        { med, qty: qtyNum, dosage: rxDosage.trim() || undefined },
      ]);
    }

    setSelectedMedId('');
    setRxQty('');
    setRxDosage('');
  };

  const removeRx = (index: number) => {
    setCurrentPrescription((prev) => prev.filter((_, i) => i !== index));
  };

  const completeConsultation = async (nextVisitDate?: string) => {
    if (!activePatient) return;

    await completeConsultationDb({
      appointmentId: activePatient.id,
      notes: diagnosticNotes || 'Clinical examination normal. Prescription issued.',
      nextVisitDate,
      prescriptions: currentPrescription.map((p) => ({
        inventoryId: String(p.med.id),
        qty: p.qty,
        medicineName: p.med.brand,
        dosage: p.dosage,
        instructions: p.instructions,
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

    for (const p of currentPrescription) {
      dispenseFefo({
        medicineId: String(p.med.id),
        requestedQty: p.qty,
        referenceNumber: 'RX-' + (activePatient.tokenNumber || activePatient.patientNumber || 'CLINIC'),
        responsibleUser: doctorProfile.name || 'Dr. Sunny',
      });
    }

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
      appointmentId: activePatient.id,
      clinicId: currentClinicId || currentLocation?.clinic_id || undefined,
      locationId: activePatient.locationId || currentLocation?.id || undefined,
      patientId: activePatient.patientDbId,
      branchName: currentLocation?.branch_name || undefined,
      date: dateStr,
      patientName: activePatient.name,
      patientPhone: activePatient.phone,
      demographics: `${activePatient.age} Yrs / ${activePatient.gender}`,
      patientAge: activePatient.age,
      patientGender: activePatient.gender,
      tokenNumber:
        activePatient.tokenNumber ||
        activePatient.displayId ||
        activePatient.patientNumber ||
        `P${activePatient.queueTokenNo || ''}`,
      diagnostics: diagnosticNotes || 'Clinical examination normal. Prescription issued.',
      items: [...currentPrescription],
      nextVisitDate,
      doctorName: doctorProfile.name,
      doctorTitle: doctorProfile.title,
      autoSaveToBackend: true,
    });

    setReturnToQueueOnPrintClose(true);
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
      <EcgActionLoader
        isLoading={Boolean(switchingBranch) || isDashboardSyncing}
        fullscreen={true}
      />

      <AnimatePresence mode="wait">
        {!isLoading && portalMode === 'gateway' && (
          <GatewayScreen
            key="portal-gateway"
            onSubmitPin={async ({ pin, clinic, branch }: GatewayPinSubmitPayload) => {
              const clean = pin.trim();
              if (!clean) {
                return { success: false, message: 'Please enter a PIN' };
              }

              // 1. Primary: Validate via unified access_pins table RPC
              const accessPinRes = await validateAccessPin(clean);
              if (accessPinRes.success && accessPinRes.clinic_id) {
                if (accessPinRes.clinic_id !== clinic.id) {
                  return {
                    success: false,
                    message: 'Invalid PIN. Please check and try again.',
                  };
                }
                if (branch && accessPinRes.has_branch && accessPinRes.location_id && accessPinRes.location_id !== branch.id) {
                  return {
                    success: false,
                    message: 'Invalid PIN. Please check and try again.',
                  };
                }

                const clinicId = accessPinRes.clinic_id;
                const clinicName = accessPinRes.clinic_name || clinic.name;
                const locationId = branch?.id || accessPinRes.location_id || undefined;
                const doctorId = accessPinRes.doctor_id || undefined;
                const isDoctor = Boolean(accessPinRes.has_doctor && doctorId);
                const isDocAdmin = Boolean(accessPinRes.is_admin_doctor);
                const isAdmin = isDocAdmin || (!accessPinRes.has_branch && !accessPinRes.has_doctor);

                if (isDoctor) {
                  saveDoctorSessionLocal({
                    doctorId: doctorId!,
                    name: accessPinRes.doctor_name || 'Doctor',
                    title: isDocAdmin ? 'Admin' : 'Consultant',
                    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
                    clinicId,
                    clinicName,
                    isAdmin: isDocAdmin,
                  });
                  setIsLoggedIn(true);
                  setIsDoctorAdmin(isDocAdmin);
                  if (isDocAdmin) {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('healthsync_admin_pin', clean);
                    }
                    setAdminPin(clean);
                  }
                  setDoctorProfile({
                    name: accessPinRes.doctor_name || 'Doctor',
                    title: isDocAdmin ? 'Admin' : 'Consultant',
                  });
                } else if (isAdmin) {
                  saveDoctorSessionLocal({
                    doctorId: 'admin',
                    name: `${clinicName} Admin`,
                    title: 'Admin',
                    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
                    clinicId,
                    clinicName,
                    isAdmin: true,
                  });
                  setIsLoggedIn(true);
                  setIsDoctorAdmin(true);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('healthsync_admin_pin', clean);
                  }
                  setAdminPin(clean);
                  setDoctorProfile({
                    name: `${clinicName} Admin`,
                    title: 'Administrator',
                  });
                } else {
                  saveClinicSessionLocal({
                    role: 'assistant',
                    name: accessPinRes.branch_name ? `${accessPinRes.branch_name} Reception` : `${clinicName} Reception`,
                    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
                    clinicId,
                    clinicName,
                    locationId,
                    isAdmin: false,
                  });
                  clearDoctorSessionLocal();
                  setIsLoggedIn(false);
                  setIsDoctorAdmin(false);
                  setDoctorProfile({
                    name: accessPinRes.branch_name ? `${accessPinRes.branch_name} Reception` : `${clinicName} Reception`,
                    title: 'Reception & Triage',
                  });
                }

                setCurrentClinicId(clinicId);
                const freshLocs = await fetchClinicLocations(clinicId);
                setClinicLocations(freshLocs);
                const matched = (locationId && freshLocs.find((l) => l.id === locationId)) || freshLocs[0];
                if (matched) {
                  setCurrentLocation(matched);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('healthsync_active_location_id', matched.id);
                    localStorage.setItem('healthsync_active_clinic_id', clinicId);
                  }
                }

                const freshDocs = await getDoctors(clinicId, matched?.id || locationId);
                if (freshDocs && freshDocs.length > 0) {
                  setAvailableDoctors(freshDocs);
                  setBookDoctorId((prev) => (freshDocs.some((d) => d.id === prev) ? prev : freshDocs[0].id));
                  setWalkinDoctorId((prev) => (freshDocs.some((d) => d.id === prev) ? prev : freshDocs[0].id));
                }

                setPortalMode('dashboard');
                setActiveSection('dashboard');
                showToast('success', 'Access Granted', accessPinRes.label || 'Authenticated successfully');
                void syncBranchSessionData(clinicId, matched?.id || locationId, isAdmin);
                return { success: true };
              }

              // 2. Fallback: Try Branch Gateway PIN
              const branchRes = await verifyBranchGatewayLogin(clean);
              if (branchRes.success && branchRes.branch_id) {
                if (branchRes.clinic_id && branchRes.clinic_id !== clinic.id) {
                  return {
                    success: false,
                    message: 'Invalid PIN. Please check and try again.',
                  };
                }
                if (branch && branchRes.branch_id !== branch.id) {
                  return {
                    success: false,
                    message: 'Invalid PIN. Please check and try again.',
                  };
                }

                const locationId = branch?.id || branchRes.branch_id;
                const branchName = branch?.branch_name || branchRes.branch_name || 'Branch';

                saveClinicSessionLocal({
                  role: 'assistant',
                  name: `${branchName} Assistant`,
                  expiresAt: Date.now() + 8 * 60 * 60 * 1000,
                  clinicId: clinic.id,
                  clinicName: clinic.name,
                  locationId,
                  isAdmin: false,
                });

                clearDoctorSessionLocal();
                setIsLoggedIn(false);
                setIsDoctorAdmin(false);
                setCurrentClinicId(clinic.id);

                const freshLocs = await fetchClinicLocations(clinic.id);
                setClinicLocations(freshLocs);
                const matched = branch || freshLocs.find((l) => l.id === locationId) || freshLocs[0];
                if (matched) {
                  setCurrentLocation(matched);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('healthsync_active_location_id', matched.id);
                    localStorage.setItem('healthsync_active_clinic_id', clinic.id);
                  }
                }

                setDoctorProfile({
                  name: `${branchName} Assistant`,
                  title: 'Reception & Triage',
                });

                setPortalMode('dashboard');
                setActiveSection('dashboard');
                showToast('success', 'Branch Gateway Connected', `Active Location: ${branchName}`);
                void syncBranchSessionData(clinic.id, matched?.id || locationId, false);
                return { success: true };
              }

              // 2. Try Doctor PIN (branch-scoped if branch selected, otherwise clinic-wide)
              if (branch) {
                const branchDocRes = await verifyBranchDoctorPin(clean, branch.id, clinic.id);
                if (branchDocRes.success && branchDocRes.doctor) {
                  const isAdmin = Boolean(branchDocRes.is_admin_doctor);
                  saveDoctorSessionLocal({
                    doctorId: branchDocRes.doctor.id,
                    name: branchDocRes.doctor.full_name,
                    title: branchDocRes.doctor.specialization || 'General Medicine',
                    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
                    clinicId: clinic.id,
                    clinicName: clinic.name,
                    isAdmin,
                  });

                  setIsLoggedIn(true);
                  setIsDoctorAdmin(isAdmin);
                  if (isAdmin) {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('healthsync_admin_pin', clean);
                    }
                    setAdminPin(clean);
                  }
                  setCurrentClinicId(clinic.id);
                  setCurrentLocation(branch);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('healthsync_active_location_id', branch.id);
                    localStorage.setItem('healthsync_active_clinic_id', clinic.id);
                  }

                  const freshLocs = await fetchClinicLocations(clinic.id);
                  setClinicLocations(freshLocs);

                  setDoctorProfile({
                    name: branchDocRes.doctor.full_name,
                    title: branchDocRes.doctor.specialization || 'General Medicine',
                  });

                  setPortalMode('dashboard');
                  setActiveSection('dashboard');
                  showToast('success', 'Doctor Authenticated', `Welcome Dr. ${branchDocRes.doctor.full_name}`);
                  void syncBranchSessionData(clinic.id, branch.id, isAdmin);
                  return { success: true };
                }
              }

              const fallbackDoc = await verifyDoctorPin(clean);
              if (fallbackDoc.success && fallbackDoc.doctor) {
                if (fallbackDoc.doctor.clinic_id && fallbackDoc.doctor.clinic_id !== clinic.id) {
                  return {
                    success: false,
                    message: `Dr. ${fallbackDoc.doctor.full_name} belongs to a different clinic.`,
                  };
                }

                const isAdmin = Boolean(fallbackDoc.doctor.is_admin_doctor || fallbackDoc.doctor.is_admin);
                saveDoctorSessionLocal({
                  doctorId: fallbackDoc.doctor.id,
                  name: fallbackDoc.doctor.full_name,
                  title: fallbackDoc.doctor.specialization || 'General Medicine',
                  expiresAt: Date.now() + 8 * 60 * 60 * 1000,
                  clinicId: clinic.id,
                  clinicName: clinic.name,
                  isAdmin,
                });

                setIsLoggedIn(true);
                setIsDoctorAdmin(isAdmin);
                if (isAdmin) {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('healthsync_admin_pin', clean);
                  }
                  setAdminPin(clean);
                }
                setCurrentClinicId(clinic.id);

                const freshLocs = await fetchClinicLocations(clinic.id);
                setClinicLocations(freshLocs);
                const targetLoc = branch || freshLocs[0] || null;
                if (targetLoc) {
                  setCurrentLocation(targetLoc);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('healthsync_active_location_id', targetLoc.id);
                  }
                }
                if (typeof window !== 'undefined') {
                  localStorage.setItem('healthsync_active_clinic_id', clinic.id);
                }

                setDoctorProfile({
                  name: fallbackDoc.doctor.full_name,
                  title: fallbackDoc.doctor.specialization || 'General Medicine',
                });

                setPortalMode('dashboard');
                setActiveSection('dashboard');
                showToast('success', 'Doctor Authenticated', `Welcome Dr. ${fallbackDoc.doctor.full_name}`);
                void syncBranchSessionData(clinic.id, targetLoc?.id, isAdmin);
                return { success: true };
              }

              return {
                success: false,
                message: branchRes.message || fallbackDoc.message || 'Invalid Clinic Gateway or Doctor PIN',
              };
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
              isAdmin={isDoctorAdmin}
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
              inventory={inventory}
              branchName={currentLocation?.branch_name}
              branchCode={currentLocation?.branch_code || undefined}
              clinicLocations={clinicLocations}
              currentLocation={currentLocation}
              onSelectLocation={handleSelectLocation}
              isAdmin={isDoctorAdmin}
            />

            <main
              className={`flex-1 overflow-y-auto no-print ${isMobile ? 'px-3.5 sm:px-6 pt-3 pb-28' : 'px-4 sm:px-6 lg:px-8 xl:px-10 pt-4 sm:pt-6 pb-12'
                }`}
            >
              {activeSection === 'settings' && (
                <motion.section
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.35 }}
                  className="flex items-center justify-between mb-6 sm:mb-8 min-w-0 bg-white p-4 sm:p-5 rounded-2xl border border-[#ECEEF2] shadow-2xs gap-3 flex-wrap"
                >
                  <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: 'spring', damping: 15 }}
                      className={`rounded-full overflow-hidden bg-blue-50 border-2 border-white shadow-sm flex-shrink-0 cursor-pointer ${isMobile ? 'w-11 h-11' : 'w-14 h-14'
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
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 }}
                        className={`font-bold text-[#16191E] leading-snug truncate ${isMobile ? 'text-base' : 'text-xl'}`}
                      >
                        {effectiveDoctorProfile.name}
                      </motion.h1>
                      <motion.p
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xs text-[#8A909D] font-medium truncate"
                      >
                        {effectiveDoctorProfile.title}
                      </motion.p>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => setShowDoctorEditModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    <UserCog className="w-4 h-4 stroke-[2]" />
                    <span>Edit Profile</span>
                  </motion.button>
                </motion.section>
              )}

              {isMobile && !['settings', 'admin_doctors', 'inventory'].includes(activeSection) && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="relative w-full mb-6"
                >
                  {activeSection === 'analytics' ? (
                    <GlobalAnalyticsSearch
                      isMobile
                      placeholder="Search analytics & insights..."
                      onSelectItem={(_id, title) => {
                        setSearchQuery(title);
                      }}
                    />
                  ) : (
                    <GlobalPatientSearch
                      isMobile
                      queue={queue}
                      onSelectConsult={handleConsultFromSearch}
                      placeholder="Search patient, phone, age, gender (e.g. Menon, 90000, 20-50)..."
                    />
                  )}
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
                    key={`${currentClinicId || 'none'}-${currentLocation?.id || 'none'}`}
                    totalPatientsCount={totalPatientsCount}
                    completedPatientsCount={completedPatientsCount}
                    totalStockUnits={totalStockUnits}
                    inChamberPatient={inChamberPatient}
                    nextWaitingPatient={nextWaitingPatient}
                    waitingPatientsCount={waitingPatientsCount}
                    filteredQueue={filteredQueue}
                    queue={queue.filter((p) => p.status !== 'Cancelled')}
                    isLoggedIn={isDoctorUnlocked}
                    locationId={currentLocation?.id}
                    clinicId={currentClinicId || currentLocation?.clinic_id || undefined}
                    branchName={currentLocation?.branch_name || undefined}
                    availableDoctors={availableDoctors}
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
                    onQueueUpdated={handleQueueUpdated}
                    onRefresh={syncClinicData}
                  />
                )}

                {activeSection === 'tables' && (
                  !isDoctorUnlocked && config.require_doctor_pin ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-2xl p-8 sm:p-12 border border-[#ECEEF2] shadow-2xs max-w-lg mx-auto text-center mt-12"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-600">
                        <Lock className="w-8 h-8" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-800 mb-2">Doctor Security Verification Required</h2>
                      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                        Visit Logs are protected. Please authenticate with your doctor PIN to access patient encounter records.
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            setIntendedSection('tables');
                            setShowPinModal(true);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          Unlock Chamber
                        </button>
                        <button
                          onClick={() => setActiveSection('dashboard')}
                          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          Back to Dashboard
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <TablesView
                      initialQueue={queue}
                      locationId={currentLocation?.id}
                      clinicId={currentClinicId || currentLocation?.clinic_id || undefined}
                      branchName={currentLocation?.branch_name || undefined}
                      onOpenConsultation={(patientId) => {
                        startConsultation(patientId);
                        setActiveSection('consult');
                      }}
                      onPrintRecord={(patient, details) => {
                        const mappedItems: PrescriptionItem[] = (details?.prescriptions || []).map((rx, idx) => ({
                          med: {
                            id: `visit-log-${idx}`,
                            brand: rx.brandName,
                            generic: rx.genericName || '',
                            stock: rx.qty || 1,
                          },
                          qty: rx.qty || 1,
                          dosage: rx.dosage && rx.dosage !== 'Standard' ? rx.dosage : undefined,
                        }));

                        setPrintRecord({
                          appointmentId: patient.id,
                          clinicId: currentClinicId || currentLocation?.clinic_id || undefined,
                          locationId: patient.locationId || currentLocation?.id || undefined,
                          patientId: patient.patientDbId,
                          branchName: currentLocation?.branch_name || undefined,
                          date: patient.appointmentDate || getTodayIST(),
                          patientName: patient.name,
                          patientPhone: patient.phone,
                          demographics: `${patient.age} Yrs / ${patient.gender}`,
                          diagnostics: details?.clinicalNotes || patient.cancellationReason || 'Consultation verified',
                          items: mappedItems,
                          patientAge: patient.age,
                          patientGender: patient.gender,
                          tokenNumber: patient.tokenNumber || patient.displayId || '',
                          doctorName: details?.doctorName || patient.doctorName || doctorProfile.name,
                          doctorTitle: details?.doctorSpecialization || doctorProfile.title,
                          nextVisitDate: details?.nextVisitDate,
                          prescriptionPdfUrl: details?.prescriptionPdfUrl,
                        });
                        setReturnToQueueOnPrintClose(false);
                        setShowPrintModal(true);
                      }}
                    />
                  )
                )}

                {activeSection === 'assistant' && (
                  <AssistantView
                    queue={queue}
                    locationId={currentLocation?.id}
                    clinicId={currentClinicId || currentLocation?.clinic_id || undefined}
                    branchName={currentLocation?.branch_name || undefined}
                    onRegisterWalkin={() => setShowWalkinModal(true)}
                    onReallocate={handleReallocate}
                    onCancelAppointment={handleCancelAppointment}
                    onReschedulePatient={handleReschedulePatient}
                    onStartConsultation={startConsultation}
                  />
                )}

                {activeSection === 'queue' && (
                  !isDoctorUnlocked ? (
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
                        The Doctor Consultation Queue requires an authenticated Doctor or Clinic Admin PIN.
                      </p>
                      <button
                        onClick={() => {
                          setIntendedSection('queue');
                          setPinErrorMessage('');
                          setShowPinModal(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center space-x-2"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Unlock with Doctor PIN</span>
                      </button>
                    </motion.div>
                  ) : (
                    <QueueView
                      queue={queue.filter(
                        (p) =>
                          p.status !== 'Cancelled' &&
                          (!p.appointmentDate || p.appointmentDate === getTodayIST())
                      )}
                      locationId={currentLocation?.id}
                      clinicId={currentClinicId || currentLocation?.clinic_id || undefined}
                      onStartConsultation={startConsultation}
                      onRefresh={handleRefreshDoctorQueue}
                    />
                  )
                )}

                {activeSection === 'consult' && (
                  !isDoctorUnlocked ? (
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
                        Clinical consultations and prescription writing require an authenticated Doctor PIN.
                      </p>
                      <button
                        onClick={() => {
                          setIntendedSection('consult');
                          setPinErrorMessage('');
                          setShowPinModal(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center space-x-2"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Unlock with Doctor PIN</span>
                      </button>
                    </motion.div>
                  ) : (
                    <ConsultationView
                      activePatient={activePatient}
                      clinicId={currentClinicId || currentLocation?.clinic_id || undefined}
                      diagnosticNotes={diagnosticNotes}
                      setDiagnosticNotes={setDiagnosticNotes}
                      selectedMedId={selectedMedId}
                      setSelectedMedId={setSelectedMedId}
                      rxQty={rxQty}
                      setRxQty={setRxQty}
                      rxDosage={rxDosage}
                      setRxDosage={setRxDosage}
                      inventory={inventory}
                      currentPrescription={currentPrescription}
                      onAddMedicineToRx={addMedicineToRx}
                      onRemoveRx={removeRx}
                      onCompleteConsultation={completeConsultation}
                      onViewRxModal={(record) => {
                        setPrintRecord(record);
                        setReturnToQueueOnPrintClose(false);
                        setShowPrintModal(true);
                      }}
                      onGoToQueue={() => setActiveSection('queue')}
                    />
                  )
                )}

                {activeSection === 'inventory' && (
                  <InventoryView
                    inventory={inventory}
                    clinicId={currentClinicId || currentLocation?.clinic_id || undefined}
                    locationId={currentLocation?.id || undefined}
                    branchName={currentLocation?.branch_name || undefined}
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
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    isDoctorUnlocked={isDoctorUnlocked}
                    onInventorySync={(updated) => setInventory(updated)}
                  />
                )}

                {activeSection === 'analytics' && (
                  !isDoctorUnlocked ? (
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
                        Clinic analytics and performance metrics require Doctor Authentication.
                      </p>
                      <button
                        onClick={() => {
                          setIntendedSection('analytics');
                          setPinErrorMessage('');
                          setShowPinModal(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center space-x-2"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Unlock with Doctor PIN</span>
                      </button>
                    </motion.div>
                  ) : (
                    <AnalyticsView
                      totalPatientsCount={totalPatientsCount}
                      queue={queue}
                      cancelledAppointments={queue.filter((p) => p.status === 'Cancelled')}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      locationId={currentLocation?.id}
                      clinicId={currentClinicId || currentLocation?.clinic_id || undefined}
                      branchName={currentLocation?.branch_name || undefined}
                    />
                  )
                )}

                {activeSection === 'settings' && (
                  !isDoctorUnlocked ? (
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
                  ) : (
                    <SettingsView
                      isMobile={isMobile}
                      onLogout={handleFullLogout}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      currentLocation={currentLocation}
                      onSelectLocation={handleSelectLocation}
                      clinicId={currentLocation?.clinic_id || currentClinicId || undefined}
                      clinicLocations={clinicLocations}
                      isAdmin={isDoctorAdmin}
                      onRefreshLocations={async () => {
                        const activeClinic = currentLocation?.clinic_id || currentClinicId || undefined;
                        const fresh = await fetchClinicLocations(activeClinic);
                        if (fresh && fresh.length > 0) setClinicLocations(fresh);
                      }}
                    />
                  )
                )}

                {activeSection === 'admin_doctors' && (
                  !isDoctorUnlocked ? (
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
                        Doctor rosters, branch assignments, daily consultation quotas, and security PINs require Doctor Authentication.
                      </p>
                      <button
                        onClick={() => {
                          setIntendedSection('admin_doctors');
                          setPinErrorMessage('');
                          setShowPinModal(true);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center space-x-2"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Unlock with Doctor PIN</span>
                      </button>
                    </motion.div>
                  ) : (
                    <DoctorManagementSettings
                      currentClinicId={currentClinicId || currentLocation?.clinic_id}
                      adminPin={adminPin}
                      isAdminUser={isDoctorAdmin}
                      lockedLocationId={!isDoctorAdmin ? currentLocation?.id : undefined}
                      lockedBranchName={!isDoctorAdmin ? currentLocation?.branch_name : undefined}
                    />
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
            walkinPriority={walkinPriority}
            setWalkinPriority={setWalkinPriority}
            availableDoctors={availableDoctors}
            selectedDoctorId={walkinDoctorId || bookDoctorId || availableDoctors[0]?.id || ''}
            setSelectedDoctorId={setWalkinDoctorId}
            onSubmit={handleRegisterWalkin}
            isSubmitting={isWalkinSubmitting}
            allowQuotaOverride={config.allow_quota_override !== false}
          />

          <DoctorProfileEditModal
            isOpen={showDoctorEditModal}
            onClose={() => setShowDoctorEditModal(false)}
            doctor={availableDoctors.find((d) => d.id === bookDoctorId) || availableDoctors[0] || null}
            existingDoctors={availableDoctors}
            onSave={(updatedDoc) => {
              setAvailableDoctors((prev) =>
                prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
              );
              setDoctorProfile({
                name: updatedDoc.full_name,
                title: updatedDoc.specialization || 'General Medicine',
              });
              saveDoctorSessionLocal({
                doctorId: updatedDoc.id,
                name: updatedDoc.full_name,
                title: updatedDoc.specialization || 'General Medicine',
                expiresAt: Date.now() + 30 * 60 * 1000,
              });
              showToast('success', 'Profile Updated', `${updatedDoc.full_name} details updated successfully.`);
            }}
          />

          <PrescriptionPrintModal
            isOpen={showPrintModal}
            onClose={() => {
              setShowPrintModal(false);
              if (returnToQueueOnPrintClose) {
                setReturnToQueueOnPrintClose(false);
                setActiveSection('queue');
              }
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
        errorMessage={pinErrorMessage}
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
            locationId={currentLocation?.id || undefined}
            clinicId={(currentLocation?.clinic_id || currentClinicId) ?? undefined}
            onBookingSuccess={() => {
              fetchQueueFromDb(undefined, undefined, currentLocation?.id).then((dbQueue) => {
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
