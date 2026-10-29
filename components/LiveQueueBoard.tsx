'use client';

import React from "react";
import { useLiveQueue } from "@/hooks/useLiveQueue";
import EcgActionLoader from "@/components/loading/EcgActionLoader";

interface LiveQueueBoardProps {
  doctorId?: string;
  date?: string;
}

export function LiveQueueBoard({ doctorId, date }: LiveQueueBoardProps) {
  const { queue, loading, refetch } = useLiveQueue(doctorId, date);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-500 relative flex items-center justify-center min-h-[220px]">
        <EcgActionLoader overlay={false} text="Synchronizing Live Queue..." />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Today's Live Queue</h2>
          <p className="text-sm text-slate-500">Auto-synchronized with Doctor Cabin</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="text-xs font-semibold px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition cursor-pointer"
          >
            ↻ Refresh
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Live WebSocket Active</span>
          </div>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <p className="text-sm font-semibold">No patients currently in the live queue.</p>
          <p className="text-xs text-slate-400 mt-1">Bookings and registered walk-ins will appear here automatically.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Token #</th>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Scheduled</th>
                <th className="py-3 px-4">Live Status</th>
                <th className="py-3 px-4">Estimated Call Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {queue.map((pt) => {
                const isOnline = pt.visit_type?.toLowerCase().includes("whatsapp") || pt.visit_type?.toLowerCase().includes("online");
                const channelLabel = isOnline ? "Online" : "Walk-in";

                return (
                  <tr 
                    key={pt.appointment_id || pt.queue_token_no}
                    className={
                      pt.is_in_cabin 
                        ? "bg-emerald-50/70 font-semibold transition" 
                        : pt.is_next 
                        ? "bg-amber-50/60 transition" 
                        : "hover:bg-slate-50 transition"
                    }
                  >
                    <td className="py-3.5 px-4 font-black text-slate-800">
                      #{pt.queue_token_no}
                      {pt.priority === "Urgent" && (
                        <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">EMERGENCY</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-900 font-medium">
                      {pt.patient_name}
                      {pt.age && <span className="text-xs text-slate-400 font-normal ml-1.5">({pt.age}y • {pt.gender})</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isOnline ? "bg-emerald-100 text-emerald-800 border border-emerald-200/50" : "bg-slate-100 text-slate-700 border border-slate-200/50"
                      }`}>
                        {channelLabel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{pt.scheduled_slot}</td>
                    <td className="py-3.5 px-4">
                      {pt.is_in_cabin ? (
                        <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5 w-max shadow-2xs">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          In Cabin
                        </span>
                      ) : pt.is_next ? (
                        <span className="px-2.5 py-1 bg-amber-500 text-white rounded-full text-xs font-bold w-max shadow-2xs">
                          Next in Line
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium border border-slate-200/40">
                          Waiting ({pt.wait_time_mins}m wait)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                      {pt.estimated_call_time}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default LiveQueueBoard;
