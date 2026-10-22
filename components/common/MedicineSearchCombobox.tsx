'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import { InventoryItem } from '@/types';

interface MedicineSearchComboboxProps {
  inventory: InventoryItem[];
  selectedMedId: string;
  onSelectMedId: (id: string) => void;
  onSelectAndFocusQty?: () => void;
  placeholder?: string;
  className?: string;
}

export function MedicineSearchCombobox({
  inventory,
  selectedMedId,
  onSelectMedId,
  onSelectAndFocusQty,
  placeholder = 'Search & select medicine by brand or generic name...',
  className = '',
}: MedicineSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Find currently selected medicine object
  const selectedMed = useMemo(() => {
    if (!selectedMedId) return null;
    return inventory.find((m) => String(m.id) === String(selectedMedId)) || null;
  }, [inventory, selectedMedId]);

  // Sync input value with selection when selection or inventory changes
  useEffect(() => {
    if (selectedMed) {
      setSearchQuery(`${selectedMed.brand} (${selectedMed.generic})`);
    } else {
      setSearchQuery('');
    }
  }, [selectedMed]);

  // Filter available medicines based on search term
  const filteredInventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const available = inventory.filter((m) => m.stock > 0);

    // If query matches current selection exactly, display all medicines when opened
    const isShowingCurrentSelection = selectedMed && searchQuery === `${selectedMed.brand} (${selectedMed.generic})`;

    if (!q || isShowingCurrentSelection) {
      return available;
    }

    return available.filter((m) => {
      const brandMatch = m.brand?.toLowerCase().includes(q);
      const genericMatch = m.generic?.toLowerCase().includes(q);
      const categoryMatch = m.category?.toLowerCase().includes(q);
      return brandMatch || genericMatch || categoryMatch;
    });
  }, [inventory, searchQuery, selectedMed]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // If closed without new selection, reset query text to current selection or empty
        if (selectedMed) {
          setSearchQuery(`${selectedMed.brand} (${selectedMed.generic})`);
        } else {
          setSearchQuery('');
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedMed]);

  // Scroll highlighted item into view
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

  const handleSelect = (item: InventoryItem) => {
    if (item.stock <= 0) return; // Cannot select out-of-stock
    onSelectMedId(String(item.id));
    setSearchQuery(`${item.brand} (${item.generic})`);
    setIsOpen(false);
    setHighlightedIndex(-1);
    onSelectAndFocusQty?.();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectMedId('');
    setSearchQuery('');
    setIsOpen(true);
    setHighlightedIndex(-1);
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
        return next >= filteredInventory.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? filteredInventory.length - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredInventory.length) {
        const candidate = filteredInventory[highlightedIndex];
        if (candidate && candidate.stock > 0) {
          handleSelect(candidate);
        }
      } else if (filteredInventory.length === 1 && filteredInventory[0].stock > 0) {
        handleSelect(filteredInventory[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      if (selectedMed) {
        setSearchQuery(`${selectedMed.brand} (${selectedMed.generic})`);
      } else {
        setSearchQuery('');
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative flex-1 ${className}`}>
      {/* Combobox Input Field */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full flex items-center gap-2 px-3.5 py-2.5 bg-[#F8F9FB] border rounded-xl text-xs sm:text-sm cursor-text transition-all duration-150 ${isOpen
            ? 'border-[#2563EB] ring-2 ring-blue-50 bg-white shadow-sm'
            : 'border-[#ECEEF2] hover:border-gray-300'
          }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            setIsOpen(true);
            // Select text if already populated for fast typing
            if (selectedMed) {
              inputRef.current?.select();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-[#16191E] placeholder:text-[#8A909D] font-medium"
        />

        {searchQuery ? (
          <button
            type="button"
            onClick={handleClear}
            title="Clear selection"
            className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-gray-700 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
            if (!isOpen) inputRef.current?.focus();
          }}
          className="p-1 text-[#8A909D] hover:text-[#16191E] transition"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#2563EB]' : ''}`}
          />
        </button>
      </div>

      {/* Dropdown Results Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-[#ECEEF2] rounded-xl shadow-xl overflow-hidden"
          >
            <ul ref={listRef} className="max-h-64 overflow-y-auto divide-y divide-[#F1F3F6] p-1">
              {filteredInventory.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-[#8A909D]">
                  <p className="font-semibold text-gray-600">No matching medicines found</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Try searching by brand or generic name
                  </p>
                </li>
              ) : (
                filteredInventory.map((item, index) => {
                  const isSelected = String(item.id) === String(selectedMedId);
                  const isHighlighted = highlightedIndex === index;

                  return (
                    <li
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-3.5 py-2.5 rounded-lg flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${isSelected
                          ? 'bg-blue-50 text-[#2563EB]'
                          : isHighlighted
                            ? 'bg-[#F4F5F7]'
                            : 'hover:bg-[#F8F9FB]'
                        }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold truncate ${isSelected ? 'text-[#2563EB]' : 'text-[#16191E]'
                              }`}
                          >
                            {item.brand}
                          </span>
                          {item.category && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 font-medium hidden sm:inline-block">
                              {item.category}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8A909D] truncate mt-0.5">
                          {item.generic}
                        </p>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MedicineSearchCombobox;
