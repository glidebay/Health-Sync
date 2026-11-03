'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Boxes, AlertTriangle, CheckCircle, Plus, Check } from 'lucide-react';
import { InventoryItem } from '@/types';

interface GlobalPharmacySearchProps {
  inventory: InventoryItem[];
  onSelectMedicine?: (medicine: InventoryItem) => void;
  onUpdateStock?: (id: string | number) => void;
  stockUpdates?: Record<string, string>;
  setStockUpdates?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  placeholder?: string;
  className?: string;
  isMobile?: boolean;
  isExpanded?: boolean;
  onClose?: () => void;
}

export function GlobalPharmacySearch({
  inventory = [],
  onSelectMedicine,
  onUpdateStock,
  stockUpdates,
  setStockUpdates,
  placeholder = 'Search pharmacy stock by brand, molecule or status (e.g. Dolo, Paracetamol, Low)...',
  className = '',
  isMobile = false,
  isExpanded = false,
  onClose,
}: GlobalPharmacySearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(isExpanded || isMobile);
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'depleted' | 'adequate'>('all');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [localUpdates, setLocalUpdates] = useState<Record<string, string>>({});
  const [updatedFeedback, setUpdatedFeedback] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto focus input when expanded
  useEffect(() => {
    if (isExpanded || isMobile) {
      inputRef.current?.focus();
    }
  }, [isExpanded, isMobile]);

  // Click outside to close
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

  // Escape key to close
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

  // Filter inventory
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();

    return inventory.filter((item) => {
      // Status filter
      if (statusFilter === 'low' && !(item.stock > 0 && item.stock <= 20)) return false;
      if (statusFilter === 'depleted' && item.stock !== 0) return false;
      if (statusFilter === 'adequate' && item.stock <= 20) return false;

      if (!q) return true;

      // Smart status queries in text
      if (q === 'low' || q === 'low stock') {
        return item.stock > 0 && item.stock <= 20;
      }
      if (q === 'out' || q === 'out of stock' || q === 'depleted' || q === '0') {
        return item.stock === 0;
      }
      if (q === 'adequate' || q === 'in stock') {
        return item.stock > 20;
      }

      const brandMatch = (item.brand || '').toLowerCase().includes(q);
      const genericMatch = (item.generic || '').toLowerCase().includes(q);
      const categoryMatch = (item.category || '').toLowerCase().includes(q);

      return brandMatch || genericMatch || categoryMatch;
    });
  }, [inventory, query, statusFilter]);

  const handleClear = () => {
    setQuery('');
    setStatusFilter('all');
    inputRef.current?.focus();
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleStockUpdate = (e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation();
    const qtyValue = (stockUpdates ? stockUpdates[item.id] : localUpdates[item.id]) || '';
    if (!qtyValue || parseInt(qtyValue, 10) <= 0) return;

    if (onUpdateStock) {
      onUpdateStock(item.id);
    }

    // Flash success checkmark
    setUpdatedFeedback((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setUpdatedFeedback((prev) => ({ ...prev, [item.id]: false }));
    }, 1800);
  };

  const handleQtyChange = (itemId: string | number, value: string) => {
    if (setStockUpdates) {
      setStockUpdates((prev) => ({ ...prev, [itemId]: value }));
    } else {
      setLocalUpdates((prev) => ({ ...prev, [itemId]: value }));
    }
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
          className={`w-full pl-10 pr-10 py-2.5 bg-white border border-[#ECEEF2] rounded-xl text-xs sm:text-sm text-[#16191E] placeholder:text-gray-400 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs ${
            isExpanded ? 'h-11' : ''
          }`}
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            title="Clear search query"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {(isExpanded || (isMobile && onClose)) && (
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center gap-1.5 h-11 px-3 sm:px-4 rounded-xl bg-white hover:bg-gray-100 border border-[#ECEEF2] text-xs font-semibold text-gray-600 hover:text-gray-900 shadow-2xs transition cursor-pointer flex-shrink-0"
          title="Close search (Esc)"
        >
          <X className="w-4 h-4 stroke-[2.2]" />
          <span className="hidden sm:inline">Close</span>
        </button>
      )}

      {/* Floating Results Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-[#ECEEF2] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header with Quick Filters */}
            <div className="px-3.5 sm:px-4 py-2.5 bg-[#F8F9FB] border-b border-[#ECEEF2] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[#8A909D] font-medium mr-1 text-[11px] sm:text-xs">
                  {searchResults.length} {searchResults.length === 1 ? 'molecule' : 'molecules'} found
                </span>

                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-[#ECEEF2] text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('low')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition cursor-pointer ${
                    statusFilter === 'low'
                      ? 'bg-amber-500 text-white'
                      : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  Low Stock (&le;20)
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('depleted')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition cursor-pointer ${
                    statusFilter === 'depleted'
                      ? 'bg-red-600 text-white'
                      : 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
                  }`}
                >
                  Depleted (0)
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('adequate')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition cursor-pointer ${
                    statusFilter === 'adequate'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Adequate (&gt;20)
                </button>
              </div>

              <span className="text-[11px] text-gray-400 hidden md:inline">
                Click molecule to view / update stock
              </span>
            </div>

            {/* List of Results */}
            <div ref={listRef} className="max-h-80 sm:max-h-96 overflow-y-auto divide-y divide-[#ECEEF2] p-1.5">
              {searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-2">
                    <Boxes className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <p className="font-semibold text-gray-800">No matching stock items found</p>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
                    Try searching by generic name (e.g. Paracetamol), brand name (e.g. Dolo), or status (e.g. low stock).
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {['Paracetamol', 'Amoxicillin', 'Pantoprazole', 'Cetirizine', 'Low Stock'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setQuery(chip);
                          inputRef.current?.focus();
                        }}
                        className="text-[11px] font-medium bg-gray-100 hover:bg-blue-50 hover:text-[#2563EB] border border-gray-200 px-2.5 py-1 rounded-lg text-gray-700 transition cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                searchResults.map((item, index) => {
                  const isHighlighted = highlightedIndex === index;
                  const isAdequate = item.stock > 20;
                  const isLow = item.stock > 0 && item.stock <= 20;
                  const isDepleted = item.stock === 0;

                  const currentQty =
                    (stockUpdates ? stockUpdates[item.id] : localUpdates[item.id]) || '';
                  const hasUpdated = updatedFeedback[item.id];

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectMedicine?.(item)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-3.5 sm:px-4 py-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-colors ${
                        isHighlighted ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="font-bold text-xs sm:text-sm text-[#16191E] truncate">
                            {item.brand}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                              isAdequate
                                ? 'bg-emerald-100 text-emerald-800'
                                : isLow
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.stock} Units
                          </span>
                          {item.category && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                              {item.category}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8A909D] font-medium mt-0.5 truncate">
                          {item.generic}
                        </p>
                      </div>

                      {/* Inline Stock Adder */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center space-x-2 self-end sm:self-auto flex-shrink-0"
                      >
                        <input
                          type="number"
                          min="1"
                          placeholder="+Qty"
                          value={currentQty}
                          onChange={(e) => handleQtyChange(item.id, e.target.value)}
                          className="w-16 sm:w-20 p-1.5 bg-white border border-[#ECEEF2] rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-400 text-center font-medium"
                        />
                        <button
                          type="button"
                          onClick={(e) => handleStockUpdate(e, item)}
                          disabled={!currentQty || parseInt(currentQty, 10) <= 0}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                            hasUpdated
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white'
                          }`}
                          title="Add quantity to stock"
                        >
                          {hasUpdated ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
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

export default GlobalPharmacySearch;
