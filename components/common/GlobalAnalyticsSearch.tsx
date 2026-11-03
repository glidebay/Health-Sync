'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, BarChart3, TrendingUp, Users, MessageSquare, CheckCircle2, CalendarX, Pill, Activity } from 'lucide-react';

interface AnalyticsSearchItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'metric' | 'medicine' | 'case' | 'trend';
  badge: string;
  icon: React.ElementType;
}

const ANALYTICS_DIRECTORY: AnalyticsSearchItem[] = [
  {
    id: 'metric-walking',
    title: 'Walking Patients',
    subtitle: 'Direct walk-in clinic arrivals and token registrations',
    type: 'metric',
    badge: 'OPD Metric',
    icon: Users,
  },
  {
    id: 'metric-whatsapp',
    title: 'WhatsApp Bookings',
    subtitle: 'Digital self-service bookings and automated chatbot requests',
    type: 'metric',
    badge: 'Digital Adoption',
    icon: MessageSquare,
  },
  {
    id: 'metric-completed',
    title: 'Completed Consultations',
    subtitle: 'Consultations concluded by doctor today',
    type: 'metric',
    badge: 'OPD Metric',
    icon: CheckCircle2,
  },
  {
    id: 'metric-cancelled',
    title: 'Cancelled Appointments',
    subtitle: 'Patient cancellations and cancellation rate dynamics',
    type: 'metric',
    badge: 'Logistics',
    icon: CalendarX,
  },
  {
    id: 'chart-footfall',
    title: 'Footfall & Channel Trends',
    subtitle: 'Monthly volume comparison: Walk-ins vs WhatsApp automation (2025 – 2026)',
    type: 'trend',
    badge: 'Volume Trend',
    icon: TrendingUp,
  },
  {
    id: 'med-paracetamol',
    title: 'Paracetamol 650mg (Dolo-650)',
    subtitle: 'Top prescribed analgesic & antipyretic (1,420 prescriptions)',
    type: 'medicine',
    badge: 'Top Medicine',
    icon: Pill,
  },
  {
    id: 'med-augmentin',
    title: 'Amoxicillin + Clav 625mg (Augmentin)',
    subtitle: 'Broad-spectrum antibiotic (1,180 prescriptions)',
    type: 'medicine',
    badge: 'Top Medicine',
    icon: Pill,
  },
  {
    id: 'med-pan40',
    title: 'Pantoprazole 40mg (Pan-40)',
    subtitle: 'Antacid & PPI gastro care (940 prescriptions)',
    type: 'medicine',
    badge: 'Top Medicine',
    icon: Pill,
  },
  {
    id: 'med-cetzine',
    title: 'Cetirizine 10mg (Cetzine)',
    subtitle: 'Antihistamine & allergy control (760 prescriptions)',
    type: 'medicine',
    badge: 'Top Medicine',
    icon: Pill,
  },
  {
    id: 'med-glycomet',
    title: 'Metformin 500mg (Glycomet)',
    subtitle: 'Glycemic control & diabetes management (680 prescriptions)',
    type: 'medicine',
    badge: 'Top Medicine',
    icon: Pill,
  },
  {
    id: 'med-azee',
    title: 'Azithromycin 500mg (Azee-500)',
    subtitle: 'Macrolide respiratory antibiotic (520 prescriptions)',
    type: 'medicine',
    badge: 'Top Medicine',
    icon: Pill,
  },
  {
    id: 'med-montair',
    title: 'Montelukast 10mg (Montair)',
    subtitle: 'Respiratory & asthma allergy care (410 prescriptions)',
    type: 'medicine',
    badge: 'Top Medicine',
    icon: Pill,
  },
  {
    id: 'case-fever',
    title: 'Viral Fever & URI',
    subtitle: '45% of total clinical OPD presentations',
    type: 'case',
    badge: 'Diagnosis Case',
    icon: Activity,
  },
  {
    id: 'case-gastric',
    title: 'Gastric & Reflux',
    subtitle: '25% of clinical consultations',
    type: 'case',
    badge: 'Diagnosis Case',
    icon: Activity,
  },
  {
    id: 'case-allergy',
    title: 'Allergies & Skin Conditions',
    subtitle: '15% of clinical consultations',
    type: 'case',
    badge: 'Diagnosis Case',
    icon: Activity,
  },
  {
    id: 'case-vitals',
    title: 'Routine Vitals & Preventive Checks',
    subtitle: '10% of clinical consultations',
    type: 'case',
    badge: 'Diagnosis Case',
    icon: Activity,
  },
  {
    id: 'case-ortho',
    title: 'Orthopedic & Joint Care',
    subtitle: '5% of clinical consultations',
    type: 'case',
    badge: 'Diagnosis Case',
    icon: Activity,
  },
];

interface GlobalAnalyticsSearchProps {
  onSelectItem?: (id: string, title: string) => void;
  placeholder?: string;
  className?: string;
  isMobile?: boolean;
  isExpanded?: boolean;
  onClose?: () => void;
}

export function GlobalAnalyticsSearch({
  onSelectItem,
  placeholder = 'Search analytics & insights...',
  className = '',
  isMobile = false,
  isExpanded = false,
  onClose,
}: GlobalAnalyticsSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(isExpanded || isMobile);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isExpanded || isMobile) {
      inputRef.current?.focus();
    }
  }, [isExpanded, isMobile]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!isMobile) {
          setIsOpen(false);
          onClose?.();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (query) {
          setQuery('');
        } else {
          setIsOpen(false);
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query, onClose]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ANALYTICS_DIRECTORY.slice(0, 8);

    return ANALYTICS_DIRECTORY.filter((item) => {
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const subMatch = (item.subtitle || '').toLowerCase().includes(q);
      const badgeMatch = (item.badge || '').toLowerCase().includes(q);
      return titleMatch || subMatch || badgeMatch;
    });
  }, [query]);

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handleSelect = (item: AnalyticsSearchItem) => {
    onSelectItem?.(item.id, item.title);
    setIsOpen(false);
    onClose?.();
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${isExpanded ? 'flex items-center gap-2' : ''} ${className}`}
    >
      <div className="relative flex-1 flex items-center">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#2563EB]">
          <Search className="w-4 h-4 stroke-[2.2]" />
        </span>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full pl-10 pr-9 py-2.5 bg-white border border-[#ECEEF2] rounded-xl text-xs sm:text-sm text-[#16191E] placeholder:text-gray-400 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs ${
            isExpanded ? 'h-11' : ''
          }`}
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {(isExpanded || (isMobile && onClose)) && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            onClose?.();
          }}
          className="flex items-center gap-1.5 h-11 px-3 sm:px-4 rounded-xl bg-white hover:bg-gray-100 border border-[#ECEEF2] text-xs font-semibold text-gray-600 hover:text-gray-900 shadow-2xs transition cursor-pointer flex-shrink-0"
          title="Close (Esc)"
        >
          <X className="w-4 h-4 stroke-[2.2]" />
          <span className="hidden sm:inline">Close</span>
        </button>
      )}

      {/* Simple Clean Results Dropdown */}
      <AnimatePresence>
        {isOpen && query.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-[#ECEEF2] rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="px-4 py-2 bg-[#F8F9FB] border-b border-[#ECEEF2] text-[11px] text-[#8A909D] font-medium">
              {searchResults.length} {searchResults.length === 1 ? 'insight' : 'insights'} found
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-[#ECEEF2] p-1">
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-gray-500">
                  <BarChart3 className="w-6 h-6 text-gray-300 mx-auto mb-1.5 stroke-[1.5]" />
                  <p className="font-semibold text-gray-700">No analytics found</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Try searching for walking, whatsapp, medicines, or cases.</p>
                </div>
              ) : (
                searchResults.map((item, index) => {
                  const isHighlighted = highlightedIndex === index;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-xs cursor-pointer transition ${
                        isHighlighted ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] flex-shrink-0">
                          <Icon className="w-3.5 h-3.5 stroke-[2]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-[#16191E] truncate">{item.title}</p>
                          <p className="text-[11px] text-[#8A909D] truncate mt-0.5">{item.subtitle}</p>
                        </div>
                      </div>

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 flex-shrink-0">
                        {item.badge}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GlobalAnalyticsSearch;

