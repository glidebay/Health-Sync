'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Boxes, Search, X, Filter } from 'lucide-react';
import { InventoryItem } from '@/types';
import { NumberedPagination } from '@/components/ui/pagination';

interface InventoryViewProps {
  inventory: InventoryItem[];
  newGeneric: string;
  setNewGeneric: (v: string) => void;
  newBrand: string;
  setNewBrand: (v: string) => void;
  newQty: string;
  setNewQty: (v: string) => void;
  stockUpdates: Record<string, string>;
  setStockUpdates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAddNewProcurement: (e: React.FormEvent) => void;
  onUpdateStock: (id: string | number) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const ITEMS_PER_PAGE = 8;

export function InventoryView({
  inventory,
  newGeneric,
  setNewGeneric,
  newBrand,
  setNewBrand,
  newQty,
  setNewQty,
  stockUpdates,
  setStockUpdates,
  onAddNewProcurement,
  onUpdateStock,
  searchQuery = '',
  onSearchChange,
}: InventoryViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [internalSearch, setInternalSearch] = useState(searchQuery);
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'depleted' | 'adequate'>('all');

  // Sync external searchQuery with internal
  useEffect(() => {
    setInternalSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setInternalSearch(value);
    setCurrentPage(1);
    onSearchChange?.(value);
  };

  const totalMolecules = inventory.length;
  const adequateStocks = inventory.filter((m) => m.stock > 20).length;
  const lowStockAlerts = inventory.filter((m) => m.stock > 0 && m.stock <= 20).length;
  const stockDepleted = inventory.filter((m) => m.stock === 0).length;

  // Filtered inventory based on search query and status filter
  const filteredInventory = useMemo(() => {
    const q = internalSearch.trim().toLowerCase();

    return inventory.filter((item) => {
      // Status filter
      if (stockStatusFilter === 'low' && !(item.stock > 0 && item.stock <= 20)) return false;
      if (stockStatusFilter === 'depleted' && item.stock !== 0) return false;
      if (stockStatusFilter === 'adequate' && item.stock <= 20) return false;

      if (!q) return true;

      // Smart status keywords
      if (q === 'low' || q === 'low stock') {
        return item.stock > 0 && item.stock <= 20;
      }
      if (q === 'depleted' || q === 'out of stock' || q === 'out') {
        return item.stock === 0;
      }
      if (q === 'adequate' || q === 'available') {
        return item.stock > 20;
      }

      const brandMatch = (item.brand || '').toLowerCase().includes(q);
      const genericMatch = (item.generic || '').toLowerCase().includes(q);
      const categoryMatch = (item.category || '').toLowerCase().includes(q);

      return brandMatch || genericMatch || categoryMatch;
    });
  }, [inventory, internalSearch, stockStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInventory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInventory, currentPage]);

  return (
    <motion.section
      key="inventory"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#16191E]">Pharmacy Stock & Inventory</h2>
          <p className="text-xs text-[#8A909D] font-medium">
            Monitor molecule stock levels, record new procurements, and manage pharmacy dispensary
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <motion.div
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(37,99,235,0.12)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          onClick={() => {
            setStockStatusFilter('all');
            setCurrentPage(1);
          }}
          className={`bg-white rounded-2xl p-3.5 sm:p-5 border shadow-sm flex flex-col gap-2 sm:gap-3 cursor-pointer transition ${
            stockStatusFilter === 'all' ? 'border-[#2563EB] ring-1 ring-blue-200' : 'border-[#ECEEF2]'
          }`}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-4.5 sm:h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" /></svg>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-extrabold text-[#16191E]">{totalMolecules}</p>
            <p className="text-[11px] sm:text-xs font-semibold text-[#8A909D] mt-0.5">Total Molecules</p>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(5,150,105,0.12)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          onClick={() => {
            setStockStatusFilter('adequate');
            setCurrentPage(1);
          }}
          className={`bg-white rounded-2xl p-3.5 sm:p-5 border shadow-sm flex flex-col gap-2 sm:gap-3 cursor-pointer transition ${
            stockStatusFilter === 'adequate' ? 'border-emerald-500 ring-1 ring-emerald-200' : 'border-[#ECEEF2]'
          }`}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-4.5 sm:h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-600">{adequateStocks}</p>
            <p className="text-[11px] sm:text-xs font-semibold text-[#8A909D] mt-0.5">Adequate Stocks</p>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(217,119,6,0.12)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          onClick={() => {
            setStockStatusFilter('low');
            setCurrentPage(1);
          }}
          className={`bg-white rounded-2xl p-3.5 sm:p-5 border shadow-sm flex flex-col gap-2 sm:gap-3 cursor-pointer transition ${
            stockStatusFilter === 'low' ? 'border-amber-500 ring-1 ring-amber-200' : 'border-[#ECEEF2]'
          }`}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-4.5 sm:h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-extrabold text-amber-600">{lowStockAlerts}</p>
            <p className="text-[11px] sm:text-xs font-semibold text-[#8A909D] mt-0.5">Low Stock Alert</p>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(220,38,38,0.12)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          onClick={() => {
            setStockStatusFilter('depleted');
            setCurrentPage(1);
          }}
          className={`bg-white rounded-2xl p-3.5 sm:p-5 border shadow-sm flex flex-col gap-2 sm:gap-3 cursor-pointer transition ${
            stockStatusFilter === 'depleted' ? 'border-red-500 ring-1 ring-red-200' : 'border-[#ECEEF2]'
          }`}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-4.5 sm:h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" /></svg>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-extrabold text-red-600">{stockDepleted}</p>
            <p className="text-[11px] sm:text-xs font-semibold text-[#8A909D] mt-0.5">Stock Depleted</p>
          </div>
        </motion.div>
      </div>

      {/* Procurement Form */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm">
        <h3 className="text-sm font-bold text-[#16191E] mb-3">Register New Procurement</h3>
        <form onSubmit={onAddNewProcurement} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3">
          <input
            type="text"
            placeholder="Generic Molecule (e.g. Paracetamol 650mg)"
            value={newGeneric}
            onChange={(e) => setNewGeneric(e.target.value)}
            required
            className="col-span-1 md:col-span-1 xl:col-span-5 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm outline-none focus:ring-1 focus:ring-gray-300 w-full"
          />
          <input
            type="text"
            placeholder="Brand (e.g. Dolo 650)"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            required
            className="col-span-1 md:col-span-1 xl:col-span-4 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm outline-none focus:ring-1 focus:ring-gray-300 w-full"
          />
          <div className="col-span-1 md:col-span-2 xl:col-span-3 flex gap-2">
            <input
              type="number"
              placeholder="Total Qty"
              min="1"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              required
              className="w-24 sm:w-28 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm outline-none focus:ring-1 focus:ring-gray-300 flex-shrink-0"
            />
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              type="submit"
              className="flex-1 xl:flex-initial bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap min-w-[90px] flex items-center justify-center shadow-xs"
            >
              Add Stock
            </motion.button>
          </div>
        </form>
      </div>

      {/* Master Inventory Section with Dedicated Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#16191E]">Master Inventory Status</h3>
            <p className="text-[11px] text-[#8A909D] font-medium mt-0.5">
              Showing {filteredInventory.length} of {inventory.length} total molecules
            </p>
          </div>

          {/* Pharmacy Stock Search Bar in Page */}
          <div className="flex items-center gap-2 flex-1 md:max-w-md">
            <div className="relative flex-1 flex items-center">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#2563EB]">
                <Search className="w-3.5 h-3.5 stroke-[2.2]" />
              </span>
              <input
                type="text"
                value={internalSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search stock by brand, molecule or status..."
                className="w-full pl-9 pr-8 py-2 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] placeholder:text-gray-400 outline-none focus:border-[#2563EB] focus:bg-white focus:ring-1 focus:ring-blue-100 transition"
              />
              {internalSearch && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Filter Dropdown / Reset */}
            {stockStatusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setStockStatusFilter('all');
                  setCurrentPage(1);
                }}
                className="text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1 transition flex-shrink-0 cursor-pointer"
                title="Reset status filter"
              >
                <span>Filter: {stockStatusFilter}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-[#ECEEF2] no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setStockStatusFilter('all');
              setCurrentPage(1);
            }}
            className={`text-[11px] font-semibold px-3 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
              stockStatusFilter === 'all'
                ? 'bg-[#2563EB] text-white shadow-2xs'
                : 'bg-[#F8F9FB] hover:bg-gray-100 text-gray-600 border border-[#ECEEF2]'
            }`}
          >
            All Molecules ({totalMolecules})
          </button>
          <button
            type="button"
            onClick={() => {
              setStockStatusFilter('adequate');
              setCurrentPage(1);
            }}
            className={`text-[11px] font-semibold px-3 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
              stockStatusFilter === 'adequate'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-[#F8F9FB] hover:bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}
          >
            Adequate ({adequateStocks})
          </button>
          <button
            type="button"
            onClick={() => {
              setStockStatusFilter('low');
              setCurrentPage(1);
            }}
            className={`text-[11px] font-semibold px-3 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
              stockStatusFilter === 'low'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-[#F8F9FB] hover:bg-amber-50 text-amber-700 border border-amber-100'
            }`}
          >
            Low Stock ({lowStockAlerts})
          </button>
          <button
            type="button"
            onClick={() => {
              setStockStatusFilter('depleted');
              setCurrentPage(1);
            }}
            className={`text-[11px] font-semibold px-3 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
              stockStatusFilter === 'depleted'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-[#F8F9FB] hover:bg-red-50 text-red-700 border border-red-100'
            }`}
          >
            Depleted ({stockDepleted})
          </button>
        </div>

        {/* Inventory List */}
        <div className="space-y-3">
          {filteredInventory.length === 0 ? (
            <div className="p-8 text-center bg-[#F8F9FB] rounded-xl border border-[#ECEEF2]">
              <Boxes className="w-8 h-8 text-gray-300 mx-auto mb-2 stroke-[1.5]" />
              <p className="text-sm font-semibold text-gray-700">
                {internalSearch || stockStatusFilter !== 'all'
                  ? 'No matching molecules found'
                  : 'No Inventory Items in Database'}
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                {internalSearch || stockStatusFilter !== 'all'
                  ? 'Try searching with a different brand, generic molecule name, or clearing filters.'
                  : 'Add pharmacy molecules above or run the SQL seed in your Supabase dashboard.'}
              </p>
              {(internalSearch || stockStatusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    handleSearchChange('');
                    setStockStatusFilter('all');
                  }}
                  className="mt-3 text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  Clear search & filters
                </button>
              )}
            </div>
          ) : (
            paginatedInventory.map((item) => {
              const isHigh = item.stock > 20;
              const isLow = item.stock > 0 && item.stock <= 20;

              return (
                <motion.div
                  key={item.id}
                  whileHover={{ y: -2 }}
                  className="p-3.5 sm:p-4 bg-[#F8F9FB] rounded-xl border border-[#ECEEF2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-bold text-sm text-[#16191E] truncate">{item.brand}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                          isHigh
                            ? 'bg-emerald-100 text-emerald-800'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.stock} Units
                      </span>
                      {item.category && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8A909D] font-medium mt-0.5 truncate">{item.generic}</p>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto flex-shrink-0">
                    <input
                      type="number"
                      min="1"
                      placeholder="Add Qty"
                      value={stockUpdates[item.id] || ''}
                      onChange={(e) =>
                        setStockUpdates((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="w-20 sm:w-24 p-1.5 bg-white border border-[#ECEEF2] rounded-xl text-xs outline-none focus:ring-1 focus:ring-gray-300 text-center font-medium"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onUpdateStock(item.id)}
                      className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer flex-shrink-0 shadow-xs"
                    >
                      Update
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          )}

          <NumberedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredInventory.length}
            itemsPerPage={ITEMS_PER_PAGE}
            itemName="molecules"
          />
        </div>
      </div>
    </motion.section>
  );
}

export default InventoryView;
