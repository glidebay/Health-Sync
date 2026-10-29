'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Phone,
  CheckCircle2,
  Search,
  MessageSquare,
  Play,
  Pause,
  Mic,
  Volume2,
} from 'lucide-react';
import { PatientChatThread } from '@/types/chat';
import { DbDoctor } from '@/types/database';
import { fetchInboundChatThreads, subscribeToChatUpdates } from '@/lib/supabaseService';
import { formatPatientToken } from '@/lib/utils';
import { getReadThreadStates, markThreadAsRead, isThreadUnread } from '@/lib/chatStorage';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

/**
 * Playable WhatsApp Audio Voice Note Player Component
 */
function AudioVoiceMessagePlayer({
  audioUrl,
  isDoctor,
  timestamp,
}: {
  audioUrl?: string;
  isDoctor: boolean;
  timestamp: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn('Playback error:', err);
          setLoadError(true);
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audio) {
      audio.currentTime = newTime;
    }
  };

  const cycleRate = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const waveBars = [35, 60, 45, 80, 50, 90, 70, 40, 85, 95, 60, 75, 40, 65, 80, 50, 30, 60];

  return (
    <div
      className={`p-3 rounded-2xl w-72 sm:w-80 select-none shadow-xs ${
        isDoctor
          ? 'bg-[#2563EB] text-white rounded-tr-xs'
          : 'bg-white text-[#16191E] border border-[#ECEEF2] rounded-tl-xs shadow-2xs'
      }`}
    >
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            const d = audioRef.current?.duration;
            if (d && !isNaN(d) && isFinite(d)) {
              setDuration(d);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onError={(e) => {
            console.warn('Audio playback error for url:', audioUrl, e);
            setLoadError(true);
            setIsPlaying(false);
          }}
        />
      )}

      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!audioUrl}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 shrink-0 shadow-xs cursor-pointer ${
            isDoctor
              ? 'bg-white text-[#2563EB] hover:bg-blue-50'
              : 'bg-emerald-500 text-white hover:bg-emerald-600'
          }`}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio message'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current translate-x-0.5" />
          )}
        </button>

        {/* Waveform & Scrubber */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div className="relative h-6 flex items-center group cursor-pointer">
            {/* Waveform Bars */}
            <div className="absolute inset-0 flex items-center justify-between gap-[2px] pointer-events-none">
              {waveBars.map((height, i) => {
                const barPercent = (i / waveBars.length) * 100;
                const isPlayed = barPercent <= progressPercent;
                return (
                  <span
                    key={i}
                    style={{ height: `${height}%` }}
                    className={`w-1 rounded-full transition-colors ${
                      isPlayed
                        ? isDoctor
                          ? 'bg-white'
                          : 'bg-emerald-600'
                        : isDoctor
                          ? 'bg-blue-300/50'
                          : 'bg-gray-200'
                    }`}
                  />
                );
              })}
            </div>

            {/* Invisible Range Input for Scrubbing */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              aria-label="Seek voice note"
            />
          </div>

          {/* Time & Duration */}
          <div className="flex items-center justify-between text-[10px] mt-0.5">
            <span
              className={
                isDoctor
                  ? 'text-blue-100 font-mono text-[10px]'
                  : 'text-[#8A909D] font-mono text-[10px]'
              }
            >
              {isPlaying || currentTime > 0
                ? formatTime(currentTime)
                : duration > 0
                  ? formatTime(duration)
                  : 'Voice note'}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cycleRate}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition ${
                  isDoctor
                    ? 'bg-blue-700/60 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-[#16191E] hover:bg-gray-200'
                }`}
                title="Change playback speed"
              >
                {playbackRate}x
              </button>
              <Mic
                className={`w-3.5 h-3.5 ${
                  isDoctor ? 'text-blue-200' : 'text-emerald-500'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1 pt-1 border-t border-black/5 text-[9px]">
        <span className={isDoctor ? 'text-blue-200' : 'text-[#8A909D]'}>
          {loadError ? 'Audio unavailable / Expired' : 'Voice Message'}
        </span>
        <span className={isDoctor ? 'text-blue-100' : 'text-[#8A909D]'}>
          {timestamp}
        </span>
      </div>
    </div>
  );
}

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
  const [threads, setThreads] = useState<PatientChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'booked'>('all');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Instant snap to bottom without animated scrolling down
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

const loadThreads = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoadingThreads(true);
    try {
      const data = await fetchInboundChatThreads();
      setThreads(data);
      if (data.length > 0) {
        setSelectedThreadId((prev) => prev || data[0].id);
      }
    } catch (err) {
      console.warn('Failed to load chat threads:', err);
    } finally {
      if (!silent) setIsLoadingThreads(false);
    }
  }, []);

  // Real-time synchronization: Instant Supabase WebSocket updates + 3s live polling guarantee
  useEffect(() => {
    if (!isOpen) return;

    loadThreads(false);

    // Live WebSocket connection to incoming WhatsApp messages
    const unsubscribe = subscribeToChatUpdates(() => {
      loadThreads(true);
    });

    // Live polling heartbeat while chat modal is open
    const interval = setInterval(() => {
      loadThreads(true);
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isOpen, loadThreads]);

  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === selectedThreadId) || threads[0] || null;
  }, [threads, selectedThreadId]);

  const [readStates, setReadStates] = useState<Record<string, number>>({});

  // Sync read states from storage
  useEffect(() => {
    setReadStates(getReadThreadStates());
    const onReadChange = () => setReadStates(getReadThreadStates());
    window.addEventListener('healthsync_chat_read_change', onReadChange);
    return () => window.removeEventListener('healthsync_chat_read_change', onReadChange);
  }, []);

  // Mark active thread as read whenever it is open and visible
  useEffect(() => {
    if (isOpen && activeThread && activeThread.id) {
      markThreadAsRead(activeThread.id, activeThread.messages?.length || 0);
    }
  }, [isOpen, activeThread?.id, activeThread?.messages?.length]);

  useEffect(() => {
    if (!isOpen || !activeThread) return;

    // Immediately snap to bottom without animated scrolling down
    scrollToBottom();

    // Ensure layout dimensions after render are pinned instantly to the latest message
    const rId = requestAnimationFrame(scrollToBottom);
    const t = setTimeout(scrollToBottom, 40);

    return () => {
      cancelAnimationFrame(rId);
      clearTimeout(t);
    };
  }, [isOpen, activeThread?.id, activeThread?.messages?.length, scrollToBottom]);

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

            <div className="flex items-center gap-2.5">
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

          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-white">
            <div className="w-full md:w-72 lg:w-80 border-r border-[#ECEEF2] flex flex-col flex-shrink-0 bg-white">
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
                    className={`flex-1 py-1 rounded-md transition text-center cursor-pointer ${filterTab === 'all'
                      ? 'bg-white text-[#2563EB] shadow-2xs font-bold'
                      : 'hover:text-[#16191E]'
                      }`}
                  >
                    All ({threads.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('pending')}
                    className={`flex-1 py-1 rounded-md transition text-center cursor-pointer ${filterTab === 'pending'
                      ? 'bg-white text-[#2563EB] shadow-2xs font-bold'
                      : 'hover:text-[#16191E]'
                      }`}
                  >
                    Pending ({threads.filter((t) => t.status !== 'booked').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('booked')}
                    className={`flex-1 py-1 rounded-md transition text-center cursor-pointer ${filterTab === 'booked'
                      ? 'bg-white text-[#2563EB] shadow-2xs font-bold'
                      : 'hover:text-[#16191E]'
                      }`}
                  >
                    Booked ({threads.filter((t) => t.status === 'booked').length})
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#ECEEF2] relative">
                <EcgActionLoader isLoading={isLoadingThreads} size="sm" text="Syncing WhatsApp chats..." />
                {filteredThreads.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#8A909D]">
                    No patient booking requests found
                  </div>
                ) : (
                  filteredThreads.map((thread) => {
                    const isSelected = activeThread?.id === thread.id;
                    const isBooked = thread.status === 'booked';
                    const isUrgent = thread.priority === 'Urgent';
                    const isUnread = isThreadUnread(thread, readStates);

                    return (
                      <div
                        key={thread.id}
                        onClick={() => {
                          setSelectedThreadId(thread.id);
                          markThreadAsRead(thread.id, thread.messages?.length || 0);
                        }}
                        className={`p-3 text-left transition cursor-pointer flex items-start gap-2.5 ${isSelected
                          ? 'bg-blue-50/70 border-l-3 border-[#2563EB]'
                          : 'hover:bg-[#F8F9FB]'
                          }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${isBooked
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
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-xs truncate ${isUnread ? 'font-black text-[#16191E]' : 'font-bold text-[#16191E]'}`}>
                                {thread.patientName}
                              </span>
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-red-600 shrink-0 ring-2 ring-red-200" title="Unopened message" />
                              )}
                              {isUrgent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                                  Urgent
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#8A909D] whitespace-nowrap">
                              {thread.lastMessageTime}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-[#8A909D]">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{thread.phoneNumber}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col h-full min-w-0 bg-[#F8FAFC]">
              {activeThread ? (
                <>
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
                        </div>
                        <span className="text-[11px] text-[#8A909D] flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{activeThread.phoneNumber}</span>
                        </span>
                      </div>
                    </div>
                  </div>

<div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 pb-6 space-y-3"
                  >
                    {activeThread.messages.map((msg) => {
                      const isDoctor = msg.sender === 'doctor';
                      const rawMsgText = typeof msg.text === 'string' ? msg.text.trim() : '';
                      const isMediaIdString =
                        /^FA[A-Za-z0-9_-]{20,}$/.test(rawMsgText) ||
                        (rawMsgText.startsWith('FA') && rawMsgText.length > 25);

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
                                    #{formatPatientToken({ tokenNumber: msg.tokenNumber })}
                                  </span>
                                </div>

                              </div>
                              <p className="text-[11px] text-[#8A909D] pt-1">{msg.text}</p>
                            </div>
                          </div>
                        );
                      }

                      if (msg.messageType === 'audio' || msg.audioUrl || msg.isVoiceNote || isMediaIdString) {
                        const voiceUrl =
                          msg.audioUrl ||
                          (isMediaIdString ? `/api/whatsapp-audio?media_id=${encodeURIComponent(rawMsgText)}` : undefined);
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isDoctor ? 'justify-end' : 'justify-start'}`}
                          >
                            <AudioVoiceMessagePlayer
                              audioUrl={voiceUrl}
                              isDoctor={isDoctor}
                              timestamp={msg.timestamp}
                            />
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isDoctor ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed break-words [overflow-wrap:anywhere] ${isDoctor
                              ? 'bg-[#2563EB] text-white rounded-tr-xs shadow-2xs'
                              : 'bg-white text-[#16191E] border border-[#ECEEF2] rounded-tl-xs shadow-2xs'
                              }`}
                          >
                            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] break-all">{msg.text}</p>
                            <span
                              className={`text-[9px] block text-right mt-1.5 ${isDoctor ? 'text-blue-100' : 'text-[#8A909D]'
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
