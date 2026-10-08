'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, type Variants } from 'framer-motion';
import EcgLoadingScreen from '@/components/loading/EcgLoadingScreen';
import { ClinicProvider } from '@/context/ClinicContext';
import {
  HeartPulse,
  Home,
  Users,
  ClipboardList,
  Stethoscope,
  Boxes,
  BarChart3,
  FileText,
  Printer,
  Lock,
  Unlock,
  Search,
  Plus,
  PlusCircle,
  Clock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  User,
  Check,
  Eye,
  ShieldCheck,
  X,
  Radio,
  Pill,
  Sparkles,
} from 'lucide-react';

/* --------------- Types --------------- */
interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  status: 'Waiting' | 'In Progress' | 'Completed';
  time: string;
}

interface InventoryItem {
  id: number;
  generic: string;
  brand: string;
  stock: number;
}

interface PrescriptionItem {
  med: InventoryItem;
  qty: number;
}

type NavSection = 'dashboard' | 'assistant' | 'queue' | 'consult' | 'inventory' | 'analytics';

/* --------------- Initial Data --------------- */
const INITIAL_QUEUE: Patient[] = [
  { id: 'P01', name: 'Unnikrishnan Menon', age: 62, gender: 'Male', status: 'Waiting', time: '09:30 AM' },
  { id: 'P02', name: 'Lakshmi Namboothiri', age: 45, gender: 'Female', status: 'In Progress', time: '09:45 AM' },
  { id: 'P03', name: 'Abdul Rahman', age: 34, gender: 'Male', status: 'Waiting', time: '10:00 AM' },
  { id: 'P04', name: 'Thomas Varghese', age: 55, gender: 'Male', status: 'Waiting', time: '10:15 AM' },
  { id: 'P05', name: 'Parvathy Nair', age: 28, gender: 'Female', status: 'Waiting', time: '10:30 AM' },
  { id: 'P06', name: 'Sreenivasan Pillai', age: 71, gender: 'Male', status: 'Waiting', time: '10:45 AM' },
];

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 1, generic: 'Paracetamol 650mg', brand: 'Dolo 650', stock: 150 },
  { id: 2, generic: 'Amoxicillin 500mg', brand: 'Novamox', stock: 45 },
  { id: 3, generic: 'Fexofenadine 120mg', brand: 'Allegra', stock: 12 },
  { id: 4, generic: 'Pantoprazole 40mg', brand: 'Pan 40', stock: 0 },
];

/* --------------- Motion Variants --------------- */
const sidebarVariants: Variants = {
  hidden: { x: -280, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 26,
      stiffness: 240,
      staggerChildren: 0.04,
    },
  },
};

const navItemVariants: Variants = {
  hidden: { x: -16, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', damping: 20, stiffness: 280 },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 22, stiffness: 260 },
  },
};

const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', damping: 24, stiffness: 260 },
  },
};

/* --------------- Animated Components --------------- */
function AnimatedCounter({ target, duration = 1.6 }: { target: number; duration?: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const controls = animate(count, target, { duration, ease: 'easeOut' });
    const unsub = rounded.on('change', (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [count, rounded, target, duration]);

  return <span>{display}</span>;
}

function AnimatedProgress({ percent, delay = 0 }: { percent: number; delay?: number }) {
  return (
    <div className="w-36 h-2 bg-[#EBECEF] rounded-full overflow-hidden flex">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ delay: delay + 0.3, duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-[#2563EB] h-full rounded-full"
      />
    </div>
  );
}

export default function HealthSyncSkillUpTheme() {
  /* --------------- State --------------- */
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [intendedSection, setIntendedSection] = useState<NavSection | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Clinic Data
  const [queue, setQueue] = useState<Patient[]>(INITIAL_QUEUE);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<PrescriptionItem[]>([]);
  const [diagnosticNotes, setDiagnosticNotes] = useState('');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Walk-in modal or inline form
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinName, setWalkinName] = useState('');
  const [walkinAge, setWalkinAge] = useState('');
  const [walkinGender, setWalkinGender] = useState<'Male' | 'Female'>('Male');

  // New Procurement form
  const [newGeneric, setNewGeneric] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newQty, setNewQty] = useState('');
  const [stockUpdates, setStockUpdates] = useState<Record<number, string>>({});

  // Prescription builder form
  const [selectedMedId, setSelectedMedId] = useState('');
  const [rxQty, setRxQty] = useState('');

  // Print modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printRecord, setPrintRecord] = useState<{
    date: string;
    patientName: string;
    demographics: string;
    diagnostics: string;
    items: PrescriptionItem[];
  } | null>(null);

  /* --------------- Navigation & Auth --------------- */
  const navItems = [
    { id: 'dashboard' as NavSection, label: 'Dashboard', icon: Home, reqAuth: false },
    { id: 'assistant' as NavSection, label: 'Assistant Desk', icon: ClipboardList, reqAuth: false },
    { id: 'queue' as NavSection, label: 'Doctor Queue', icon: Users, reqAuth: true },
    { id: 'consult' as NavSection, label: 'Consultation', icon: Stethoscope, reqAuth: true },
    { id: 'inventory' as NavSection, label: 'Pharmacy Stock', icon: Boxes, reqAuth: true },
    { id: 'analytics' as NavSection, label: 'Analytics', icon: BarChart3, reqAuth: true },
  ];

  const handleNavClick = (section: NavSection, reqAuth: boolean) => {
    if (reqAuth && !isLoggedIn) {
      setIntendedSection(section);
      setShowPinModal(true);
      return;
    }
    setActiveSection(section);
  };

  const handlePinSubmit = () => {
    if (pinInput.trim() === '1234') {
      setIsLoggedIn(true);
      setShowPinModal(false);
      setPinError(false);
      const target = intendedSection || 'queue';
      setActiveSection(target);
      setIntendedSection(null);
      setPinInput('');
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
    }
  };

  /* --------------- Clinic Actions --------------- */
  const handleRegisterWalkin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinName.trim() || !walkinAge) return;

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const newPat: Patient = {
      id: `P${String(queue.length + 1).padStart(2, '0')}`,
      name: walkinName.trim(),
      age: parseInt(walkinAge, 10),
      gender: walkinGender,
      status: 'Waiting',
      time: timeStr,
    };

    setQueue((prev) => [...prev, newPat]);
    setWalkinName('');
    setWalkinAge('');
    setShowWalkinModal(false);
  };

  const handleReallocate = (id: string) => {
    setQueue((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const nextTime = new Date(Date.now() + 20 * 60000).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          return { ...p, time: nextTime };
        }
        return p;
      })
    );
  };

  const startConsultation = (patientId: string) => {
    const patient = queue.find((p) => p.id === patientId);
    if (!patient) return;

    setActivePatient(patient);
    setCurrentPrescription([]);
    setDiagnosticNotes('');
    setSelectedMedId('');
    setRxQty('');

    setQueue((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, status: 'In Progress' } : p))
    );

    setActiveSection('consult');
  };

  const addMedicineToRx = () => {
    if (!selectedMedId || !rxQty) return;
    const qtyNum = parseInt(rxQty, 10);
    if (qtyNum <= 0) return;

    const med = inventory.find((m) => m.id === parseInt(selectedMedId, 10));
    if (!med) return;

    if (qtyNum > med.stock) {
      alert(`Only ${med.stock} units available in pharmacy.`);
      return;
    }

    const existing = currentPrescription.find((p) => p.med.id === med.id);
    if (existing) {
      if (existing.qty + qtyNum > med.stock) {
        alert(`Combined total exceeds available stock of ${med.stock}.`);
        return;
      }
      setCurrentPrescription((prev) =>
        prev.map((p) => (p.med.id === med.id ? { ...p, qty: p.qty + qtyNum } : p))
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

  const completeConsultation = () => {
    if (!activePatient) return;

    // Deduct stock in real time
    setInventory((prevInv) =>
      prevInv.map((item) => {
        const prescribed = currentPrescription.find((p) => p.med.id === item.id);
        if (prescribed) {
          return { ...item, stock: Math.max(0, item.stock - prescribed.qty) };
        }
        return item;
      })
    );

    // Update patient status to Completed
    setQueue((prevQueue) =>
      prevQueue.map((p) => (p.id === activePatient.id ? { ...p, status: 'Completed' } : p))
    );

    // Populate Print Record
    const dateStr = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    setPrintRecord({
      date: dateStr,
      patientName: activePatient.name,
      demographics: `${activePatient.age} Yrs / ${activePatient.gender}`,
      diagnostics: diagnosticNotes || 'Clinical examination normal. Prescription issued.',
      items: [...currentPrescription],
    });

    setShowPrintModal(true);
    setActivePatient(null);
  };

  const handleAddNewProcurement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGeneric.trim() || !newBrand.trim() || !newQty) return;
    const qtyNum = parseInt(newQty, 10);
    if (qtyNum <= 0) return;

    setInventory((prev) => [
      ...prev,
      { id: Date.now(), generic: newGeneric.trim(), brand: newBrand.trim(), stock: qtyNum },
    ]);
    setNewGeneric('');
    setNewBrand('');
    setNewQty('');
  };

  const handleUpdateStock = (id: number) => {
    const val = parseInt(stockUpdates[id] || '0', 10);
    if (val > 0) {
      setInventory((prev) =>
        prev.map((item) => (item.id === id ? { ...item, stock: item.stock + val } : item))
      );
      setStockUpdates((prev) => ({ ...prev, [id]: '' }));
    }
  };

  // Filtered queue based on search
  const filteredQueue = queue.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPatientsCount = 54 + queue.length - 6;
  const waitingPatientsCount = queue.filter((p) => p.status === 'Waiting').length;
  const completedPatientsCount = queue.filter((p) => p.status === 'Completed').length;
  const totalStockUnits = inventory.reduce((acc, curr) => acc + curr.stock, 0);

  return (
    <ClinicProvider>
    <div
      className="min-h-screen bg-[#F8F9FB] flex antialiased select-none text-[#16191E]"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* --------------- Print Styles --------------- */}
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

      {/* --------------- Initial ECG Splash Screen --------------- */}
      <EcgLoadingScreen />

      {/* --------------- BEGIN: Sidebar (SkillUp Design with Full Animation) --------------- */}
      <motion.aside
        variants={sidebarVariants}
        initial="hidden"
        animate="visible"
        className="w-64 min-w-[256px] bg-white border-r border-[#ECEEF2] flex flex-col justify-between py-8 px-6 min-h-screen no-print"
      >
        <div className="flex flex-col space-y-9">
          {/* Brand Logo */}
          <motion.div
            variants={navItemVariants}
            className="flex items-center space-x-3.5 px-2"
          >
            <motion.div
              whileHover={{ scale: 1.08, rotate: 8 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-xs cursor-pointer"
            >
              <HeartPulse className="w-6 h-6 stroke-[2.2]" />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold tracking-tight text-[#16191E]">HealthSync</span>
              <span className="text-[10px] font-bold tracking-wider text-[#8A909D] uppercase -mt-1">
                CLMS Pavilion
              </span>
            </div>
          </motion.div>

          {/* Navigation Menu with Animated Pill */}
          <nav aria-label="Sidebar" className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const isLocked = item.reqAuth && !isLoggedIn;

              return (
                <motion.div key={item.id} variants={navItemVariants}>
                  <button
                    onClick={() => handleNavClick(item.id, item.reqAuth)}
                    className={`relative w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer text-left group ${
                      isActive
                        ? 'text-[#16191E] font-semibold'
                        : 'text-[#5E6470] hover:text-[#16191E] hover:bg-gray-50/80 font-medium'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeSidebarPill"
                        className="absolute inset-0 bg-[#EBECEF] rounded-xl"
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      />
                    )}
                    <div className="relative z-10 flex items-center space-x-3.5">
                      <Icon
                        className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? 'text-[#2563EB] stroke-[2.2]' : 'text-[#8A909D] group-hover:text-[#2563EB] stroke-[1.8]'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {isLocked && <Lock className="relative z-10 w-3.5 h-3.5 text-[#8A909D]" />}
                  </button>
                </motion.div>
              );
            })}
          </nav>
        </div>

        {/* Upgrade / Doctor Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: 'spring', damping: 20 }}
          className="bg-[#F8F9FB] rounded-3xl p-5 pt-8 text-center border border-[#ECEEF2] flex flex-col items-center"
        >
          {/* Animated Lock Body Graphic */}
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="relative w-16 h-16 mb-4 flex items-center justify-center"
          >
            <div className="w-14 h-12 bg-[#ECEEF2] rounded-2xl relative flex items-center justify-center shadow-inner mt-3">
              <div className="w-3.5 h-4 bg-[#2563EB] rounded-full" />
              <div className="absolute -top-5 w-8 h-8 border-4 border-blue-200 rounded-t-full bg-transparent" />
            </div>
          </motion.div>

          <p className="text-xs font-bold text-[#16191E] leading-relaxed max-w-[160px] mb-4">
            {isLoggedIn ? 'Doctor Authenticated • Dr. Sunny' : 'Doctor Security PIN Required for Triage & Rx'}
          </p>

          {isLoggedIn ? (
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setIsLoggedIn(false);
                setActiveSection('dashboard');
              }}
              className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition duration-150 shadow-sm cursor-pointer"
            >
              Lock Session
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setIntendedSection('queue');
                setShowPinModal(true);
              }}
              className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition duration-150 shadow-sm cursor-pointer"
            >
              Authenticate PIN
            </motion.button>
          )}
        </motion.div>
      </motion.aside>
      {/* --------------- END: Sidebar --------------- */}

      {/* --------------- BEGIN: Main Content Area --------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header with Animations */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full bg-[#F8F9FB] px-10 py-7 flex items-center justify-between no-print"
        >
          {/* Current Section Indicator */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8A909D]">
              CLMS Worklist
            </span>
            <span className="text-xs text-[#8A909D]">•</span>
            <span className="text-xs font-bold text-[#16191E]">
              {navItems.find((n) => n.id === activeSection)?.label || 'Dashboard'}
            </span>
          </div>

          {/* Search & Sign In Button */}
          <div className="flex items-center space-x-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="relative w-72"
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-[#2563EB]">
                <Search className="w-4 h-4 stroke-[2]" />
              </span>
              <input
                type="text"
                placeholder="search patient or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2.5 pl-11 pr-4 bg-[#ECEEF2] border-0 rounded-xl text-sm placeholder-gray-400 text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300 transition-shadow duration-200"
              />
            </motion.div>

            {isLoggedIn ? (
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold bg-[#EBECEF] text-[#16191E] px-4 py-2.5 rounded-xl border border-[#ECEEF2]">
                  Dr. Sunny (MD)
                </span>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setIsLoggedIn(false)}
                  className="bg-[#2563EB] hover:bg-blue-700 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition duration-150 cursor-pointer"
                >
                  Exit
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setIntendedSection('queue');
                  setShowPinModal(true);
                }}
                className="bg-[#2563EB] hover:bg-blue-700 text-white font-medium text-xs px-7 py-3 rounded-xl transition duration-150 shadow-sm cursor-pointer"
              >
                Sign In
              </motion.button>
            )}
          </div>
        </motion.header>

        {/* Dashboard Dynamic Viewport */}
        <main className="flex-1 px-10 pb-12 overflow-y-auto no-print">
          {/* Welcome Profile Banner */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45 }}
            className="flex items-center space-x-4 mb-8"
          >
            <motion.div
              whileHover={{ scale: 1.08 }}
              transition={{ type: 'spring', damping: 15 }}
              className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow-sm flex-shrink-0 cursor-pointer"
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
                className="text-xl font-bold text-[#16191E] leading-snug"
              >
                Welcome Back {isLoggedIn ? 'Dr. Sunny' : 'Jack (Assistant)'}
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

          {/* 3 Metric Overview Cards */}
          <motion.section
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"
          >
            {/* Metric 1 */}
            <motion.div
              variants={fadeScale}
              whileHover={{
                y: -4,
                boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)',
              }}
              transition={{ type: 'spring', damping: 18, stiffness: 300 }}
              className="bg-white rounded-2xl p-6 border border-[#ECEEF2] flex justify-between items-start shadow-sm cursor-default"
            >
              <div>
                <span className="text-sm font-semibold text-[#16191E] block mb-6">
                  Total Patients Today
                </span>
                <span className="text-xs text-[#8A909D] font-medium tracking-wide">
                  <AnimatedCounter target={totalPatientsCount} />
                </span>
              </div>
              <motion.div
                whileHover={{ rotate: 12, scale: 1.1 }}
                className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-sm shadow-blue-500/20"
              >
                <Eye className="w-4 h-4 stroke-[2]" />
              </motion.div>
            </motion.div>

            {/* Metric 2 */}
            <motion.div
              variants={fadeScale}
              whileHover={{
                y: -4,
                boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)',
              }}
              transition={{ type: 'spring', damping: 18, stiffness: 300 }}
              className="bg-white rounded-2xl p-6 border border-[#ECEEF2] flex justify-between items-start shadow-sm cursor-default"
            >
              <div>
                <span className="text-sm font-semibold text-[#16191E] block mb-6">
                  Completed Consults
                </span>
                <span className="text-xs text-[#8A909D] font-medium tracking-wide">
                  <AnimatedCounter target={completedPatientsCount + 50} />
                </span>
              </div>
              <motion.div
                whileHover={{ rotate: -12, scale: 1.1 }}
                className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-sm shadow-blue-500/20"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
              </motion.div>
            </motion.div>

            {/* Metric 3 */}
            <motion.div
              variants={fadeScale}
              whileHover={{
                y: -4,
                boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)',
              }}
              transition={{ type: 'spring', damping: 18, stiffness: 300 }}
              className="bg-white rounded-2xl p-6 border border-[#ECEEF2] flex justify-between items-start shadow-sm cursor-default"
            >
              <div>
                <span className="text-sm font-semibold text-[#16191E] block mb-6">
                  Pharmacy Units in Stock
                </span>
                <span className="text-xs text-[#8A909D] font-medium tracking-wide">
                  <AnimatedCounter target={totalStockUnits} />
                </span>
              </div>
              <motion.div
                whileHover={{ rotate: 12, scale: 1.1 }}
                className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-sm shadow-blue-500/20"
              >
                <Boxes className="w-4 h-4 stroke-[2]" />
              </motion.div>
            </motion.div>
          </motion.section>

          {/* --------------- View 1: DASHBOARD (Exact layout from screenshot with Animations) --------------- */}
          <AnimatePresence mode="wait">
            {activeSection === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
              >
                {/* Recent Active Chamber & Daily Progress */}
                <section className="mb-10">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-[#16191E] tracking-tight">
                      Active consultations & Chamber Flow
                    </h2>
                    <motion.button
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setShowWalkinModal(true)}
                      className="flex items-center space-x-1.5 text-xs font-semibold bg-[#2563EB] text-white px-3.5 py-1.5 rounded-xl hover:bg-blue-700 transition cursor-pointer shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Register Walk-in</span>
                    </motion.button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Card 1: Active Doctor Consultation */}
                    <motion.div
                      whileHover={{
                        y: -4,
                        boxShadow: '0 14px 32px -8px rgba(0,0,0,0.08)',
                      }}
                      className="lg:col-span-4 bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm flex flex-col justify-between cursor-default"
                    >
                      <motion.div
                        whileHover={{ rotate: -8, scale: 1.1 }}
                        className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB] mb-12"
                      >
                        <Stethoscope className="w-5 h-5 stroke-[1.8]" />
                      </motion.div>
                      <div>
                        <h3 className="text-sm font-bold text-[#16191E] mb-4">
                          Lakshmi Namboothiri (In Chamber)
                        </h3>
                        <div className="flex items-center justify-between">
                          <AnimatedProgress percent={75} delay={0.1} />
                          <span className="text-xs font-semibold text-[#8A909D]">
                            <strong className="text-[#16191E]">45</strong> Yrs • Female
                          </span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Card 2: Next in Queue */}
                    <motion.div
                      whileHover={{
                        y: -4,
                        boxShadow: '0 14px 32px -8px rgba(0,0,0,0.08)',
                      }}
                      className="lg:col-span-4 bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm flex flex-col justify-between cursor-default"
                    >
                      <motion.div
                        whileHover={{ rotate: 8, scale: 1.1 }}
                        className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB] mb-12"
                      >
                        <Clock className="w-5 h-5 stroke-[1.8]" />
                      </motion.div>
                      <div>
                        <h3 className="text-sm font-bold text-[#16191E] mb-4">
                          Unnikrishnan Menon (Waiting)
                        </h3>
                        <div className="flex items-center justify-between">
                          <AnimatedProgress percent={45} delay={0.2} />
                          <span className="text-xs font-semibold text-[#8A909D]">
                            <strong className="text-[#16191E]">09:30</strong> AM Slot
                          </span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Daily Progress Widget */}
                    <motion.div
                      whileHover={{
                        y: -4,
                        boxShadow: '0 14px 32px -8px rgba(0,0,0,0.08)',
                      }}
                      className="lg:col-span-4 bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm flex flex-col justify-start cursor-default"
                    >
                      <h3 className="text-base font-bold text-[#16191E] mb-4">Clinic Daily Stream</h3>
                      <div className="space-y-3">
                        <motion.div whileHover={{ scale: 1.04, x: 4 }} transition={{ type: 'spring', damping: 20 }}>
                          <span className="inline-flex items-center space-x-2 bg-[#EAECEF] px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#16191E] cursor-pointer">
                            <Users className="w-4 h-4 text-[#2563EB] stroke-[2]" />
                            <span>{waitingPatientsCount} Waiting in Queue</span>
                          </span>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.04, x: 4 }} transition={{ type: 'spring', damping: 20 }}>
                          <span className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#16191E] hover:bg-gray-100 transition cursor-pointer">
                            <Pill className="w-4 h-4 text-[#2563EB] stroke-[1.8]" />
                            <span>Live Stock Synced</span>
                          </span>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.04, x: 4 }} transition={{ type: 'spring', damping: 20 }}>
                          <span className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#16191E] hover:bg-gray-100 transition cursor-pointer">
                            <CheckCircle2 className="w-4 h-4 text-[#2563EB] stroke-[1.8]" />
                            <span>14m Avg Consultation</span>
                          </span>
                        </motion.div>
                      </div>
                    </motion.div>
                  </div>
                </section>

                {/* Bottom Split Section (Recent enrolled class & Upcoming Class) */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left: Recent Queue list */}
                  <div className="lg:col-span-7 flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-base font-bold text-[#16191E]">Live Queue Oversight</h2>
                      <div className="flex items-center space-x-3.5">
                        <motion.span
                          whileHover={{ scale: 1.06 }}
                          onClick={() => setActiveSection('assistant')}
                          className="text-sm font-semibold text-[#16191E] cursor-pointer hover:underline"
                        >
                          All
                        </motion.span>
                        <motion.button
                          whileHover={{ scale: 1.15, rotate: 90 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setShowWalkinModal(true)}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-blue-50 transition text-[#2563EB] cursor-pointer"
                          title="Add Walk-in"
                        >
                          <PlusCircle className="w-4 h-4 stroke-[2.2]" />
                        </motion.button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {filteredQueue.slice(0, 3).map((p) => (
                        <motion.div
                          key={p.id}
                          whileHover={{
                            y: -3,
                            boxShadow: '0 10px 24px -6px rgba(0,0,0,0.07)',
                          }}
                          className="bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-sm flex items-center space-x-4 cursor-default"
                        >
                          <motion.div
                            whileHover={{ rotate: 10 }}
                            className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-[#2563EB]"
                          >
                            <User className="w-6 h-6 stroke-[2]" />
                          </motion.div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-bold text-[#16191E]">{p.name}</h3>
                              <span
                                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                  p.status === 'Completed'
                                    ? 'bg-gray-100 text-gray-600'
                                    : p.status === 'In Progress'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {p.status}
                              </span>
                            </div>
                            <div className="flex items-center space-x-6 text-xs text-[#5E6470] font-medium">
                              <div className="flex items-center space-x-1.5">
                                <Clock className="w-3.5 h-3.5 text-[#2563EB] stroke-[2]" />
                                <span>{p.time}</span>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <span>
                                  {p.age} Yrs • {p.gender}
                                </span>
                              </div>
                              {p.status === 'Waiting' && (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleReallocate(p.id)}
                                  className="text-[#2563EB] hover:underline font-semibold cursor-pointer"
                                >
                                  Reallocate
                                </motion.button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Upcoming Consultations */}
                  <div className="lg:col-span-5 flex flex-col">
                    <h2 className="text-base font-bold text-[#16191E] mb-5">Upcoming Consultations</h2>
                    <div className="space-y-4">
                      {queue.slice(2, 5).map((p) => (
                        <motion.div
                          key={p.id}
                          whileHover={{
                            y: -3,
                            x: 4,
                            boxShadow: '0 10px 24px -6px rgba(0,0,0,0.07)',
                          }}
                          className="bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-sm flex items-center space-x-4 cursor-pointer"
                          onClick={() => {
                            if (isLoggedIn) startConsultation(p.id);
                            else {
                              setIntendedSection('queue');
                              setShowPinModal(true);
                            }
                          }}
                        >
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-[#2563EB]"
                          >
                            <Stethoscope className="w-6 h-6 stroke-[1.8]" />
                          </motion.div>
                          <div>
                            <h3 className="text-sm font-bold text-[#16191E] mb-0.5">{p.name}</h3>
                            <motion.span
                              animate={{ opacity: [0.6, 1, 0.6] }}
                              transition={{ repeat: Infinity, duration: 2.5 }}
                              className="text-xs text-[#8A909D] font-medium"
                            >
                              Slot: {p.time} • {p.age} Yrs
                            </motion.span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {/* --------------- View 2: ASSISTANT DESK --------------- */}
            {activeSection === 'assistant' && (
              <motion.section
                key="assistant"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#16191E]">Assistant Queue Oversight</h2>
                    <p className="text-xs text-[#8A909D]">
                      Coordinate incoming walk-in patients and manage token allocations
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowWalkinModal(true)}
                    className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Register Walk-in</span>
                  </motion.button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {queue.map((p) => (
                    <motion.div
                      key={p.id}
                      whileHover={{ y: -2 }}
                      className="bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-sm flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-[#16191E]">{p.name}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              p.status === 'Completed'
                                ? 'bg-gray-100 text-gray-600'
                                : p.status === 'In Progress'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#8A909D] font-medium mt-1">
                          {p.age} Yrs • {p.gender} • Slot: {p.time}
                        </p>
                      </div>

                      {p.status === 'Waiting' && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleReallocate(p.id)}
                          className="text-xs font-semibold px-3 py-1.5 border border-blue-200 text-[#2563EB] rounded-xl hover:bg-blue-50 transition cursor-pointer"
                        >
                          Reallocate
                        </motion.button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ─────────────── View 3: DOCTOR QUEUE ─────────────── */}
            {activeSection === 'queue' && (
              <motion.section
                key="queue"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#16191E]">Pending Consultations</h2>
                    <p className="text-xs text-[#8A909D]">
                      Click any waiting patient to begin consultation & digital charting
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {queue.map((p) => {
                    const isCompleted = p.status === 'Completed';
                    return (
                      <motion.div
                        key={p.id}
                        whileHover={!isCompleted ? { y: -3, boxShadow: '0 10px 24px -6px rgba(0,0,0,0.07)' } : {}}
                        onClick={() => !isCompleted && startConsultation(p.id)}
                        className={`bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-sm flex items-center justify-between transition-colors ${
                          isCompleted ? 'opacity-60 cursor-default' : 'cursor-pointer hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <motion.div
                            whileHover={{ rotate: 8 }}
                            className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]"
                          >
                            <User className="w-5 h-5 stroke-[2]" />
                          </motion.div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-bold text-[#16191E]">{p.name}</h3>
                              <span className="text-xs text-[#8A909D]">({p.id})</span>
                            </div>
                            <p className="text-xs text-[#5E6470] mt-0.5">
                              {p.age} Yrs • {p.gender} • Slot: {p.time}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-xl ${
                              isCompleted
                                ? 'bg-gray-100 text-gray-600'
                                : p.status === 'In Progress'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {p.status}
                          </span>
                          {!isCompleted && (
                            <span className="text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs">
                              Start Consult &rarr;
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* ─────────────── View 4: CONSULTATION & RX BUILDER ─────────────── */}
            {activeSection === 'consult' && (
              <motion.section
                key="consult"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {!activePatient ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-[#ECEEF2] shadow-sm">
                    <Stethoscope className="w-12 h-12 text-[#2563EB] opacity-40 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-[#16191E]">No Active Patient Selected</h3>
                    <p className="text-xs text-[#8A909D] max-w-sm mx-auto mt-1 mb-5">
                      Select a patient from the Doctor Queue to open diagnostic notes & prescription builder
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setActiveSection('queue')}
                      className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer"
                    >
                      Go to Queue
                    </motion.button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Patient Banner */}
                    <div className="bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-[#16191E]">{activePatient.name}</h2>
                        <p className="text-xs text-[#8A909D] font-medium mt-0.5">
                          {activePatient.age} Yrs • {activePatient.gender} • Slot: {activePatient.time}
                        </p>
                      </div>
                      <span className="text-xs font-bold bg-[#EBECEF] text-[#16191E] px-3.5 py-1.5 rounded-xl">
                        Active Chamber
                      </span>
                    </div>

                    {/* Diagnostic Notes */}
                    <div className="bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm">
                      <h3 className="text-sm font-bold text-[#16191E] mb-3">Clinical Diagnostic Notes</h3>
                      <textarea
                        rows={3}
                        value={diagnosticNotes}
                        onChange={(e) => setDiagnosticNotes(e.target.value)}
                        placeholder="Record patient complaints, clinical findings, and diagnosis..."
                        className="w-full p-3.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300 transition"
                      />
                    </div>

                    {/* Prescription Builder */}
                    <div className="bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-[#16191E]">
                          Prescription Builder (Linked to Live Inventory)
                        </h3>
                        <span className="text-xs text-[#8A909D]">Real-time stock validation</span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 mb-5">
                        <select
                          value={selectedMedId}
                          onChange={(e) => setSelectedMedId(e.target.value)}
                          className="flex-1 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300 font-medium cursor-pointer"
                        >
                          <option value="">-- Select Available Medicine --</option>
                          {inventory
                            .filter((m) => m.stock > 0)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.brand} ({m.generic}) — {m.stock} units available
                              </option>
                            ))}
                        </select>

                        <input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={rxQty}
                          onChange={(e) => setRxQty(e.target.value)}
                          className="w-24 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300"
                        />

                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={addMedicineToRx}
                          className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer"
                        >
                          Add to Rx
                        </motion.button>
                      </div>

                      {/* Prescribed List */}
                      <div className="border border-[#ECEEF2] rounded-xl p-4 bg-[#F8F9FB] min-h-[100px]">
                        {currentPrescription.length === 0 ? (
                          <p className="text-xs text-[#8A909D] italic text-center py-4">
                            No medicines prescribed yet. Select from the dropdown above.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {currentPrescription.map((item, idx) => (
                              <div
                                key={item.med.id}
                                className="bg-white p-3 rounded-xl border border-[#ECEEF2] flex justify-between items-center"
                              >
                                <div>
                                  <span className="font-bold text-sm text-[#16191E]">{item.med.brand}</span>
                                  <span className="text-[10px] text-[#8A909D] block">{item.med.generic}</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <span className="text-xs font-bold bg-[#F4F5F7] px-2.5 py-1 rounded-lg">
                                    Qty: {item.qty}
                                  </span>
                                  <button
                                    onClick={() => removeRx(idx)}
                                    className="text-red-500 hover:text-red-700 cursor-pointer p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Complete & Print */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={completeConsultation}
                        className="w-full mt-6 py-3 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center space-x-2"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Complete & Print Rx</span>
                      </motion.button>
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* --------------- View 5: PHARMACY INVENTORY --------------- */}
            {activeSection === 'inventory' && (
              <motion.section
                key="inventory"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Register Procurement */}
                <div className="bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm">
                  <h3 className="text-sm font-bold text-[#16191E] mb-3">Register New Procurement</h3>
                  <form onSubmit={handleAddNewProcurement} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Generic Molecule (e.g. Paracetamol 650mg)"
                      value={newGeneric}
                      onChange={(e) => setNewGeneric(e.target.value)}
                      required
                      className="flex-1 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300"
                    />
                    <input
                      type="text"
                      placeholder="Brand (e.g. Dolo 650)"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      required
                      className="flex-1 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300"
                    />
                    <input
                      type="number"
                      placeholder="Total Qty"
                      min="1"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      required
                      className="w-28 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300"
                    />
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      type="submit"
                      className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                    >
                      Add to Stock
                    </motion.button>
                  </form>
                </div>

                {/* Master Inventory List */}
                <div className="bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm">
                  <h3 className="text-sm font-bold text-[#16191E] mb-4">Master Inventory Status</h3>
                  <div className="space-y-3">
                    {inventory.map((item) => {
                      const isHigh = item.stock > 20;
                      const isLow = item.stock > 0 && item.stock <= 20;

                      return (
                        <motion.div
                          key={item.id}
                          whileHover={{ y: -2 }}
                          className="p-4 bg-[#F8F9FB] rounded-xl border border-[#ECEEF2] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-[#16191E]">{item.brand}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  isHigh
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isLow
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {item.stock} Units
                              </span>
                            </div>
                            <p className="text-xs text-[#8A909D] font-medium mt-0.5">{item.generic}</p>
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              placeholder="Add Qty"
                              value={stockUpdates[item.id] || ''}
                              onChange={(e) =>
                                setStockUpdates((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              className="w-24 p-1.5 bg-white border border-[#ECEEF2] rounded-xl text-xs outline-none"
                            />
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleUpdateStock(item.id)}
                              className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer"
                            >
                              Update
                            </motion.button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.section>
            )}

            {/* --------------- View 6: OPERATIONAL ANALYTICS --------------- */}
            {activeSection === 'analytics' && (
              <motion.section
                key="analytics"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <motion.div
                    whileHover={{ y: -3 }}
                    className="bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm text-center"
                  >
                    <span className="text-4xl font-extrabold text-[#16191E] block mb-1">54</span>
                    <span className="text-xs font-semibold text-[#8A909D] uppercase tracking-wider">
                      Total Patients Today
                    </span>
                  </motion.div>
                  <motion.div
                    whileHover={{ y: -3 }}
                    className="bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm text-center"
                  >
                    <span className="text-4xl font-extrabold text-[#16191E] block mb-1">14m</span>
                    <span className="text-xs font-semibold text-[#8A909D] uppercase tracking-wider">
                      Avg Consultation Duration
                    </span>
                  </motion.div>
                </div>

                {/* Consultation Breakdown */}
                <motion.div
                  whileHover={{ y: -2 }}
                  className="bg-white rounded-2xl p-6 border border-[#ECEEF2] shadow-sm"
                >
                  <h3 className="text-sm font-bold text-[#16191E] mb-6 text-center">
                    Consultation Case Breakdown
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                    {/* SVG Doughnut */}
                    <div className="relative w-44 h-44">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#2563EB"
                          strokeWidth="14"
                          strokeDasharray="107.44 238.76"
                          strokeDashoffset="0"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#3B82F6"
                          strokeWidth="14"
                          strokeDasharray="59.69 238.76"
                          strokeDashoffset="-107.44"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#60A5FA"
                          strokeWidth="14"
                          strokeDasharray="35.81 238.76"
                          strokeDashoffset="-167.13"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#93C5FD"
                          strokeWidth="14"
                          strokeDasharray="23.88 238.76"
                          strokeDashoffset="-202.94"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#BFDBFE"
                          strokeWidth="14"
                          strokeDasharray="11.94 238.76"
                          strokeDashoffset="-226.82"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold text-[#16191E]">100%</span>
                        <span className="text-[9px] text-[#8A909D] font-bold uppercase">Cases</span>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-2 text-xs font-medium">
                      {[
                        { label: 'Viral Fever & URI', pct: '45%', color: 'bg-[#2563EB]' },
                        { label: 'Gastric & Reflux', pct: '25%', color: 'bg-[#3B82F6]' },
                        { label: 'Allergies & Skin', pct: '15%', color: 'bg-[#60A5FA]' },
                        { label: 'Routine Vitals', pct: '10%', color: 'bg-[#93C5FD]' },
                        { label: 'Orthopedic / Joints', pct: '5%', color: 'bg-[#BFDBFE]' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center space-x-2.5">
                          <span className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="text-[#16191E] w-36">{item.label}</span>
                          <span className="text-[#8A909D] font-bold">{item.pct}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* --------------- MODAL 1: Walk-in Registration Modal --------------- */}
      <AnimatePresence>
        {showWalkinModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-[#ECEEF2]"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-[#16191E]">Register Walk-in Patient</h3>
                <button
                  onClick={() => setShowWalkinModal(false)}
                  className="text-gray-400 hover:text-black cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterWalkin} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#8A909D] block mb-1">Patient Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="w-1/3">
                    <label className="text-xs font-semibold text-[#8A909D] block mb-1">Age</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Age"
                      value={walkinAge}
                      onChange={(e) => setWalkinAge(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300"
                    />
                  </div>
                  <div className="w-2/3">
                    <label className="text-xs font-semibold text-[#8A909D] block mb-1">Gender</label>
                    <select
                      value={walkinGender}
                      onChange={(e) => setWalkinGender(e.target.value as 'Male' | 'Female')}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer mt-2"
                >
                  Queue Patient
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --------------- MODAL 2: Doctor PIN Modal --------------- */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[#ECEEF2] text-center ${
                pinError ? 'animate-shake' : ''
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-5 h-5 text-[#2563EB]" />
              </div>
              <h3 className="text-base font-bold text-[#16191E] mb-1">Doctor Authentication</h3>
              <p className="text-xs text-[#8A909D] mb-4">Enter security PIN (try 1234)</p>

              <input
                type="password"
                placeholder="PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                autoFocus
                className={`w-full p-2.5 text-center text-lg tracking-widest bg-[#F8F9FB] border rounded-xl outline-none mb-3 ${
                  pinError ? 'border-red-500' : 'border-[#ECEEF2]'
                }`}
              />

              {pinError && <p className="text-xs text-red-500 font-medium mb-3">Invalid PIN. Try 1234</p>}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePinSubmit}
                className="w-full py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer mb-2"
              >
                Sign In
              </motion.button>
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setIntendedSection(null);
                  setPinInput('');
                }}
                className="text-xs text-[#8A909D] hover:text-black transition cursor-pointer"
              >
                Cancel & Return
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --------------- MODAL 3: Prescription Print Modal --------------- */}
      <AnimatePresence>
        {showPrintModal && printRecord && (
          <div
            id="print-modal"
            className="fixed inset-0 bg-white z-50 flex flex-col overflow-y-auto p-8"
          >
            <div className="max-w-2xl mx-auto w-full my-auto">
              <div className="flex justify-between items-end border-b-2 border-[#16191E] pb-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#16191E]">HealthSync Clinic</h2>
                  <p className="text-xs text-[#5E6470] font-medium">Dr. Sunny • General Medicine</p>
                </div>
                <div className="text-right text-xs text-[#8A909D]">
                  <p>{printRecord.date}</p>
                </div>
              </div>

              <div className="mb-6 flex flex-col gap-1 text-sm border border-[#ECEEF2] p-4 rounded-xl bg-[#F8F9FB]">
                <p>
                  <span className="font-bold text-[#16191E]">Patient:</span>
                  <span className="ml-2">{printRecord.patientName}</span>
                </p>
                <p>
                  <span className="font-bold text-[#16191E]">Demographics:</span>
                  <span className="ml-2">{printRecord.demographics}</span>
                </p>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-[#16191E] border-b pb-1 mb-2 text-sm">Clinical Diagnostics</h3>
                <p className="text-sm text-[#5E6470] leading-relaxed">{printRecord.diagnostics}</p>
              </div>

              <div className="mb-8">
                <h3 className="font-bold text-[#16191E] border-b pb-1 mb-3 text-sm">Prescription (Rx)</h3>
                {printRecord.items.length > 0 ? (
                  <ul className="space-y-3 text-sm text-[#16191E]">
                    {printRecord.items.map((p) => (
                      <li key={p.med.id} className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <div>
                          <span className="font-bold">{p.med.brand}</span>
                          <span className="text-xs text-[#8A909D] block uppercase">{p.med.generic}</span>
                        </div>
                        <span className="font-bold bg-gray-100 px-3 py-1 rounded-lg">
                          Dispense: {p.qty}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="italic text-xs text-[#8A909D]">No medication prescribed during this visit.</p>
                )}
              </div>

              <div className="mt-16 text-right">
                <p className="border-t border-gray-400 inline-block pt-2 pr-16 text-sm font-semibold">
                  Doctor's Signature
                </p>
              </div>

              <div className="mt-10 flex gap-4 no-print justify-center">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => window.print()}
                  className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs px-8 py-2.5 rounded-xl transition cursor-pointer flex items-center space-x-2 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Rx</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setShowPrintModal(false);
                    setActiveSection('queue');
                  }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold text-xs px-8 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Close
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </ClinicProvider>
  );
}



