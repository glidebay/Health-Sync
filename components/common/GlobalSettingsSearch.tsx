'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { SETTINGS_METADATA, ParameterMetadata } from '@/data/default-config';

interface GlobalSettingsSearchProps {
  onSelectSetting?: (key: string, category?: string) => void;
  placeholder?: string;
  className?: string;
  isMobile?: boolean;
  isExpanded?: boolean;
  onClose?: () => void;
}

export function GlobalSettingsSearch({
  onSelectSetting,
  placeholder = 'Search settings...',
  className = '',
  isMobile = false,
  isExpanded = false,
  onClose,
}: GlobalSettingsSearchProps) {
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
    if (!q) return SETTINGS_METADATA.slice(0, 8);

    return SETTINGS_METADATA.filter((meta) => {
      const nameMatch = (meta.name || '').toLowerCase().includes(q);
      const descMatch = (meta.description || '').toLowerCase().includes(q);
      const catMatch = (meta.category || '').toLowerCase().includes(q);
      const keyMatch = (meta.key || '').toLowerCase().includes(q);
      return nameMatch || descMatch || catMatch || keyMatch;
    });
  }, [query]);

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handleSelect = (meta: ParameterMetadata) => {
    onSelectSetting?.(meta.key, meta.category);
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
              {searchResults.length} {searchResults.length === 1 ? 'setting' : 'settings'} found
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-[#ECEEF2] p-1">
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-gray-500">
                  <SlidersHorizontal className="w-6 h-6 text-gray-300 mx-auto mb-1.5 stroke-[1.5]" />
                  <p className="font-semibold text-gray-700">No settings found</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Try searching with a different keyword like PIN, quota, phone, or template.</p>
                </div>
              ) : (
                searchResults.map((meta, index) => {
                  const isHighlighted = highlightedIndex === index;

                  return (
                    <div
                      key={meta.key}
                      onClick={() => handleSelect(meta)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-xs cursor-pointer transition ${
                        isHighlighted ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-[#16191E] truncate">{meta.name}</p>
                        <p className="text-[11px] text-[#8A909D] truncate mt-0.5">{meta.description}</p>
                      </div>

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 flex-shrink-0">
                        {meta.category.split('&')[0].trim()}
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

export default GlobalSettingsSearch;

