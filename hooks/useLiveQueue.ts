'use client';

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { LiveQueuePatient } from "@/types/clinic";
import { enterpriseCLMSService } from "@/lib/enterpriseCLMSService";

export function useLiveQueue(doctorId?: string, date?: string) {
  const [queue, setQueue] = useState<LiveQueuePatient[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Initial Load: Fetched ONLY ONCE on mount
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const cleanItems = await enterpriseCLMSService.fetchActiveQueue(doctorId, date);
      if (cleanItems && Array.isArray(cleanItems)) {
        let hasCabin = false;
        let hasNext = false;

        const mapped: LiveQueuePatient[] = cleanItems.map((item) => {
          const isCabin = item.status === 'In Progress' || item.status === 'In Consultation';
          if (isCabin) hasCabin = true;
          const isNext = !isCabin && !hasNext;
          if (isNext) hasNext = true;

          return {
            queue_token_no: item.token_no,
            appointment_id: item.appointment_id,
            patient_name: item.patient_name,
            phone_number: item.phone,
            age: null,
            gender: null,
            priority: (item.priority === 'Urgent' ? 'Urgent' : 'Normal') as 'Normal' | 'Urgent',
            visit_type: (item.visit_type?.includes('WhatsApp') ? 'WhatsApp Link' : 'Walk-in') as 'Walk-in' | 'WhatsApp Link' | 'WhatsApp Bot',
            status: (isCabin ? 'In Progress' : item.status === 'Completed' ? 'Completed' : 'Waiting') as 'In Progress' | 'Waiting' | 'Completed' | 'Cancelled',
            scheduled_slot: new Date(item.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            estimated_call_time: `${item.wait_time_mins} mins wait`,
            wait_time_mins: item.wait_time_mins,
            is_in_cabin: isCabin,
            is_next: isNext,
          };
        });
        setQueue(mapped);
      }
    } catch (err) {
      console.warn('Error fetching clean active queue:', err);
    } finally {
      setLoading(false);
    }
  }, [doctorId, date]);

  useEffect(() => {
    fetchQueue();

    // 2. Open Persistent WebSocket Channel for Surgical In-Memory Updates (ZERO extra DB fetches)
    const channel = supabase
      .channel(`live-queue-${doctorId || 'all'}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          ...(doctorId ? { filter: `doctor_id=eq.${doctorId}` } : {}),
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const raw = payload.new as Record<string, any>;
            const isCabin = raw.status === 'In Progress' || raw.status === 'In Consultation';
            const scheduledSlot = raw.scheduled_time
              ? new Date(raw.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '10:00 AM';

            const newPatient: LiveQueuePatient = {
              queue_token_no: raw.queue_token_no || 0,
              appointment_id: raw.id,
              patient_name: raw.patient_name || raw.patient?.full_name || 'Patient',
              phone_number: raw.phone || raw.phone_number || raw.patient?.phone_number || '',
              age: raw.age || null,
              gender: raw.gender || null,
              priority: (raw.priority === 'Urgent' ? 'Urgent' : 'Normal') as 'Normal' | 'Urgent',
              visit_type: (raw.visit_type?.includes('WhatsApp') ? 'WhatsApp Link' : 'Walk-in') as 'Walk-in' | 'WhatsApp Link' | 'WhatsApp Bot',
              status: (isCabin ? 'In Progress' : raw.status === 'Completed' ? 'Completed' : 'Waiting') as 'In Progress' | 'Waiting' | 'Completed' | 'Cancelled',
              scheduled_slot: scheduledSlot,
              estimated_call_time: `${raw.wait_time_mins || 0} mins wait`,
              wait_time_mins: raw.wait_time_mins || 0,
              is_in_cabin: isCabin,
              is_next: false,
            };

            setQueue((prev) => {
              if (prev.some((item) => item.appointment_id === newPatient.appointment_id)) {
                return prev;
              }
              const updated = [...prev, newPatient].sort(
                (a, b) => (a.queue_token_no || 0) - (b.queue_token_no || 0)
              );

              let hasNext = false;
              return updated.map((p) => {
                const inCabin = p.status === 'In Progress';
                const isNext = !inCabin && !hasNext;
                if (isNext) hasNext = true;
                return { ...p, is_in_cabin: inCabin, is_next: isNext };
              });
            });
          } else if (payload.eventType === 'UPDATE') {
            const raw = payload.new as Record<string, any>;

            setQueue((prev) => {
              // If status moved to Completed or Cancelled, remove from active queue
              if (['Completed', 'Cancelled'].includes(raw.status)) {
                const remaining = prev.filter((item) => item.appointment_id !== raw.id);
                let hasNext = false;
                return remaining.map((p) => {
                  const inCabin = p.status === 'In Progress';
                  const isNext = !inCabin && !hasNext;
                  if (isNext) hasNext = true;
                  return { ...p, is_in_cabin: inCabin, is_next: isNext };
                });
              }

              const isCabin = raw.status === 'In Progress' || raw.status === 'In Consultation';
              const updated = prev.map((item) => {
                if (item.appointment_id === raw.id) {
                  return {
                    ...item,
                    queue_token_no: raw.queue_token_no ?? item.queue_token_no,
                    status: (isCabin ? 'In Progress' : raw.status || item.status) as 'In Progress' | 'Waiting' | 'Completed' | 'Cancelled',
                    priority: (raw.priority || item.priority) as 'Normal' | 'Urgent',
                    is_in_cabin: isCabin,
                  };
                }
                return item;
              });

              let hasNext = false;
              return updated.map((p) => {
                const inCabin = p.status === 'In Progress';
                const isNext = !inCabin && !hasNext;
                if (isNext) hasNext = true;
                return { ...p, is_in_cabin: inCabin, is_next: isNext };
              });
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Record<string, any>)?.id;
            setQueue((prev) => {
              const remaining = prev.filter((item) => item.appointment_id !== deletedId);
              let hasNext = false;
              return remaining.map((p) => {
                const inCabin = p.status === 'In Progress';
                const isNext = !inCabin && !hasNext;
                if (isNext) hasNext = true;
                return { ...p, is_in_cabin: inCabin, is_next: isNext };
              });
            });
          }
        }
      )
      .subscribe();

    // 3. Clean up WebSocket connection when navigating away
    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId, fetchQueue]);

  return { queue, loading, refetch: fetchQueue };
}

export default useLiveQueue;
