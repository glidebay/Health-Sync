'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, User, Phone } from 'lucide-react';
import { Patient } from '@/types';

interface QueueViewProps {
  queue: Patient[];
  onStartConsultation: (id: string) => void;
}

export function QueueView({
  queue,
  onStartConsultation,
}: QueueViewProps) {
  const sortedQueue = React.useMemo(() => {
    const notCompleted = queue.filter((p) => p.status !== 'Completed');
    const completed = queue.filter((p) => p.status === 'Completed');
    return [...notCompleted, ...completed];
  }, [queue]);

  return (
    <motion.section
      key="queue"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#16191E]">Pending Consultations</h2>
          <p className="text-xs text-[#8A909D]">
            Click any waiting patient to begin consultation & digital charting
          </p>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {sortedQueue.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-[#ECEEF2] text-center shadow-xs">
            <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-bold text-[#16191E]">No Active Patients in Consultation Queue</h3>
            <p className="text-xs text-[#8A909D] mt-1 max-w-sm mx-auto">
              Patients registered at the Assistant Desk will appear here in real time.
            </p>
          </div>
        ) : (
          sortedQueue.map((p) => {
            const isCompleted = p.status === 'Completed';
            return (
              <motion.div
                key={p.id}
                whileHover={!isCompleted ? { y: -3, boxShadow: '0 10px 24px -6px rgba(0,0,0,0.07)' } : {}}
                onClick={() => !isCompleted && onStartConsultation(p.id)}
                className={`bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isCompleted ? 'opacity-60 cursor-default' : 'cursor-pointer hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                  <motion.div
                    whileHover={{ rotate: 8 }}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB] flex-shrink-0"
                  >
                    <User className="w-5 h-5 stroke-[2]" />
                  </motion.div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-[#16191E] truncate">{p.name}</h3>
                      <span className="text-xs text-[#8A909D] font-medium flex-shrink-0">
                        ({p.displayId || (p.tokenNumber ? `P${String(p.tokenNumber).padStart(3, '0')}` : 'P001')})
                      </span>
                    </div>
                    <p className="text-xs text-[#5E6470] mt-0.5 truncate flex items-center flex-wrap gap-1">
                      <span>{p.age} Yrs • {p.gender}</span>
                      {p.phone && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-gray-600">
                            <Phone className="w-3 h-3 text-[#2563EB]" />
                            {p.phone}
                          </span>
                        </>
                      )}
                      <span>• Slot: {p.time}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#ECEEF2]">
                  <span
                    className={`text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-xl ${
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
                    <span className="text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap">
                      Start Consult &rarr;
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.section>
  );
}

export default QueueView;
