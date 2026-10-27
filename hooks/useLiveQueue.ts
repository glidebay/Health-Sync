import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { LiveQueuePatient } from "@/types/clinic";

export function useLiveQueue(doctorId?: string, date?: string) {
  const [queue, setQueue] = useState<LiveQueuePatient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_live_queue", {
      p_doctor_id: doctorId || null,
      p_date: date || null,
    });
    if (!error && data) {
      setQueue(data as LiveQueuePatient[]);
    }
    setLoading(false);
  }, [doctorId, date]);

  useEffect(() => {
    fetchQueue();

    // Subscribe to live appointment status changes (Inserts, Updates, Deletions)
    const channel = supabase
      .channel("realtime-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          fetchQueue(); // Auto-refresh when any patient is booked, called, or completed
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  return { queue, loading, refetch: fetchQueue };
}
