'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Boxes } from 'lucide-react';
import { InventoryItem } from '@/types';

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
}

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
}: InventoryViewProps) {
  const totalMolecules = inventory.length;
  const adequateStocks = inventory.filter((m) => m.stock > 20).length;
  const lowStockAlerts = inventory.filter((m) => m.stock > 0 && m.stock <= 20).length;
  const stockDepleted = inventory.filter((m) => m.stock === 0).length;

  return (
    <motion.section
      key="inventory"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <motion.div
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(37,99,235,0.12)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-2xl p-3.5 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col gap-2 sm:gap-3 cursor-default"
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
          className="bg-white rounded-2xl p-3.5 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col gap-2 sm:gap-3 cursor-default"
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
          className="bg-white rounded-2xl p-3.5 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col gap-2 sm:gap-3 cursor-default"
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
          className="bg-white rounded-2xl p-3.5 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col gap-2 sm:gap-3 cursor-default"
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

      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm">
        <h3 className="text-sm font-bold text-[#16191E] mb-4">Master Inventory Status</h3>
        <div className="space-y-3">
          {inventory.length === 0 ? (
            <div className="p-8 text-center bg-[#F8F9FB] rounded-xl border border-[#ECEEF2]">
              <Boxes className="w-8 h-8 text-gray-300 mx-auto mb-2 stroke-[1.5]" />
              <p className="text-sm font-semibold text-gray-700">No Inventory Items in Database</p>
              <p className="text-xs text-gray-400 mt-1">
                Add pharmacy molecules above or run the SQL seed in your Supabase dashboard.
              </p>
            </div>
          ) : (
            inventory.map((item) => {
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
                      className="w-20 sm:w-24 p-1.5 bg-white border border-[#ECEEF2] rounded-xl text-xs outline-none focus:ring-1 focus:ring-gray-300"
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
        </div>
      </div>
    </motion.section>
  );
}

export default InventoryView;
