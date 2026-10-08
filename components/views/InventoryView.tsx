'use client';

import React, { useState } from 'react';
import { useClinic } from '@/context/ClinicContext';
import {
  Package,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  Layers,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';

export default function InventoryView() {
  const {
    inventory,
    addNewInventoryItem,
    restockItem
  } = useClinic();

  const [generic, setGeneric] = useState('');
  const [brand, setBrand] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('Tablets');
  const [successMsg, setSuccessMsg] = useState(false);

  // Quick replenish input state map
  const [restockInputs, setRestockInputs] = useState<Record<number, string>>({});
  const [activeFilter, setActiveFilter] = useState<'all' | 'low' | 'out'>('all');

  const handleAddProcurement = (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseInt(qty, 10);
    if (!generic.trim() || !brand.trim() || !numQty || numQty <= 0) return;

    const ok = addNewInventoryItem(generic, brand, numQty, unit);
    if (ok) {
      setGeneric('');
      setBrand('');
      setQty('');
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    }
  };

  const handleRestockSubmit = (id: number) => {
    const amount = parseInt(restockInputs[id] || '0', 10);
    if (amount > 0) {
      restockItem(id, amount);
      setRestockInputs(prev => ({ ...prev, [id]: '' }));
    }
  };

  const totalSKUs = inventory.length;
  const lowStockCount = inventory.filter(i => i.stock > 0 && i.stock <= 20).length;
  const outOfStockCount = inventory.filter(i => i.stock === 0).length;
  const healthyStockCount = inventory.filter(i => i.stock > 20).length;

  const filteredInventory = inventory.filter(item => {
    if (activeFilter === 'low') return item.stock > 0 && item.stock <= 20;
    if (activeFilter === 'out') return item.stock === 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Inventory Header & Stats Overview (Nexuma Stat Tiles) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="apple-glass rounded-[20px] p-4 sm:p-5 border border-slate-200/80 apple-card-shadow">
          <span className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-500 block">
            Total Molecules
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl sm:text-3xl font-display font-bold text-slate-900">{totalSKUs}</span>
            <span className="text-xs font-sans text-slate-500 font-medium">SKUs</span>
          </div>
        </div>

        <div className="apple-glass rounded-[20px] p-4 sm:p-5 border border-slate-200/80 apple-card-shadow">
          <span className="text-[11px] font-display font-bold uppercase tracking-wider text-emerald-600 block">
            Adequate Stock
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl sm:text-3xl font-display font-bold text-emerald-700">{healthyStockCount}</span>
            <span className="text-xs font-sans text-emerald-600 font-medium">&gt; 20 units</span>
          </div>
        </div>

        <div className="apple-glass rounded-[20px] p-4 sm:p-5 border border-slate-200/80 apple-card-shadow">
          <span className="text-[11px] font-display font-bold uppercase tracking-wider text-amber-600 block">
            Low Stock Alerts
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl sm:text-3xl font-display font-bold text-amber-600">{lowStockCount}</span>
            <span className="text-xs font-sans text-amber-600 font-medium">Restock soon</span>
          </div>
        </div>

        <div className="apple-glass rounded-[20px] p-4 sm:p-5 border border-slate-200/80 apple-card-shadow">
          <span className="text-[11px] font-display font-bold uppercase tracking-wider text-rose-600 block">
            Stockout Depleted
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl sm:text-3xl font-display font-bold text-rose-600">{outOfStockCount}</span>
            <span className="text-xs font-sans text-rose-600 font-medium">0 units</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Register New Procurement Card (4 cols) */}
        <div className="lg:col-span-4">
          <div className="apple-glass rounded-[24px] p-6 sm:p-7 border border-slate-200/85 apple-card-shadow sticky top-20">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base tracking-tight">New Procurement</h3>
                <p className="text-xs font-sans text-slate-500 mt-0.5">Add batches to clinic master stock</p>
              </div>
            </div>

            {successMsg && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-display font-semibold flex items-center gap-2 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Medicine successfully added to inventory!</span>
              </div>
            )}

            <form onSubmit={handleAddProcurement} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                  Generic Molecule & Strength
                </label>
                <input
                  type="text"
                  required
                  value={generic}
                  onChange={e => setGeneric(e.target.value)}
                  placeholder="e.g. Paracetamol 650mg"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-slate-900 text-sm transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                  Brand Name
                </label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="e.g. Dolo 650"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-slate-900 text-sm transition-all shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                    Procured Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-slate-900 text-sm transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                    Dosage Unit
                  </label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-slate-900 text-sm transition-all shadow-2xs"
                  >
                    <option value="Tablets">Tablets</option>
                    <option value="Capsules">Capsules</option>
                    <option value="Syrup / Bottles">Syrup / Bottles</option>
                    <option value="Injections">Injections</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-display font-semibold text-sm shadow-md shadow-indigo-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-sky-200" />
                <span>Add to Master Stock</span>
              </button>
            </form>
          </div>
        </div>

        {/* Master Stock Listing (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span>Master Inventory Status</span>
            </h2>

            {/* Quick Filter (Nexuma Pill Style) */}
            <div className="flex items-center p-1 bg-slate-100/90 rounded-full border border-slate-200/80 shadow-inner text-xs self-start sm:self-auto">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3.5 py-1.5 rounded-full font-display transition-all ${
                  activeFilter === 'all' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                All ({inventory.length})
              </button>
              <button
                onClick={() => setActiveFilter('low')}
                className={`px-3.5 py-1.5 rounded-full font-display transition-all ${
                  activeFilter === 'low' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                Low ({lowStockCount})
              </button>
              <button
                onClick={() => setActiveFilter('out')}
                className={`px-3.5 py-1.5 rounded-full font-display transition-all ${
                  activeFilter === 'out' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                Out ({outOfStockCount})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredInventory.map(item => {
              const isDepleted = item.stock === 0;
              const isLow = item.stock > 0 && item.stock <= 20;

              return (
                <div
                  key={item.id}
                  className={`apple-glass rounded-[20px] p-5 border apple-card-shadow flex flex-col justify-between gap-4 transition-all ${
                    isDepleted
                      ? 'border-rose-300/80 bg-rose-50/30'
                      : isLow
                      ? 'border-amber-300/80 bg-amber-50/30'
                      : 'border-slate-200/85 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-display font-bold text-slate-900 text-base tracking-tight">
                        {item.brand}
                      </h4>
                      <p className="text-xs font-sans text-slate-500 font-medium mt-0.5">
                        {item.generic}
                      </p>
                      {item.batchNo && (
                        <span className="text-[10px] text-slate-400 font-mono mt-1.5 block">
                          Batch: {item.batchNo}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`inline-flex flex-col items-center px-3.5 py-1.5 rounded-2xl border shadow-2xs ${
                          isDepleted
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : isLow
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                      >
                        <span className="text-xl font-display font-bold leading-none">{item.stock}</span>
                        <span className="text-[9px] uppercase font-display font-bold tracking-wider mt-0.5">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stock Replenish Action */}
                  <div className="pt-3.5 border-t border-slate-100 flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="+ Qty"
                      value={restockInputs[item.id] || ''}
                      onChange={e =>
                        setRestockInputs({
                          ...restockInputs,
                          [item.id]: e.target.value
                        })
                      }
                      className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-sans bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 shadow-2xs"
                    />
                    <button
                      onClick={() => handleRestockSubmit(item.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-display font-semibold shadow-xs transition-colors active:scale-95 cursor-pointer"
                    >
                      Add Stock
                    </button>
                    {isLow && (
                      <span className="text-[10px] font-display font-bold text-amber-700 ml-auto">
                        Low Stock
                      </span>
                    )}
                    {isDepleted && (
                      <span className="text-[10px] font-display font-bold text-rose-700 ml-auto">
                        Out of Stock
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
