'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Phone } from 'lucide-react';
import { Patient } from '@/types';

interface AssistantViewProps {
  queue: Patient[];
  onRegisterWalkin: () => void;
  onReallocate: (id: string) => void;
}

export function AssistantView({
  queue,
  onRegisterWalkin,
  onReallocate,
}: AssistantViewProps) {
  const sortedQueue = React.useMemo(() => {
    const notCompleted = queue.filter((p) => p.status !== 'Completed');
    const completed = queue.filter((p) => p.status === 'Completed');
    return [...notCompleted, ...completed];
  }, [queue]);

  return (
    <motion.section
      key="assistant"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#16191E]">Assistant Queue Oversight</h2>
          <p className="text-xs text-[#8A909D]">
            Coordinate incoming walk-in patients and manage token allocations
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={onRegisterWalkin}
          className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center space-x-1.5 shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register Walk-in</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {sortedQueue.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-10 border border-[#ECEEF2] text-center shadow-xs">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-bold text-[#16191E]">No Patients Registered in Database</h3>
            <p className="text-xs text-[#8A909D] mt-1 max-w-sm mx-auto">
              Use the "Register Walk-in" button above to insert patient records directly into Supabase.
            </p>
          </div>
        ) : (
          sortedQueue.map((p) => (
            <motion.div
              key={p.id}
              whileHover={{ y: -2 }}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-[#16191E] truncate">{p.name}</span>
                  <span className="text-xs text-[#8A909D] font-medium flex-shrink-0">
                    ({p.displayId || (p.tokenNumber ? `P${String(p.tokenNumber).padStart(3, '0')}` : 'P001')})
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
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
                <p className="text-xs text-[#8A909D] font-medium mt-1 truncate flex items-center flex-wrap gap-1">
                  <span>{p.age} Yrs • {p.gender}</span>
                  {p.phone && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-[#5E6470]">
                        <Phone className="w-3 h-3 text-[#2563EB]" />
                        {p.phone}
                      </span>
                    </>
                  )}
                  <span>• Slot: {p.time}</span>
                </p>
              </div>

              {p.status === 'Waiting' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onReallocate(p.id)}
                  className="text-xs font-semibold px-3 py-1.5 border border-blue-200 text-[#2563EB] rounded-xl hover:bg-blue-50 transition cursor-pointer flex-shrink-0"
                >
                  Reallocate
                </motion.button>
              )}
            </motion.div>
          ))
        )}
      </div>
    </motion.section>
  );
}

export default AssistantView;
