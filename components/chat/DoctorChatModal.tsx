'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Phone,
  CheckCircle2,
  Search,
  RefreshCw,
  MessageSquare,
  Check,
} from 'lucide-react';
import { DbDoctor } from '@/types/database';
import { PatientChatThread } from '@/types/chat';
import { fetchInboundChatThreads } from '@/lib/supabaseService';

interface DoctorChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDoctors?: DbDoctor[];
  currentDoctorName?: string;
  onBookingSuccess?: () => void;
}

export function DoctorChatModal({
  isOpen,
  onClose,
}: DoctorChatModalProps) {
  // Threads state
  const [threads, setThreads] = useState<PatientChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'booked'>('all');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load patient threads
  const loadThreads = async () => {
    setIsLoadingThreads(true);
    try {
      const data = await fetchInboundChatThreads();
      setThreads(data);
      if (data.length > 0 && !selectedThreadId) {
        setSelectedThreadId(data[0].id);
      }
    } catch (err) {
      console.warn('Failed to load chat threads:', err);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadThreads();
    }
  }, [isOpen]);

  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === selectedThreadId) || threads[0] || null;
  }, [threads, selectedThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  // Filtered threads
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const match =
        t.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.phoneNumber.includes(searchQuery);
      if (!match) return false;
      if (filterTab === 'pending') return t.status !== 'booked';
      if (filterTab === 'booked') return t.status === 'booked';
      return true;
    });
  }, [threads, searchQuery, filterTab]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4">
        <motion.div
          key="clean-chat-modal"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] max-h-[720px] shadow-2xl border border-[#ECEEF2] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-[#ECEEF2] flex items-center justify-between bg-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
                <MessageSquare className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#16191E]">
                  Patient Booking Inquiries
                </h3>
                <p className="text-[11px] text-[#8A909D]">
                  Incoming WhatsApp messages and appointment requests
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={loadThreads}
                title="Refresh messages"
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#16191E] hover:bg-gray-100 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingThreads ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#16191E] hover:bg-gray-100 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2-Pane Split */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-white">
            {/* Left Pane: Patient List (Name & Mobile Number) */}
            <div className="w-full md:w-72 lg:w-80 border-r border-[#ECEEF2] flex flex-col flex-shrink-0 bg-white">
              {/* Search & Tabs */}
              <div className="p-3 border-b border-[#ECEEF2] space-y-2 bg-[#F8F9FB]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#8A909D] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or mobile..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white rounded-xl border border-[#ECEEF2] text-xs text-[#16191E] placeholder-[#8A909D] focus:outline-none focus:border-[#2563EB] transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#16191E]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center bg-gray-200/60 p-0.5 rounded-lg text-[11px] font-semibold text-[#8A909D]">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`flex-1 py-1 rounded-md transition text-center cursor-pointer ${
                      filterTab === 'all'
                        ? 'bg-white text-[#2563EB] shadow-2xs font-bold'
                        : 'hover:text-[#16191E]'
                    }`}
                  >
                    All ({threads.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('pending')}
                    className={`flex-1 py-1 rounded-md transition text-center cursor-pointer ${
                      filterTab === 'pending'
                        ? 'bg-white text-[#2563EB] shadow-2xs font-bold'
                        : 'hover:text-[#16191E]'
                    }`}
                  >
                    Pending ({threads.filter((t) => t.status !== 'booked').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('booked')}
                    className={`flex-1 py-1 rounded-md transition text-center cursor-pointer ${
                      filterTab === 'booked'
                        ? 'bg-white text-[#2563EB] shadow-2xs font-bold'
                        : 'hover:text-[#16191E]'
                    }`}
                  >
                    Booked ({threads.filter((t) => t.status === 'booked').length})
                  </button>
                </div>
              </div>

              {/* Patient Items List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#ECEEF2]">
                {filteredThreads.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#8A909D]">
                    No patient booking requests found
                  </div>
                ) : (
                  filteredThreads.map((thread) => {
                    const isSelected = activeThread?.id === thread.id;
                    const isBooked = thread.status === 'booked';
                    const isUrgent = thread.priority === 'Urgent';

                    return (
                      <div
                        key={thread.id}
                        onClick={() => {
                          setSelectedThreadId(thread.id);
                          setThreads((prev) =>
                            prev.map((t) =>
                              t.id === thread.id ? { ...t, unread: false } : t
                            )
                          );
                        }}
                        className={`p-3 text-left transition cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-blue-50/70 border-l-3 border-[#2563EB]'
                            : 'hover:bg-[#F8F9FB]'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isBooked
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : isUrgent
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-[#F8F9FB] border border-[#ECEEF2] text-[#16191E]'
                          }`}
                        >
                          {thread.patientName.charAt(0).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-bold text-[#16191E] truncate">
                              {thread.patientName}
                            </span>
                            <span className="text-[10px] text-[#8A909D] whitespace-nowrap">
                              {thread.lastMessageTime}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-[#8A909D] mb-1">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span>{thread.phoneNumber}</span>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            {isBooked ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                <Check className="w-2.5 h-2.5" />
                                {thread.tokenNumber ? `#${thread.tokenNumber}` : 'Booked'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700">
                                {thread.requestedSlot || 'Requested Slot'}
                              </span>
                            )}

                            {isUrgent && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                Urgent
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Pane: Patient Message Stream */}
            <div className="flex-1 flex flex-col h-full min-w-0 bg-[#F8FAFC]">
              {activeThread ? (
                <>
                  {/* Top Bar for Selected Patient */}
                  <div className="px-4 py-3 bg-white border-b border-[#ECEEF2] flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#F8F9FB] border border-[#ECEEF2] flex items-center justify-center text-xs font-bold text-[#16191E]">
                        {activeThread.patientName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[#16191E] truncate">
                            {activeThread.patientName}
                          </span>
                          {activeThread.priority === 'Urgent' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                              Urgent
                            </span>
                          )}
                          {activeThread.status === 'booked' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Booked #{activeThread.tokenNumber || 'P001'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#8A909D] flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{activeThread.phoneNumber}</span>
                          {activeThread.requestedSlot && (
                            <span>• Wants {activeThread.requestedSlot}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Messages Stream (Takes up the whole pane) */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                    {activeThread.messages.map((msg) => {
                      const isDoctor = msg.sender === 'doctor';

                      if (msg.isBookingReceipt) {
                        return (
                          <div key={msg.id} className="flex justify-end">
                            <div className="max-w-sm bg-white border border-emerald-200 p-3.5 rounded-2xl shadow-xs space-y-2">
                              <div className="flex items-center justify-between border-b border-[#ECEEF2] pb-1.5">
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Slot Confirmed
                                </span>
                                <span className="text-[10px] text-[#8A909D]">{msg.date}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] text-[#8A909D] block">Token</span>
                                  <span className="text-xl font-bold text-[#2563EB]">
                                    #{msg.tokenNumber}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-[#8A909D] block">Slot Time</span>
                                  <span className="text-xs font-bold text-[#16191E]">{msg.slotTime}</span>
                                </div>
                              </div>
                              <p className="text-[11px] text-[#8A909D] pt-1">{msg.text}</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isDoctor ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                              isDoctor
                                ? 'bg-[#2563EB] text-white rounded-tr-xs'
                                : 'bg-white text-[#16191E] border border-[#ECEEF2] rounded-tl-xs shadow-2xs'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <span
                              className={`text-[9px] block text-right mt-1.5 ${
                                isDoctor ? 'text-blue-100' : 'text-[#8A909D]'
                              }`}
                            >
                              {msg.timestamp}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8A909D]">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">Select a patient to view messages</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default DoctorChatModal;
