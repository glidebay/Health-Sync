'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Stethoscope } from 'lucide-react';
import { Patient } from '@/types';
import { fetchPatientAppointmentsFromDb } from '@/lib/supabaseService';
import { getTodayIST } from '@/lib/utils';

interface GlobalPatientSearchProps {
  queue: Patient[];
  onSelectConsult: (patient: Patient) => void;
  placeholder?: string;
  className?: string;
  isMobile?: boolean;
  isExpanded?: boolean;
  onClose?: () => void;
}

function matchPatientCriteria(
  p: { name: string; phone?: string; age: number; gender: string; id?: string; displayId?: string },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  if (p.name.toLowerCase().includes(q)) return true;

  if (p.phone && p.phone.toLowerCase().includes(q)) return true;

  if (p.displayId && p.displayId.toLowerCase().includes(q)) return true;
  if (p.id && p.id.toLowerCase().includes(q)) return true;

  const rangeMatch = q.match(/(\d+)\s*(?:-|to|and)\s*(\d+)/i);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    const inRange = p.age >= min && p.age <= max;

    if (q.includes('female')) {
      return inRange && p.gender.toLowerCase() === 'female';
    }
    if (q.includes('male') && !q.includes('female')) {
      return inRange && p.gender.toLowerCase() === 'male';
    }
    return inRange;
  }

  const gtMatch = q.match(/(?:>=|>|above)\s*(\d+)|\b(\d+)\s*\+/i);
  if (gtMatch) {
    const min = parseInt(gtMatch[1] || gtMatch[2], 10);
    const isGt = p.age >= min;
    if (q.includes('female')) return isGt && p.gender.toLowerCase() === 'female';
    if (q.includes('male') && !q.includes('female')) return isGt && p.gender.toLowerCase() === 'male';
    return isGt;
  }

  if (q.includes('senior') || q.includes('elderly')) {
    const isSenior = p.age >= 60;
    if (q.includes('female')) return isSenior && p.gender.toLowerCase() === 'female';
    if (q.includes('male') && !q.includes('female')) return isSenior && p.gender.toLowerCase() === 'male';
    return isSenior;
  }

  const ltMatch = q.match(/(?:<=|<|under)\s*(\d+)/i);
  if (ltMatch) {
    const max = parseInt(ltMatch[1], 10);
    const isLt = p.age < max;
    if (q.includes('female')) return isLt && p.gender.toLowerCase() === 'female';
    if (q.includes('male') && !q.includes('female')) return isLt && p.gender.toLowerCase() === 'male';
    return isLt;
  }

  if (q.includes('pediatric') || q.includes('child') || q.includes('young')) {
    const isPediatric = p.age < 18;
    if (q.includes('female')) return isPediatric && p.gender.toLowerCase() === 'female';
    if (q.includes('male') && !q.includes('female')) return isPediatric && p.gender.toLowerCase() === 'male';
    return isPediatric;
  }

  if (q === 'female' || q === 'females' || q === 'women' || q === 'woman') {
    return p.gender.toLowerCase() === 'female';
  }
  if (q === 'male' || q === 'males' || q === 'men' || q === 'man') {
    return p.gender.toLowerCase() === 'male';
  }

  const genderAgeMatch = q.match(/(female|male)\s*(\d+)/i);
  if (genderAgeMatch) {
    const g = genderAgeMatch[1].toLowerCase();
    const age = parseInt(genderAgeMatch[2], 10);
    return p.gender.toLowerCase() === g && p.age === age;
  }

  if (/^\d{1,3}$/.test(q)) {
    const exactAge = parseInt(q, 10);
    if (exactAge <= 120 && p.age === exactAge) return true;
  }

  return false;
}

export function GlobalPatientSearch({
  queue,
  onSelectConsult,
  placeholder = 'Search by name, phone, age, gender (e.g. Menon, 90000, Female, 20-50)...',
  className = '',
  isMobile = false,
  isExpanded: controlledExpanded,
  onClose,
}: GlobalPatientSearchProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isSearchExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [dbAppointments, setDbAppointments] = useState<Patient[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const todayIST = useMemo(() => getTodayIST(), []);

  // Guarantee search operates strictly on today's patients
  const todayQueue = useMemo(() => {
    return queue.filter((p) => !p.appointmentDate || p.appointmentDate === todayIST);
  }, [queue, todayIST]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setDbAppointments([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingDb(true);
      try {
        // Query database appointments strictly anchored to today in IST
        const results = await fetchPatientAppointmentsFromDb({
          date: todayIST,
          search: trimmed,
          status: 'All',
        });
        setDbAppointments(results || []);
      } catch (err) {
        console.warn('Error querying today appointments for search:', err);
      } finally {
        setIsLoadingDb(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, todayIST]);

  const searchResults: Patient[] = useMemo(() => {
    let combined: Patient[] = [];

    if (!query.trim()) {
      combined = [...todayQueue];
    } else {
      const queueMatches = todayQueue.filter((p) => matchPatientCriteria(p, query));
      const queueIds = new Set(queueMatches.map((p) => p.id));

      const extraMatches = dbAppointments.filter(
        (p) => !queueIds.has(p.id) && matchPatientCriteria(p, query)
      );

      combined = [...queueMatches, ...extraMatches];
    }

    const notCompleted = combined.filter((p) => p.status !== 'Completed');
    const completed = combined.filter((p) => p.status === 'Completed');
    return [...notCompleted, ...completed];
  }, [todayQueue, dbAppointments, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (controlledExpanded === undefined) {
          setInternalExpanded(false);
        }
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [controlledExpanded]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        (items[highlightedIndex] as HTMLElement).scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleOpen = () => {
    if (controlledExpanded === undefined) {
      setInternalExpanded(true);
    }
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    if (controlledExpanded === undefined) {
      setInternalExpanded(false);
    }
    setIsOpen(false);
    setQuery('');
  };

  const handleSelect = (patient: Patient) => {
    onSelectConsult(patient);
    handleClose();
  };

  const handleClear = () => {
    setQuery('');
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= searchResults.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? searchResults.length - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        handleSelect(searchResults[highlightedIndex]);
      } else if (searchResults.length === 1) {
        handleSelect(searchResults[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  const quickFilterPills = [
    { label: 'Female Patients', query: 'Female' },
    { label: 'Male Patients', query: 'Male' },
    { label: '20-50 Yrs', query: '20-50' },
    { label: 'Seniors (60+)', query: 'Senior' },
    { label: 'Pediatric (<18)', query: '<18' },
  ];

  if (!isSearchExpanded) {
    return (
      <div
        onClick={handleOpen}
        className={`relative flex items-center cursor-pointer transition-all duration-200 group ${
          isMobile
            ? 'w-full py-2.5 pl-10 pr-4 bg-white border border-[#ECEEF2] rounded-xl text-xs text-gray-400 shadow-2xs'
            : 'w-44 sm:w-56 md:w-64 lg:w-72 xl:w-80 h-10 pl-10 pr-3.5 bg-[#ECEEF2] hover:bg-[#E6E8ED] border border-transparent rounded-xl text-xs text-gray-500 font-medium'
        } ${className}`}
        title="Click to search patients (or press /)"
      >
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#2563EB] group-hover:scale-105 transition-transform">
          <Search className="w-4 h-4 stroke-[2]" />
        </span>
        <span className="truncate text-gray-500 group-hover:text-gray-700">
          Search patient, phone, age, gender...
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative w-full flex items-center gap-2 sm:gap-3 ${className}`}>
      <div className="relative flex-1 flex items-center">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#2563EB]">
          <Search className="w-4 h-4 stroke-[2.2]" />
        </span>

        <input
          ref={inputRef}
          type="text"
          autoFocus
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full h-11 pl-10 pr-10 bg-white border border-[#2563EB]/40 rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs font-medium transition-all"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            title="Clear search text"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleClose}
        className="flex items-center gap-1.5 h-11 px-3 sm:px-4 rounded-xl bg-white hover:bg-gray-100 border border-[#ECEEF2] text-xs font-semibold text-gray-600 hover:text-gray-900 shadow-2xs transition cursor-pointer flex-shrink-0"
        title="Close search (Esc)"
      >
        <X className="w-4 h-4 stroke-[2.2]" />
        <span className="hidden sm:inline">Close</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-[#ECEEF2] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-[#F8F9FB] border-b border-[#ECEEF2] flex items-center justify-between text-xs text-[#8A909D]">
              <span className="font-medium flex items-center gap-1.5">
                {query.trim() ? (
                  <>
                    <span>Found</span>
                    <strong className="text-[#16191E] font-bold">{searchResults.length}</strong>
                    <span>{searchResults.length === 1 ? 'patient' : 'patients'}</span>
                    {isLoadingDb && (
                      <span className="text-[11px] text-blue-500 animate-pulse ml-1 font-normal">
                        (searching database...)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-semibold text-gray-700">
                    Today's Patient Queue ({searchResults.length})
                  </span>
                )}
              </span>
              <span className="text-[11px] text-gray-400 hidden sm:inline">
                Click Consult to begin
              </span>
            </div>

            <div ref={listRef} className="max-h-80 sm:max-h-96 overflow-y-auto divide-y divide-[#ECEEF2] p-1.5">
              {searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs">
                  <p className="font-semibold text-gray-800">No matching patients found</p>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
                    Try searching by name, phone number, gender, or age range.
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {quickFilterPills.map((pill) => (
                      <button
                        key={pill.label}
                        type="button"
                        onClick={() => {
                          setQuery(pill.query);
                          inputRef.current?.focus();
                        }}
                        className="text-[11px] font-medium bg-gray-100 hover:bg-blue-50 hover:text-[#2563EB] border border-gray-200 px-2.5 py-1 rounded-lg text-gray-700 transition cursor-pointer"
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                searchResults.map((patient, index) => {
                  const isHighlighted = highlightedIndex === index;

                  return (
                    <div
                      key={patient.id}
                      onClick={() => handleSelect(patient)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-4 py-2.5 rounded-xl flex items-center justify-between gap-4 text-xs cursor-pointer transition-colors ${
                        isHighlighted ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs sm:text-sm text-gray-900 truncate">
                          {patient.name}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                          {patient.time}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(patient);
                        }}
                        className="px-3.5 py-1.5 rounded-lg font-medium text-xs text-white bg-[#2563EB] hover:bg-blue-700 transition cursor-pointer flex items-center gap-1.5 shadow-2xs flex-shrink-0"
                        title={`Consult ${patient.name}`}
                      >
                        <Stethoscope className="w-3.5 h-3.5 stroke-[2]" />
                        <span>Consult</span>
                      </button>
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

export default GlobalPatientSearch;
