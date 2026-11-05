import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { LiveQueuePatient } from "@/types/clinic";
import { enterpriseCLMSService } from "@/lib/enterpriseCLMSService";

export function useLiveQueue(doctorId?: string, date?: string) {
  const [queue, setQueue] = useState<LiveQueuePatient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      const cleanItems = await enterpriseCLMSService.fetchActiveQueue(doctorId, date);
      if (cleanItems && Array.isArray(cleanItems)) {
        const mapped: LiveQueuePatient[] = cleanItems.map((item, idx) => {
          const isCabin = item.status === 'In Progress' || item.status === 'In Consultation';
          const isNext = !isCabin && idx === 0;
          return {
            queue_token_no: item.token_no,
            appointment_id: item.appointment_id,
            patient_name: item.patient_name,
            phone_number: item.phone,
            age: null,
            gender: null,
            priority: (item.priority === 'Urgent' ? 'Urgent' : 'Normal') as any,
            visit_type: (item.visit_type?.includes('WhatsApp') ? 'WhatsApp Link' : 'Walk-in') as any,
            status: (isCabin ? 'In Progress' : item.status === 'Completed' ? 'Completed' : 'Waiting') as any,
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

    const channel = supabase
      .channel("realtime-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  return { queue, loading, refetch: fetchQueue };
}
